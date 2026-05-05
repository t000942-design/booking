"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import {
  createDiscountAction,
  deleteDiscountAction,
  toggleDiscountAction,
  type DiscountState,
} from "@/lib/server/discountActions";
import type { Discount } from "@/lib/domain/types";

const DOW = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const initial: DiscountState = { error: null };

export function DiscountManager({ discounts }: { discounts: Discount[] }) {
  const [state, formAction, pending] = useActionState(createDiscountAction, initial);
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
            <TagIcon />
          </span>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
              Discounts
            </h2>
            <p className="text-xs text-slate-500">
              {discounts.filter((d) => d.active).length} active ·{" "}
              {discounts.length} total
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={open ? "outline" : "primary"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Cancel" : "+ New discount"}
        </Button>
      </header>

      {open ? (
        <form
          action={(fd) => {
            formAction(fd);
            // We can't await the action here; rely on revalidatePath updates.
            setTimeout(() => setOpen(false), 200);
          }}
          className="border-t border-slate-100 bg-slate-50 px-4 py-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="d-name" required error={fieldErrors.name}>
              <Input
                id="d-name"
                name="name"
                placeholder="Black Friday"
                required
                disabled={pending}
                invalid={Boolean(fieldErrors.name)}
              />
            </Field>
            <Field label="Percent off" htmlFor="d-percent" required error={fieldErrors.percentOff}>
              <Input
                id="d-percent"
                name="percentOff"
                type="number"
                min={1}
                max={100}
                placeholder="30"
                required
                disabled={pending}
                invalid={Boolean(fieldErrors.percentOff)}
              />
            </Field>
            <Field label="Valid from" htmlFor="d-from" required error={fieldErrors.validFrom}>
              <Input
                id="d-from"
                name="validFrom"
                type="date"
                required
                disabled={pending}
                invalid={Boolean(fieldErrors.validFrom)}
              />
            </Field>
            <Field label="Valid to" htmlFor="d-to" required error={fieldErrors.validTo}>
              <Input
                id="d-to"
                name="validTo"
                type="date"
                required
                disabled={pending}
                invalid={Boolean(fieldErrors.validTo)}
              />
            </Field>
          </div>
          <Field label="Description (optional)" htmlFor="d-desc" className="mt-3">
            <Input
              id="d-desc"
              name="description"
              placeholder="30% off any Friday slot"
              disabled={pending}
            />
          </Field>
          <fieldset className="mt-3">
            <legend className="mb-1.5 text-xs font-medium text-slate-700">
              Days (leave none for every day)
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {DOW.map((d) => (
                <label
                  key={d.value}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs has-[:checked]:border-pitch-500 has-[:checked]:bg-pitch-50 has-[:checked]:text-pitch-900"
                >
                  <input
                    type="checkbox"
                    name="daysOfWeek"
                    value={d.value}
                    className="h-3 w-3"
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>
          {state.error && !state.fieldErrors ? (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" size="sm" variant="primary" disabled={pending}>
              {pending ? "Creating…" : "Create discount"}
            </Button>
          </div>
        </form>
      ) : null}

      {discounts.length > 0 ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {discounts.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-4 py-3">
              <span
                className={
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg font-bold " +
                  (d.active
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-500")
                }
              >
                {d.percentOff}%
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{d.name}</span>
                  {!d.active ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Paused
                    </span>
                  ) : null}
                </div>
                {d.description ? (
                  <div className="text-sm text-slate-600">{d.description}</div>
                ) : null}
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {d.validFrom} → {d.validTo}
                  {d.daysOfWeek.length > 0
                    ? ` · ${d.daysOfWeek
                        .map((dow) => DOW.find((x) => x.value === dow)?.label)
                        .join(", ")}`
                    : ""}
                </div>
              </div>
              <div className="flex gap-1">
                <form
                  action={(fd) => {
                    startTransition(() => {
                      void toggleDiscountAction(fd);
                    });
                  }}
                >
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="active" value={d.active ? "false" : "true"} />
                  <Button type="submit" size="sm" variant="outline">
                    {d.active ? "Pause" : "Resume"}
                  </Button>
                </form>
                <form
                  action={(fd) => {
                    startTransition(() => {
                      void deleteDiscountAction(fd);
                    });
                  }}
                >
                  <input type="hidden" name="id" value={d.id} />
                  <Button type="submit" size="sm" variant="danger">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-500">
          No discounts yet. Create one to make slots cheaper for a window of time.
        </div>
      )}
    </section>
  );
}

function TagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-7.2-7.2A2 2 0 013 12V5a2 2 0 012-2h7a2 2 0 011.4.6l7.2 7.2a2 2 0 010 2.8z" />
      <circle cx="8" cy="8" r="1.5" />
    </svg>
  );
}
