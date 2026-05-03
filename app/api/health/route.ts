import { NextResponse } from "next/server";
import { branding } from "@/lib/config/branding";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    server: "next",
    runtime: "nodejs",
    name: branding.pitchName,
    timezone: branding.timezone,
    now: new Date().toISOString(),
  });
}
