import { Badge } from "@/components/ui/Badge";
import { branding } from "@/lib/config/branding";
import { todayAtVenue, venueDateLabel, venueTime } from "@/lib/domain/slots";
import {
  getAllPitchesAvailability,
  listTodaysBookings,
} from "@/lib/services/bookings";
import { formatPrice } from "@/lib/utils/format";
import type { Booking, Slot } from "@/lib/domain/types";
import { BookingActions } from "./BookingActions";
import { SlotControls } from "./SlotControls";

export default async function AdminTodayPage() {
  const today = todayAtVenue();
  const [bookings, pitchesAvail] = await Promise.all([
    listTodaysBookings(),
    getAllPitchesAvailability(today),
  ]);

  const active = bookings.filter((b) => b.status !== "CANCELLED");
  const expectedFils = active.reduce(
    (sum, b) => sum + (b.priceFils - b.refundFils),
    0,
  );
  const totalSlots = pitchesAvail.reduce((sum, p) => sum + p.slots.length, 0);
  const takenCount = pitchesAvail.reduce(
    (sum, p) => sum + p.slots.filter((s) => s.taken).length,
    0,
  );
  const blockedCount = pitchesAvail.reduce(
    (sum, p) => sum + p.slots.filter((s) => s.blocked).length,
    0,
  );
  const openCount = totalSlots - takenCount - blockedCount;

  const bookingsByKey = new Map<string, Booking>();
  for (const b of active) bookingsByKey.set(`${b.pitch}|${b.hour}`, b);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <div className="text-xs font-medium uppercase tracking-widest text-slate-500">
          Today
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {venueDateLabel(today)}
        </h1>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Booked" value={String(active.length)} />
        <Stat label="Open" value={String(openCount)} />
        <Stat label="Blocked" value={String(blockedCount)} />
        <Stat
          label="Expected"
          value={formatPrice(expectedFils, branding.currency)}
        />
      </section>

      {pitchesAvail.map(({ pitch, slots }) => (
        <PitchSection
          key={pitch}
          pitch={pitch}
          slots={slots}
          bookingsByKey={bookingsByKey}
        />
      ))}

      {bookings.some((b) => b.status === "CANCELLED") ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-600">
            Cancelled today
          </h2>
          <ul className="space-y-2">
            {bookings
              .filter((b) => b.status === "CANCELLED")
              .map((b) => (
                <li
                  key={b.ref}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                >
                  <span className="font-mono text-xs">{b.ref}</span> ·{" "}
                  {b.pitch} · {venueTime(b.slotStart)} · {b.customerName}
                  {b.refundFils > 0 ? (
                    <span className="ml-2 text-amber-700">
                      · refunded {formatPrice(b.refundFils, b.currency)}
                    </span>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PitchSection({
  pitch,
  slots,
  bookingsByKey,
}: {
  pitch: string;
  slots: Slot[];
  bookingsByKey: Map<string, Booking>;
}) {
  const pitchBookings = slots.filter((s) => s.taken).length;
  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          {pitch}
        </h2>
        <span className="text-xs text-slate-500">
          {pitchBookings} booked · {slots.length - pitchBookings} free
        </span>
      </header>
      <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {slots.map((s, idx) => {
          const booking = bookingsByKey.get(`${pitch}|${s.hour}`);
          return (
            <li
              key={s.hour}
              className={
                "flex items-start gap-3 px-3 py-3 sm:px-4 " +
                (idx > 0 ? "border-t border-slate-100" : "")
              }
            >
              <div className="w-16 shrink-0 pt-0.5 font-mono text-sm">
                <div className="font-semibold">{s.label}</div>
                <div className="text-[11px] text-slate-500">– {s.endLabel}</div>
              </div>
              <div className="min-w-0 flex-1">
                {booking ? (
                  <BookingRow booking={booking} />
                ) : s.blocked ? (
                  <BlockedRow slot={s} />
                ) : s.inPast ? (
                  <div className="text-sm text-slate-400">No booking · past</div>
                ) : (
                  <OpenRow slot={s} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{booking.customerName}</span>
        <BookingStatusBadge status={booking.status} />
        {booking.refundFils > 0 ? (
          <Badge tone="warn">
            Refunded {formatPrice(booking.refundFils, booking.currency)}
          </Badge>
        ) : null}
      </div>
      <div className="mt-0.5 text-sm text-slate-600">
        <a href={`tel:${booking.customerPhone}`} className="hover:underline">
          {booking.customerPhone}
        </a>
        {booking.teamName ? <> · {booking.teamName}</> : null}
      </div>
      {booking.notes ? (
        <div className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">
          {booking.notes}
        </div>
      ) : null}
      <div className="mt-1 font-mono text-[11px] text-slate-500">
        {booking.ref}
      </div>
      <div className="mt-2">
        <BookingActions
          refCode={booking.ref}
          status={booking.status}
          refundFils={booking.refundFils}
          priceFils={booking.priceFils}
        />
      </div>
    </>
  );
}

function OpenRow({ slot }: { slot: Slot }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-slate-500">Open</span>
      <SlotControls
        kind="block"
        date={slot.date}
        hour={slot.hour}
        pitch={slot.pitch}
      />
    </div>
  );
}

function BlockedRow({ slot }: { slot: Slot }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <Badge tone="muted">Blocked</Badge>
        {slot.blockReason ? (
          <span className="ml-2 text-sm text-slate-600">{slot.blockReason}</span>
        ) : null}
      </div>
      <SlotControls kind="unblock" blockedId={slot.blockedId ?? ""} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold tracking-tight">{value}</div>
    </div>
  );
}

function BookingStatusBadge({ status }: { status: string }) {
  if (status === "DONE") return <Badge tone="muted">Done</Badge>;
  if (status === "CANCELLED") return <Badge tone="danger">Cancelled</Badge>;
  if (status === "PENDING") return <Badge tone="warn">Pending</Badge>;
  return <Badge tone="success">Confirmed</Badge>;
}
