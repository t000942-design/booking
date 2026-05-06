import { branding } from "@/lib/config/branding";
import {
  parseVenueDate,
  todayAtVenue,
  upcomingDates,
  venueDateLabel,
} from "@/lib/domain/slots";
import {
  getAllPitchesAvailability,
  getBookingByRef,
  listBookingsForCustomer,
} from "@/lib/services/bookings";
import { listDiscounts } from "@/lib/services/discounts";
import { searchKnowledgeBase, type KbHit } from "./knowledge";
import type { Booking } from "@/lib/domain/types";

export interface BuiltContext {
  /** Venue facts the LLM should know unconditionally. */
  venueInfo: string;
  /** Active discounts (today). */
  discountsBlock: string;
  /** Top-N KB matches for the user's question. */
  kbHits: KbHit[];
  /** Availability snapshot for the date(s) the user mentioned, if any. */
  availabilityBlock: string | null;
  /** The user's current bookings, if logged in and asking. */
  myBookingsBlock: string | null;
  /** A specific booking by ref (when user mentions one). */
  bookingByRefBlock: string | null;
  /** Detected intent hints for the LLM. */
  intentHints: string[];
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

interface BuildOpts {
  /** Phone of the signed-in customer, if any. */
  phone?: string;
  /** Customer's name from session, if any. */
  name?: string;
}

export async function buildContext(
  question: string,
  opts: BuildOpts = {},
): Promise<BuiltContext> {
  const text = question.toLowerCase();

  const intentHints: string[] = [];
  const today = todayAtVenue();

  // ---- Always-on context ------------------------------------------------
  const venueInfo = formatVenueInfo();
  const discounts = (await listDiscounts()).filter(
    (d) => d.active && d.validFrom <= today && d.validTo >= today,
  );
  const discountsBlock =
    discounts.length === 0
      ? "(no discounts running today)"
      : discounts
          .map((d) => `- ${d.name}: ${d.percentOff}% off (valid ${d.validFrom} → ${d.validTo})`)
          .join("\n");

  // ---- Knowledge base ---------------------------------------------------
  const kbHits = await searchKnowledgeBase(question, 3);
  if (kbHits.length > 0) intentHints.push("kb_match");

  // ---- Date(s) the user mentioned --------------------------------------
  const targetDates = extractDates(text);
  let availabilityBlock: string | null = null;
  if (targetDates.length > 0) {
    intentHints.push("date_mentioned");
    const blocks: string[] = [];
    for (const date of targetDates.slice(0, 2)) {
      blocks.push(await formatAvailability(date));
    }
    availabilityBlock = blocks.join("\n\n");
  }

  // ---- Booking ref reference --------------------------------------------
  const refMatch = text.match(/\b(ko-[a-z0-9]{6})\b/i);
  let bookingByRefBlock: string | null = null;
  if (refMatch) {
    const booking = await getBookingByRef(refMatch[1].toUpperCase());
    bookingByRefBlock = booking
      ? formatBooking(booking, opts.phone)
      : `Booking ${refMatch[1].toUpperCase()} not found.`;
    intentHints.push("ref_mentioned");
  }

  // ---- "my bookings" / possessive ---------------------------------------
  let myBookingsBlock: string | null = null;
  const wantsOwn =
    /\b(my\s+bookings?|my\s+slots?|my\s+reservations?|my\s+games?|what\s+did\s+i\s+book)\b/.test(
      text,
    );
  if (wantsOwn && opts.phone) {
    const list = await listBookingsForCustomer(opts.phone);
    const upcoming = list
      .filter((b) => b.status !== "CANCELLED" && b.slotEnd.getTime() >= Date.now())
      .slice(0, 8);
    myBookingsBlock =
      upcoming.length === 0
        ? "(no upcoming bookings on file)"
        : upcoming.map((b) => formatBooking(b, opts.phone)).join("\n");
    intentHints.push("my_bookings");
  } else if (wantsOwn && !opts.phone) {
    myBookingsBlock = "(user is not signed in — cannot look up their bookings)";
    intentHints.push("my_bookings_no_session");
  }

  // ---- Booking intent ---------------------------------------------------
  if (/\b(book|reserve|grab|take|schedule|lock\s+in)\b/.test(text)) {
    intentHints.push("book_intent");
  }
  if (/\b(cancel|drop|delete|undo)\b/.test(text)) {
    intentHints.push("cancel_intent");
  }
  if (/\b(recommend|best|pick|suggest)\b/.test(text)) {
    intentHints.push("recommend_intent");
  }

  return {
    venueInfo,
    discountsBlock,
    kbHits,
    availabilityBlock,
    myBookingsBlock,
    bookingByRefBlock,
    intentHints,
  };
}

// ---------------- Helpers ----------------

function formatVenueInfo(): string {
  return [
    `Name: ${branding.pitchName} (${branding.tagline})`,
    `Location: ${branding.location}`,
    `Owner: ${branding.ownerName} · ${branding.ownerPhone} · ${branding.ownerEmail}`,
    `Hours: ${branding.openingHour}:00–${branding.closingHour}:00 daily, slots are ${branding.slotMinutes} min on the hour`,
    `Price: ${branding.currency} ${(branding.priceFils / 1000).toFixed(0)} per slot`,
    `Pitches: ${branding.pitches
      .map((p) => `${p} (${branding.pitchTaglines[p] ?? ""})`)
      .join("; ")}`,
    `Today (venue local): ${today_label()}`,
  ].join("\n");
}

function today_label(): string {
  const t = todayAtVenue();
  return `${t} = ${venueDateLabel(t)}`;
}

function extractDates(text: string): string[] {
  const out: string[] = [];
  if (/\btoday\b|\btonight\b|\bnow\b|\bthis\s*evening\b/.test(text)) {
    out.push(todayAtVenue());
  }
  if (/\btomorrow\b/.test(text)) {
    out.push(upcomingDates(2)[1]);
  }
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(text)) {
      out.push(nextDateForWeekday(i));
    }
  }
  if (/\bthis\s*weekend\b/.test(text)) {
    const days = upcomingDates(7);
    for (const d of days) {
      const dow = parseVenueDate(d).getUTCDay();
      if (dow === 5 || dow === 6) out.push(d);
    }
  }
  // Dedupe while preserving order.
  return Array.from(new Set(out));
}

function nextDateForWeekday(weekday: number): string {
  const start = parseVenueDate(todayAtVenue());
  for (let i = 0; i < 14; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    if (d.getUTCDay() === weekday) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
  }
  return todayAtVenue();
}

async function formatAvailability(date: string): Promise<string> {
  const all = await getAllPitchesAvailability(date);
  const lines = [`Availability for ${date} (${venueDateLabel(date)}):`];
  for (const { pitch, slots } of all) {
    const open = slots.filter((s) => !s.taken && !s.blocked && !s.inPast);
    if (open.length === 0) {
      lines.push(`  - ${pitch}: fully booked`);
    } else {
      lines.push(
        `  - ${pitch}: open at ${open.map((s) => s.label).join(", ")}`,
      );
    }
  }
  return lines.join("\n");
}

function formatBooking(b: Booking, sessionPhone?: string): string {
  const own = sessionPhone && b.customerPhone === sessionPhone ? " (yours)" : "";
  return `- ${b.ref}${own}: ${b.pitch} · ${b.date} ${String(b.hour).padStart(2, "0")}:00 · status=${b.status} · paid=${b.paymentStatus}`;
}
