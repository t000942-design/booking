"use server";

import { revalidatePath } from "next/cache";
import { askAssistant } from "@/lib/ai/assistant";
import {
  expandSchedulePlan,
  parseScheduleCommand,
} from "@/lib/ai/scheduleParser";
import type { ChatMessage, SchedulePlan } from "@/lib/ai/types";
import { getSession } from "@/lib/auth/session";
import { bookingRepository } from "@/lib/storage";
import { blockSlot, unblockSlot } from "@/lib/services/bookings";

export async function askAssistantAction(question: string): Promise<ChatMessage> {
  const session = await getSession();
  if (!session) {
    return {
      role: "assistant",
      content: "You need to sign in first.",
    };
  }
  return askAssistant(question);
}

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

  // Resolve current state for each tuple to mark already-applied no-ops.
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
      if (block) {
        skipped += 1;
        continue;
      }
      const taken = await bookingRepository.isSlotTaken(t.date, t.hour, t.pitch);
      if (taken) {
        skipped += 1;
        continue;
      }
      await blockSlot(t.date, t.hour, t.pitch, parsed.plan.command.reason);
      applied += 1;
    } else {
      if (!block) {
        skipped += 1;
        continue;
      }
      await unblockSlot(block.id);
      applied += 1;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/book");
  return { ok: true, applied, skipped };
}
