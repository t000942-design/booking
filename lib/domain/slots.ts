import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { branding } from "@/lib/config/branding";
import type { Slot } from "./types";

const tz = branding.timezone;

/** Today's date string at the venue's timezone, YYYY-MM-DD. */
export function todayAtVenue(now: Date = new Date()): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

/** Format a UTC date to "HH:mm" in venue local time. */
export function venueTime(d: Date): string {
  return formatInTimeZone(d, tz, "HH:mm");
}

/** Format a UTC date to a friendly venue-local date string. */
export function venueDateLabel(d: Date | string): string {
  const date = typeof d === "string" ? parseVenueDate(d) : d;
  return formatInTimeZone(date, tz, "EEE d MMM");
}

/** Convert venue-local YYYY-MM-DD to a UTC midnight Date. */
export function parseVenueDate(date: string): Date {
  return fromZonedTime(`${date} 00:00:00`, tz);
}

/** UTC start of a venue-local slot. */
export function slotStartUtc(date: string, hour: number): Date {
  const hh = String(hour).padStart(2, "0");
  return fromZonedTime(`${date} ${hh}:00:00`, tz);
}

/** UTC end of a venue-local slot. */
export function slotEndUtc(date: string, hour: number): Date {
  const start = slotStartUtc(date, hour);
  return new Date(start.getTime() + branding.slotMinutes * 60_000);
}

/**
 * Generate every operating-hour slot for one pitch on one venue-local date.
 * `taken` / `blocked` are filled by the service layer based on existing data.
 */
export function generateDaySlots(
  date: string,
  pitch: string,
  now: Date = new Date(),
): Slot[] {
  const out: Slot[] = [];
  for (let h = branding.openingHour; h < branding.closingHour; h++) {
    const start = slotStartUtc(date, h);
    const end = slotEndUtc(date, h);
    out.push({
      date,
      hour: h,
      pitch,
      label: `${String(h).padStart(2, "0")}:00`,
      endLabel: `${String(h + 1).padStart(2, "0")}:00`,
      start,
      end,
      taken: false,
      blocked: false,
      blockedId: null,
      blockReason: null,
      inPast: start.getTime() <= now.getTime(),
    });
  }
  return out;
}

/** Next N venue-local dates starting today. */
export function upcomingDates(count = 7, now: Date = new Date()): string[] {
  const today = todayAtVenue(now);
  const start = parseVenueDate(today);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60_000);
    out.push(formatInTimeZone(d, tz, "yyyy-MM-dd"));
  }
  return out;
}
