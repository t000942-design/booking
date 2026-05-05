import { branding } from "@/lib/config/branding";
import { formatPrice } from "@/lib/utils/format";
import type { Booking } from "@/lib/domain/types";

interface CustomerStat {
  phone: string;
  name: string;
  bookings: number;
  spentFils: number;
  lastBooked: Date;
}

function aggregate(bookings: Booking[]): CustomerStat[] {
  const map = new Map<string, CustomerStat>();
  for (const b of bookings) {
    const existing = map.get(b.customerPhone);
    if (existing) {
      existing.bookings += 1;
      existing.spentFils +=
        b.paymentStatus === "PAID"
          ? b.priceFils - b.discountFils - b.refundFils
          : 0;
      if (b.createdAt > existing.lastBooked) {
        existing.lastBooked = b.createdAt;
        existing.name = b.customerName;
      }
    } else {
      map.set(b.customerPhone, {
        phone: b.customerPhone,
        name: b.customerName,
        bookings: 1,
        spentFils:
          b.paymentStatus === "PAID"
            ? b.priceFils - b.discountFils - b.refundFils
            : 0,
        lastBooked: b.createdAt,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.bookings - a.bookings);
}

export function CustomerInsights({ bookings }: { bookings: Booking[] }) {
  const stats = aggregate(bookings);
  const top = stats.slice(0, 6);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
          Top customers
        </h2>
        <span className="text-xs text-slate-500">
          {stats.length} unique{stats.length === 1 ? "" : "s"}
        </span>
      </header>
      {top.length === 0 ? (
        <div className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-500">
          Customer insights show up after the first booking.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {top.map((s, i) => (
            <li
              key={s.phone}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pitch-100 text-xs font-bold text-pitch-700">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-semibold text-slate-900">{s.name}</div>
                <div className="truncate text-xs text-slate-500">
                  <a
                    href={`tel:${s.phone}`}
                    className="font-mono underline-offset-2 hover:underline"
                  >
                    {s.phone}
                  </a>{" "}
                  · {s.bookings} booking{s.bookings === 1 ? "" : "s"}
                </div>
              </div>
              <div className="text-right text-xs leading-tight">
                <div className="font-bold text-slate-900">
                  {formatPrice(s.spentFils, branding.currency)}
                </div>
                <div className="text-[10px] text-slate-400">spent</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
