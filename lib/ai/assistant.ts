import { branding } from "@/lib/config/branding";
import { todayAtVenue, upcomingDates, venueDateLabel } from "@/lib/domain/slots";
import { getAllPitchesAvailability } from "@/lib/services/bookings";
import type { ChatMessage } from "./types";

/**
 * Day 1: rule-based assistant ("Coach"). Day 2 swap: replace this with an
 * LLM call that has tool access to the same `getAllPitchesAvailability`
 * service. Same return shape.
 */
export async function askAssistant(question: string): Promise<ChatMessage> {
  const text = question.toLowerCase().trim();

  if (!text) {
    return defaultMessage();
  }

  // Greetings
  if (/\b(hi|hello|hey|salam|hola)\b/.test(text)) {
    return {
      role: "assistant",
      content: `Welcome to ${branding.pitchName}. I can help you find an open slot or pick a pitch.`,
      suggestions: ["What's open today?", "Cheapest time", "Recommend a pitch"],
    };
  }

  // Price
  if (/\b(price|cost|how much|cheap|cheapest|expensive)\b/.test(text)) {
    return {
      role: "assistant",
      content: `Every slot is a flat ${branding.currency} ${(branding.priceFils / 1000).toFixed(0)} for 60 minutes — same price across all three pitches.`,
      suggestions: ["What's open today?", "Recommend a pitch"],
    };
  }

  // Hours
  if (/\b(hour|open|close|when do you|opening|closing)\b/.test(text) && !/today|tomorrow|tonight|tonight/.test(text)) {
    return {
      role: "assistant",
      content: `We're open every day from ${branding.openingHour}:00 to ${branding.closingHour}:00. Slots are 60 minutes, on the hour.`,
      suggestions: ["What's open today?", "What's open tomorrow?"],
    };
  }

  // Location
  if (/\b(where|location|address|how to get|directions)\b/.test(text)) {
    return {
      role: "assistant",
      content: `${branding.pitchName} is in ${branding.location}. Owner contact: ${branding.ownerPhone}.`,
      suggestions: ["What's open today?"],
    };
  }

  // Availability — today / tomorrow / this week
  if (/\b(today|tonight|now|this evening)\b/.test(text)) {
    return availabilityMessage(todayAtVenue(), "today");
  }
  if (/\btomorrow\b/.test(text)) {
    const dates = upcomingDates(2);
    return availabilityMessage(dates[1], "tomorrow");
  }
  if (/\b(open|available|free|when can i|slot)\b/.test(text)) {
    return availabilityMessage(todayAtVenue(), "today");
  }

  // Recommend a pitch
  if (/\b(recommend|best|pick|which pitch|suggest)\b/.test(text)) {
    return await recommendMessage();
  }

  // Booking help
  if (/\b(book|reserve|how to|help me)\b/.test(text)) {
    return {
      role: "assistant",
      content:
        "Easiest way: scroll to a day card on this page, pick a green slot for any pitch, then fill the short form below — no extra clicks.",
      suggestions: ["What's open today?", "Cheapest time"],
    };
  }

  // Default
  return defaultMessage();
}

function defaultMessage(): ChatMessage {
  return {
    role: "assistant",
    content:
      "I can help with availability, prices, the schedule, or recommending a pitch. Try one of these:",
    suggestions: ["What's open today?", "Cheapest time", "Recommend a pitch", "Where are you?"],
  };
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
      ? `${capitalize(label)} (${venueDateLabel(date)}) is fully booked.`
      : `${total} slot${total === 1 ? "" : "s"} open ${label} (${venueDateLabel(date)}):`;
  return {
    role: "assistant",
    content: [header, ...lines].join("\n"),
    suggestions: ["Cheapest time", "Recommend a pitch", "What's open tomorrow?"],
    link: { href: `/book?date=${date}`, label: `See ${label}` },
  };
}

async function recommendMessage(): Promise<ChatMessage> {
  const all = await getAllPitchesAvailability(todayAtVenue());
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
    suggestions: ["What's open today?", "Cheapest time"],
    link: {
      href: `/book?date=${todayAtVenue()}&pitch=${encodeURIComponent(top.pitch)}`,
      label: `Browse ${top.pitch}`,
    },
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
