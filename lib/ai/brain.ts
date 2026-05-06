import { z } from "zod";
import { branding } from "@/lib/config/branding";
import { listBookingsForCustomer } from "@/lib/services/bookings";
import { venueDateLabel, venueTime } from "@/lib/domain/slots";
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

const ActionSchema = z.object({
  kind: z.enum(["book", "cancel", "pay"]),
  label: z.string().min(1).max(60),
  payload: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    hour: z
      .number()
      .int()
      .min(branding.openingHour)
      .max(branding.closingHour - 1)
      .optional(),
    pitch: z.enum(PITCH_NAMES as [string, ...string[]]).optional(),
    ref: z
      .string()
      .regex(new RegExp(`^${branding.bookingPrefix}-[A-Z0-9]{6}$`))
      .optional(),
  }),
  tone: z.enum(["primary", "danger", "muted"]).optional(),
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
});

export type LlmResponse = z.infer<typeof ResponseSchema>;

/**
 * LLM-driven brain. Returns a ChatMessage with text + widgets, or throws so
 * the caller can fall back to the rule-based assistant.
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

  // Build the widget message from the validated LLM output.
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

  // The server (not the LLM) populates the actual bookingList. The LLM
  // only asks for it via show_my_bookings.
  if (parsed.show_my_bookings && ctx.phone) {
    message.bookingList = await fetchUpcomingBookings(ctx.phone);
  }

  return message;
}

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
  "actions"?: Action[],                              // up to 3 buttons that perform an action
  "show_my_bookings"?: boolean                       // set true to render the user's upcoming bookings as cards (only if MyBookings block is in context)
}

Where Action is:
{
  "kind": "book" | "cancel" | "pay",
  "label": string,                                   // button text, e.g. "Book Friday 7pm on Pitch 1"
  "payload": {
    "date"?: "YYYY-MM-DD",                          // required for kind=book
    "hour"?: integer in [${branding.openingHour}, ${branding.closingHour - 1}],
    "pitch"?: one of ${PITCH_NAMES.map((p) => `"${p}"`).join(" | ")},
    "ref"?: "${branding.bookingPrefix}-XXXXXX"      // required for kind=cancel and kind=pay
  },
  "tone"?: "primary" | "danger" | "muted"
}

Action RULES:
- Only propose a "book" action when the slot is in the Availability block as OPEN. Never propose a fully-booked or past slot.
- Only propose a "cancel" action when the user explicitly asked to cancel and the ref appears in their bookings.
- "pay" is currently disabled (online payment off) — don't emit pay actions; tell them to settle on arrival.
- If the user gave a specific time + pitch and it's open, propose ONE book action. If they gave only a time, suggest the first open pitch at that hour. If they gave a date only, list options as text + a link, no action.

NEVER include any text outside the JSON object. NEVER use code fences. Output the JSON object directly.`;
}

function buildUserPrompt(question: string, built: BuiltContext, ctx: Ctx): string {
  const sessionLine = ctx.phone
    ? `Signed in: yes${ctx.name ? ` (name: ${ctx.name})` : ""} · phone: ${ctx.phone}`
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

  parts.push(
    `Write the JSON reply now. Keep "content" short and natural.`,
  );
  return parts.join("\n\n---\n\n");
}

function parseAndValidate(raw: string): LlmResponse {
  // Some models wrap JSON in code fences despite instructions.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new OpenRouterError(`LLM returned invalid JSON: ${cleaned.slice(0, 200)}`);
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
