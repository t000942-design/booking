import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { branding } from "@/lib/config/branding";
import { venueDateLabel, venueTime } from "@/lib/domain/slots";
import { getBookingByRef } from "@/lib/services/bookings";
import { formatPrice } from "@/lib/utils/format";
import { CopyRefButton } from "./CopyRefButton";
import { Confetti } from "./Confetti";

interface PageProps {
  params: Promise<{ ref: string }>;
}

export default async function ConfirmationPage({ params }: PageProps) {
  const { ref } = await params;
  const booking = await getBookingByRef(ref);
  if (!booking) notFound();

  const startISO = booking.slotStart.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const endISO = booking.slotEnd.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const calendarUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(`${branding.pitchName} · ${booking.pitch}`)}` +
    `&dates=${startISO}/${endISO}` +
    `&details=${encodeURIComponent(
      `Booking ${booking.ref}\nName: ${booking.customerName}\nPhone: ${booking.customerPhone}` +
        (booking.teamName ? `\nTeam: ${booking.teamName}` : ""),
    )}` +
    `&location=${encodeURIComponent(`${branding.pitchName}, ${branding.location}`)}`;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <Confetti />

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-pitch-700 via-pitch-800 to-pitch-950 p-6 text-white shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <AnimatedCheck />
          <h1 className="mt-5 text-3xl font-black tracking-tight">
            You&apos;re in.
          </h1>
          <p className="mt-1 text-sm text-white/80">
            See you on the pitch, {booking.customerName.split(" ")[0]}.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl bg-white p-5 text-pitch-950 shadow-xl ring-1 ring-pitch-900/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-pitch-900/60">
              Booking code
            </div>
            <div className="mt-1 font-mono text-2xl font-black tracking-[0.2em] text-pitch-800">
              {booking.ref}
            </div>
          </div>
          <Badge tone="success">Confirmed</Badge>
        </div>
        <div className="mt-3">
          <CopyRefButton refCode={booking.ref} />
        </div>

        <hr className="my-5 border-dashed border-pitch-900/10" />

        <Row icon={<CalendarIcon />} label="When">
          <div className="text-base font-semibold">
            {venueDateLabel(booking.slotStart)}
          </div>
          <div className="text-sm text-pitch-900/70">
            {venueTime(booking.slotStart)} – {venueTime(booking.slotEnd)} ·{" "}
            {branding.timezone.split("/")[1]}
          </div>
        </Row>

        <Row icon={<PitchIcon />} label="Pitch">
          <div className="font-semibold">{booking.pitch}</div>
          <div className="text-sm text-pitch-900/70">
            7-a-side · {branding.pitchName} · {branding.location}
          </div>
        </Row>

        <Row icon={<UserIcon />} label="Booked under">
          <div className="font-medium">{booking.customerName}</div>
          <div className="text-sm text-pitch-900/70">{booking.customerPhone}</div>
          {booking.teamName ? (
            <div className="text-sm text-pitch-900/70">
              Team: {booking.teamName}
            </div>
          ) : null}
        </Row>

        <Row icon={<PriceIcon />} label="Price">
          {booking.discountFils > 0 ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-pitch-900/40 line-through">
                  {formatPrice(booking.priceFils, booking.currency)}
                </span>
                <span className="font-bold text-emerald-700">
                  {formatPrice(
                    booking.priceFils - booking.discountFils,
                    booking.currency,
                  )}
                </span>
              </div>
              <div className="text-[11px] font-semibold text-amber-700">
                🏷 {booking.discountName ?? "Discount"} applied
              </div>
            </>
          ) : (
            <div className="font-semibold">
              {formatPrice(booking.priceFils, booking.currency)}
            </div>
          )}
          {booking.paymentStatus === "PAID" ? (
            <div className="text-xs text-emerald-700">
              Paid via MyFatoorah
              {booking.paymentRef ? (
                <>
                  {" · "}
                  <span className="font-mono text-[10px]">{booking.paymentRef}</span>
                </>
              ) : null}
            </div>
          ) : booking.paymentStatus === "FAILED" ? (
            <div className="text-xs text-red-700">Payment failed</div>
          ) : (
            <div className="text-xs text-amber-700">Awaiting payment</div>
          )}
          {booking.refundFils > 0 ? (
            <div className="text-xs text-amber-700">
              Refunded: {formatPrice(booking.refundFils, booking.currency)}
            </div>
          ) : null}
        </Row>
      </section>

      <section className="rounded-3xl bg-pitch-950 p-5 text-sm text-white/95 shadow-xl">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
          What happens next
        </div>
        <ul className="mt-3 flex flex-col gap-2.5 text-[13px]">
          <li className="flex gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-bold">1</span>
            <span>Show up 5 minutes early.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-bold">2</span>
            <span>
              Show your code at the gate:{" "}
              <span className="font-mono font-semibold">{booking.ref}</span>
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-bold">3</span>
            <span>
              {booking.paymentStatus === "PAID"
                ? `Paid · ${formatPrice(booking.priceFils, booking.currency)} settled.`
                : `Settle ${formatPrice(booking.priceFils, booking.currency)} from /pay/${booking.ref}.`}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-bold">4</span>
            <span>
              Need to cancel?{" "}
              <a
                href={`tel:${branding.ownerPhone.replace(/\s/g, "")}`}
                className="font-semibold underline underline-offset-2"
              >
                Call {branding.ownerPhone}
              </a>{" "}
              at least 2 hours before.
            </span>
          </li>
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={calendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
        >
          <CalendarIcon className="h-4 w-4" />
          Add to Calendar
        </a>
        <Link href="/book" className="block">
          <Button variant="secondary" size="block" type="button">
            Book another
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex gap-3 first:mt-0">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-pitch-100 text-pitch-700">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-pitch-900/55">
          {label}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function AnimatedCheck() {
  return (
    <svg
      viewBox="0 0 56 56"
      className="h-20 w-20 drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <circle
        cx="28"
        cy="28"
        r="26"
        fill="none"
        stroke="white"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <circle cx="28" cy="28" r="22" fill="white" />
      <path
        d="M16 28.5l8 8 16-16"
        fill="none"
        stroke="#16a34a"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animated-check-path"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

function PitchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-5 w-5"
    >
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M12 6v12" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M12 3v18M16 7H10a3 3 0 000 6h4a3 3 0 010 6H8" />
    </svg>
  );
}
