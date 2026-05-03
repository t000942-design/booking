import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  cancelBooking,
  getBookingByRef,
  markBookingDone,
} from "@/lib/services/bookings";

interface Ctx {
  params: Promise<{ ref: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: Ctx) {
  const { ref } = await params;
  const booking = await getBookingByRef(ref);
  if (!booking) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, booking });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { ref } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  const next = body.status;

  let booking = null;
  if (next === "DONE") booking = await markBookingDone(ref);
  else if (next === "CANCELLED") booking = await cancelBooking(ref);
  else {
    return NextResponse.json(
      { ok: false, error: "status must be DONE or CANCELLED" },
      { status: 400 },
    );
  }

  if (!booking) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, booking });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { ref } = await params;
  const booking = await cancelBooking(ref);
  if (!booking) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, booking });
}
