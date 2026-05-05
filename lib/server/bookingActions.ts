"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  BookingValidationError,
  blockSlot,
  cancelBooking,
  createBooking,
  markBookingDone,
  refundBooking,
  SlotUnavailableError,
  unblockSlot,
} from "@/lib/services/bookings";

export interface BookingState {
  error: string | null;
  fieldErrors?: Record<string, string>;
}

export async function createBookingAction(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    redirect("/");
  }

  const dto = {
    customerName: String(formData.get("customerName") ?? "").trim(),
    customerPhone: session.phone,
    teamName: String(formData.get("teamName") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    date: String(formData.get("date") ?? ""),
    hour: Number(formData.get("hour") ?? NaN),
    pitch: String(formData.get("pitch") ?? ""),
  };

  try {
    const booking = await createBooking(dto);
    // Payment disabled for now — go straight to the confirmation page.
    redirect(`/booking/${booking.ref}`);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) fieldErrors[issue.path] = issue.message;
      return { error: "Please fix the highlighted fields.", fieldErrors };
    }
    if (err instanceof SlotUnavailableError) {
      return { error: "That slot was just taken. Pick another." };
    }
    throw err;
  }
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Forbidden");
  }
}

export async function markDoneAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ref = String(formData.get("ref") ?? "");
  if (!ref) return;
  await markBookingDone(ref);
  revalidatePath("/admin");
}

export async function cancelAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ref = String(formData.get("ref") ?? "");
  if (!ref) return;
  await cancelBooking(ref);
  revalidatePath("/admin");
}

export async function blockSlotAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const hour = Number(formData.get("hour") ?? NaN);
  const pitch = String(formData.get("pitch") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!date || !pitch || Number.isNaN(hour)) return;
  await blockSlot(date, hour, pitch, reason);
  revalidatePath("/admin");
}

export async function unblockSlotAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await unblockSlot(id);
  revalidatePath("/admin");
}

export async function refundAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ref = String(formData.get("ref") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!ref) return;
  if (kind === "full") {
    await refundBooking(ref, { full: true });
  } else if (kind === "half") {
    await refundBooking(ref, { full: false, fraction: 0.5 });
  } else {
    const amount = Number(formData.get("amountFils") ?? NaN);
    if (Number.isNaN(amount) || amount <= 0) return;
    await refundBooking(ref, { full: false, amountFils: amount });
  }
  revalidatePath("/admin");
}
