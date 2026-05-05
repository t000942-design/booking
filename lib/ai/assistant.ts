import { branding } from "@/lib/config/branding";
import {
  parseVenueDate,
  todayAtVenue,
  upcomingDates,
  venueDateLabel,
} from "@/lib/domain/slots";
import { getAllPitchesAvailability } from "@/lib/services/bookings";
import { findDiscountsForDate, listDiscounts } from "@/lib/services/discounts";
import { formatPrice } from "@/lib/utils/format";
import type { ChatMessage } from "./types";

/**
 * Day 1: rule-based assistant ("Coach"). Day 2 swap: replace askAssistant with
 * an LLM call that has tool access to the same services. Same return shape.
 */
export async function askAssistant(question: string): Promise<ChatMessage> {
  const text = question.toLowerCase().trim();
  if (!text) return defaultMessage();

  // 1. Greetings
  if (/\b(hi|hello|hey|salam|hola|yo|sup)\b/.test(text)) {
    return {
      role: "assistant",
      content: `Welcome to ${branding.pitchName}. I can find you a slot, list discounts, or recommend a pitch. Try one of these:`,
      suggestions: [
        "What's open today?",
        "Any discounts?",
        "Book me Friday 7pm",
        "Recommend a pitch",
      ],
    };
  }

  // 2. Discount queries
  if (/\b(discount|deal|promo|offer|sale|cheap|cheaper)s?\b/.test(text)) {
    return discountsMessage();
  }

  // 3. Hours / opening
  if (/\b(open(ing)?|close|hours?|when do you|what time)\b/.test(text) && !/today|tomorrow|tonight/.test(text)) {
    return {
      role: "assistant",
      content: `We're open every day from ${branding.openingHour}:00 to ${branding.closingHour}:00. Slots are 60 minutes, on the hour.`,
      suggestions: ["What's open today?", "Any discounts?"],
    };
  }

  // 4. Location
  if (/\b(where|location|address|map|how to get|directions)\b/.test(text)) {
    return {
      role: "assistant",
      content: `${branding.pitchName} is in ${branding.location}. Owner contact: ${branding.ownerPhone}.`,
      suggestions: ["What's open today?"],
    };
  }

  // 5. Cancel intent
  if (/\b(cancel|delete|undo|drop)\b.*\b(book|reservation|slot)\b/.test(text)) {
    return {
      role: "assistant",
      content: `Need to cancel? Call the owner at ${branding.ownerPhone} at least 2 hours before — they'll handle the refund based on policy.`,
    };
  }

  // 6. Booking intent: try to extract a target slot from natural language
  const target = parseBookingIntent(text);
  if (target) {
    return await bookingSuggestionMessage(target);
  }

  // 7. Tonight / today
  if (/\b(today|tonight|now|this evening)\b/.test(text)) {
    return availabilityMessage(todayAtVenue(), "today");
  }

  // 8. Tomorrow
  if (/\btomorrow\b/.test(text)) {
    const dates = upcomingDates(2);
    return availabilityMessage(dates[1], "tomorrow");
  }

  // 9. Specific weekday → next occurrence
  const dayMatch = matchWeekday(text);
  if (dayMatch !== null) {
    const next = nextDateForWeekday(dayMatch);
    return availabilityMessage(next, venueDateLabel(next));
  }

  // 10. "this week" / "this weekend"
  if (/\bthis\s*weekend\b/.test(text)) {
    return weekendMessage();
  }
  if (/\b(this\s*week|next\s*7\s*days)\b/.test(text)) {
    return upcomingMessage();
  }

  // 11. Recommend a pitch
  if (/\b(recommend|best|pick|which pitch|suggest)\b/.test(text)) {
    return await recommendMessage();
  }

  // 12. Price
  if (/\b(price|cost|how much)\b/.test(text)) {
    return {
      role: "assistant",
      content: `Every slot is ${branding.currency} ${(branding.priceFils / 1000).toFixed(0)} for 60 minutes. Active discounts are auto-applied at checkout.`,
      suggestions: ["Any discounts?", "What's open today?"],
    };
  }

  // 13. Booking instructions
  if (/\b(book|reserve|how to|help me)\b/.test(text)) {
    return {
      role: "assistant",
      content:
        "Pick a green slot in any day card, fill the short form, and pay via MyFatoorah. The whole thing is under 60 seconds.",
      suggestions: [
        "What's open today?",
        "Book me Friday 7pm",
        "Any discounts?",
      ],
    };
  }

  // Default
  return defaultMessage();
}

