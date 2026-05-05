"use server";

import { revalidatePath } from "next/cache";
import { askAssistant } from "@/lib/ai/assistant";
import {
  expandSchedulePlan,
  parseScheduleCommand,
} from "@/lib/ai/scheduleParser";
import type { ChatAction, ChatMessage, SchedulePlan } from "@/lib/ai/types";
import { getSession } from "@/lib/auth/session";
import { venueDateLabel, venueTime } from "@/lib/domain/slots";
import { bookingRepository } from "@/lib/storage";
import {
  blockSlot,
  cancelBooking,
  createBooking,
  getBookingByRef,
  unblockSlot,
} from "@/lib/services/bookings";
import { formatPrice } from "@/lib/utils/format";

export async function askAssistantAction(question: string): Promise<ChatMessage> {
  const session = await getSession();
  if (!session) {
    return {
      role: "assistant",
      content: "You need to sign in first.",
    };
  }
  return askAssistant(question, {
    phone: session.phone,
    name: session.name,
  });
}

export async function chatActionAction(
  action: ChatAction,
): Promise<ChatMessage> {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    return {
      role: "assistant",
      content: "You need to be signed in as a customer for that.",
    };
  }

  if (action.kind === "book") {
    const { date, hour, pitch } = action.payload;
    if (!date || hour === undefined || hour === null || !pitch) {
      return { role: "assistant", content: "Missing slot details." };
    }
    if (!session.name) {
      return {
        role: "assistant",
        content:
          "I need a name on the booking — sign out and use Sign Up so I can save it on your account.",
      };
    }
    try {
      const booking = await createBooking({
        customerName: session.name,
        customerPhone: session.phone,
        date,
        hour,
        pitch,
      });
      return {
        role: "assistant",
        content: `Done. **${booking.ref}** is yours: ${booking.pitch} · ${venueDateLabel(booking.slotStart)} · ${venueTime(booking.slotStart)}–${venueTime(booking.slotEnd)}.\nTotal due: ${formatPrice(booking.priceFils - booking.discountFils, booking.currency)}.`,
        link: { href: `/pay/${booking.ref}`, label: `Pay ${formatPrice(booking.priceFils - booking.discountFils, booking.currency)}` },
        actions: [
          {
            kind: "cancel",
            label: "Cancel this booking",
            payload: { ref: booking.ref },
            tone: "danger",
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking failed.";
      return {
        role: "assistant",
        content: `Couldn't lock that slot — ${message}.`,
      };
    }
  }

  if (action.kind === "cancel") {
    const { ref } = action.payload;
    if (!ref) return { role: "assistant", content: "Missing booking ref." };
    const existing = await getBookingByRef(ref);
    if (!existing) {
      return { role: "assistant", content: `Booking ${ref} not found.` };
    }
    if (existing.customerPhone !== session.phone) {
      return {
        role: "assistant",
        content: `Booking ${ref} is on a different account.`,
      };
    }
    await cancelBooking(ref);
    revalidatePath("/book");
    revalidatePath(`/booking/${ref}`);
    return {
      role: "assistant",
      content: `Cancelled ${ref}. The slot is back in the calendar.`,
    };
  }

  return { role: "assistant", content: "I'm not sure how to do that yet." };
}

// ---- Admin Slot Manager actions (unchanged) ----

export type PlanResult =
  | { ok: true; plan: SchedulePlan }
  | { ok: false; error: string; hint?: string };

export async function planScheduleAction(input: string): Promise<PlanResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  const parsed = parseScheduleCommand(input);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, hint: parsed.hint };
  }

  const tuples = expandSchedulePlan(parsed.plan.command);
  const warnings: string[] = [];
  const seen = new Set<string>();

  const changes = await Promise.all(
    tuples.map(async (t) => {
      const key = `${t.date}|${t.pitch}|${t.hour}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const block = await bookingRepository.isSlotBlocked(t.date, t.hour, t.pitch);
      const taken = await bookingRepository.isSlotTaken(t.date, t.hour, t.pitch);
      if (parsed.plan.command.action === "block" && taken) {
        warnings.push(`${t.date} ${t.hour}:00 on ${t.pitch} already has a booking — left it.`);
        return null;
      }
      const alreadyApplied =
        (parsed.plan.command.action === "block" && Boolean(block)) ||
        (parsed.plan.command.action === "unblock" && !block);
      return {
        date: t.date,
        hour: t.hour,
        pitch: t.pitch,
        action: parsed.plan.command.action,
        alreadyApplied,
      };
    }),
  );

  return {
    ok: true,
    plan: {
      command: parsed.plan.command,
      changes: changes.filter((c): c is NonNullable<typeof c> => Boolean(c)),
      warnings,
    },
  };
}

export interface ApplyResult {
  ok: boolean;
  applied: number;
  skipped: number;
  error?: string;
}

export async function applyScheduleAction(input: string): Promise<ApplyResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { ok: false, applied: 0, skipped: 0, error: "Admin only." };
  }

  const parsed = parseScheduleCommand(input);
  if (!parsed.ok) {
    return { ok: false, applied: 0, skipped: 0, error: parsed.error };
  }

  const tuples = expandSchedulePlan(parsed.plan.command);
  let applied = 0;
  let skipped = 0;

  for (const t of tuples) {
    const block = await bookingRepository.isSlotBlocked(t.date, t.hour, t.pitch);
    if (parsed.plan.command.action === "block") {
      if (block) { skipped += 1; continue; }
      const taken = await bookingRepository.isSlotTaken(t.date, t.hour, t.pitch);
      if (taken) { skipped += 1; continue; }
      await blockSlot(t.date, t.hour, t.pitch, parsed.plan.command.reason);
      applied += 1;
    } else {
      if (!block) { skipped += 1; continue; }
      await unblockSlot(block.id);
      applied += 1;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/book");
  return { ok: true, applied, skipped };
}
