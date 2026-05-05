import { generateBookingRef } from "@/lib/domain/bookingRef";
import { slotEndUtc, slotStartUtc } from "@/lib/domain/slots";
import type {
  BlockedSlot,
  Booking,
  BookingStatus,
  CreateBookingInput,
  Discount,
  PaymentStatus,
} from "@/lib/domain/types";
import { getServiceSupabase } from "@/lib/supabase/server";
import { SlotUnavailableError } from "./memory";
import type {
  BlockedSlotFilter,
  BookingFilter,
  BookingRepository,
} from "./repository";

const ACTIVE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "DONE"];

type BookingRow = {
  ref: string;
  id: string;
  customer_name: string;
  customer_phone: string;
  team_name: string | null;
  notes: string | null;
  date: string;
  hour: number;
  pitch: string;
  slot_start: string;
  slot_end: string;
  price_fils: number;
  currency: string;
  discount_fils: number;
  discount_name: string | null;
  status: BookingStatus;
  payment_status: PaymentStatus;
  paid_at: string | null;
  payment_ref: string | null;
  refund_fils: number;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

type BlockedSlotRow = {
  id: string;
  date: string;
  hour: number;
  pitch: string;
  reason: string | null;
  created_at: string;
};

type DiscountRow = {
  id: string;
  name: string;
  description: string | null;
  percent_off: number;
  valid_from: string;
  valid_to: string;
  days_of_week: number[];
  pitches: string[];
  active: boolean;
  created_at: string;
};

function bookingFromRow(r: BookingRow): Booking {
  return {
    id: r.id,
    ref: r.ref,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    teamName: r.team_name,
    notes: r.notes,
    date: r.date,
    hour: r.hour,
    pitch: r.pitch,
    slotStart: new Date(r.slot_start),
    slotEnd: new Date(r.slot_end),
    priceFils: r.price_fils,
    currency: r.currency,
    discountFils: r.discount_fils,
    discountName: r.discount_name,
    status: r.status,
    paymentStatus: r.payment_status,
    paidAt: r.paid_at ? new Date(r.paid_at) : null,
    paymentRef: r.payment_ref,
    refundFils: r.refund_fils,
    refundedAt: r.refunded_at ? new Date(r.refunded_at) : null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

function blockedSlotFromRow(r: BlockedSlotRow): BlockedSlot {
  return {
    id: r.id,
    date: r.date,
    hour: r.hour,
    pitch: r.pitch,
    reason: r.reason,
    createdAt: new Date(r.created_at),
  };
}

function discountFromRow(r: DiscountRow): Discount {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    percentOff: r.percent_off,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    daysOfWeek: r.days_of_week,
    pitches: r.pitches,
    active: r.active,
    createdAt: new Date(r.created_at),
  };
}

export class SupabaseBookingRepository implements BookingRepository {
  private get sb() {
    return getServiceSupabase();
  }

  // ----- Bookings -----

  async create(
    input: CreateBookingInput & {
      priceFils: number;
      currency: string;
      discountFils: number;
      discountName: string | null;
    },
  ): Promise<Booking> {
    const blocked = await this.isSlotBlocked(input.date, input.hour, input.pitch);
    if (blocked) {
      throw new SlotUnavailableError(input.date, input.hour, input.pitch, "blocked");
    }
    const taken = await this.isSlotTaken(input.date, input.hour, input.pitch);
    if (taken) {
      throw new SlotUnavailableError(input.date, input.hour, input.pitch, "taken");
    }

    const ref = generateBookingRef();
    const slotStart = slotStartUtc(input.date, input.hour);
    const slotEnd = slotEndUtc(input.date, input.hour);

    const { data, error } = await this.sb
      .from("bookings")
      .insert({
        ref,
        id: ref,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        team_name: input.teamName ?? null,
        notes: input.notes ?? null,
        date: input.date,
        hour: input.hour,
        pitch: input.pitch,
        slot_start: slotStart.toISOString(),
        slot_end: slotEnd.toISOString(),
        price_fils: input.priceFils,
        currency: input.currency,
        discount_fils: input.discountFils,
        discount_name: input.discountName,
      })
      .select("*")
      .single<BookingRow>();

    if (error) {
      // Unique-violation on (date, hour, pitch) partial index → race lost.
      if (error.code === "23505") {
        throw new SlotUnavailableError(input.date, input.hour, input.pitch, "taken");
      }
      throw error;
    }
    return bookingFromRow(data);
  }

  async findByRef(ref: string): Promise<Booking | null> {
    const { data, error } = await this.sb
      .from("bookings")
      .select("*")
      .eq("ref", ref)
      .maybeSingle<BookingRow>();
    if (error) throw error;
    return data ? bookingFromRow(data) : null;
  }

  async list(filter: BookingFilter = {}): Promise<Booking[]> {
    let q = this.sb
      .from("bookings")
      .select("*")
      .order("slot_start", { ascending: true })
      .order("pitch", { ascending: true });

    if (filter.date) q = q.eq("date", filter.date);
    if (filter.pitch) q = q.eq("pitch", filter.pitch);
    if (filter.status) {
      const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
      q = q.in("status", arr);
    }
    if (filter.query) {
      const escaped = filter.query.replace(/[%_\\]/g, (c) => `\\${c}`);
      const term = `%${escaped}%`;
      q = q.or(
        `ref.ilike.${term},customer_name.ilike.${term},customer_phone.ilike.${term},team_name.ilike.${term}`,
      );
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data as BookingRow[]).map(bookingFromRow);
  }

  async isSlotTaken(date: string, hour: number, pitch: string): Promise<boolean> {
    const { count, error } = await this.sb
      .from("bookings")
      .select("ref", { count: "exact", head: true })
      .eq("date", date)
      .eq("hour", hour)
      .eq("pitch", pitch)
      .in("status", ACTIVE_STATUSES);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async updateStatus(ref: string, status: BookingStatus): Promise<Booking | null> {
    const { data, error } = await this.sb
      .from("bookings")
      .update({ status })
      .eq("ref", ref)
      .select("*")
      .maybeSingle<BookingRow>();
    if (error) throw error;
    return data ? bookingFromRow(data) : null;
  }

  async markPaid(ref: string, paymentRef: string): Promise<Booking | null> {
    const existing = await this.findByRef(ref);
    if (!existing) return null;
    const nextStatus =
      existing.status === "PENDING" ? "CONFIRMED" : existing.status;
    const { data, error } = await this.sb
      .from("bookings")
      .update({
        payment_status: "PAID",
        paid_at: new Date().toISOString(),
        payment_ref: paymentRef,
        status: nextStatus,
      })
      .eq("ref", ref)
      .select("*")
      .maybeSingle<BookingRow>();
    if (error) throw error;
    return data ? bookingFromRow(data) : null;
  }

  async markPaymentFailed(ref: string): Promise<Booking | null> {
    const { data, error } = await this.sb
      .from("bookings")
      .update({ payment_status: "FAILED" })
      .eq("ref", ref)
      .select("*")
      .maybeSingle<BookingRow>();
    if (error) throw error;
    return data ? bookingFromRow(data) : null;
  }

  async applyRefund(
    ref: string,
    refundFils: number,
    fullRefund: boolean,
  ): Promise<Booking | null> {
    const existing = await this.findByRef(ref);
    if (!existing) return null;
    const refundAmount = Math.min(
      Math.max(0, refundFils + existing.refundFils),
      existing.priceFils,
    );
    const update: Record<string, unknown> = {
      refund_fils: refundAmount,
      refunded_at: new Date().toISOString(),
    };
    if (fullRefund) update.status = "CANCELLED";
    const { data, error } = await this.sb
      .from("bookings")
      .update(update)
      .eq("ref", ref)
      .select("*")
      .maybeSingle<BookingRow>();
    if (error) throw error;
    return data ? bookingFromRow(data) : null;
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
    const { data, error } = await this.sb
      .from("blocked_slots")
      .insert({ id, date, hour, pitch, reason })
      .select("*")
      .single<BlockedSlotRow>();
    if (error) {
      if (error.code === "23505") {
        const again = await this.isSlotBlocked(date, hour, pitch);
        if (again) return again;
      }
      throw error;
    }
    return blockedSlotFromRow(data);
  }

  async unblockSlot(id: string): Promise<boolean> {
    const { error, count } = await this.sb
      .from("blocked_slots")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async listBlockedSlots(filter: BlockedSlotFilter = {}): Promise<BlockedSlot[]> {
    let q = this.sb
      .from("blocked_slots")
      .select("*")
      .order("hour", { ascending: true });
    if (filter.date) q = q.eq("date", filter.date);
    if (filter.pitch) q = q.eq("pitch", filter.pitch);
    const { data, error } = await q;
    if (error) throw error;
    return (data as BlockedSlotRow[]).map(blockedSlotFromRow);
  }

  async isSlotBlocked(
    date: string,
    hour: number,
    pitch: string,
  ): Promise<BlockedSlot | null> {
    const { data, error } = await this.sb
      .from("blocked_slots")
      .select("*")
      .eq("date", date)
      .eq("hour", hour)
      .eq("pitch", pitch)
      .maybeSingle<BlockedSlotRow>();
    if (error) throw error;
    return data ? blockedSlotFromRow(data) : null;
  }

  // ----- Discounts -----

  async createDiscount(
    input: Omit<Discount, "id" | "createdAt">,
  ): Promise<Discount> {
    const id = `dsc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await this.sb
      .from("discounts")
      .insert({
        id,
        name: input.name,
        description: input.description,
        percent_off: input.percentOff,
        valid_from: input.validFrom,
        valid_to: input.validTo,
        days_of_week: input.daysOfWeek,
        pitches: input.pitches,
        active: input.active,
      })
      .select("*")
      .single<DiscountRow>();
    if (error) throw error;
    return discountFromRow(data);
  }

  async listDiscounts(): Promise<Discount[]> {
    const { data, error } = await this.sb
      .from("discounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as DiscountRow[]).map(discountFromRow);
  }

  async deleteDiscount(id: string): Promise<boolean> {
    const { error, count } = await this.sb
      .from("discounts")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async setDiscountActive(id: string, active: boolean): Promise<Discount | null> {
    const { data, error } = await this.sb
      .from("discounts")
      .update({ active })
      .eq("id", id)
      .select("*")
      .maybeSingle<DiscountRow>();
    if (error) throw error;
    return data ? discountFromRow(data) : null;
  }
}
