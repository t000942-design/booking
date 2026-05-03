import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  BookingValidationError,
  createBooking,
  listBookingsForDate,
  SlotUnavailableError,
} from "@/lib/services/bookings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { ok: false, error: "Provide ?date=YYYY-MM-DD" },
      { status: 400 },
    );
  }
  const bookings = await listBookingsForDate(date);
  return NextResponse.json({ ok: true, date, bookings });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    return NextResponse.json(
      { ok: false, error: "Sign in as a customer to book." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const dto = {
    customerName: String(body.customerName ?? "").trim(),
    customerPhone: session.phone,
    teamName:
      typeof body.teamName === "string" ? body.teamName.trim() || null : null,
    notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    date: String(body.date ?? ""),
    hour: Number(body.hour ?? NaN),
    pitch: String(body.pitch ?? ""),
  };

  try {
    const booking = await createBooking(dto);
    return NextResponse.json({ ok: true, booking }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingValidationError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) fieldErrors[issue.path] = issue.message;
      return NextResponse.json(
        { ok: false, error: "Validation failed", fieldErrors },
        { status: 400 },
      );
    }
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json(
        { ok: false, error: "That slot was just taken." },
        { status: 409 },
      );
    }
    throw err;
  }
}
