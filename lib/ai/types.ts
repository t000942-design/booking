export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Optional structured suggestions the UI can render as chips. */
  suggestions?: string[];
  /** Optional deep-link the UI can render as a "Go" button. */
  link?: { href: string; label: string };
}

export interface ScheduleCommand {
  action: "block" | "unblock";
  /** Which days of week (0=Sun … 6=Sat) the rule targets. */
  weekdays: number[];
  /** Which pitches the rule targets. Empty = all pitches. */
  pitches: string[];
  /** Inclusive start hour, exclusive end hour (24h, venue local). */
  startHour: number;
  endHour: number;
  /** How many weeks forward from today the rule applies. */
  weeks: number;
  /** Free-text reason to attach to created blocks. */
  reason: string | null;
}

export interface ScheduleSlotChange {
  date: string;
  hour: number;
  pitch: string;
  /** What this row will do when applied. */
  action: "block" | "unblock";
  /** True if the slot is already in the desired state (no-op). */
  alreadyApplied: boolean;
}

export interface SchedulePlan {
  command: ScheduleCommand;
  changes: ScheduleSlotChange[];
  warnings: string[];
}

export type ScheduleParseResult =
  | { ok: true; plan: SchedulePlan }
  | { ok: false; error: string; hint?: string };
