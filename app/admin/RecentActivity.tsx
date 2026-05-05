import { Badge } from "@/components/ui/Badge";
import { venueDateLabel, venueTime } from "@/lib/domain/slots";
import { formatPrice } from "@/lib/utils/format";
import type { Booking } from "@/lib/domain/types";

export function RecentActivity({ bookings }: { bookings: Booking[] }) {
  const recent = [...bookings]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
          Recent activity
        </h2>
        <span className="text-xs text-slate-500">{bookings.length} total</span>
      </header>
      {recent.length === 0 ? (
        <div className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-500">
          No bookings yet — once customers start booking, the latest will show up here.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {recent.map((b) => (
            <li
              key={b.ref}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span className={"h-8 w-1 shrink-0 rounded-full " + statusBar(b)} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    {b.customerName}
                  </span>
                  <StatusBadge booking={b} />
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {b.pitch} · {venueDateLabel(b.slotStart)} · {venueTime(b.slotStart)} ·{" "}
                  <span className="font-mono">{b.ref}</span>
                </div>
              </div>
              <div className="text-right text-xs leading-tight">
                <div className="font-bold text-slate-900">
                  {formatPrice(
                    b.priceFils - b.discountFils,
                    b.currency,
                  )}
                </div>
                <div className="text-[10px] text-slate-400">
                  {timeAgo(b.createdAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function statusBar(b: Booking): string {
  if (b.status === "CANCELLED") return "bg-red-300";
  if (b.status === "DONE") return "bg-slate-300";
  if (b.paymentStatus === "PAID") return "bg-emerald-500";
  if (b.paymentStatus === "FAILED") return "bg-red-500";
  return "bg-amber-400";
}

function StatusBadge({ booking }: { booking: Booking }) {
  if (booking.status === "CANCELLED") return <Badge tone="danger">Cancelled</Badge>;
  if (booking.status === "DONE") return <Badge tone="muted">Done</Badge>;
  if (booking.paymentStatus === "PAID") return <Badge tone="success">Paid</Badge>;
  if (booking.paymentStatus === "FAILED") return <Badge tone="danger">Pay failed</Badge>;
  return <Badge tone="warn">Awaiting pay</Badge>;
}

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}
