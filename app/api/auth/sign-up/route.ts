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
  name: z
    .string()
    .trim()
    .regex(/^[\p{L}][\p{L}\s'.-]{1,79}$/u, "Use letters only"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return NextResponse.json(
      { ok: false, error: "Invalid input", fieldErrors },
      { status: 400 },
    );
  }

  const { phone, name } = parsed.data;

  if (phoneMatches(phone, branding.adminPhones)) {
    return NextResponse.json(
      { ok: false, error: "That number belongs to the owner. Use sign-in." },
      { status: 400 },
    );
  }

  const normalized = normalizePhone(phone);
  await setSession("customer", normalized, { name });
  return NextResponse.json({
    ok: true,
    role: "customer" as const,
    next: "/book",
  });
}
