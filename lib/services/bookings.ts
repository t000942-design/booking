import { branding } from "@/lib/config/branding";
import { generateDaySlots, todayAtVenue } from "@/lib/domain/slots";
import type {
  BlockedSlot,
  Booking,
  RefundOptions,
  Slot,
} from "@/lib/domain/types";
import { createBookingSchema, type CreateBookingDTO } from "@/lib/domain/validation";
import { bookingRepository, SlotUnavailableError } from "@/lib/storage";

export class BookingValidationError extends Error {
  constructor(public issues: { path: string; message: string }[]) {
    super("Booking validation failed");
    this.name = "BookingValidationError";
  }
}

export async function createBooking(input: unknown): Promise<Booking> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    throw new BookingValidationError(
      parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    );
  }
  const dto: CreateBookingDTO = parsed.data;
  const { computeDiscountFils, findApplicableDiscount } = await import(
    "./discounts"
  );
  const discount = await findApplicableDiscount(dto.date, dto.pitch);
  const discountFils = discount
    ? computeDiscountFils(branding.priceFils, discount.percentOff)
    : 0;
  return bookingRepository.create({
    ...dto,
    priceFils: branding.priceFils,
    currency: branding.currency,
    discountFils,
    discountName: discount?.name ?? null,
  });
}

export async function getBookingByRef(ref: string): Promise<Booking | null> {
  return bookingRepository.findByRef(ref);
}

export async function listTodaysBookings(now: Date = new Date()): Promise<Booking[]> {
  return bookingRepository.list({ date: todayAtVenue(now) });
}

export async function listBookingsForDate(date: string): Promise<Booking[]> {
  return bookingRepository.list({ date });
}

export async function listBookingsForCustomer(
  phone: string,
): Promise<Booking[]> {
  const all = await bookingRepository.list();
  return all
    .filter((b) => b.customerPhone === phone)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Slots for one pitch on one date, with taken/blocked/inPast filled in. */
export async function getDayAvailability(
  date: string,
  pitch: string,
  now: Date = new Date(),
): Promise<Slot[]> {
  const baseSlots = generateDaySlots(date, pitch, now);
  const [taken, blocks] = await Promise.all([
    bookingRepository.list({
      date,
      pitch,
      status: ["PENDING", "CONFIRMED", "DONE"],
    }),
    bookingRepository.listBlockedSlots({ date, pitch }),
  ]);
  const takenSet = new Set(taken.map((b) => b.hour));
  const blocksByHour = new Map<number, BlockedSlot>();
  for (const b of blocks) blocksByHour.set(b.hour, b);

  return baseSlots.map((s) => {
    const block = blocksByHour.get(s.hour);
    return {
      ...s,
      taken: takenSet.has(s.hour),
      blocked: Boolean(block),
      blockedId: block?.id ?? null,
      blockReason: block?.reason ?? null,
    };
  });
}

/** Slots for ALL pitches on one date — keyed by pitch name. */
export async function getAllPitchesAvailability(
  date: string,
  now: Date = new Date(),
): Promise<{ pitch: string; slots: Slot[] }[]> {
  return Promise.all(
    branding.pitches.map(async (pitch) => ({
      pitch,
      slots: await getDayAvailability(date, pitch, now),
    })),
  );
}

export async function markBookingDone(ref: string): Promise<Booking | null> {
  return bookingRepository.updateStatus(ref, "DONE");
}

export async function cancelBooking(ref: string): Promise<Booking | null> {
  return bookingRepository.updateStatus(ref, "CANCELLED");
}

export async function blockSlot(
  date: string,
  hour: number,
  pitch: string,
  reason: string | null = null,
): Promise<BlockedSlot> {
  return bookingRepository.blockSlot(date, hour, pitch, reason);
}

export async function unblockSlot(id: string): Promise<boolean> {
  return bookingRepository.unblockSlot(id);
}

export async function refundBooking(
  ref: string,
  options: RefundOptions,
): Promise<Booking | null> {
  const existing = await bookingRepository.findByRef(ref);
  if (!existing) return null;
  let amount: number;
  if (options.full) {
    amount = existing.priceFils - existing.refundFils;
  } else if (typeof options.amountFils === "number") {
    amount = options.amountFils;
  } else if (typeof options.fraction === "number") {
    amount = Math.round(existing.priceFils * options.fraction);
  } else {
    amount = 0;
  }
  amount = Math.min(Math.max(0, amount), existing.priceFils - existing.refundFils);
  return bookingRepository.applyRefund(ref, amount, options.full);
}

export { SlotUnavailableError };
