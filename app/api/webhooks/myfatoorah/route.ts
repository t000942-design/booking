import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { bookingRepository } from "@/lib/storage";

/**
 * MyFatoorah webhook receiver.
 *
 * Configure on MyFatoorah's side (Portal → Settings → Webhook) or pass
 * `WebhookEndpoint` in ExecutePayment requests. MyFatoorah will POST a
 * JSON event here whenever a transaction's status changes — even if the
 * customer never returns to our site.
 *
 * Signature verification (recommended in production):
 *   header `MyFatoorah-Signature` = base64(HMAC-SHA256(rawBody, MYFATOORAH_WEBHOOK_SECRET))
 *
 * Payload shape (TransactionsStatusChanged):
 *   {
 *     "EventType": 1,
 *     "Event": "TransactionsStatusChanged",
 *     "DateTime": "...",
 *     "CountryIsoCode": "KWT",
 *     "Data": {
 *       "InvoiceId": 12345,
 *       "InvoiceStatus": "Paid" | "Failed" | "Pending" | "Cancelled" | "Expired",
 *       "InvoiceReference": "...",
 *       "CustomerReference": "KO-XXXXXX",   ← our booking ref
 *       "PaymentMethod": "KNET",
 *       ...
 *     }
 *   }
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const text = await request.text();

  // Optional signature verification.
  const secret = process.env.MYFATOORAH_WEBHOOK_SECRET;
  if (secret) {
    const provided = request.headers.get("myfatoorah-signature") ?? "";
    const expected = crypto
      .createHmac("sha256", secret)
      .update(text)
      .digest("base64");
    // Use timingSafeEqual to avoid leaking the secret via timing.
    const ok =
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!ok) {
      console.warn("[webhooks/myfatoorah] signature mismatch");
      return NextResponse.json(
        { ok: false, error: "Invalid signature" },
        { status: 401 },
      );
    }
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(text) as WebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const data = event?.Data;
  if (!data) {
    return NextResponse.json({ ok: true, message: "No Data in event, ignored" });
  }

  // CustomerReference is what we sent as the booking ref (KO-XXXXXX).
  const ref = String(data.CustomerReference ?? "").trim();
  const status = String(data.InvoiceStatus ?? "").trim().toLowerCase();
  const paymentRef = String(data.InvoiceId ?? "");

  if (!ref) {
    return NextResponse.json({
      ok: true,
      message: "No CustomerReference, ignored",
    });
  }

  const booking = await bookingRepository.findByRef(ref);
  if (!booking) {
    return NextResponse.json({
      ok: true,
      message: `Booking ${ref} not found — webhook ignored`,
    });
  }

  // Idempotency: if already paid, ack and return.
  if (booking.paymentStatus === "PAID") {
    return NextResponse.json({
      ok: true,
      message: `${ref} already PAID, no-op`,
    });
  }

  if (status === "paid" || status === "successful" || status === "successfull") {
    await bookingRepository.markPaid(ref, paymentRef);
    console.log(`[webhooks/myfatoorah] ${ref} → PAID (invoice ${paymentRef})`);
    return NextResponse.json({ ok: true, applied: "PAID" });
  }

  if (
    status === "failed" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "expired"
  ) {
    await bookingRepository.markPaymentFailed(ref);
    console.log(`[webhooks/myfatoorah] ${ref} → FAILED (status=${status})`);
    return NextResponse.json({ ok: true, applied: "FAILED" });
  }

  // Pending or any other status — ack but don't change state.
  return NextResponse.json({
    ok: true,
    applied: "ignored",
    status,
  });
}

interface WebhookEvent {
  EventType?: number;
  Event?: string;
  DateTime?: string;
  CountryIsoCode?: string;
  Data?: {
    InvoiceId?: number;
    InvoiceStatus?: string;
    InvoiceReference?: string;
    CustomerReference?: string;
    PaymentMethod?: string;
  };
}
