import { requireCustomer } from "@/lib/auth/guards";
import { branding } from "@/lib/config/branding";
import {
  todayAtVenue,
  upcomingDates,
  venueDateLabel,
} from "@/lib/domain/slots";
import { getAllPitchesAvailability } from "@/lib/services/bookings";
import type { Slot } from "@/lib/domain/types";
import { AIAssistant } from "./AIAssistant";
import { BookingForm } from "./BookingForm";

interface PageProps {
  searchParams: Promise<{ date?: string; hour?: string; pitch?: string }>;
}

/** Pitch-by-name accent palette for slot chips. */
const PITCH_ACCENTS: Record<
  string,
  { idle: string; selected: string; hint: string; dot: string }
> = {
  "Pitch 1": {
    idle: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
    selected: "bg-emerald-700 text-white",
    hint: "text-emerald-800/70",
    dot: "bg-emerald-500",
  },
  "Pitch 2": {
    idle: "bg-sky-100 text-sky-900 hover:bg-sky-200",
    selected: "bg-sky-700 text-white",
    hint: "text-sky-800/70",
    dot: "bg-sky-500",
  },
  "Pitch 3": {
    idle: "bg-amber-100 text-amber-900 hover:bg-amber-200",
    selected: "bg-amber-700 text-white",
    hint: "text-amber-800/70",
    dot: "bg-amber-500",
  },
};

const FALLBACK_ACCENT = {
  idle: "bg-pitch-100 text-pitch-900 hover:bg-pitch-200",
  selected: "bg-pitch-700 text-white",
  hint: "text-pitch-900/70",
  dot: "bg-pitch-500",
};

export default async function BookPage({ searchParams }: PageProps) {
  const session = await requireCustomer();
  const params = await searchParams;

  const days = upcomingDates(7);
  const today = todayAtVenue();

  const selectedDate = days.includes(params.date ?? "")
    ? (params.date as string)
    : today;
  const selectedPitch = branding.pitches.includes(params.pitch ?? "")
    ? (params.pitch as string)
    : "";
  const selectedHour =
    params.hour && /^\d+$/.test(params.hour) ? Number(params.hour) : null;

  const calendar = await Promise.all(
    days.map(async (date) => ({
      date,
      pitches: await getAllPitchesAvailability(date),
    })),
  );

  const selectedDayPitches = calendar.find((d) => d.date === selectedDate);
  const selectedSlots =
    selectedDayPitches?.pitches.find((p) => p.pitch === selectedPitch)?.slots ?? [];
  const availableHours = selectedSlots
    .filter((s) => !s.taken && !s.blocked && !s.inPast)
    .map((s) => s.hour);

  const slotChosen =
    selectedHour !== null &&
    selectedPitch &&
    availableHours.includes(selectedHour);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight drop-shadow">
          Book a pitch
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {branding.pitchName} · {branding.location}
        </p>
      </div>

      <DayJumpBar days={days} today={today} selected={selectedDate} />

      <section className="flex flex-col gap-3">
        {calendar.map(({ date, pitches }) => (
          <DayCard
            key={date}
            date={date}
            isToday={date === today}
            pitches={pitches}
            selectedDate={selectedDate}
            selectedPitch={selectedPitch}
            selectedHour={selectedHour}
          />
        ))}
      </section>

      <section
        id="details"
        className="field-card rounded-2xl p-5 text-pitch-950 scroll-mt-6"
      >
        <h2 className="text-lg font-bold tracking-tight">Your details</h2>
        <p className="mt-1 text-sm text-pitch-900/70">
          Signed in as <span className="font-mono">{session.phone}</span>
          {session.name ? ` · ${session.name}` : null}
        </p>
        <div className="mt-4">
          <BookingForm
            date={selectedDate}
            hour={selectedHour}
            pitch={selectedPitch || branding.pitches[0]}
            priceFils={branding.priceFils}
            currency={branding.currency}
            sessionName={session.name ?? null}
            availableHours={availableHours}
          />
        </div>
      </section>

      {slotChosen ? (
        <StickyActionBar
          pitch={selectedPitch}
          date={selectedDate}
          hour={selectedHour as number}
          priceFils={branding.priceFils}
          currency={branding.currency}
        />
      ) : null}

      <AIAssistant />
    </div>
  );
}

function StickyActionBar({
  pitch,
  date,
  hour,
  priceFils,
  currency,
}: {
  pitch: string;
  date: string;
  hour: number;
  priceFils: number;
  currency: string;
}) {
  const accent = PITCH_ACCENTS[pitch] ?? FALLBACK_ACCENT;
  return (
    <div className="action-bar">
      <div className="action-bar-card mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent.dot}`} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
            Selected
          </div>
          <div className="truncate text-sm font-semibold">
            {pitch} · {venueDateLabel(date)} · {String(hour).padStart(2, "0")}:00
          </div>
        </div>
        <a
          href="#details"
          className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-pitch-900 shadow hover:bg-pitch-50"
        >
          {currency} {(priceFils / 1000).toFixed(0)} →
        </a>
      </div>
    </div>
  );
}

