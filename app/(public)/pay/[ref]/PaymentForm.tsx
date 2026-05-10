"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import {
  cancelPendingBookingAction,
  startPaymentAction,
  type PaymentState,
} from "@/lib/server/paymentActions";
import type { PaymentMethod } from "@/lib/payments";

const initial: PaymentState = { error: null };

export function PaymentMethodButtons({
  refCode,
  methods,
}: {
  refCode: string;
  methods: PaymentMethod[];
}) {
  const [state, formAction, pending] = useActionState(startPaymentAction, initial);

  // When the server action succeeds, it returns a paymentUrl. We navigate
  // the browser there ourselves — server-side redirects to external origins
  // are unreliable from Server Actions.
  useEffect(() => {
    if (state.paymentUrl) {
      window.location.href = state.paymentUrl;
    }
  }, [state.paymentUrl]);

  const redirecting = pending || Boolean(state.paymentUrl);

  return (
    <div className="flex flex-col gap-2">
      {methods.length === 0 ? (
        <div className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/80">
          No payment methods configured.
        </div>
      ) : (
        methods.map((method) => (
          <form key={method.id} action={formAction}>
            <input type="hidden" name="ref" value={refCode} />
            <input type="hidden" name="paymentMethodId" value={method.id} />
            <Button
              type="submit"
              size="block"
              variant="primary"
              disabled={redirecting}
              className="justify-between"
            >
              <span className="flex items-center gap-2">
                <MethodIcon name={method.name} />
                {redirecting ? "Redirecting…" : `Pay with ${method.label}`}
              </span>
              <span aria-hidden>→</span>
            </Button>
          </form>
        ))
      )}

      <form action={cancelPendingBookingAction}>
        <input type="hidden" name="ref" value={refCode} />
        <button
          type="submit"
          className="w-full rounded-xl px-3 py-2 text-xs font-semibold text-white/80 underline-offset-4 hover:underline"
          disabled={redirecting}
        >
          Cancel this booking
        </button>
      </form>

      {state.error ? (
        <div className="mt-1 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-100">
          {state.error}
        </div>
      ) : null}
    </div>
  );
}

function MethodIcon({ name }: { name: string }) {
  if (name === "KNET") {
    return (
      <span
        className="grid h-6 w-10 place-items-center rounded bg-blue-700 text-[10px] font-black tracking-tight text-white"
        aria-hidden
      >
        K-NET
      </span>
    );
  }
  if (name === "ApplePay") {
    return (
      <span
        className="grid h-6 w-10 place-items-center rounded bg-black text-white"
        aria-hidden
      >
        <AppleIcon />
      </span>
    );
  }
  if (name === "VisaMaster") {
    return (
      <span className="grid h-6 w-10 place-items-center rounded bg-white text-[9px] font-bold tracking-tight text-slate-900">
        VISA
      </span>
    );
  }
  return (
    <span className="grid h-6 w-10 place-items-center rounded bg-white/15 text-[10px] font-semibold text-white">
      Pay
    </span>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M16.365 12.823c-.025-2.499 2.04-3.706 2.137-3.764-1.166-1.704-2.978-1.937-3.616-1.964-1.541-.156-3.005.91-3.787.91-.795 0-1.987-.886-3.27-.86-1.683.024-3.235.978-4.1 2.486-1.747 3.026-.447 7.49 1.255 9.946.832 1.196 1.823 2.541 3.119 2.493 1.252-.05 1.726-.81 3.243-.81 1.503 0 1.94.81 3.265.79 1.346-.025 2.196-1.22 3.018-2.42.953-1.39 1.347-2.74 1.371-2.81-.029-.014-2.633-1.012-2.66-4.012M13.93 5.473c.69-.836 1.158-2 1.03-3.156-1 .04-2.21.668-2.92 1.5-.642.74-1.198 1.926-1.05 3.06 1.119.087 2.247-.567 2.94-1.404" />
    </svg>
  );
}
