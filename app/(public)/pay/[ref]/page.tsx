import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { LobbyBackdrop } from "@/components/LobbyBackdrop";
import { branding } from "@/lib/config/branding";
import { requireCustomer } from "@/lib/auth/guards";
import { venueDateLabel, venueTime } from "@/lib/domain/slots";
import { getBookingByRef } from "@/lib/services/bookings";
import { detectPaymentMode, paymentClient } from "@/lib/payments";
import { formatPrice } from "@/lib/utils/format";
import type { PaymentMethod } from "@/lib/payments";
import { BookingExpired } from "./BookingExpired";
import { CouponForm } from "./CouponForm";
import { PaymentMethodButtons } from "./PaymentForm";

interface PageProps {
  params: Promise<{ ref: string }>;
}

const ALLOWED_METHODS = new Set(["KNET", "ApplePay"]);

export default async function PayPage({ params }: PageProps) {
  const session = await requireCustomer();
  const { ref } = await params;

  const booking = await getBookingByRef(ref);
  if (!booking) {
    return (
      <>
        <LobbyBackdrop />
        <BookingExpired ref={ref} reason="not-found" />
      </>
    );
  }
  if (booking.customerPhone !== session.phone) {
    return (
      <>
        <LobbyBackdrop />
        <BookingExpired ref={ref} reason="wrong-account" />
      </>
    );
  }
  if (booking.paymentStatus === "PAID") redirect(`/booking/${ref}`);
  if (booking.status === "CANCELLED") redirect("/book");

  const dueFils = booking.priceFils - booking.discountFils - booking.refundFils;

  let methods: PaymentMethod[] = [];
  let methodsError: string | null = null;
  try {
    const all = await paymentClient.listPaymentMethods({
      amountFils: dueFils,
      currency: booking.currency,
    });
    methods = all.filter((m) => ALLOWED_METHODS.has(m.name));
    if (methods.length === 0 && all.length > 0) {
      // Account doesn't have KNET/ApplePay enabled — show every available method.
      methods = all;
    }
  } catch (err) {
    console.error("[pay] listPaymentMethods failed:", err);
    methodsError =
      "Couldn't load payment methods from MyFatoorah. Check your API key.";
  }

  const paymentMode = detectPaymentMode();
  const isStubbed = paymentMode === "stub";

  return (
    <div className="flex flex-col gap-5 pt-4">
      <LobbyBackdrop />

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
                <span>🏷</span>
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

        <div className="mt-4">
          <CouponForm
            refCode={booking.ref}
            appliedName={booking.discountName}
            appliedFils={booking.discountFils}
            currency={booking.currency}
          />
        </div>

        <p className="mt-3 text-xs text-white/80">
          Payment via <span className="font-semibold">MyFatoorah</span> hosted
          checkout — secure, no card details touch our server.
        </p>

        <div className="mt-4">
          <PaymentMethodButtons refCode={booking.ref} methods={methods} />
        </div>

        {methodsError ? (
          <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-[11px] text-red-100">
            {methodsError}
          </p>
        ) : null}

        {isStubbed ? (
          <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-200/95 p-3 text-amber-950 shadow-lg">
            <div className="text-base font-black uppercase tracking-wider">
              ⚠ STUB MODE · NOT HITTING MYFATOORAH
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              The deploy can&apos;t see <code className="font-mono">MYFATOORAH_API_TOKEN</code>
              {" "}— clicking Pay will simulate a successful charge and send you
              straight to the confirmation page <strong>without</strong> a card
              entry screen.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed">
              Fix on Vercel → Settings → Environment Variables → add
              {" "}<code className="font-mono">MYFATOORAH_API_TOKEN</code>{" "}
              for <strong>all environments</strong> → Save → Deployments →
              Redeploy.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-emerald-100">
            <div className="font-bold">
              ✓ Live mode ({paymentMode === "direct" ? "direct" : "edge"}) ·
              clicking a method redirects to MyFatoorah&apos;s hosted page
            </div>
            <details className="mt-1.5 text-[11px]">
              <summary className="cursor-pointer font-semibold">Test cards</summary>
              <ul className="mt-1 list-disc pl-4 font-mono text-[10px]">
                <li>KNET · 0000000001 · 09/25 · OTP 1111</li>
                <li>VISA / MC · 4005550000000001 · 05/26 · CVV 123</li>
                <li>Mada · 5123456789012346 · 12/26 · CVV 123</li>
              </ul>
            </details>
          </div>
        )}
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
