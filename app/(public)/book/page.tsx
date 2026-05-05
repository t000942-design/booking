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

  // Available hours for the currently selected pitch + date (used by the form).
  const selectedDayPitches = calendar.find((d) => d.date === selectedDate);
  const selectedSlots =
    selectedDayPitches?.pitches.find((p) => p.pitch === selectedPitch)?.slots ?? [];
  const availableHours = selectedSlots
    .filter((s) => !s.taken && !s.blocked && !s.inPast)
    .map((s) => s.hour);

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

      <AIAssistant />

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
                    ? "bg-white text-pitch-900 font-bold"
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
      className="field-card rounded-2xl bg-gradient-to-br from-white to-pitch-50 p-4 text-pitch-950 shadow-lg shadow-pitch-900/10 scroll-mt-20 transition hover:shadow-xl"
    >
      <header className="mb-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-bold tracking-tight">
            {isToday ? "Today" : venueDateLabel(date).split(" ")[0]}{" "}
            <span className="text-pitch-900/60">
              · {venueDateLabel(date).slice(venueDateLabel(date).indexOf(" ") + 1)}
            </span>
          </h3>
          <span className="text-[11px] font-semibold text-pitch-900/70">
            {openSlots} open
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pitch-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pitch-500 to-pitch-700 transition-all"
            style={{ width: `${fillPct}%` }}
            aria-label={`${fillPct}% booked`}
          />
        </div>
      </header>
      <ul className="flex flex-col gap-3">
        {pitches.map(({ pitch, slots }) => {
          const isSelectedPitch =
            selectedDate === date && selectedPitch === pitch;
          return (
            <li key={pitch}>
              <div className="mb-1.5 flex items-center justify-between text-xs uppercase tracking-wider text-pitch-900/70">
                <span className="font-semibold">{pitch}</span>
                <span className="text-[10px]">
                  {slots.filter((s) => !s.taken && !s.blocked && !s.inPast).length}{" "}
                  open
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => (
                  <SlotChip
                    key={s.hour}
                    slot={s}
                    date={date}
                    isSelected={
                      isSelectedPitch && selectedHour === s.hour
                    }
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
        "inline-flex min-w-[58px] items-center justify-center rounded-lg px-2 py-1.5 text-sm font-semibold transition " +
        (disabled
          ? "cursor-not-allowed bg-pitch-900/5 text-pitch-900/30 line-through"
          : isSelected
          ? "bg-pitch-700 text-white shadow"
          : "bg-pitch-100 text-pitch-900 hover:bg-pitch-200")
      }
    >
      {slot.label}
    </a>
  );
}
