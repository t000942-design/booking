import type { Discount } from "@/lib/domain/types";
import { bookingRepository } from "@/lib/storage";
import { parseVenueDate } from "@/lib/domain/slots";

export interface DiscountInput {
  name: string;
  description?: string | null;
  percentOff: number;
  validFrom: string;
  validTo: string;
  daysOfWeek?: number[];
  pitches?: string[];
  /** Optional coupon code. If set, the discount is redeem-only. */
  code?: string | null;
}

export class DiscountValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "DiscountValidationError";
  }
}

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export async function createDiscount(input: DiscountInput): Promise<Discount> {
  const name = input.name.trim();
  if (!name) throw new DiscountValidationError("name", "Name is required.");
  if (name.length > 60)
    throw new DiscountValidationError("name", "Name is too long.");

  const percentOff = Math.round(input.percentOff);
  if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
    throw new DiscountValidationError("percentOff", "Percent must be 1–100.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.validFrom))
    throw new DiscountValidationError("validFrom", "Invalid date.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.validTo))
    throw new DiscountValidationError("validTo", "Invalid date.");
  if (input.validTo < input.validFrom)
    throw new DiscountValidationError("validTo", "End must be after start.");

  let code: string | null = null;
  if (input.code && input.code.trim().length > 0) {
    code = normalizeCouponCode(input.code);
    if (!/^[A-Z0-9]{2,32}$/.test(code)) {
      throw new DiscountValidationError(
        "code",
        "Code must be 2–32 letters or digits.",
      );
    }
  }

  return bookingRepository.createDiscount({
    name,
    description: input.description?.trim() || null,
    percentOff,
    validFrom: input.validFrom,
    validTo: input.validTo,
    daysOfWeek: input.daysOfWeek ?? [],
    pitches: input.pitches ?? [],
    code,
    active: true,
  });
}

export async function listDiscounts(): Promise<Discount[]> {
  return bookingRepository.listDiscounts();
}

export async function deleteDiscount(id: string): Promise<boolean> {
  return bookingRepository.deleteDiscount(id);
}

export async function toggleDiscount(
  id: string,
  active: boolean,
): Promise<Discount | null> {
  return bookingRepository.setDiscountActive(id, active);
}

/**
 * Returns the best (largest %) AUTO-APPLIED discount that fits the given
 * (date, pitch) tuple. Discounts with a coupon code are excluded — those
 * have to be redeemed by the customer at checkout.
 */
export async function findApplicableDiscount(
  date: string,
  pitch: string,
): Promise<Discount | null> {
  const all = await bookingRepository.listDiscounts();
  const candidates = all.filter(
    (d) => isApplicable(d, date, pitch) && !d.code,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, d) => (d.percentOff > best.percentOff ? d : best));
}

/** Discounts active for a date (any pitch, auto-only) — for calendar badges. */
export async function findDiscountsForDate(date: string): Promise<Discount[]> {
  const all = await bookingRepository.listDiscounts();
  return all.filter(
    (d) =>
      d.active &&
      !d.code &&
      d.validFrom <= date &&
      d.validTo >= date &&
      (d.daysOfWeek.length === 0 ||
        d.daysOfWeek.includes(parseVenueDate(date).getUTCDay())),
  );
}

/** Look up a coupon by code (case-insensitive) and validate it for a slot. */
export async function findCouponByCode(
  rawCode: string,
  date: string,
  pitch: string,
): Promise<Discount | null> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return null;
  const all = await bookingRepository.listDiscounts();
  const match = all.find((d) => d.code === code);
  if (!match) return null;
  if (!isApplicable(match, date, pitch)) return null;
  return match;
}

function isApplicable(d: Discount, date: string, pitch: string): boolean {
  if (!d.active) return false;
  if (date < d.validFrom || date > d.validTo) return false;
  if (d.pitches.length > 0 && !d.pitches.includes(pitch)) return false;
  if (d.daysOfWeek.length > 0) {
    const dow = parseVenueDate(date).getUTCDay();
    if (!d.daysOfWeek.includes(dow)) return false;
  }
  return true;
}

export function computeDiscountFils(priceFils: number, percentOff: number): number {
  return Math.round((priceFils * percentOff) / 100);
}
