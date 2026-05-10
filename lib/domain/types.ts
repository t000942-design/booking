export type BookingStatus = "PENDING" | "CONFIRMED" | "DONE" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PAID" | "FAILED";

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
  /** Discount applied at booking time (in fils). 0 if none. */
  discountFils: number;
  /** Name of the discount that was applied, e.g. "Black Friday". */
  discountName: string | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paidAt: Date | null;
  /** Reference returned by the payment gateway (MyFatoorah InvoiceId, etc.). */
  paymentRef: string | null;
  /** Total amount refunded so far (full or partial). 0 if none. */
  refundFils: number;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A promotional discount applied automatically at booking time.
 * Stored in the same in-memory repo today; promoted to a real table on Day 2.
 */
export interface Discount {
  id: string;
  name: string;
  description: string | null;
  /** 1–100. Applied as a percentage off the listed slot price. */
  percentOff: number;
  /** YYYY-MM-DD inclusive. */
  validFrom: string;
  validTo: string;
  /** Empty = all days; otherwise 0..6 (Sun..Sat). */
  daysOfWeek: number[];
  /** Empty = all pitches; otherwise pitch names. */
  pitches: string[];
  /** Optional coupon code. When present, this discount is NOT auto-applied —
   *  the customer has to enter the code on the checkout page to redeem it. */
  code: string | null;
  active: boolean;
  createdAt: Date;
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
