import { branding } from "@/lib/config/branding";
import {
  parseVenueDate,
  todayAtVenue,
  upcomingDates,
  venueDateLabel,
  venueTime,
} from "@/lib/domain/slots";
import {
  getAllPitchesAvailability,
  getBookingByRef,
  listBookingsForCustomer,
} from "@/lib/services/bookings";
import { findDiscountsForDate, listDiscounts } from "@/lib/services/discounts";
import { bookingRepository } from "@/lib/storage";
import { formatPrice } from "@/lib/utils/format";
import type { Booking } from "@/lib/domain/types";
import type { BookingSummary, ChatMessage } from "./types";
import { think } from "./brain";

interface Ctx {
  /** Phone of the signed-in customer, if any. */
  phone?: string;
  /** Customer's name from the session, if any. */
  name?: string;
}

/**
 * Coach — primary entrypoint. When OPENROUTER_API_KEY is set, the LLM brain
 * (lib/ai/brain.ts) drives the reply with conversational text + widgets.
 * The rule-based path remains as a failsafe for: (1) no API key configured,
 * (2) LLM error / invalid JSON / timeout, (3) empty input.
 */
export async function askAssistant(
  question: string,
  ctx: Ctx = {},
): Promise<ChatMessage> {
  const text = question.toLowerCase().trim();
  if (!text) return defaultMessage();

  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await think(question, ctx);
    } catch (err) {
      console.warn(
        "[ai] LLM brain failed, falling back to rule-based:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return askAssistantRuleBased(question, ctx);
}

async function askAssistantRuleBased(
  question: string,
  ctx: Ctx = {},
): Promise<ChatMessage> {
  const text = question.toLowerCase().trim();
  if (!text) return defaultMessage();

  // 1. Greetings
  if (/^(hi|hello|hey|salam|hola|yo|sup)\b/.test(text)) {
    return {
      role: "assistant",
      content: `Welcome to ${branding.pitchName}. Tell me what you want — I can book a slot, cancel one, list your bookings, or just answer questions.`,
      suggestions: [
        "What's open today?",
        "Book me Friday 7pm",
        "My bookings",
        "Any discounts?",
      ],
    };
  }

  // 2. Cancel by ref:  "cancel KO-XXXXXX"
  const refMatch = text.match(/\b(ko-[a-z0-9]{6})\b/i);
  if (refMatch && /\b(cancel|drop|delete|undo)\b/.test(text)) {
    return await cancelByRefMessage(refMatch[1].toUpperCase(), ctx);
  }

  // 3. Pay for booking by ref — payments are disabled; settle on arrival.
  if (refMatch && /\b(pay|payment|checkout)\b/.test(text)) {
    return {
      role: "assistant",
      content: `Online payment is off for now — pay ${refMatch[1].toUpperCase()} on arrival when you turn up.`,
    };
  }

  // 4. "my bookings" / "what did i book"
  if (
    /\b(my\s+bookings?|what\s+did\s+i\s+book|my\s+slots?|my\s+reservations?|my\s+games?)\b/.test(
      text,
    )
  ) {
    return await myBookingsMessage(ctx);
  }

  // 5. Discount queries
  if (/\b(discount|deal|promo|offer|sale|cheap|cheaper)s?\b/.test(text)) {
    return discountsMessage();
  }

  // 6. Hours / opening
  if (
    /\b(open(ing)?|close|hours?|when do you|what time)\b/.test(text) &&
    !/today|tomorrow|tonight/.test(text)
  ) {
    return {
      role: "assistant",
      content: `We're open every day from ${branding.openingHour}:00 to ${branding.closingHour}:00. Slots are 60 minutes, on the hour.`,
      suggestions: ["What's open today?", "Any discounts?"],
    };
  }

  // 7. Location
  if (/\b(where|location|address|map|how to get|directions)\b/.test(text)) {
    return {
      role: "assistant",
      content: `${branding.pitchName} is in ${branding.location}. Owner contact: ${branding.ownerPhone}.`,
      suggestions: ["What's open today?"],
    };
  }

  // 8. Booking intent: try to extract a target slot from natural language
  const target = parseBookingIntent(text);
  if (target) {
    return await bookingSuggestionMessage(target, ctx);
  }

  // 9. Tonight / today
  if (/\b(today|tonight|now|this evening)\b/.test(text)) {
    return availabilityMessage(todayAtVenue(), "today");
  }

  // 10. Tomorrow
  if (/\btomorrow\b/.test(text)) {
    const dates = upcomingDates(2);
    return availabilityMessage(dates[1], "tomorrow");
  }

  // 11. Specific weekday → next occurrence
  const dayMatch = matchWeekday(text);
  if (dayMatch !== null) {
    const next = nextDateForWeekday(dayMatch);
    return availabilityMessage(next, venueDateLabel(next));
  }

  // 12. "this week" / "this weekend"
  if (/\bthis\s*weekend\b/.test(text)) return weekendMessage();
  if (/\b(this\s*week|next\s*7\s*days)\b/.test(text)) return upcomingMessage();

  // 13. Recommend a pitch
  if (/\b(recommend|best|pick|which pitch|suggest)\b/.test(text)) {
    return await recommendMessage();
  }

  // 14. Price
  if (/\b(price|cost|how much)\b/.test(text)) {
    return {
      role: "assistant",
      content: `Every slot is ${branding.currency} ${(branding.priceFils / 1000).toFixed(0)} for 60 minutes. Active discounts are auto-applied at checkout.`,
      suggestions: ["Any discounts?", "Book me Friday 7pm"],
    };
  }

  // 15. Booking instructions
  if (/\b(book|reserve|how to)\b/.test(text)) {
    return {
      role: "assistant",
      content:
        "Tell me a day and time and I'll find an open slot — e.g. \"book me Friday 7pm pitch 2\". Or scroll the calendar and tap a green chip.",
      suggestions: [
        "Book me Friday 7pm",
        "Book Saturday morning",
        "What's open today?",
      ],
    };
  }

  return defaultMessage();
}

function defaultMessage(): ChatMessage {
  return {
    role: "assistant",
    content:
      "I can find availability, list your bookings, propose a slot to book, cancel one by ref, list discounts, and recommend a pitch. Try one of these:",
    suggestions: [
      "What's open today?",
      "My bookings",
      "Book me Friday 7pm",
      "Any discounts?",
    ],
  };
}

// ---------------- My bookings ----------------

async function myBookingsMessage(ctx: Ctx): Promise<ChatMessage> {
  if (!ctx.phone) {
    return {
      role: "assistant",
      content: "I'd need to look up your phone — but I don't have a session yet.",
    };
  }
  const list = await listBookingsForCustomer(ctx.phone);
  const upcoming = list
    .filter((b) => b.status !== "CANCELLED" && b.slotEnd.getTime() >= Date.now())
    .slice(0, 8);

  if (upcoming.length === 0) {
    return {
      role: "assistant",
      content: "No upcoming bookings on file. Want me to find you a slot?",
      suggestions: ["What's open today?", "Book me Friday 7pm"],
    };
  }

  return {
    role: "assistant",
    content:
      upcoming.length === 1
        ? "Here's your upcoming booking:"
        : `Here are your ${upcoming.length} upcoming bookings:`,
    bookingList: upcoming.map(toSummary),
  };
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

// ---------------- Cancel / pay by ref ----------------

async function cancelByRefMessage(
  ref: string,
  ctx: Ctx,
): Promise<ChatMessage> {
  const booking = await getBookingByRef(ref);
  if (!booking) {
    return {
      role: "assistant",
      content: `I couldn't find a booking with ref ${ref}.`,
    };
  }
  if (ctx.phone && booking.customerPhone !== ctx.phone) {
    return {
      role: "assistant",
      content: `Booking ${ref} is on a different account. I can't cancel it from here.`,
    };
  }
  if (booking.status === "CANCELLED") {
    return {
      role: "assistant",
      content: `${ref} is already cancelled.`,
    };
  }
  return {
    role: "assistant",
    content: `Cancel **${ref}** — ${booking.pitch} · ${venueDateLabel(booking.slotStart)} · ${venueTime(booking.slotStart)}? This is permanent.`,
    actions: [
      {
        kind: "cancel",
        label: "Cancel this booking",
        payload: { ref },
        tone: "danger",
      },
    ],
  };
}


// ---------------- Booking intent ----------------

interface BookingIntent {
  date: string;
  hour: number | null;
  pitch: string | null;
}

function parseBookingIntent(text: string): BookingIntent | null {
  if (
    !/\b(book|reserve|grab|take|get|schedule)\b/.test(text) &&
    !/\b(at|for)\s+\d/.test(text)
  ) {
    return null;
  }

  let date: string | null = null;
  if (/\btoday\b|\btonight\b/.test(text)) date = todayAtVenue();
  else if (/\btomorrow\b/.test(text)) date = upcomingDates(2)[1];
  else {
    const wd = matchWeekday(text);
    if (wd !== null) date = nextDateForWeekday(wd);
  }
  if (!date) return null;

  let hour: number | null = null;
  const twelve = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const twenty = text.match(/\b(\d{1,2})(?::(\d{2}))?\b(?!\s*(am|pm))/);
  if (twelve) {
    let h = parseInt(twelve[1], 10);
    const mer = twelve[3];
    if (mer === "am") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    hour = h;
  } else if (twenty) {
    const h = parseInt(twenty[1], 10);
    if (h >= branding.openingHour && h < branding.closingHour) hour = h;
  }

  let pitch: string | null = null;
  for (let i = 0; i < branding.pitches.length; i++) {
    if (new RegExp(`pitch\\s*${i + 1}\\b`).test(text)) {
      pitch = branding.pitches[i];
      break;
    }
  }

  return { date, hour, pitch };
}

async function bookingSuggestionMessage(
  target: BookingIntent,
  ctx: Ctx,
): Promise<ChatMessage> {
  const all = await getAllPitchesAvailability(target.date);
  const discounts = await findDiscountsForDate(target.date);

  // Specific pitch + hour
  if (target.pitch && target.hour !== null) {
    const slots = all.find((p) => p.pitch === target.pitch)?.slots ?? [];
    const slot = slots.find((s) => s.hour === target.hour);
    if (slot && !slot.taken && !slot.blocked && !slot.inPast) {
      return makeBookProposal(
        target.pitch,
        target.date,
        target.hour,
        discounts.length > 0 ? discounts[0] : null,
        ctx,
      );
    }
    return slotMissMessage(target, slots);
  }

  // Specific hour, no pitch — find first available pitch
  if (target.hour !== null) {
    const candidate = all.find(({ slots }) =>
      slots.some(
        (s) =>
          s.hour === target.hour && !s.taken && !s.blocked && !s.inPast,
      ),
    );
    if (candidate) {
      return makeBookProposal(
        candidate.pitch,
        target.date,
        target.hour,
        discounts.length > 0 ? discounts[0] : null,
        ctx,
      );
    }
    return {
      role: "assistant",
      content: `${String(target.hour).padStart(2, "0")}:00 is fully booked on ${venueDateLabel(target.date)} across all 3 pitches.`,
      link: { href: `/book?date=${target.date}`, label: "See alternatives" },
    };
  }

  // Specific pitch only — list its open hours
  if (target.pitch) {
    const slots = all.find((p) => p.pitch === target.pitch)?.slots ?? [];
    const open = slots.filter((s) => !s.taken && !s.blocked && !s.inPast);
    if (open.length === 0) {
      return {
        role: "assistant",
        content: `${target.pitch} is fully booked on ${venueDateLabel(target.date)}.`,
        link: { href: `/book?date=${target.date}`, label: "Try another day" },
      };
    }
    return {
      role: "assistant",
      content: `${target.pitch} on ${venueDateLabel(target.date)} — open at: ${open.map((s) => s.label).join(", ")}. Tell me a time and I'll book it.`,
      suggestions: open.slice(0, 3).map(
        (s) => `Book ${target.pitch!.toLowerCase()} at ${s.label}`,
      ),
    };
  }

  return availabilityMessage(target.date, venueDateLabel(target.date));
}

function makeBookProposal(
  pitch: string,
  date: string,
  hour: number,
  discount: { name: string; percentOff: number } | null,
  ctx: Ctx,
): ChatMessage {
  const namePart = ctx.name ? ` for ${ctx.name}` : "";
  const discountSuffix = discount
    ? ` · ${discount.name} −${discount.percentOff}%`
    : "";
  return {
    role: "assistant",
    content: `${pitch} · ${venueDateLabel(date)} · ${String(hour).padStart(2, "0")}:00 is open${namePart}.${discountSuffix} Want me to lock it in?`,
    actions: [
      {
        kind: "book",
        label: "Book this slot",
        payload: { date, hour, pitch },
        tone: "primary",
      },
    ],
    suggestions: ["My bookings", "Any discounts?"],
  };
}

async function slotMissMessage(
  target: BookingIntent,
  slots: { hour: number; label: string; taken: boolean; blocked: boolean; inPast: boolean }[],
): Promise<ChatMessage> {
  const open = slots.filter((s) => !s.taken && !s.blocked && !s.inPast);
  if (open.length === 0) {
    return {
      role: "assistant",
      content: `${target.pitch} is fully booked on ${venueDateLabel(target.date)}.`,
    };
  }
  return {
    role: "assistant",
    content: `${target.pitch} at ${String(target.hour).padStart(2, "0")}:00 isn't available on ${venueDateLabel(target.date)}. Open: ${open
      .slice(0, 4)
      .map((s) => s.label)
      .join(", ")}.`,
    link: {
      href: `/book?date=${target.date}&pitch=${encodeURIComponent(target.pitch ?? "")}`,
      label: `Browse ${target.pitch}`,
    },
  };
}

// ---------------- Availability + discounts + recommendations ----------------

async function availabilityMessage(date: string, label: string): Promise<ChatMessage> {
  const all = await getAllPitchesAvailability(date);
  const lines: string[] = [];
  let total = 0;
  for (const { pitch, slots } of all) {
    const open = slots.filter((s) => !s.taken && !s.blocked && !s.inPast);
    total += open.length;
    if (open.length === 0) {
      lines.push(`• ${pitch}: fully booked`);
    } else {
      const sample = open.slice(0, 4).map((s) => s.label).join(", ");
      const more = open.length > 4 ? `, +${open.length - 4} more` : "";
      lines.push(`• ${pitch}: ${sample}${more}`);
    }
  }
  const header =
    total === 0
      ? `${capitalize(label)} is fully booked.`
      : `${total} slot${total === 1 ? "" : "s"} open ${label}:`;
  return {
    role: "assistant",
    content: [header, ...lines].join("\n"),
    suggestions: ["Book me " + label.split(" ")[0] + " 7pm", "Any discounts?"],
    link: { href: `/book?date=${date}`, label: `See ${label}` },
  };
}

async function recommendMessage(): Promise<ChatMessage> {
  const today = todayAtVenue();
  const all = await getAllPitchesAvailability(today);
  const ranked = all
    .map(({ pitch, slots }) => ({
      pitch,
      open: slots.filter((s) => !s.taken && !s.blocked && !s.inPast).length,
    }))
    .sort((a, b) => b.open - a.open);
  const top = ranked[0];
  if (!top || top.open === 0) {
    return {
      role: "assistant",
      content:
        "All three pitches are fully booked today. Tomorrow is wide open — want me to show you?",
      suggestions: ["What's open tomorrow?"],
    };
  }
  return {
    role: "assistant",
    content: `For today, **${top.pitch}** has the most availability — ${top.open} open slot${top.open === 1 ? "" : "s"}. The other pitches: ${ranked
      .slice(1)
      .map((r) => `${r.pitch} (${r.open})`)
      .join(", ")}.`,
    suggestions: ["What's open today?", "Any discounts?"],
    link: {
      href: `/book?date=${today}&pitch=${encodeURIComponent(top.pitch)}`,
      label: `Browse ${top.pitch}`,
    },
  };
}

async function discountsMessage(): Promise<ChatMessage> {
  const all = (await listDiscounts()).filter((d) => d.active);
  const today = todayAtVenue();
  const live = all.filter((d) => d.validFrom <= today && d.validTo >= today);

  if (live.length === 0 && all.length === 0) {
    return {
      role: "assistant",
      content: "No discounts running right now. Slots are flat-rate KWD 25.",
      suggestions: ["What's open today?", "Recommend a pitch"],
    };
  }

  const lines: string[] = [];
  if (live.length > 0) {
    lines.push("Live now:");
    for (const d of live) {
      lines.push(`• ${d.name} — ${d.percentOff}% off (${d.validFrom} → ${d.validTo})`);
    }
  }
  const upcoming = all.filter((d) => d.validFrom > today);
  if (upcoming.length > 0) {
    lines.push("");
    lines.push("Coming soon:");
    for (const d of upcoming) {
      lines.push(`• ${d.name} — ${d.percentOff}% off, starts ${d.validFrom}`);
    }
  }
  return {
    role: "assistant",
    content: lines.join("\n"),
    suggestions: ["What's open today?", "Recommend a pitch"],
  };
}

async function weekendMessage(): Promise<ChatMessage> {
  const days = upcomingDates(7);
  const weekend = days.filter((d) => {
    const dow = parseVenueDate(d).getUTCDay();
    return dow === 5 || dow === 6;
  });
  if (weekend.length === 0) {
    return availabilityMessage(days[0], venueDateLabel(days[0]));
  }
  const lines: string[] = ["Upcoming weekend availability:"];
  for (const date of weekend.slice(0, 4)) {
    const all = await getAllPitchesAvailability(date);
    const open = all.reduce(
      (sum, p) =>
        sum + p.slots.filter((s) => !s.taken && !s.blocked && !s.inPast).length,
      0,
    );
    lines.push(`• ${venueDateLabel(date)} — ${open} open`);
  }
  return {
    role: "assistant",
    content: lines.join("\n"),
    suggestions: ["Any discounts?", "Recommend a pitch"],
    link: { href: `/book?date=${weekend[0]}`, label: "See the weekend" },
  };
}

async function upcomingMessage(): Promise<ChatMessage> {
  const days = upcomingDates(7);
  const lines: string[] = ["The next 7 days:"];
  for (const date of days) {
    const all = await getAllPitchesAvailability(date);
    const open = all.reduce(
      (sum, p) =>
        sum + p.slots.filter((s) => !s.taken && !s.blocked && !s.inPast).length,
      0,
    );
    lines.push(`• ${venueDateLabel(date)} — ${open} open`);
  }
  return {
    role: "assistant",
    content: lines.join("\n"),
    suggestions: ["Any discounts?", "Book me Friday 7pm"],
    link: { href: `/book`, label: "Open the calendar" },
  };
}

// ---------------- Helpers ----------------

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function matchWeekday(text: string): number | null {
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(text)) return i;
  }
  return null;
}

function nextDateForWeekday(weekday: number, fromIso?: string): string {
  const start = parseVenueDate(fromIso ?? todayAtVenue());
  for (let i = 0; i < 14; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    if (d.getUTCDay() === weekday) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
  }
  return todayAtVenue();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// kept for the page-level discount badge / form helpers
export { findDiscountsForDate, formatPrice, bookingRepository };
