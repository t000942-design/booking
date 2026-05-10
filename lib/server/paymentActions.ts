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
  /** When set, the client should perform `window.location.href = paymentUrl`
   *  to send the customer to the gateway. Server-side redirects to external
   *  URLs from Server Actions are flaky on some Next.js builds, so we drive
   *  the navigation from the client instead. */
  paymentUrl?: string;
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

  // Optional: a specific PaymentMethodId chosen on the pay page (KNET / Apple Pay).
  const rawMethod = String(formData.get("paymentMethodId") ?? "");
  const paymentMethodId = /^\d+$/.test(rawMethod) ? Number(rawMethod) : undefined;

  let intent;
  try {
    intent = await paymentClient.createIntent({
      bookingRef: booking.ref,
      amountFils: booking.priceFils - booking.discountFils - booking.refundFils,
      currency: booking.currency,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      callbackUrl,
      paymentMethodId,
    });
  } catch (err) {
    console.error("[payments] createIntent failed:", err);
    const message =
      err instanceof Error
        ? err.message.slice(0, 200)
        : "Couldn't start payment.";
    return { error: message };
  }

  if (!intent.paymentUrl) {
    return { error: "Gateway didn't return a payment URL." };
  }

  // Hand the URL back to the client so it can navigate. Avoids a server-side
  // redirect to an external origin, which can return a generic 500 in some
  // Next.js / Turbopack combinations.
  return { error: null, paymentUrl: intent.paymentUrl };
}

export async function completePaymentAction(
  ref: string,
  paymentRef: string,
  keyType: "PaymentId" | "InvoiceId" = "PaymentId",
): Promise<{ ok: boolean; error?: string; rawStatus?: string }> {
  const booking = await getBookingByRef(ref);
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.paymentStatus === "PAID") {
    return { ok: true };
  }

  let result;
  try {
    result = await paymentClient.verify(paymentRef, keyType);
  } catch (err) {
    console.error("[payments] verify failed:", err);
    await bookingRepository.markPaymentFailed(ref);
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Verify failed: ${err.message.slice(0, 200)}`
          : "Couldn't verify payment.",
    };
  }

  if (!result.paid) {
    await bookingRepository.markPaymentFailed(ref);
    return {
      ok: false,
      error: `MyFatoorah reported the invoice as "${result.rawStatus ?? "unknown"}" — try paying again.`,
      rawStatus: result.rawStatus,
    };
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
