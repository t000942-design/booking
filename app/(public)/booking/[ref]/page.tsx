import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { branding } from "@/lib/config/branding";
import { venueDateLabel, venueTime } from "@/lib/domain/slots";
import { getBookingByRef } from "@/lib/services/bookings";
import { formatPrice } from "@/lib/utils/format";

interface PageProps {
  params: Promise<{ ref: string }>;
}

export default async function ConfirmationPage({ params }: PageProps) {
  const { ref } = await params;
  const booking = await getBookingByRef(ref);
  if (!booking) notFound();

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-pitch-700 shadow-lg">
          <CheckIcon className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight drop-shadow">
          You&apos;re booked.
        </h1>
        <p className="mt-1 text-sm text-white/85">
          See you on the pitch.
        </p>
      </div>

      <section className="field-card rounded-2xl p-5 text-pitch-950">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-widest text-pitch-900/60">
            Booking
          </div>
          <Badge tone="success">CONFIRMED</Badge>
        </div>
        <div className="mt-1 font-mono text-xl font-bold tracking-wider">
          {booking.ref}
        </div>

        <hr className="my-4 border-pitch-900/10" />

        <Row label="When">
          <div className="text-base font-semibold">
            {venueDateLabel(booking.slotStart)}
          </div>
          <div className="text-sm text-pitch-900/70">
            {venueTime(booking.slotStart)} – {venueTime(booking.slotEnd)} ·{" "}
            {branding.timezone.split("/")[1]}
          </div>
        </Row>
        <Row label="Pitch">
          <div className="font-medium">
            {booking.pitch} · 7-a-side
          </div>
          <div className="text-sm text-pitch-900/70">
            {branding.pitchName} · {branding.location}
          </div>
        </Row>
        <Row label="Booked under">
          <div className="font-medium">{booking.customerName}</div>
          <div className="text-sm text-pitch-900/70">{booking.customerPhone}</div>
          {booking.teamName ? (
            <div className="text-sm text-pitch-900/70">
              Team: {booking.teamName}
            </div>
          ) : null}
        </Row>
        <Row label="Price">
          <div className="font-semibold">
            {formatPrice(booking.priceFils, booking.currency)}
          </div>
          {booking.refundFils > 0 ? (
            <div className="text-xs text-amber-700">
              Refunded: {formatPrice(booking.refundFils, booking.currency)}
            </div>
          ) : (
            <div className="text-xs text-pitch-900/60">Pay on arrival.</div>
          )}
        </Row>
      </section>

      <section className="field-card-dark rounded-2xl p-5 text-sm">
        <div className="text-xs uppercase tracking-widest text-white/60">
          What&apos;s next
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-white/90">
          <li>Show up 5 minutes early.</li>
          <li>Bring your booking code: <span className="font-mono">{booking.ref}</span>.</li>
          <li>
            Need to cancel? Call{" "}
            <a
              href={`tel:${branding.ownerPhone.replace(/\s/g, "")}`}
              className="font-semibold underline"
            >
              {branding.ownerPhone}
            </a>{" "}
            at least 2 hours before.
          </li>
        </ul>
      </section>

      <Link href="/book" className="block">
        <Button variant="secondary" size="block" type="button">
          Book another slot
        </Button>
      </Link>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="text-[11px] uppercase tracking-widest text-pitch-900/55">
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12.5l4.5 4.5L20 7" />
    </svg>
  );
}
