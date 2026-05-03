import { customAlphabet } from "nanoid";

const alphabet = "ACDEFGHJKLMNPQRTUVWXY3479";
const nano = customAlphabet(alphabet, 6);

/** P5-XXXXXX (6 unambiguous chars). */
export function generateBookingRef(): string {
  return `P5-${nano()}`;
}
