import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { branding } from "@/lib/config/branding";
import { requireCustomer } from "@/lib/auth/guards";
import { venueDateLabel, venueTime } from "@/lib/domain/slots";
import { getBookingByRef } from "@/lib/services/bookings";
import { formatPrice } from "@/lib/utils/format";
import { PaymentForm } from "./PaymentForm";

interface PageProps {
  params: Promise<{ ref: string }>;
}

export default async function PayPage({ params }: PageProps) {
  const session = await requireCustomer();
  const { ref } = await params;

  const booking = await getBookingByRef(ref);
  if (!booking) notFound();
  if (booking.customerPhone !== session.phone) redirect("/book");
  if (booking.paymentStatus === "PAID") redirect(`/booking/${ref}`);
  if (booking.status === "CANCELLED") redirect("/book");

  const dueFils = booking.priceFils - booking.discountFils - booking.refundFils;
  const isStubbed = !process.env.MYFATOORAH_API_TOKEN;

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight drop-shadow">Checkout</h1>
        <p className="mt-1 text-sm text-white/85">
          One step away — confirm payment to lock your slot.
        </p>
      </div>

      <section className="overflow-hidden rounded-3xl bg-white p-5 text-pitch-950 shadow-xl ring-1 ring-pitch-900/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-pitch-900/60">
              Booking
            </div>
            <div className="mt-1 font-mono text-lg font-black tracking-[0.18em] text-pitch-800">
              {booking.ref}
            </div>
          </div>
          <Badge tone={booking.paymentStatus === "FAILED" ? "danger" : "warn"}>
            {booking.paymentStatus === "FAILED" ? "Payment failed" : "Awaiting payment"}
          </Badge>
        </div>

        <hr className="my-4 border-dashed border-pitch-900/10" />

        <Row label="When">
          <div className="font-semibold">{venueDateLabel(booking.slotStart)}</div>
          <div className="text-sm text-pitch-900/70">
            {venueTime(booking.slotStart)} – {venueTime(booking.slotEnd)} ·{" "}
            {branding.timezone.split("/")[1]}
          </div>
        </Row>
        <Row label="Pitch">
          <div className="font-semibold">{booking.pitch}</div>
          <div className="text-sm text-pitch-900/70">
            7-a-side · {branding.pitchName}
          </div>
        </Row>
        <Row label="Booked under">
          <div>{booking.customerName}</div>
          <div className="text-sm text-pitch-900/70">{booking.customerPhone}</div>
        </Row>
      </section>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-pitch-700 to-pitch-950 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm text-white/85">
            <span>Slot price</span>
            <span>{formatPrice(booking.priceFils, booking.currency)}</span>
          </div>
          {booking.discountFils > 0 ? (
            <div className="flex items-center justify-between text-sm text-amber-200">
              <span className="flex items-center gap-1.5">
                <span className="text-base">🏷</span>
                {booking.discountName ?? "Discount"}
              </span>
              <span>−{formatPrice(booking.discountFils, booking.currency)}</span>
            </div>
          ) : null}
          {booking.refundFils > 0 ? (
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Already refunded</span>
              <span>−{formatPrice(booking.refundFils, booking.currency)}</span>
            </div>
          ) : null}
          <div className="mt-1 h-px bg-white/15" />
          <div className="flex items-baseline justify-between pt-1">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
              Total due
            </div>
            <div className="text-3xl font-black tracking-tight">
              {formatPrice(dueFils, booking.currency)}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/80">
          Payments are handled by{" "}
          <span className="font-semibold">MyFatoorah</span> — KNET, Visa,
          Mastercard, Apple Pay, Google Pay.
        </p>

        <div className="mt-4">
          <PaymentForm refCode={booking.ref} />
        </div>

        {isStubbed ? (
          <p className="mt-3 rounded-lg bg-white/10 p-2 text-[11px] text-amber-100">
            <span className="font-semibold">Day 1 stub:</span> no real card
            charge. Click Pay to simulate a successful payment and continue.
          </p>
        ) : null}
      </section>

      <Link
        href="/book"
        className="text-center text-xs font-medium text-white/80 underline-offset-4 hover:underline"
      >
        Back to slots
      </Link>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-pitch-900/55">
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
