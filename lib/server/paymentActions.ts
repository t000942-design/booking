"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  cancelBooking,
  getBookingByRef,
} from "@/lib/services/bookings";
import { paymentClient } from "@/lib/payments";
import { bookingRepository } from "@/lib/storage";

export interface PaymentState {
  error: string | null;
}

export async function startPaymentAction(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const session = await getSession();
  if (!session || session.role !== "customer") redirect("/");

  const ref = String(formData.get("ref") ?? "");
  if (!ref) return { error: "Missing booking reference." };

  const booking = await getBookingByRef(ref);
  if (!booking) return { error: "Booking not found." };
  if (booking.customerPhone !== session.phone) {
    return { error: "This booking belongs to a different account." };
  }
  if (booking.paymentStatus === "PAID") {
    redirect(`/booking/${ref}`);
  }

  // Vercel auto-sets VERCEL_URL on every deployment (no protocol).
  // Fallback chain: explicit APP_URL → NEXT_PUBLIC_APP_URL → VERCEL_URL → localhost.
  const baseUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";
  const callbackUrl = `${baseUrl}/pay/${ref}/complete`;

  let intent;
  try {
    intent = await paymentClient.createIntent({
      bookingRef: booking.ref,
      amountFils: booking.priceFils - booking.refundFils,
      currency: booking.currency,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      callbackUrl,
    });
  } catch (err) {
    console.error("[payments] createIntent failed:", err);
    return { error: "Couldn't start payment. Try again." };
  }

  // redirect throws — execution stops here.
  redirect(intent.paymentUrl);
}

export async function completePaymentAction(
  ref: string,
  paymentRef: string,
): Promise<{ ok: boolean; error?: string }> {
  const booking = await getBookingByRef(ref);
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.paymentStatus === "PAID") {
    return { ok: true };
  }

  let result;
  try {
    result = await paymentClient.verify(paymentRef);
  } catch (err) {
    console.error("[payments] verify failed:", err);
    await bookingRepository.markPaymentFailed(ref);
    return { ok: false, error: "Couldn't verify payment." };
  }

  if (!result.paid) {
    await bookingRepository.markPaymentFailed(ref);
    return { ok: false, error: "Payment was not completed." };
  }

  await bookingRepository.markPaid(ref, result.paymentRef);
  revalidatePath(`/booking/${ref}`);
  return { ok: true };
}

export async function cancelPendingBookingAction(
  formData: FormData,
): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "customer") redirect("/");

  const ref = String(formData.get("ref") ?? "");
  if (!ref) redirect("/book");

  const booking = await getBookingByRef(ref);
  if (!booking) redirect("/book");
  if (booking!.customerPhone !== session.phone) redirect("/book");
  if (booking!.status === "PENDING") {
    await cancelBooking(ref);
  }
  redirect("/book");
}