function defaultMessage(): ChatMessage {
  return {
    role: "assistant",
    content:
      "I can find availability, list discounts, suggest a pitch, or jump you straight to a slot. Try one of these:",
    suggestions: [
      "What's open today?",
      "Any discounts?",
      "Book me Friday 7pm",
      "Recommend a pitch",
    ],
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

interface BookingIntent {
  date: string;
  hour: number | null;
  pitch: string | null;
}

function parseBookingIntent(text: string): BookingIntent | null {
  // Must look like a booking request
  if (!/\b(book|reserve|grab|take|get)\b/.test(text) && !/\b(at|for)\s+\d/.test(text)) {
    return null;
  }

  // Date
  let date: string | null = null;
  if (/\btoday\b|\btonight\b/.test(text)) date = todayAtVenue();
  else if (/\btomorrow\b/.test(text)) date = upcomingDates(2)[1];
  else {
    const wd = matchWeekday(text);
    if (wd !== null) date = nextDateForWeekday(wd);
  }
  if (!date) return null;

  // Hour: 12h or 24h
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

  // Pitch
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
): Promise<ChatMessage> {
  const all = await getAllPitchesAvailability(target.date);

  // If a specific pitch was requested
  if (target.pitch) {
    const slots = all.find((p) => p.pitch === target.pitch)?.slots ?? [];
    if (target.hour !== null) {
      const slot = slots.find((s) => s.hour === target.hour);
      if (slot && !slot.taken && !slot.blocked && !slot.inPast) {
        const q = new URLSearchParams({
          date: target.date,
          pitch: target.pitch,
          hour: String(target.hour),
        });
        return {
          role: "assistant",
          content: `${target.pitch} at ${slot.label} on ${venueDateLabel(target.date)} — yes, that's open. Click below and I'll preselect it for you.`,
          link: { href: `/book?${q.toString()}#details`, label: "Open this slot" },
          suggestions: ["What's open tomorrow?", "Any discounts?"],
        };
      }
      // Specific slot unavailable
      const open = slots.filter((s) => !s.taken && !s.blocked && !s.inPast).slice(0, 4);
      return {
        role: "assistant",
        content:
          open.length === 0
            ? `${target.pitch} is fully booked on ${venueDateLabel(target.date)}.`
            : `${target.pitch} at ${String(target.hour).padStart(2, "0")}:00 isn't available on ${venueDateLabel(target.date)}. Open: ${open
                .map((s) => s.label)
                .join(", ")}.`,
        link: {
          href: `/book?date=${target.date}&pitch=${encodeURIComponent(target.pitch)}`,
          label: `Browse ${target.pitch}`,
        },
      };
    }
  }

  // No specific pitch, optionally specific hour
  if (target.hour !== null) {
    const candidates = all
      .map(({ pitch, slots }) => ({
        pitch,
        slot: slots.find((s) => s.hour === target.hour),
      }))
      .filter((c) => c.slot && !c.slot.taken && !c.slot.blocked && !c.slot.inPast);
    if (candidates.length > 0) {
      const choice = candidates[0]!;
      const q = new URLSearchParams({
        date: target.date,
        pitch: choice.pitch,
        hour: String(target.hour),
      });
      return {
        role: "assistant",
        content: `Found one — ${choice.pitch} at ${String(target.hour).padStart(2, "0")}:00 on ${venueDateLabel(target.date)}.${
          candidates.length > 1
            ? ` (${candidates.length - 1} other pitch${candidates.length === 2 ? "" : "es"} also open at that time.)`
            : ""
        }`,
        link: { href: `/book?${q.toString()}#details`, label: "Take this slot" },
        suggestions: ["Any discounts?", "What's open tomorrow?"],
      };
    }
    return {
      role: "assistant",
      content: `${String(target.hour).padStart(2, "0")}:00 is fully booked on ${venueDateLabel(target.date)} across all 3 pitches.`,
      link: { href: `/book?date=${target.date}`, label: "See alternatives" },
    };
  }

  return availabilityMessage(target.date, venueDateLabel(target.date));
}

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
    suggestions: ["Any discounts?", "Recommend a pitch", "What's open tomorrow?"],
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
      lines.push(
        `• ${d.name} — ${d.percentOff}% off (${d.validFrom} → ${d.validTo})`,
      );
    }
  }
  const upcoming = all.filter((d) => d.validFrom > today);
  if (upcoming.length > 0) {
    lines.push("");
    lines.push("Coming soon:");
    for (const d of upcoming) {
      lines.push(
        `• ${d.name} — ${d.percentOff}% off, starts ${d.validFrom}`,
      );
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Used by the page-level discount badge logic; not exposed in chat directly.
export { findDiscountsForDate };
export { formatPrice };
