import { NextResponse } from "next/server";
import { branding } from "@/lib/config/branding";
import { detectPaymentMode } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  const paymentMode = detectPaymentMode();
  return NextResponse.json({
    ok: true,
    server: "next",
    runtime: "nodejs",
    name: branding.pitchName,
    timezone: branding.timezone,
    now: new Date().toISOString(),
    payment: {
      mode: paymentMode,
      hasMyFatoorahToken: Boolean(process.env.MYFATOORAH_API_TOKEN),
      hasSupabase:
        Boolean(process.env.SUPABASE_URL) &&
        Boolean(
          process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
        ),
    },
  });
}
