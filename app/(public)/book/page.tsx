import { requireCustomer } from "@/lib/auth/guards";
import { branding } from "@/lib/config/branding";
import {
  todayAtVenue,
  upcomingDates,
  venueDateLabel,
} from "@/lib/domain/slots";
import { getDayAvailability } from "@/lib/services/bookings";
import { findDiscountsForDate } from "@/lib/services/discounts";
import { bookingRepository } from "@/lib/storage";
import type { Discount, Slot } from "@/lib/domain/types";
import { LobbyBackdrop } from "@/components/LobbyBackdrop";
import { AIAssistant } from "./AIAssistant";
import { BookingForm } from "./BookingForm";

interface PageProps {
  searchParams: Promise<{ date?: string; hour?: string; pitch?: string }>;
}

const PITCH_ACCENTS: Record<
  string,
  { idle: string; selected: string; dot: string; bar: string; tint: string }
> = {
  "Pitch 1": {
    idle: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
    selected: "bg-emerald-700 text-white",
    dot: "bg-emerald-500",
    bar: "from-emerald-400 to-emerald-700",
    tint: "from-white to-emerald-50",
  },
  "Pitch 2": {
    idle: "bg-sky-100 text-sky-900 hover:bg-sky-200",
    selected: "bg-sky-700 text-white",
    dot: "bg-sky-500",
    bar: "from-sky-400 to-sky-700",
    tint: "from-white to-sky-50",
  },
  "Pitch 3": {
    idle: "bg-amber-100 text-amber-900 hover:bg-amber-200",
    selected: "bg-amber-700 text-white",
    dot: "bg-amber-500",
    bar: "from-amber-400 to-amber-700",
    tint: "from-white to-amber-50",
  },
};

