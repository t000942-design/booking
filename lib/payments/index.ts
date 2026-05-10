import { createMyFatoorahClient, detectPaymentMode } from "./myfatoorah";
import type { PaymentClient } from "./types";

/**
 * Singleton client. We don't pin to globalThis: detectPaymentMode reads
 * env vars on each cold start, and re-deriving the client per-process is
 * cheap. Avoids stale singletons after env var changes on Vercel.
 */
let cached: PaymentClient | null = null;
let cachedMode: ReturnType<typeof detectPaymentMode> | null = null;

export function getPaymentClient(): PaymentClient {
  const mode = detectPaymentMode();
  if (cached && mode === cachedMode) return cached;
  cached = createMyFatoorahClient();
  cachedMode = mode;
  return cached;
}

/** For backwards compat. */
export const paymentClient: PaymentClient = new Proxy({} as PaymentClient, {
  get(_target, prop) {
    const client = getPaymentClient() as unknown as Record<string, unknown>;
    return client[prop as string];
  },
});

export { detectPaymentMode } from "./myfatoorah";
export type { PaymentMode } from "./myfatoorah";

export type {
  CreateIntentArgs,
  PaymentClient,
  PaymentIntent,
  PaymentMethod,
  PaymentStatusResult,
} from "./types";
