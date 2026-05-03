/** Strip everything but digits (and optional leading +). */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

/** Compare two phones by their digit suffix (last 8 digits). */
export function phoneMatches(input: string, allowed: readonly string[]): boolean {
  const a = normalizePhone(input).replace(/\D/g, "").slice(-8);
  if (!a) return false;
  return allowed.some((p) => normalizePhone(p).replace(/\D/g, "").slice(-8) === a);
}
