"use server";

import { redirect } from "next/navigation";
import { branding } from "@/lib/config/branding";
import { normalizePhone, phoneMatches } from "@/lib/auth/phone";
import { clearSession, setSession } from "@/lib/auth/session";

/**
 * NOTE: OTP step is intentionally disabled until an SMS provider is wired up.
 * The signature & shape are unchanged so the UI / API surface stays stable.
 * To re-enable: see lib/auth/otp.ts (issueOtp / verifyOtp helpers still exist).
 */

export interface AuthState {
  error: string | null;
  fieldErrors?: Record<string, string>;
}

export interface VerifyState {
  error: string | null;
  attemptsLeft?: number;
}

const PHONE_REGEX = /^\+?[\d\s-]{6,20}$/;
const NAME_REGEX = /^[\p{L}][\p{L}\s'.-]{1,79}$/u;

export async function requestSignInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const raw = String(formData.get("phone") ?? "").trim();
  if (!raw) return { error: "Enter your phone number." };
  if (!PHONE_REGEX.test(raw)) return { error: "That doesn't look like a phone number." };

  if (phoneMatches(raw, branding.adminPhones)) {
    await setSession("admin", normalizePhone(raw));
    redirect("/admin");
  }

  await setSession("customer", normalizePhone(raw));
  redirect("/book");
}

export async function requestSignUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const rawName = String(formData.get("name") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!rawName) fieldErrors.name = "Enter your name.";
  else if (!NAME_REGEX.test(rawName)) fieldErrors.name = "Use letters only.";
  if (!rawPhone) fieldErrors.phone = "Enter your phone number.";
  else if (!PHONE_REGEX.test(rawPhone)) fieldErrors.phone = "Invalid phone number.";

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  if (phoneMatches(rawPhone, branding.adminPhones)) {
    return {
      error: "That number belongs to the owner. Use Sign In.",
      fieldErrors: { phone: "Use Sign In for owner number." },
    };
  }

  await setSession("customer", normalizePhone(rawPhone), { name: rawName });
  redirect("/book");
}

/** Kept for API compatibility — redirects to /book if a session was already set. */
export async function verifyOtpAction(
  _prev: VerifyState,
  _formData: FormData,
): Promise<VerifyState> {
  redirect("/book");
}

export async function signOutAction(): Promise<void> {
  await clearSession();
  redirect("/");
}
