import { Badge } from "@/components/ui/Badge";
import { branding } from "@/lib/config/branding";
import {
  parseVenueDate,
  todayAtVenue,
  venueDateLabel,
  venueTime,
} from "@/lib/domain/slots";
import {
  getAllPitchesAvailability,
  listBookingsForDate,
} from "@/lib/services/bookings";
import { listDiscounts } from "@/lib/services/discounts";
import { bookingRepository } from "@/lib/storage";
import { formatPrice } from "@/lib/utils/format";
import type { Booking, Slot } from "@/lib/domain/types";
import { AISlotManager } from "./AISlotManager";
import { BookingActions } from "./BookingActions";
import { CustomerInsights } from "./CustomerInsights";
import { DateNav } from "./DateNav";
import { DiscountManager } from "./DiscountManager";
import { PendingPaymentsAlert } from "./PendingPaymentsAlert";
import { RecentActivity } from "./RecentActivity";
import { SearchBookings } from "./SearchBookings";
import { SlotControls } from "./SlotControls";

interface PageProps {
  searchParams: Promise<{ date?: string; q?: string }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = todayAtVenue();
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const query = params.q?.trim() ?? "";

  const [
    bookings,
    pitchesAvail,
    discounts,
    allBookings,
    pendingBookings,
    searchResults,
  ] = await Promise.all([
    listBookingsForDate(date),
    getAllPitchesAvailability(date),
    listDiscounts(),
    bookingRepository.list(),
    bookingRepository.list({ status: "PENDING" }),
    query ? bookingRepository.list({ query }) : Promise.resolve<Booking[]>([]),
  ]);

