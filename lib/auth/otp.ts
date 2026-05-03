import { normalizePhone } from "./phone";

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

interface Entry {
  code: string;
  createdAt: number;
  attempts: number;
  /** Captured during sign-up. Promoted onto the session on successful verify. */
  name?: string;
}

/** Pinned to globalThis so HMR doesn't wipe pending OTPs. */
const g = globalThis as unknown as { __otpStore?: Map<string, Entry> };
const store: Map<string, Entry> = g.__otpStore ?? new Map();
if (!g.__otpStore) g.__otpStore = store;

function key(phone: string): string {
  return normalizePhone(phone);
}

function isExpired(entry: Entry, now = Date.now()): boolean {
  return now - entry.createdAt > TTL_MS;
}

/** Create or refresh an OTP for the given phone. Returns the 4-digit code. */
export function issueOtp(phone: string, name?: string): string {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  store.set(key(phone), {
    code,
    createdAt: Date.now(),
    attempts: 0,
    name: name?.trim() || undefined,
  });
  return code;
}

export type VerifyResult =
  | { ok: true; name?: string }
  | { ok: false; reason: "missing" | "expired" | "wrong" | "locked" };

export function verifyOtp(phone: string, code: string): VerifyResult {
  const k = key(phone);
  const entry = store.get(k);
  if (!entry) return { ok: false, reason: "missing" };
  if (isExpired(entry)) {
    store.delete(k);
    return { ok: false, reason: "expired" };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(k);
    return { ok: false, reason: "locked" };
  }
  if (entry.code !== code.trim()) {
    entry.attempts += 1;
    return { ok: false, reason: "wrong" };
  }
  const { name } = entry;
  store.delete(k);
  return { ok: true, name };
}

/** DEV-ONLY: peek at the active OTP for display in the verify page banner. */
export function peekOtp(phone: string): string | null {
  const entry = store.get(key(phone));
  if (!entry || isExpired(entry)) return null;
  return entry.code;
}
