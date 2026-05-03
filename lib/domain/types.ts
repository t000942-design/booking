export type BookingStatus = "PENDING" | "CONFIRMED" | "DONE" | "CANCELLED";

export interface Booking {
  id: string;
  ref: string;
  customerName: string;
  customerPhone: string;
  teamName: string | null;
  notes: string | null;
  /** Local date at venue, YYYY-MM-DD */
  date: string;
  /** Local hour at venue, 0-23 */
  hour: number;
  /** Which pitch was booked, e.g. "Pitch 1". */
  pitch: string;
  /** UTC instant of slot start */
  slotStart: Date;
  /** UTC instant of slot end */
  slotEnd: Date;
  priceFils: number;
  currency: string;
  status: BookingStatus;
  /** Total amount refunded so far (full or partial). 0 if none. */
  refundFils: number;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockedSlot {
  id: string;
  date: string;
  hour: number;
  pitch: string;
  reason: string | null;
  createdAt: Date;
}

export interface Slot {
  /** YYYY-MM-DD at venue */
  date: string;
  /** 0-23 at venue */
  hour: number;
  /** Which pitch this availability is for */
  pitch: string;
  /** "HH:00" */
  label: string;
  /** Slot end label "HH:00" */
  endLabel: string;
  /** UTC instant */
  start: Date;
  /** UTC instant */
  end: Date;
  /** A booking exists for this slot. */
  taken: boolean;
  /** Admin has blocked this slot from being booked. */
  blocked: boolean;
  /** Block id (if blocked), so admin can unblock. */
  blockedId: string | null;
  blockReason: string | null;
  inPast: boolean;
}

export interface CreateBookingInput {
  customerName: string;
  customerPhone: string;
  teamName?: string | null;
  notes?: string | null;
  date: string;
  hour: number;
  pitch: string;
}

export interface RefundOptions {
  full: boolean;
  /** When `full` is false: either explicit amount in fils or a fraction of the price. */
  amountFils?: number;
  fraction?: number;
}
