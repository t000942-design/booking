import type {
  BlockedSlot,
  Booking,
  BookingStatus,
  CreateBookingInput,
} from "@/lib/domain/types";

export interface BookingFilter {
  date?: string;
  pitch?: string;
  status?: BookingStatus | BookingStatus[];
  query?: string;
}

export interface BlockedSlotFilter {
  date?: string;
  pitch?: string;
}

/**
 * Storage interface. Day 1: in-memory. Day 2: Prisma. The interface stays.
 */
export interface BookingRepository {
  // Bookings
  create(input: CreateBookingInput & { priceFils: number; currency: string }): Promise<Booking>;
  findByRef(ref: string): Promise<Booking | null>;
  list(filter?: BookingFilter): Promise<Booking[]>;
  isSlotTaken(date: string, hour: number, pitch: string): Promise<boolean>;
  updateStatus(ref: string, status: BookingStatus): Promise<Booking | null>;
  applyRefund(
    ref: string,
    refundFils: number,
    fullRefund: boolean,
  ): Promise<Booking | null>;

  // Payments
  markPaid(ref: string, paymentRef: string): Promise<Booking | null>;
  markPaymentFailed(ref: string): Promise<Booking | null>;

  // Blocked slots
  blockSlot(
    date: string,
    hour: number,
    pitch: string,
    reason: string | null,
  ): Promise<BlockedSlot>;
  unblockSlot(id: string): Promise<boolean>;
  listBlockedSlots(filter?: BlockedSlotFilter): Promise<BlockedSlot[]>;
  isSlotBlocked(date: string, hour: number, pitch: string): Promise<BlockedSlot | null>;
}
