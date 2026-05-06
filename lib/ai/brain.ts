import { revalidatePath } from "next/cache";
import { z } from "zod";
import { branding } from "@/lib/config/branding";
import {
  cancelBooking,
  createBooking,
  getBookingByRef,
  listBookingsForCustomer,
} from "@/lib/services/bookings";
import { venueDateLabel, venueTime } from "@/lib/domain/slots";
import { formatPrice } from "@/lib/utils/format";
import type { Booking } from "@/lib/domain/types";
import { buildContext, type BuiltContext } from "./contextBuilder";
import { formatHitsForPrompt } from "./knowledge";
import { chatCompletion, OpenRouterError } from "./openrouter";
import type { BookingSummary, ChatMessage } from "./types";

interface Ctx {
  phone?: string;
  name?: string;
}

const PITCH_NAMES = branding.pitches as readonly string[];
const REF_REGEX = new RegExp(`^${branding.bookingPrefix}-[A-Z0-9]{6}$`);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_MIN = branding.openingHour;
const HOUR_MAX = branding.closingHour - 1;

const ActionSchema = z.object({
  kind: z.enum(["book", "cancel", "pay"]),
  label: z.string().min(1).max(60),
  payload: z.object({
    date: z.string().regex(DATE_REGEX).optional(),
    hour: z.number().int().min(HOUR_MIN).max(HOUR_MAX).optional(),
    pitch: z.enum(PITCH_NAMES as [string, ...string[]]).optional(),
    ref: z.string().regex(REF_REGEX).optional(),
  }),
  tone: z.enum(["primary", "danger", "muted"]).optional(),
});

const BookNowSchema = z.object({
  date: z.string().regex(DATE_REGEX),
  hour: z.number().int().min(HOUR_MIN).max(HOUR_MAX),
  pitch: z.enum(PITCH_NAMES as [string, ...string[]]),
});

const CancelNowSchema = z.object({
  ref: z.string().regex(REF_REGEX),
});

const ResponseSchema = z.object({
  content: z.string().min(1).max(1500),
  suggestions: z.array(z.string().min(1).max(60)).max(4).optional(),
  link: z
    .object({
      href: z.string().min(1).max(200),
      label: z.string().min(1).max(60),
    })
    .optional(),
  actions: z.array(ActionSchema).max(3).optional(),
  show_my_bookings: z.boolean().optional(),
  // Auto-execute fields. When set, the server runs the operation BEFORE
  // returning the message; the LLM's "content" is replaced with a server-
  // generated confirmation (or a graceful failure message).
  book_now: BookNowSchema.optional(),
  cancel_now: CancelNowSchema.optional(),
});

export type LlmResponse = z.infer<typeof ResponseSchema>;

/**
 * LLM-driven brain. Returns a ChatMessage with text + widgets. May also
 * place or cancel a booking on the user's behalf when the LLM signals
 * unambiguous intent. Throws so the caller can fall back to rule-based.
 */
