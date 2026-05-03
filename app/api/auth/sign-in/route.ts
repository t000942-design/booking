import { NextResponse } from "next/server";
import { z } from "zod";
import { branding } from "@/lib/config/branding";
import { normalizePhone, phoneMatches } from "@/lib/auth/phone";
import { setSession } from "@/lib/auth/session";

const schema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{6,20}$/, "Invalid phone"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { phone } = parsed.data;
  const normalized = normalizePhone(phone);

  if (phoneMatches(phone, branding.adminPhones)) {
    await setSession("admin", normalized);
    return NextResponse.json({
      ok: true,
      role: "admin" as const,
      next: "/admin",
    });
  }

  await setSession("customer", normalized);
  return NextResponse.json({
    ok: true,
    role: "customer" as const,
    next: "/book",
  });
}
