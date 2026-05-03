"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  blockSlotAction,
  unblockSlotAction,
} from "@/lib/server/bookingActions";

type Props =
  | { kind: "block"; date: string; hour: number; pitch: string }
  | { kind: "unblock"; blockedId: string };

export function SlotControls(props: Props) {
  const [pending, startTransition] = useTransition();

  if (props.kind === "block") {
    return (
      <form
        action={(fd) => {
          startTransition(() => {
            void blockSlotAction(fd);
          });
        }}
      >
        <input type="hidden" name="date" value={props.date} />
        <input type="hidden" name="hour" value={props.hour} />
        <input type="hidden" name="pitch" value={props.pitch} />
        <input type="hidden" name="reason" value="Closed" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Block
        </Button>
      </form>
    );
  }

  return (
    <form
      action={(fd) => {
        startTransition(() => {
          void unblockSlotAction(fd);
        });
      }}
    >
      <input type="hidden" name="id" value={props.blockedId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Unblock
      </Button>
    </form>
  );
}
