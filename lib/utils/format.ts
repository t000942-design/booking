import { branding } from "@/lib/config/branding";

/** Format a fils amount (1 KWD = 1000 fils) to "KWD 25.000". */
export function formatPrice(fils: number, currency: string = branding.currency): string {
  const major = (fils / 1000).toFixed(3);
  return `${currency} ${major}`;
}

/** "+965 9000 0000" → keep as-is for now; placeholder for future normalization. */
export function formatPhone(phone: string): string {
  return phone.trim();
}
