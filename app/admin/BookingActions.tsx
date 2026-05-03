"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  cancelAction,
  markDoneAction,
  refundAction,
} from "@/lib/server/bookingActions";

interface Props {
  refCode: string;
  status: string;
  refundFils: number;
  priceFils: number;
}

export function BookingActions({ refCode, status, refundFils, priceFils }: Props) {
  const [pending, startTransition] = useTransition();
  const isCancelled = status === "CANCELLED";
  const isDone = status === "DONE";
  const fullyRefunded = refundFils >= priceFils;
  const hasRefund = refundFils > 0;

  if (isCancelled) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {!isDone ? (
        <ActionForm
          action={markDoneAction}
          refCode={refCode}
          variant="primary"
          label="Mark done"
          pending={pending}
          startTransition={startTransition}
        />
      ) : null}
      {!isDone ? (
        <ActionForm
          action={cancelAction}
          refCode={refCode}
          variant="outline"
          label="Cancel"
          pending={pending}
          startTransition={startTransition}
        />
      ) : null}
      {!fullyRefunded ? (
        <RefundForm
          refCode={refCode}
          kind="full"
          label="Refund full"
          pending={pending}
          startTransition={startTransition}
        />
      ) : null}
      {!fullyRefunded && !hasRefund ? (
        <RefundForm
          refCode={refCode}
          kind="half"
          label="Refund 50%"
          pending={pending}
          startTransition={startTransition}
        />
      ) : null}
    </div>
  );
}

function ActionForm({
  action,
  refCode,
  variant,
  label,
  pending,
  startTransition,
}: {
  action: (fd: FormData) => Promise<void>;
  refCode: string;
  variant: "primary" | "outline" | "danger";
  label: string;
  pending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  return (
    <form
      action={(fd) => {
        startTransition(() => {
          void action(fd);
        });
      }}
    >
      <input type="hidden" name="ref" value={refCode} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {label}
      </Button>
    </form>
  );
}

function RefundForm({
  refCode,
  kind,
  label,
  pending,
  startTransition,
}: {
  refCode: string;
  kind: "full" | "half";
  label: string;
  pending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  return (
    <form
      action={(fd) => {
        startTransition(() => {
          void refundAction(fd);
        });
      }}
    >
      <input type="hidden" name="ref" value={refCode} />
      <input type="hidden" name="kind" value={kind} />
      <Button
        type="submit"
        size="sm"
        variant={kind === "full" ? "danger" : "outline"}
        disabled={pending}
      >
        {label}
      </Button>
    </form>
  );
}