export async function think(question: string, ctx: Ctx = {}): Promise<ChatMessage> {
  const built = await buildContext(question, ctx);

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(question, built, ctx);

  const raw = await chatCompletion({
    json: true,
    temperature: 0.5,
    maxTokens: 700,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const parsed = parseAndValidate(raw);

  // ---- Auto-execute book_now -----------------------------------------
  if (parsed.book_now) {
    return await executeBookNow(parsed.book_now, ctx);
  }

  // ---- Auto-execute cancel_now ---------------------------------------
  if (parsed.cancel_now) {
    return await executeCancelNow(parsed.cancel_now, ctx);
  }

  // ---- Standard reply with widgets -----------------------------------
  const message: ChatMessage = {
    role: "assistant",
    content: parsed.content,
  };
  if (parsed.suggestions && parsed.suggestions.length > 0) {
    message.suggestions = parsed.suggestions;
  }
  if (parsed.link) message.link = parsed.link;
  if (parsed.actions && parsed.actions.length > 0) {
    message.actions = parsed.actions.map((a) => ({
      kind: a.kind,
      label: a.label,
      payload: a.payload,
      tone: a.tone,
    }));
  }
  if (parsed.show_my_bookings && ctx.phone) {
    message.bookingList = await fetchUpcomingBookings(ctx.phone);
  }
  return message;
}

// ---------------- Auto-execute helpers ----------------

async function executeBookNow(
  slot: z.infer<typeof BookNowSchema>,
  ctx: Ctx,
): Promise<ChatMessage> {
  if (!ctx.phone) {
    return {
      role: "assistant",
      content: "I need you signed in before I can lock that slot in. Tap Sign in and ask me again.",
    };
  }
  if (!ctx.name) {
    return {
      role: "assistant",
      content:
        "I need a name on the booking — sign out and use Sign Up so I can save it on your account, then tell me again and I'll book it.",
    };
  }

  try {
    const booking = await createBooking({
      customerName: ctx.name,
      customerPhone: ctx.phone,
      date: slot.date,
      hour: slot.hour,
      pitch: slot.pitch,
    });
    safeRevalidate("/book");

    const due = booking.priceFils - booking.discountFils;
    return {
      role: "assistant",
      content: `Done — **${booking.ref}** is yours.\n${booking.pitch} · ${venueDateLabel(booking.slotStart)} · ${venueTime(booking.slotStart)}–${venueTime(booking.slotEnd)}.\nTotal due: ${formatPrice(due, booking.currency)}. Pay on arrival.`,
      bookingList: [toSummary(booking)],
      actions: [
        {
          kind: "cancel",
          label: "Cancel this booking",
          payload: { ref: booking.ref },
          tone: "danger",
        },
      ],
      suggestions: ["My bookings", "Book another slot"],
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "the slot wasn't available";
    return {
      role: "assistant",
      content: `Couldn't lock ${slot.pitch} on ${slot.date} at ${pad2(slot.hour)}:00 — ${reason.toLowerCase()}. Want me to find an alternative?`,
      suggestions: [
        `What's open on ${slot.date}?`,
        "Recommend a pitch",
      ],
      link: { href: `/book?date=${slot.date}`, label: "Open the calendar" },
    };
  }
}

async function executeCancelNow(
  payload: z.infer<typeof CancelNowSchema>,
  ctx: Ctx,
): Promise<ChatMessage> {
  if (!ctx.phone) {
    return {
      role: "assistant",
      content: `Sign in first and I'll cancel ${payload.ref} for you.`,
    };
  }

  const existing = await getBookingByRef(payload.ref);
  if (!existing) {
    return { role: "assistant", content: `I couldn't find a booking with ref ${payload.ref}.` };
  }
  if (existing.customerPhone !== ctx.phone) {
    return {
      role: "assistant",
      content: `Booking ${payload.ref} is on a different account — I can't cancel it from here.`,
    };
  }
  if (existing.status === "CANCELLED") {
    return { role: "assistant", content: `${payload.ref} is already cancelled.` };
  }

  await cancelBooking(payload.ref);
  safeRevalidate("/book");
  safeRevalidate(`/booking/${payload.ref}`);

  return {
    role: "assistant",
    content: `Cancelled **${payload.ref}** — ${existing.pitch} · ${venueDateLabel(existing.slotStart)} · ${venueTime(existing.slotStart)}. The slot is back in the calendar.`,
    suggestions: ["What's open today?", "My bookings"],
  };
}

// ---------------- Prompt construction ----------------

function buildSystemPrompt(): string {
  return `You are "Coach", the AI assistant for ${branding.pitchName}, a 7-a-side football pitch in ${branding.location}. You help customers check availability, book slots, cancel bookings, and answer questions about the venue.

Reply STYLE:
- Conversational, warm, concise. No corporate fluff. No emojis.
- Vary your phrasing — don't sound templated.
- Use the customer's name when you know it. Match their language register (formal/casual).
- If the user asked in Arabic or another language, reply in that language.
- Never invent facts. If the knowledge base + given context don't cover the answer, say so plainly and offer to put them in touch with the owner.

Reply STRUCTURE — return ONLY a single JSON object with these fields:
{
  "content": string,                                 // the spoken reply (markdown-light, max ~6 short lines)
  "suggestions"?: string[],                          // 0–4 short follow-up chips the user can tap
  "link"?: { "href": string, "label": string },     // optional deep-link button (use "/book?date=YYYY-MM-DD" for calendar)
  "actions"?: Action[],                              // up to 3 buttons that perform an action (used when you want the user to confirm with a tap)
  "show_my_bookings"?: boolean,                      // set true to render the user's upcoming bookings as cards (only if MyBookings block is in context)
  "book_now"?: { "date": "YYYY-MM-DD", "hour": int, "pitch": string },   // see BOOK NOW rules below
  "cancel_now"?: { "ref": "${branding.bookingPrefix}-XXXXXX" }            // see CANCEL NOW rules below
}

Where Action is:
{
  "kind": "book" | "cancel" | "pay",
  "label": string,
  "payload": {
    "date"?: "YYYY-MM-DD",
    "hour"?: integer in [${HOUR_MIN}, ${HOUR_MAX}],
    "pitch"?: one of ${PITCH_NAMES.map((p) => `"${p}"`).join(" | ")},
    "ref"?: "${branding.bookingPrefix}-XXXXXX"
  },
  "tone"?: "primary" | "danger" | "muted"
}

BOOK NOW (auto-execute) — set "book_now" ONLY when ALL of these hold:
- The user expressed a clear booking intent in this message ("book me", "reserve", "lock it in", "yes do it", "I want", "أريد أن أحجز", etc.)
- They gave a specific date, hour, AND pitch (or you can infer them unambiguously: e.g. "book Friday 7pm on pitch 1" → date=next Friday, hour=19, pitch="Pitch 1")
- The slot is listed as OPEN in the AVAILABILITY block (not taken, not blocked, not in the past)
- The user is signed in (SESSION block says "Signed in: yes" with a name)
- Hour is in [${HOUR_MIN}, ${HOUR_MAX}] and pitch is one of: ${PITCH_NAMES.map((p) => `"${p}"`).join(", ")}
When you set book_now, the server creates the booking and writes its own confirmation — your "content" field will be REPLACED. So just include a brief best-guess line (e.g. "Locking it in…").
DO NOT also include a "book" action when book_now is set.

If ANY condition fails (slot taken, user not signed in, no name, hour ambiguous, pitch missing) — do NOT set book_now. Instead either:
- Use an "actions" book button so the user confirms with a tap, OR
- Reply in text with options + a /book?date=... link.

CANCEL NOW (auto-execute) — set "cancel_now" ONLY when ALL of these hold:
- The user explicitly asked to cancel (e.g. "cancel KO-ABC123", "drop my Friday booking", "yes cancel it")
- A booking ref of the form ${branding.bookingPrefix}-XXXXXX is referenced (either typed by the user or unambiguously identifiable from "USER'S BOOKINGS")
- The booking exists in USER'S BOOKINGS or REFERENCED BOOKING and is not already CANCELLED

When set, the server cancels and overrides your content. DO NOT also include a "cancel" action when cancel_now is set.

Action RULES (when you DO use the actions array instead of book_now/cancel_now):
- Only propose a "book" action when the slot is OPEN in Availability. Never for fully-booked or past slots.
- Only propose a "cancel" action when the user asked to cancel and the ref appears in their bookings.
- "pay" is currently disabled (online payment off) — never emit pay actions; tell users to settle on arrival.
- If the user gave a specific time + pitch and it's open AND they're signed in with a name → prefer book_now.
- If the user gave a specific time only (no pitch) → propose ONE book action for the first open pitch at that hour.
- If the user gave a date only → list options as text + a /book?date=... link, no action.

NEVER include any text outside the JSON object. NEVER use code fences. Output the JSON object directly.`;
}

function buildUserPrompt(question: string, built: BuiltContext, ctx: Ctx): string {
  const sessionLine = ctx.phone
    ? `Signed in: yes${ctx.name ? ` (name: ${ctx.name})` : " — but NO name on file (cannot book until they Sign Up)"} · phone: ${ctx.phone}`
    : "Signed in: no";
  const intentLine =
    built.intentHints.length > 0
      ? `Detected hints: ${built.intentHints.join(", ")}`
      : "Detected hints: none";

  const parts: string[] = [];
  parts.push(`USER MESSAGE:\n${question}`);
  parts.push(`SESSION:\n${sessionLine}\n${intentLine}`);
  parts.push(`VENUE INFO:\n${built.venueInfo}`);
  parts.push(`ACTIVE DISCOUNTS (today):\n${built.discountsBlock}`);
  parts.push(`KNOWLEDGE BASE MATCHES:\n${formatHitsForPrompt(built.kbHits)}`);

  if (built.availabilityBlock) {
    parts.push(`AVAILABILITY:\n${built.availabilityBlock}`);
  }
  if (built.myBookingsBlock) {
    parts.push(`USER'S BOOKINGS:\n${built.myBookingsBlock}`);
  }
  if (built.bookingByRefBlock) {
    parts.push(`REFERENCED BOOKING:\n${built.bookingByRefBlock}`);
  }

  parts.push(`Write the JSON reply now. Keep "content" short and natural.`);
  return parts.join("\n\n---\n\n");
}

function parseAndValidate(raw: string): LlmResponse {
  // Some models wrap JSON in code fences despite instructions; some free
  // models also dribble a bit of prose around the object.
  let cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    // Salvage: extract the largest top-level {...} block.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      cleaned = match[0];
      try {
        json = JSON.parse(cleaned);
      } catch {
        throw new OpenRouterError(
          `LLM returned invalid JSON: ${cleaned.slice(0, 200)}`,
        );
      }
    } else {
      throw new OpenRouterError(
        `LLM returned invalid JSON: ${cleaned.slice(0, 200)}`,
      );
    }
  }

  const result = ResponseSchema.safeParse(json);
  if (!result.success) {
    throw new OpenRouterError(
      `LLM JSON failed schema: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}

async function fetchUpcomingBookings(phone: string): Promise<BookingSummary[]> {
  const list = await listBookingsForCustomer(phone);
  return list
    .filter((b) => b.status !== "CANCELLED" && b.slotEnd.getTime() >= Date.now())
    .slice(0, 8)
    .map(toSummary);
}

function toSummary(b: Booking): BookingSummary {
  return {
    ref: b.ref,
    pitch: b.pitch,
    date: b.date,
    dateLabel: venueDateLabel(b.slotStart),
    timeLabel: `${venueTime(b.slotStart)}–${venueTime(b.slotEnd)}`,
    status: b.status,
    paymentStatus: b.paymentStatus,
    priceFils: b.priceFils,
    discountFils: b.discountFils,
    currency: b.currency,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * revalidatePath throws when called outside a Next.js request context
 * (e.g. from smoke tests). Cache invalidation must never break the
 * user-visible response, so swallow these errors.
 */
function safeRevalidate(path: string): void {
  try {
    revalidatePath(path);
  } catch {
    // ignore — running outside Next.js context
  }
}
