import { branding } from "@/lib/config/branding";
import { todayAtVenue } from "@/lib/domain/slots";
import type { ScheduleCommand, ScheduleParseResult } from "./types";

/**
 * Day 1: a deliberately small rule-based parser. Day 2 swap: replace this
 * function with an LLM call (Claude / GPT) that returns the same shape.
 */
const WEEKDAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const PITCH_BY_DIGIT: Record<string, string | undefined> = Object.fromEntries(
  branding.pitches.map((p, idx) => [String(idx + 1), p]),
);

export function parseScheduleCommand(input: string): ScheduleParseResult {
  const text = input.toLowerCase().trim();
  if (!text) return { ok: false, error: "Type a command first." };

  // Action
  let action: ScheduleCommand["action"] = "block";
  if (/\b(unblock|open|reopen|release|free)\b/.test(text)) action = "unblock";
  else if (!/\b(block|close|reserve|hold|maintenance)\b/.test(text)) {
    return {
      ok: false,
      error: "I couldn't tell if you want to block or unblock.",
      hint: "Try: \"Block Friday 6-8pm next 2 weeks\"",
    };
  }

  // Weekdays
  const weekdays = new Set<number>();
  for (const [name, idx] of Object.entries(WEEKDAY_NAMES)) {
    if (new RegExp(`\\b${name}s?\\b`).test(text)) weekdays.add(idx);
  }
  if (/\bweekend(s)?\b/.test(text)) {
    weekdays.add(5);
    weekdays.add(6);
  }
  if (/\bweek\s*day(s)?\b/.test(text)) {
    [0, 1, 2, 3, 4].forEach((d) => weekdays.add(d));
  }
  if (/\b(every\s*day|all\s*week|daily)\b/.test(text)) {
    [0, 1, 2, 3, 4, 5, 6].forEach((d) => weekdays.add(d));
  }
  if (weekdays.size === 0) {
    return {
      ok: false,
      error: "Tell me which day(s) — e.g. Monday, weekends, every day.",
    };
  }

  // Hours: "6-8pm", "6pm to 8pm", "18:00 to 20:00", "from 6 to 8 pm"
  const hourRange = matchHourRange(text);
  if (!hourRange) {
    return {
      ok: false,
      error: "Tell me the time window — e.g. 6-8pm or 18:00-20:00.",
    };
  }
  let { startHour, endHour } = hourRange;
  if (startHour < branding.openingHour) startHour = branding.openingHour;
  if (endHour > branding.closingHour) endHour = branding.closingHour;
  if (startHour >= endHour) {
    return {
      ok: false,
      error: `Time window is outside operating hours (${branding.openingHour}:00–${branding.closingHour}:00).`,
    };
  }

  // Weeks: "next 2 weeks", "for 3 weeks", "this week"
  let weeks = 1;
  const weekMatch = text.match(/\b(\d+)\s*week/);
  if (weekMatch) weeks = Math.min(12, Math.max(1, parseInt(weekMatch[1], 10)));
  else if (/\bnext\s+month\b/.test(text)) weeks = 4;

  // Pitches: "pitch 1", "pitches 2 and 3", "all pitches"
  const pitches: string[] = [];
  for (const [digit, name] of Object.entries(PITCH_BY_DIGIT)) {
    if (!name) continue;
    if (new RegExp(`pitch\\s*${digit}\\b`).test(text)) pitches.push(name);
  }
  if (pitches.length === 0) {
    pitches.push(...branding.pitches);
  }

  // Reason
  const reasonMatch = text.match(/(?:reason|because|for)\s+(.+)$/);
  const reason =
    reasonMatch && !reasonMatch[1].match(/^\d+\s*week/)
      ? reasonMatch[1].trim()
      : action === "block"
      ? "Closed"
      : null;

  return {
    ok: true,
    plan: {
      command: {
        action,
        weekdays: Array.from(weekdays).sort(),
        pitches,
        startHour,
        endHour,
        weeks,
        reason,
      },
      changes: [],
      warnings: [],
    },
  };
}

function matchHourRange(text: string): { startHour: number; endHour: number } | null {
  // 24-hour "18:00-20:00" or "18-20"
  const twentyFour = text.match(/\b(\d{1,2})(?::00)?\s*(?:to|-|–)\s*(\d{1,2})(?::00)?\b/);
  // 12-hour "6-8pm" or "6pm to 8pm" or "6 to 8 pm"
  const twelveHour = text.match(
    /\b(\d{1,2})(?::00)?\s*(am|pm)?\s*(?:to|-|–)\s*(\d{1,2})(?::00)?\s*(am|pm)\b/,
  );

  if (twelveHour) {
    let s = parseInt(twelveHour[1], 10);
    let e = parseInt(twelveHour[3], 10);
    const startMer = twelveHour[2] ?? twelveHour[4];
    const endMer = twelveHour[4];
    s = to24h(s, startMer);
    e = to24h(e, endMer);
    return { startHour: s, endHour: e };
  }
  if (twentyFour) {
    return {
      startHour: parseInt(twentyFour[1], 10),
      endHour: parseInt(twentyFour[2], 10),
    };
  }
  return null;
}

function to24h(h: number, mer?: string): number {
  if (!mer) return h;
  if (mer === "am") return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

/** Expand a parsed ScheduleCommand into concrete (date, hour, pitch) tuples. */
export function expandSchedulePlan(command: ScheduleCommand): {
  date: string;
  hour: number;
  pitch: string;
}[] {
  const out: { date: string; hour: number; pitch: string }[] = [];
  const today = todayAtVenue();
  const [y, m, d] = today.split("-").map(Number);
  const startDate = new Date(Date.UTC(y, m - 1, d));

  const horizonDays = command.weeks * 7;
  for (let i = 0; i < horizonDays; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    if (!command.weekdays.includes(date.getUTCDay())) continue;
    const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    for (let h = command.startHour; h < command.endHour; h++) {
      for (const pitch of command.pitches) {
        out.push({ date: dateStr, hour: h, pitch });
      }
    }
  }
  return out;
}
