import { venueDateLabel } from "@/lib/domain/slots";

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function DateNav({
  date,
  today,
}: {
  date: string;
  today: string;
}) {
  const isToday = date === today;
  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);

  return (
    <nav
      aria-label="Schedule date"
      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
    >
      <a
        href={`/admin?date=${prev}`}
        className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
        aria-label="Previous day"
      >
        <ChevronLeftIcon />
      </a>

      <div className="flex flex-1 flex-col items-center gap-0.5 leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {isToday ? "Today" : "Schedule for"}
        </span>
        <span className="text-base font-bold text-slate-900">
          {venueDateLabel(date)}
        </span>
      </div>

      <a
        href={`/admin?date=${next}`}
        className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
        aria-label="Next day"
      >
        <ChevronRightIcon />
      </a>

      {!isToday ? (
        <a
          href={`/admin?date=${today}`}
          className="ml-1 rounded-xl bg-pitch-700 px-3 text-xs font-semibold text-white hover:bg-pitch-800"
          style={{ height: 40, lineHeight: "40px" }}
        >
          Today
        </a>
      ) : null}
    </nav>
  );
}

function ChevronLeftIcon() {
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
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
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
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
