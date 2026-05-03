import { NextResponse } from "next/server";
import { branding } from "@/lib/config/branding";
import { todayAtVenue } from "@/lib/domain/slots";
import {
  getAllPitchesAvailability,
  getDayAvailability,
} from "@/lib/services/bookings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? todayAtVenue();
  const pitch = searchParams.get("pitch");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { ok: false, error: "Invalid date — use YYYY-MM-DD" },
      { status: 400 },
    );
  }

  if (pitch) {
    if (!branding.pitches.includes(pitch)) {
      return NextResponse.json(
        { ok: false, error: "Unknown pitch", pitches: branding.pitches },
        { status: 400 },
      );
    }
    const slots = await getDayAvailability(date, pitch);
    return NextResponse.json({
      ok: true,
      date,
      pitch,
      slots: slots.map(serializeSlot),
    });
  }

  const all = await getAllPitchesAvailability(date);
  return NextResponse.json({
    ok: true,
    date,
    pitches: all.map((entry) => ({
      pitch: entry.pitch,
      slots: entry.slots.map(serializeSlot),
    })),
  });
}

function serializeSlot(s: {
  hour: number;
  label: string;
  endLabel: string;
  start: Date;
  end: Date;
  taken: boolean;
  inPast: boolean;
}) {
  return {
    hour: s.hour,
    label: s.label,
    endLabel: s.endLabel,
    start: s.start.toISOString(),
    end: s.end.toISOString(),
    taken: s.taken,
    inPast: s.inPast,
  };
}
