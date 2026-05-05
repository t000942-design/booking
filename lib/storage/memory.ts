import { branding } from "@/lib/config/branding";
import { generateBookingRef } from "@/lib/domain/bookingRef";
import { slotEndUtc, slotStartUtc } from "@/lib/domain/slots";
import type {
  BlockedSlot,
  Booking,
  BookingStatus,
  CreateBookingInput,
  Discount,
} from "@/lib/domain/types";
import type {
  BlockedSlotFilter,
  BookingFilter,
  BookingRepository,
} from "./repository";

const ACTIVE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "DONE"];

export class InMemoryBookingRepository implements BookingRepository {
  private bookings = new Map<string, Booking>();
  private blocks = new Map<string, BlockedSlot>();
  private discounts = new Map<string, Discount>();

  // ----- Bookings -----

  async create(
    input: CreateBookingInput & {
      priceFils: number;
      currency: string;
      discountFils: number;
      discountName: string | null;
    },
  ): Promise<Booking> {
    const taken = await this.isSlotTaken(input.date, input.hour, input.pitch);
    if (taken) {
      throw new SlotUnavailableError(input.date, input.hour, input.pitch, "taken");
    }
    const blocked = await this.isSlotBlocked(input.date, input.hour, input.pitch);
    if (blocked) {
      throw new SlotUnavailableError(input.date, input.hour, input.pitch, "blocked");
    }
    const now = new Date();
    let ref = generateBookingRef();
    while (this.findByRefSync(ref)) ref = generateBookingRef();

    const booking: Booking = {
      id: ref,
      ref,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      teamName: input.teamName ?? null,
      notes: input.notes ?? null,
      date: input.date,
      hour: input.hour,
      pitch: input.pitch,
      slotStart: slotStartUtc(input.date, input.hour),
      slotEnd: slotEndUtc(input.date, input.hour),
      priceFils: input.priceFils,
      currency: input.currency,
      discountFils: input.discountFils,
      discountName: input.discountName,
      status: "PENDING",
      paymentStatus: "UNPAID",
      paidAt: null,
      paymentRef: null,
      refundFils: 0,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.bookings.set(ref, booking);
    return booking;
  }

  async findByRef(ref: string): Promise<Booking | null> {
    return this.findByRefSync(ref);
  }

  async list(filter: BookingFilter = {}): Promise<Booking[]> {
    let rows = Array.from(this.bookings.values());

    if (filter.date) rows = rows.filter((b) => b.date === filter.date);
    if (filter.pitch) rows = rows.filter((b) => b.pitch === filter.pitch);
    if (filter.status) {
      const set = new Set(Array.isArray(filter.status) ? filter.status : [filter.status]);
      rows = rows.filter((b) => set.has(b.status));
    }
    if (filter.query) {
      const q = filter.query.toLowerCase();
      rows = rows.filter(
        (b) =>
          b.ref.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.customerPhone.includes(q) ||
          (b.teamName ?? "").toLowerCase().includes(q),
      );
    }
    return rows.sort((a, b) => {
      const t = a.slotStart.getTime() - b.slotStart.getTime();
      if (t !== 0) return t;
      return a.pitch.localeCompare(b.pitch);
    });
  }

  async isSlotTaken(date: string, hour: number, pitch: string): Promise<boolean> {
    for (const b of this.bookings.values()) {
      if (
        b.date === date &&
        b.hour === hour &&
        b.pitch === pitch &&
        ACTIVE_STATUSES.includes(b.status)
      ) {
        return true;
      }
    }
    return false;
  }

  async updateStatus(ref: string, status: BookingStatus): Promise<Booking | null> {
    const existing = this.findByRefSync(ref);
    if (!existing) return null;
    const updated: Booking = { ...existing, status, updatedAt: new Date() };
    this.bookings.set(ref, updated);
    return updated;
  }

  async markPaid(ref: string, paymentRef: string): Promise<Booking | null> {
    const existing = this.findByRefSync(ref);
    if (!existing) return null;
    const now = new Date();
    const updated: Booking = {
      ...existing,
      paymentStatus: "PAID",
      paidAt: now,
      paymentRef,
      status: existing.status === "PENDING" ? "CONFIRMED" : existing.status,
      updatedAt: now,
    };
    this.bookings.set(ref, updated);
    return updated;
  }

  async markPaymentFailed(ref: string): Promise<Booking | null> {
    const existing = this.findByRefSync(ref);
    if (!existing) return null;
    const updated: Booking = {
      ...existing,
      paymentStatus: "FAILED",
      updatedAt: new Date(),
    };
    this.bookings.set(ref, updated);
    return updated;
  }

  async applyRefund(
    ref: string,
    refundFils: number,
    fullRefund: boolean,
  ): Promise<Booking | null> {
    const existing = this.findByRefSync(ref);
    if (!existing) return null;
    const refundAmount = Math.min(
      Math.max(0, refundFils + existing.refundFils),
      existing.priceFils,
    );
    const updated: Booking = {
      ...existing,
      refundFils: refundAmount,
      refundedAt: new Date(),
      status: fullRefund ? "CANCELLED" : existing.status,
      updatedAt: new Date(),
    };
    this.bookings.set(ref, updated);
    return updated;
  }

  // ----- Blocked slots -----

  async blockSlot(
    date: string,
    hour: number,
    pitch: string,
    reason: string | null,
  ): Promise<BlockedSlot> {
    const existing = await this.isSlotBlocked(date, hour, pitch);
    if (existing) return existing;
    const id = `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const block: BlockedSlot = {
      id,
      date,
      hour,
      pitch,
      reason,
      createdAt: new Date(),
    };
    this.blocks.set(id, block);
    return block;
  }

  async unblockSlot(id: string): Promise<boolean> {
    return this.blocks.delete(id);
  }

  async listBlockedSlots(filter: BlockedSlotFilter = {}): Promise<BlockedSlot[]> {
    let rows = Array.from(this.blocks.values());
    if (filter.date) rows = rows.filter((b) => b.date === filter.date);
    if (filter.pitch) rows = rows.filter((b) => b.pitch === filter.pitch);
    return rows.sort((a, b) => a.hour - b.hour);
  }

  async isSlotBlocked(
    date: string,
    hour: number,
    pitch: string,
  ): Promise<BlockedSlot | null> {
    for (const b of this.blocks.values()) {
      if (b.date === date && b.hour === hour && b.pitch === pitch) return b;
    }
    return null;
  }

  // ----- Discounts -----

  async createDiscount(
    input: Omit<Discount, "id" | "createdAt">,
  ): Promise<Discount> {
    const id = `dsc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const discount: Discount = {
      ...input,
      id,
      createdAt: new Date(),
    };
    this.discounts.set(id, discount);
    return discount;
  }

  async listDiscounts(): Promise<Discount[]> {
    return Array.from(this.discounts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async deleteDiscount(id: string): Promise<boolean> {
    return this.discounts.delete(id);
  }

  async setDiscountActive(id: string, active: boolean): Promise<Discount | null> {
    const existing = this.discounts.get(id);
    if (!existing) return null;
    const updated: Discount = { ...existing, active };
    this.discounts.set(id, updated);
    return updated;
  }

  private findByRefSync(ref: string): Booking | null {
    return this.bookings.get(ref) ?? null;
  }
}

export class SlotUnavailableError extends Error {
  constructor(
    public date: string,
    public hour: number,
    public pitch: string,
    public reason: "taken" | "blocked" = "taken",
  ) {
    super(
      `Slot ${date} ${hour}:00 on ${pitch} is unavailable (${reason})`,
    );
    this.name = "SlotUnavailableError";
  }
}

/** Used by the singleton; ignored on Day 2. */
export function seedDevBookings(repo: InMemoryBookingRepository, _branding = branding): void {
  void repo;
}
