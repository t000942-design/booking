"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  cancelPendingBookingAction,
  startPaymentAction,
  type PaymentState,
} from "@/lib/server/paymentActions";

const initial: PaymentState = { error: null };

export function PaymentForm({ refCode }: { refCode: string }) {
  const [state, formAction, pending] = useActionState(startPaymentAction, initial);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <input type="hidden" name="ref" value={refCode} />
        <Button type="submit" size="block" variant="primary" disabled={pending}>
          {pending ? "Redirecting…" : "Pay with MyFatoorah →"}
        </Button>
      </form>

      <form action={cancelPendingBookingAction}>
        <input type="hidden" name="ref" value={refCode} />
        <button
          type="submit"
          className="w-full rounded-xl px-3 py-2 text-xs font-semibold text-white/80 underline-offset-4 hover:underline"
          disabled={pending}
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
