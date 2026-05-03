"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import {
  createBookingAction,
  type BookingState,
} from "@/lib/server/bookingActions";

const initial: BookingState = { error: null };

interface Props {
  date: string;
  hour: number | null;
  pitch: string;
  priceFils: number;
  currency: string;
  sessionName: string | null;
  availableHours: number[];
}

export function BookingForm({
  date,
  hour,
  pitch,
  priceFils,
  currency,
  sessionName,
  availableHours,
}: Props) {
  const [state, formAction, pending] = useActionState(createBookingAction, initial);
  const fieldErrors = state.fieldErrors ?? {};
  const slotChosen = hour !== null;
  const slotValid = slotChosen && availableHours.includes(hour);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="hour" value={hour ?? ""} />
      <input type="hidden" name="pitch" value={pitch} />

      <div className="rounded-xl border border-pitch-200 bg-pitch-50 px-3 py-2 text-sm">
        {slotValid ? (
          <div className="flex items-center justify-between">
            <span>
              <span className="text-pitch-900/70">{pitch} · </span>
              <span className="font-semibold">
                {String(hour).padStart(2, "0")}:00 – {String(hour + 1).padStart(2, "0")}:00
              </span>
            </span>
          </div>
        ) : (
          <span className="text-pitch-900/70">
            Pick a slot above to continue.
          </span>
        )}
      </div>

      <Field
        label="Your name"
        htmlFor="customerName"
        required
        error={fieldErrors.customerName}
      >
        <Input
          id="customerName"
          name="customerName"
          autoComplete="name"
          placeholder="e.g. Ahmed"
          required
          defaultValue={sessionName ?? ""}
          disabled={pending}
          invalid={Boolean(fieldErrors.customerName)}
        />
      </Field>

      <Field label="Team name (optional)" htmlFor="teamName">
        <Input
          id="teamName"
          name="teamName"
          placeholder="e.g. Salmiya Strikers"
          disabled={pending}
          invalid={Boolean(fieldErrors.teamName)}
        />
      </Field>

      <Field label="Notes (optional)" htmlFor="notes" error={fieldErrors.notes}>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Anything the owner should know — bibs, balls, gate access…"
          maxLength={500}
          disabled={pending}
          invalid={Boolean(fieldErrors.notes)}
        />
      </Field>

      {state.error ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" size="block" disabled={pending || !slotValid}>
        {pending
          ? "Booking…"
          : `Confirm · ${currency} ${(priceFils / 1000).toFixed(0)}`}
      </Button>
      <p className="text-center text-xs text-pitch-900/60">
        Pay on arrival. Cancel up to 2 hours before.
      </p>
    </form>
  );
}
