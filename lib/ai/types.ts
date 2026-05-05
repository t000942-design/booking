export interface BookingSummary {
  ref: string;
  pitch: string;
  /** YYYY-MM-DD venue-local */
  date: string;
  /** Display label, e.g. "Tue 6 May" */
  dateLabel: string;
  /** "HH:00" */
  timeLabel: string;
  status: string;
  paymentStatus: string;
  priceFils: number;
  discountFils: number;
  currency: string;
}

export interface ChatAction {
  kind: "book" | "cancel" | "pay";
  label: string;
  /** Server-side payload for the action handler. */
  payload: {
    date?: string;
    hour?: number;
    pitch?: string;
    ref?: string;
  };
  /** Optional css tone hint for the UI button. */
  tone?: "primary" | "danger" | "muted";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Optional structured suggestions the UI can render as chips. */
  suggestions?: string[];
  /** Optional deep-link the UI can render as a "Go" button. */
  link?: { href: string; label: string };
  /** Optional inline action buttons that trigger a server action. */
  actions?: ChatAction[];
  /** Optional list of bookings to render as cards in the message. */
  bookingList?: BookingSummary[];
}

export interface ScheduleCommand {
  action: "block" | "unblock";
  weekdays: number[];
  pitches: string[];
  startHour: number;
  endHour: number;
  weeks: number;
  reason: string | null;
}

export interface ScheduleSlotChange {
  date: string;
  hour: number;
  pitch: string;
  action: "block" | "unblock";
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
