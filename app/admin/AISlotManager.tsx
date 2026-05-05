"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  applyScheduleAction,
  planScheduleAction,
  type ApplyResult,
  type PlanResult,
} from "@/lib/server/aiActions";

const SAMPLES = [
  "Block Friday 6-8pm next 2 weeks",
  "Block weekend mornings for 3 weeks",
  "Unblock Tuesday 18:00-20:00 next week",
  "Block pitch 1 every day 18-20 for maintenance",
];

export function AISlotManager() {
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [applyMsg, setApplyMsg] = useState<ApplyResult | null>(null);
  const [pending, startTransition] = useTransition();

  function preview() {
    setApplyMsg(null);
    startTransition(async () => {
      const result = await planScheduleAction(input);
      setPlan(result);
    });
  }

  function apply() {
    if (!plan?.ok) return;
    startTransition(async () => {
      const result = await applyScheduleAction(input);
      setApplyMsg(result);
      if (result.ok) {
        setPlan(null);
        setInput("");
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white shadow-lg">
      <header className="mb-3 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
          <SparkleIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold tracking-tight">AI Slot Manager</h2>
          <p className="text-xs text-white/70">
            Type natural language. I&apos;ll preview the changes before anything is applied.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Block Friday 6-8pm next 2 weeks"
          className="min-h-[68px] w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20"
          disabled={pending}
        />
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
              disabled={pending}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={preview}
            disabled={pending || !input.trim()}
          >
            {pending ? "Thinking…" : "Preview changes"}
          </Button>
          {plan?.ok ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={apply}
              disabled={pending}
            >
              Apply {plan.plan.changes.filter((c) => !c.alreadyApplied).length} change
              {plan.plan.changes.filter((c) => !c.alreadyApplied).length === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </div>

      {plan && !plan.ok ? (
        <div className="mt-4 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-100">
          {plan.error}
          {plan.hint ? <div className="mt-1 text-[12px] opacity-80">{plan.hint}</div> : null}
        </div>
      ) : null}

      {plan?.ok ? <PlanPreview plan={plan.plan} /> : null}

      {applyMsg ? (
        <div
          className={
            "mt-4 rounded-xl px-3 py-2 text-sm " +
            (applyMsg.ok
              ? "bg-emerald-500/15 text-emerald-100"
              : "bg-red-500/15 text-red-100")
          }
        >
          {applyMsg.ok
            ? `Applied ${applyMsg.applied} change${applyMsg.applied === 1 ? "" : "s"}.${
                applyMsg.skipped > 0
                  ? ` ${applyMsg.skipped} skipped (already in that state, or had bookings).`
                  : ""
              }`
            : applyMsg.error ?? "Apply failed."}
        </div>
      ) : null}
    </section>
  );
}

function PlanPreview({ plan }: { plan: import("@/lib/ai/types").SchedulePlan }) {
  const todo = plan.changes.filter((c) => !c.alreadyApplied);
  const noop = plan.changes.length - todo.length;

  if (plan.changes.length === 0) {
    return (
      <div className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/80">
        No matching slots in the chosen window.
      </div>
    );
  }

  // Group by date for compact preview
  const byDate = new Map<string, typeof todo>();
  for (const c of todo) {
    const arr = byDate.get(c.date) ?? [];
    arr.push(c);
    byDate.set(c.date, arr);
  }

  return (
    <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">
          {plan.command.action === "block" ? "Will block" : "Will unblock"}{" "}
          {todo.length} slot{todo.length === 1 ? "" : "s"}
        </span>
        {noop > 0 ? (
          <span className="text-[11px] text-white/60">
            ({noop} already done — skipping)
          </span>
        ) : null}
      </div>
      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1 text-[12px]">
        {Array.from(byDate.entries()).map(([date, changes]) => (
          <li key={date} className="leading-relaxed">
            <span className="font-mono text-white/60">{date}</span>{" "}
            <span className="text-white/90">
              {changes
                .map((c) => `${c.pitch} ${String(c.hour).padStart(2, "0")}:00`)
                .join(", ")}
            </span>
          </li>
        ))}
      </ul>
      {plan.warnings.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-amber-200">
          {plan.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
    </svg>
  );
}
