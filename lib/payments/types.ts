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
}

export interface PaymentClient {
  /** Initiates a payment for a booking, returning a hosted-checkout URL. */
  createIntent(args: {
    bookingRef: string;
    amountFils: number;
    currency: string;
    customerName: string;
    customerPhone: string;
    /** Where the gateway should send the customer back. */
    callbackUrl: string;
  }): Promise<PaymentIntent>;

  /**
   * Verifies whether a payment associated with a paymentRef succeeded.
   * Called from the callback URL after the gateway redirects back.
   */
  verify(paymentRef: string): Promise<PaymentStatusResult>;
}