const FALLBACK_ACCENT = {
  idle: "bg-pitch-100 text-pitch-900 hover:bg-pitch-200",
  selected: "bg-pitch-700 text-white",
  dot: "bg-pitch-500",
  bar: "from-pitch-400 to-pitch-700",
  tint: "from-white to-pitch-50",
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

  // For each pitch, fetch its availability across all 7 days, plus the
  // discounts active per day (used for badges).
  const pitchData = await Promise.all(
    branding.pitches.map(async (pitch) => {
      const days7 = await Promise.all(
        days.map(async (date) => ({
          date,
          slots: await getDayAvailability(date, pitch),
          discounts: await findDiscountsForDate(date),
        })),
      );
      return { pitch, days: days7 };
    }),
  );

  // Available hours for the form (depend on selected pitch + date).
  const selectedSlots =
    pitchData
      .find((p) => p.pitch === selectedPitch)
      ?.days.find((d) => d.date === selectedDate)?.slots ?? [];
  const availableHours = selectedSlots
    .filter((s) => !s.taken && !s.blocked && !s.inPast)
    .map((s) => s.hour);

  const slotChosen =
    selectedHour !== null &&
    selectedPitch &&
    availableHours.includes(selectedHour);

  // Pending unpaid booking banner
  const myBookings = await bookingRepository.list({
    query: session.phone,
    status: "PENDING",
  });
  const pendingBooking = myBookings.find((b) => b.customerPhone === session.phone);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <LobbyBackdrop />
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight drop-shadow">
          Pick your pitch
        </h1>
        <p className="mt-1 text-sm text-white/85">
          {branding.pitchName} · {branding.location}
        </p>
      </div>

      {pendingBooking ? (
        <a
          href={`/pay/${pendingBooking.ref}`}
          className="block rounded-2xl border border-amber-300 bg-amber-100 px-4 py-3 text-amber-900 shadow-md transition hover:bg-amber-200"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-300/70">
              <ClockIcon />
            </div>
            <div className="flex-1 leading-tight">
              <div className="text-xs font-semibold uppercase tracking-wider">
                Awaiting payment
              </div>
              <div className="text-sm">
                {pendingBooking.pitch} · {venueDateLabel(pendingBooking.slotStart)} ·{" "}
                {String(pendingBooking.hour).padStart(2, "0")}:00
              </div>
            </div>
            <span className="text-sm font-bold">Resume →</span>
          </div>
        </a>
      ) : null}

      <section className="flex flex-col gap-5">
        {pitchData.map(({ pitch, days: pitchDays }) => (
          <PitchSection
            key={pitch}
            pitch={pitch}
            today={today}
            pitchDays={pitchDays}
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

function PitchSection({
  pitch,
  today,
  pitchDays,
  selectedDate,
  selectedPitch,
  selectedHour,
}: {
  pitch: string;
  today: string;
  pitchDays: { date: string; slots: Slot[]; discounts: Discount[] }[];
  selectedDate: string;
  selectedPitch: string;
  selectedHour: number | null;
}) {
  const accent = PITCH_ACCENTS[pitch] ?? FALLBACK_ACCENT;
  const photo = branding.pitchPhotos[pitch];
  const tagline = branding.pitchTaglines[pitch];

  const totalOpen = pitchDays.reduce(
    (sum, d) =>
      sum + d.slots.filter((s) => !s.taken && !s.blocked && !s.inPast).length,
    0,
  );

  return (
    <article
      id={`pitch-${pitch.replace(/\s+/g, "-")}`}
      className={`field-card overflow-hidden rounded-3xl bg-gradient-to-br ${accent.tint} text-pitch-950 shadow-lg shadow-pitch-900/10`}
    >
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} />
          <h2 className="text-lg font-black tracking-tight">{pitch}</h2>
        </div>
        <span className="text-[11px] font-semibold text-pitch-900/70">
          {totalOpen} open · 7 days
        </span>
      </header>
      {tagline ? (
        <p className="px-4 pb-2 text-xs text-pitch-900/65">{tagline}</p>
      ) : null}

      {/* Calendar (rows = days, slots for THIS pitch) */}
      <div className="mx-4 mb-4 mt-2 overflow-hidden rounded-2xl bg-white/85 ring-1 ring-pitch-900/5">
        <ul className="divide-y divide-pitch-100">
          {pitchDays.map(({ date, slots, discounts }) => {
            const open = slots.filter(
              (s) => !s.taken && !s.blocked && !s.inPast,
            ).length;
            const topDiscount = discounts.reduce<Discount | null>(
              (best, d) =>
                !best || d.percentOff > best.percentOff ? d : best,
              null,
            );
            return (
              <li key={date} className="px-3 py-2.5 sm:px-4">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[13px] font-bold tracking-tight">
                      {date === today ? (
                        <span className="rounded-md bg-pitch-700 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                          Today
                        </span>
                      ) : (
                        venueDateLabel(date).split(" ")[0]
                      )}{" "}
                      <span className="text-pitch-900/60 font-semibold">
                        {venueDateLabel(date).slice(
                          venueDateLabel(date).indexOf(" ") + 1,
                        )}
                      </span>
                    </span>
                    {topDiscount ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                        🏷 {topDiscount.percentOff}% OFF
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-semibold text-pitch-900/55">
                    {open} open
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((s) => (
                    <SlotChip
                      key={s.hour}
                      slot={s}
                      date={date}
                      pitch={pitch}
                      isSelected={
                        selectedDate === date &&
                        selectedPitch === pitch &&
                        selectedHour === s.hour
                      }
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Photo of this pitch */}
      {photo ? (
        <figure className="relative h-44 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt={`${pitch} at ${branding.pitchName}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <figcaption className="absolute bottom-0 left-0 right-0 px-4 pb-3 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-widest opacity-80">
              {pitch}
            </div>
            <div className="text-sm font-medium">
              {tagline ?? "7-a-side"}
            </div>
          </figcaption>
        </figure>
      ) : null}
    </article>
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

function SlotChip({
  slot,
  date,
  pitch,
  isSelected,
}: {
  slot: Slot;
  date: string;
  pitch: string;
  isSelected: boolean;
}) {
  const disabled = slot.taken || slot.blocked || slot.inPast;
  const accent = PITCH_ACCENTS[pitch] ?? FALLBACK_ACCENT;
  const q = new URLSearchParams({
    date,
    pitch,
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
        "slot-chip inline-flex min-w-[54px] items-center justify-center rounded-lg px-2 py-1.5 text-sm font-semibold " +
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