  const active = bookings.filter((b) => b.status !== "CANCELLED");
  const paidBookings = active.filter((b) => b.paymentStatus === "PAID");
  const expectedFils = active.reduce(
    (sum, b) => sum + (b.priceFils - b.discountFils - b.refundFils),
    0,
  );
  const collectedFils = paidBookings.reduce(
    (sum, b) => sum + (b.priceFils - b.discountFils - b.refundFils),
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

  // Yesterday's revenue, for trend comparison.
  const yesterday = (() => {
    const d = parseVenueDate(date);
    d.setUTCDate(d.getUTCDate() - 1);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  })();
  const ydayBookings = await listBookingsForDate(yesterday);
  const ydayCollected = ydayBookings
    .filter((b) => b.status !== "CANCELLED" && b.paymentStatus === "PAID")
    .reduce(
      (sum, b) => sum + (b.priceFils - b.discountFils - b.refundFils),
      0,
    );
  const trend = collectedFils - ydayCollected;

  const bookingsByKey = new Map<string, Booking>();
  for (const b of active) bookingsByKey.set(`${b.pitch}|${b.hour}`, b);

  const isToday = date === today;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-slate-500">
            {isToday ? "Today" : "Schedule"}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {venueDateLabel(date)}
          </h1>
        </div>
        <span className="text-[11px] text-slate-500">
          {pendingBookings.length} pending · {allBookings.length} all-time
        </span>
      </header>

      <PendingPaymentsAlert pending={pendingBookings} />

      <DateNav date={date} today={today} />

      <SearchBookings initial={query} />

      {query ? (
        <SearchResults bookings={searchResults} query={query} />
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          label="Bookings"
          value={String(active.length)}
          tone="brand"
        />
        <KpiCard
          label="Open slots"
          value={`${openCount}/${totalSlots}`}
          tone="success"
        />
        <KpiCard
          label="Blocked"
          value={String(blockedCount)}
          tone="muted"
        />
        <KpiCard
          label="Revenue"
          value={formatPrice(collectedFils, branding.currency)}
          subtext={
            isToday
              ? trend === 0
                ? "= yesterday"
                : trend > 0
                ? `▲ ${formatPrice(trend, branding.currency)}`
                : `▼ ${formatPrice(-trend, branding.currency)}`
              : `Expected ${formatPrice(expectedFils, branding.currency)}`
          }
          subtone={
            isToday
              ? trend > 0
                ? "good"
                : trend < 0
                ? "bad"
                : "neutral"
              : "neutral"
          }
          tone="amber"
        />
      </section>

      <AISlotManager />

      {pitchesAvail.map(({ pitch, slots }) => (
        <PitchSection
          key={pitch}
          pitch={pitch}
          slots={slots}
          bookingsByKey={bookingsByKey}
        />
      ))}

      <RecentActivity bookings={allBookings} />

      <CustomerInsights bookings={allBookings} />

      <DiscountManager discounts={discounts} />

      {bookings.some((b) => b.status === "CANCELLED") ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-600">
            Cancelled on this day
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

function SearchResults({
  bookings,
  query,
}: {
  bookings: Booking[];
  query: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-pitch-200 bg-pitch-50 shadow-sm">
      <header className="flex items-center justify-between px-4 py-2 text-sm">
        <span className="font-semibold text-pitch-900">
          Search · {bookings.length} match{bookings.length === 1 ? "" : "es"} for &ldquo;{query}&rdquo;
        </span>
      </header>
      {bookings.length > 0 ? (
        <ul className="divide-y divide-pitch-200/50 bg-white">
          {bookings.slice(0, 12).map((b) => (
            <li
              key={b.ref}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">
                  {b.customerName}
                </div>
                <div className="truncate text-xs text-slate-500">
                  <span className="font-mono">{b.ref}</span> · {b.pitch} ·{" "}
                  {venueDateLabel(b.slotStart)} {venueTime(b.slotStart)} ·{" "}
                  {b.customerPhone}
                </div>
              </div>
              <Badge tone={statusTone(b)}>{statusText(b)}</Badge>
            </li>
          ))}
          {bookings.length > 12 ? (
            <li className="px-4 py-2 text-center text-[11px] text-slate-500">
              + {bookings.length - 12} more
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
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
        <Badge tone={statusTone(booking)}>{statusText(booking)}</Badge>
        {booking.discountFils > 0 ? (
          <Badge tone="warn">
            🏷 {booking.discountName ?? "Discount"}
          </Badge>
        ) : null}
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
          priceFils={booking.priceFils - booking.discountFils}
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

function KpiCard({
  label,
  value,
  subtext,
  tone = "brand",
  subtone = "neutral",
}: {
  label: string;
  value: string;
  subtext?: string;
  tone?: "brand" | "success" | "muted" | "amber";
  subtone?: "good" | "bad" | "neutral";
}) {
  const palette: Record<string, string> = {
    brand: "from-pitch-500/10 to-white text-pitch-900",
    success: "from-emerald-400/15 to-white text-emerald-900",
    muted: "from-slate-400/10 to-white text-slate-800",
    amber: "from-amber-400/15 to-white text-amber-900",
  };
  const subPalette: Record<string, string> = {
    good: "text-emerald-700",
    bad: "text-red-700",
    neutral: "text-slate-500",
  };
  return (
    <div
      className={
        "rounded-2xl border border-slate-200 bg-gradient-to-br px-3 py-3 shadow-sm " +
        palette[tone]
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-black tracking-tight">{value}</div>
      {subtext ? (
        <div className={"mt-0.5 text-[11px] font-medium " + subPalette[subtone]}>
          {subtext}
        </div>
      ) : null}
    </div>
  );
}

function statusTone(
  b: Booking,
): "default" | "success" | "muted" | "warn" | "danger" {
  if (b.status === "CANCELLED") return "danger";
  if (b.status === "DONE") return "muted";
  if (b.paymentStatus === "PAID") return "success";
  if (b.paymentStatus === "FAILED") return "danger";
  return "warn";
}

function statusText(b: Booking): string {
  if (b.status === "CANCELLED") return "Cancelled";
  if (b.status === "DONE") return "Done";
  if (b.paymentStatus === "PAID") return "Paid";
  if (b.paymentStatus === "FAILED") return "Pay failed";
  return "Awaiting pay";
}
