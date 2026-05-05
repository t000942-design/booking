import { branding } from "@/lib/config/branding";
import { venueDateLabel } from "@/lib/domain/slots";
import type { Discount, Slot } from "@/lib/domain/types";

const PITCH_DOTS: Record<string, string> = {
  "Pitch 1": "bg-emerald-400",
  "Pitch 2": "bg-sky-400",
  "Pitch 3": "bg-amber-400",
};

interface NextSlot {
  pitch: string;
  date: string;
  hour: number;
  label: string;
  endLabel: string;
  discount?: Discount | null;
}

/** Find the soonest open slot across all pitches/days. */
export function findNextOpenSlot(
  pitchData: { pitch: string; days: { date: string; slots: Slot[]; discounts: Discount[] }[] }[],
): NextSlot | null {
  let best: NextSlot | null = null;
  let bestTime = Infinity;
  for (const { pitch, days } of pitchData) {
    for (const { date, slots, discounts } of days) {
      for (const s of slots) {
        if (s.taken || s.blocked || s.inPast) continue;
        const ts = s.start.getTime();
        if (ts < bestTime) {
          bestTime = ts;
          const topDiscount = discounts.reduce<Discount | null>(
            (b, d) => (!b || d.percentOff > b.percentOff ? d : b),
            null,
          );
          best = {
            pitch,
            date,
            hour: s.hour,
            label: s.label,
            endLabel: s.endLabel,
            discount: topDiscount,
          };
        }
      }
    }
  }
  return best;
}

export function NextSlotCard({
  next,
}: {
  next: NextSlot | null;
}) {
  if (!next) return null;
  const dot = PITCH_DOTS[next.pitch] ?? "bg-pitch-400";
  const q = new URLSearchParams({
    date: next.date,
    pitch: next.pitch,
    hour: String(next.hour),
  });

  return (
    <a
      href={`/book?${q.toString()}#details`}
      className="group block overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-pitch-700/80 via-pitch-800/80 to-pitch-950/80 p-4 text-white shadow-xl backdrop-blur-xl transition hover:from-pitch-600/85 hover:to-pitch-900/85"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 text-lg">
          ⚡
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
            Quick book · soonest open
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            <span className="font-bold">{next.pitch}</span>
            <span className="text-white/70">·</span>
            <span className="font-semibold">{venueDateLabel(next.date)}</span>
            <span className="text-white/70">·</span>
            <span className="font-bold">
              {next.label}–{next.endLabel}
            </span>
          </div>
          {next.discount ? (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-200">
              🏷 {next.discount.name} · {next.discount.percentOff}% OFF
            </div>
          ) : null}
        </div>
        <span className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-pitch-900 shadow group-hover:bg-pitch-50">
          {branding.currency} {(branding.priceFils / 1000).toFixed(0)} →
        </span>
      </div>
    </a>
  );
}