function DayJumpBar({
  days,
  today,
  selected,
}: {
  days: string[];
  today: string;
  selected: string;
}) {
  return (
    <nav
      aria-label="Jump to day"
      className="-mx-4 sticky top-0 z-10 overflow-x-auto bg-pitch-950/40 px-4 py-2 backdrop-blur"
    >
      <ul className="flex gap-2">
        {days.map((d) => {
          const active = d === selected;
          const label = venueDateLabel(d);
          const [dow, ...rest] = label.split(" ");
          const num = rest.join(" ");
          return (
            <li key={d} className="shrink-0">
              <a
                href={`#day-${d}`}
                className={
                  "flex min-w-[68px] flex-col items-center rounded-xl px-2 py-1 text-xs transition " +
                  (active
                    ? "bg-white text-pitch-900 font-bold shadow"
                    : "bg-white/10 text-white hover:bg-white/20")
                }
              >
                <span className="uppercase tracking-wider opacity-80">
                  {d === today ? "Today" : dow}
                </span>
                <span className="text-sm font-semibold">{num}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DayCard({
  date,
  isToday,
  pitches,
  selectedDate,
  selectedPitch,
  selectedHour,
}: {
  date: string;
  isToday: boolean;
  pitches: { pitch: string; slots: Slot[] }[];
  selectedDate: string;
  selectedPitch: string;
  selectedHour: number | null;
}) {
  const totalSlots = pitches.reduce((sum, p) => sum + p.slots.length, 0);
  const openSlots = pitches.reduce(
    (sum, p) => sum + p.slots.filter((s) => !s.taken && !s.blocked && !s.inPast).length,
    0,
  );
  const fillPct = totalSlots > 0 ? Math.round(((totalSlots - openSlots) / totalSlots) * 100) : 0;

  return (
    <div
      id={`day-${date}`}
      className="field-card rounded-3xl bg-gradient-to-br from-white to-pitch-50 p-4 text-pitch-950 shadow-lg shadow-pitch-900/10 scroll-mt-20 transition hover:shadow-xl"
    >
      <header className="mb-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-bold tracking-tight">
            {isToday ? (
              <span className="rounded-md bg-pitch-700 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
                Today
              </span>
            ) : (
              <>{venueDateLabel(date).split(" ")[0]}</>
            )}{" "}
            <span className="text-pitch-900/60">
              {venueDateLabel(date).slice(venueDateLabel(date).indexOf(" ") + 1)}
            </span>
          </h3>
          <span className="text-[11px] font-semibold text-pitch-900/70">
            {openSlots} open
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pitch-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pitch-500 to-pitch-700 transition-all duration-500"
            style={{ width: `${fillPct}%` }}
            aria-label={`${fillPct}% booked`}
          />
        </div>
      </header>
      <ul className="flex flex-col gap-3">
        {pitches.map(({ pitch, slots }) => {
          const isSelectedPitch =
            selectedDate === date && selectedPitch === pitch;
          const accent = PITCH_ACCENTS[pitch] ?? FALLBACK_ACCENT;
          const open = slots.filter((s) => !s.taken && !s.blocked && !s.inPast).length;
          return (
            <li key={pitch}>
              <div className="mb-1.5 flex items-center justify-between text-xs uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
                  <span className="font-semibold text-pitch-900/85">{pitch}</span>
                </span>
                <span className={`text-[10px] ${accent.hint}`}>
                  {open} open
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => (
                  <SlotChip
                    key={s.hour}
                    slot={s}
                    date={date}
                    isSelected={isSelectedPitch && selectedHour === s.hour}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SlotChip({
  slot,
  date,
  isSelected,
}: {
  slot: Slot;
  date: string;
  isSelected: boolean;
}) {
  const disabled = slot.taken || slot.blocked || slot.inPast;
  const accent = PITCH_ACCENTS[slot.pitch] ?? FALLBACK_ACCENT;
  const q = new URLSearchParams({
    date,
    pitch: slot.pitch,
    hour: String(slot.hour),
  });
  const href = disabled ? "#" : `/book?${q.toString()}#details`;
  const reason = slot.blocked
    ? "Closed"
    : slot.taken
    ? "Taken"
    : slot.inPast
    ? "Past"
    : null;

  return (
    <a
      href={href}
      aria-disabled={disabled}
      title={reason ?? undefined}
      className={
        "slot-chip inline-flex min-w-[58px] items-center justify-center rounded-lg px-2 py-1.5 text-sm font-semibold " +
        (disabled
          ? "cursor-not-allowed bg-pitch-900/5 text-pitch-900/30 line-through"
          : isSelected
          ? `${accent.selected} shadow-md`
          : accent.idle)
      }
    >
      {slot.label}
    </a>
  );
}
