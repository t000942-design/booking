import type { PaymentClient, PaymentIntent, PaymentStatusResult } from "./types";

/**
 * MyFatoorah client — sandbox: https://apitest.myfatoorah.com/
 *
 * Day 1: stubbed (no API calls). When MYFATOORAH_API_TOKEN is set, calls go
 * to the real sandbox or production endpoint. Same return shapes either way,
 * so nothing else in the app needs to change.
 *
 * Real reference flow:
 *  1. POST {base}/v2/InitiatePayment    — list available payment methods
 *  2. POST {base}/v2/ExecutePayment     — chosen method → returns PaymentURL
 *  3. Customer pays on PaymentURL
 *  4. Gateway redirects to CallbackUrl with ?paymentId=...
 *  5. POST {base}/v2/getPaymentStatus   — verify final state
 */
export function createMyFatoorahClient(
  options: {
    token?: string;
    baseUrl?: string;
  } = {},
): PaymentClient {
  const token = options.token ?? process.env.MYFATOORAH_API_TOKEN ?? "";
  const baseUrl =
    options.baseUrl ??
    process.env.MYFATOORAH_BASE_URL ??
    "https://apitest.myfatoorah.com";

  const isStubbed = !token;

  return {
    async createIntent(args): Promise<PaymentIntent> {
      if (isStubbed) {
        // Day 1 stub: synthesize a return URL that flows through our own
        // /pay/[ref]/complete page with simulate=true to mark the booking PAID.
        const paymentRef = `MFT-DEV-${Date.now().toString(36).toUpperCase()}`;
        const paymentUrl = `${args.callbackUrl}?paymentRef=${encodeURIComponent(paymentRef)}&simulate=success`;
        return { paymentUrl, paymentRef };
      }

      // Real call (when token is set):
      const initRes = await fetch(`${baseUrl}/v2/InitiatePayment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          InvoiceAmount: args.amountFils / 1000,
          CurrencyIso: args.currency,
        }),
      });
      if (!initRes.ok) throw new Error(`MyFatoorah InitiatePayment ${initRes.status}`);

      const execRes = await fetch(`${baseUrl}/v2/ExecutePayment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          PaymentMethodId: 0, // 0 = show all available methods
          InvoiceValue: args.amountFils / 1000,
          CustomerName: args.customerName,
          CustomerMobile: args.customerPhone,
          CurrencyIso: args.currency,
          CallBackUrl: args.callbackUrl,
          ErrorUrl: args.callbackUrl,
          CustomerReference: args.bookingRef,
          Language: "en",
        }),
      });
      if (!execRes.ok) throw new Error(`MyFatoorah ExecutePayment ${execRes.status}`);
      const data = (await execRes.json()) as {
        Data: { PaymentURL: string; InvoiceId: number };
      };
      return {
        paymentUrl: data.Data.PaymentURL,
        paymentRef: String(data.Data.InvoiceId),
      };
    },

    async verify(paymentRef: string): Promise<PaymentStatusResult> {
      if (isStubbed) {
        // Stub: anything that came back through our simulate path is "paid".
        return { paid: true, paymentRef };
      }
      const res = await fetch(`${baseUrl}/v2/getPaymentStatus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ Key: paymentRef, KeyType: "PaymentId" }),
      });
      if (!res.ok) throw new Error(`MyFatoorah getPaymentStatus ${res.status}`);
      const data = (await res.json()) as {
        Data: { InvoiceStatus: string; InvoiceTransactions?: { TransactionStatus: string }[] };
      };
      const status = data.Data.InvoiceStatus.toLowerCase();
      return {
        paid: status === "paid" || status === "successfull" || status === "successful",
        paymentRef,
      };
    },
  };
}
