import { createMyFatoorahClient } from "./myfatoorah";
import type { PaymentClient } from "./types";

/** Singleton client, swapped out by env config. */
const g = globalThis as unknown as { __paymentClient?: PaymentClient };

export const paymentClient: PaymentClient =
  g.__paymentClient ??
  (g.__paymentClient = createMyFatoorahClient());

export type { PaymentClient, PaymentIntent, PaymentStatusResult } from "./types";
