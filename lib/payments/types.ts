export interface PaymentMethod {
  /** MyFatoorah PaymentMethodId. Specific to the account/region. */
  id: number;
  /** Canonical name (e.g. "KNET", "ApplePay") used to filter the surface. */
  name: string;
  /** User-facing label, taken from PaymentMethodEn. */
  label: string;
  /** Total amount the customer would pay (gateway may add a service charge). */
  totalFils: number;
  /** Card-network logo URL from MyFatoorah's CDN. */
  imageUrl: string | null;
}

export interface PaymentIntent {
  /** Where to redirect the customer (gateway-hosted page). */
  paymentUrl: string;
  /** Gateway-side identifier (e.g. MyFatoorah InvoiceId). */
  paymentRef: string;
}

export interface PaymentStatusResult {
  paid: boolean;
  paymentRef: string;
  /** Optional gateway-reported amount in fils. */
  amountFils?: number;
  /** The raw status string the gateway returned, e.g. "Paid", "Pending",
   *  "Failed", "Expired" — useful for showing the actual reason on failure. */
  rawStatus?: string;
}

export type PaymentKeyType = "PaymentId" | "InvoiceId";

export interface CreateIntentArgs {
  bookingRef: string;
  amountFils: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  /** Where the gateway should send the customer back. */
  callbackUrl: string;
  /** When set, ExecutePayment runs against this method directly and the
   *  hosted page goes straight to that gateway (e.g. KNET). */
  paymentMethodId?: number;
}

export interface PaymentClient {
  /** Lists payment methods enabled on the merchant account for this amount. */
  listPaymentMethods(args: {
    amountFils: number;
    currency: string;
  }): Promise<PaymentMethod[]>;

  /** Initiates a payment, returning a hosted-checkout URL. */
  createIntent(args: CreateIntentArgs): Promise<PaymentIntent>;

  /**
   * Verifies whether a payment associated with a paymentRef succeeded.
   * Called from the callback URL after the gateway redirects back.
   * keyType says whether the ref is a PaymentId or InvoiceId.
   */
  verify(
    paymentRef: string,
    keyType?: PaymentKeyType,
  ): Promise<PaymentStatusResult>;
}
