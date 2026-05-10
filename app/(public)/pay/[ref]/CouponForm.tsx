"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  applyCouponAction,
  type CouponState,
} from "@/lib/server/paymentActions";

const initial: CouponState = { ok: false, error: null };

export function CouponForm({
  refCode,
  appliedName,
  appliedFils,
  currency,
}: {
  refCode: string;
  appliedName: string | null;
  appliedFils: number;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState(applyCouponAction, initial);
  const hasApplied = appliedFils > 0 && appliedName;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
          Coupon
        </span>
        {hasApplied ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-100">
            ✓ {appliedName} applied
          </span>
        ) : null}
      </div>

      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="ref" value={refCode} />
        <input
          type="text"
          name="code"
          placeholder="e.g. SUMMER10"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          disabled={pending}
          className="h-10 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-mono uppercase tracking-widest text-white placeholder:text-white/40 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20"
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={pending}
          className="px-4"
        >
          {pending ? "…" : hasApplied ? "Replace" : "Apply"}
        </Button>
      </form>

      {state.error ? (
        <div className="mt-2 rounded-lg bg-red-500/15 px-2 py-1.5 text-[11px] text-red-100">
          {state.error}
        </div>
      ) : null}
      {state.ok && state.applied ? (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[11px] text-emerald-100">
          <span>
            ✓ {state.applied.name} · {state.applied.percentOff}% off
          </span>
          <span className="font-semibold">
            −{currency} {(state.applied.discountFils / 1000).toFixed(3)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
