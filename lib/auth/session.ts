import { cookies } from "next/headers";

const COOKIE_NAME = "kickoff_session";
const ONE_WEEK = 60 * 60 * 24 * 7;

export type Role = "admin" | "customer";

export interface Session {
  role: Role;
  phone: string;
  signedInAt: number;
  /** Captured during sign-up; admin sessions don't carry this. */
  name?: string;
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (parsed.role !== "admin" && parsed.role !== "customer") return null;
    if (typeof parsed.phone !== "string" || !parsed.phone) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setSession(
  role: Role,
  phone: string,
  extras: { name?: string } = {},
): Promise<void> {
  const c = await cookies();
  const payload: Session = {
    role,
    phone,
    signedInAt: Date.now(),
    ...(extras.name ? { name: extras.name } : {}),
  };
  c.set(COOKIE_NAME, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK,
  });
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
