import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { branding } from "@/lib/config/branding";
import { venueDateLabel, venueTime } from "@/lib/domain/slots";
import { formatPrice } from "@/lib/utils/format";
import type { Booking } from "@/lib/domain/types";

export function PendingPaymentsAlert({ pending }: { pending: Booking[] }) {
  if (pending.length === 0) return null;
  const totalFils = pending.reduce(
    (sum, b) => sum + (b.priceFils - b.discountFils),
    0,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 shadow-sm">
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-700">
          <ClockIcon />
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Awaiting payment
          </div>
          <div className="text-sm text-amber-900">
            {pending.length} booking{pending.length === 1 ? "" : "s"} ·{" "}
            {formatPrice(totalFils, branding.currency)} pending
          </div>
        </div>
      </header>
      <ul className="divide-y divide-amber-200/70 bg-white/40">
        {pending.slice(0, 5).map((b) => (
          <li
            key={b.ref}
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-amber-950">{b.customerName}</span>
                <Badge tone="warn">PENDING</Badge>
              </div>
              <div className="mt-0.5 text-xs text-amber-900/80">
                {b.pitch} · {venueDateLabel(b.slotStart)} · {venueTime(b.slotStart)}
                {" · "}
                <a
                  href={`tel:${b.customerPhone}`}
                  className="underline-offset-2 hover:underline"
                >
                  {b.customerPhone}
                </a>
              </div>
            </div>
            <Link
              href={`/pay/${b.ref}`}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
            >
              View
            </Link>
          </li>
        ))}
        {pending.length > 5 ? (
          <li className="px-4 py-2 text-center text-[11px] text-amber-800/70">
            + {pending.length - 5} more
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
