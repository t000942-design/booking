import type {
  CreateIntentArgs,
  PaymentClient,
  PaymentIntent,
  PaymentMethod,
  PaymentStatusResult,
} from "./types";

/**
 * MyFatoorah hosted-checkout client — talks to a Supabase Edge Function
 * (`supabase/functions/myfatoorah`) which holds the MYFATOORAH_API_TOKEN
 * secret. The token never reaches the Next.js side.
 *
 * Edge function endpoint: {SUPABASE_URL}/functions/v1/myfatoorah
 * Actions: list-methods | execute | verify (see the function source).
 *
 * Falls back to an in-process stub when SUPABASE_URL or SUPABASE_ANON_KEY
 * isn't set, so local dev keeps working without any of this configured.
 */
export function createMyFatoorahClient(): PaymentClient {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const isStubbed = !supabaseUrl || !supabaseKey;

  async function callEdge<T>(action: string, args: object): Promise<T> {
    const res = await fetch(`${supabaseUrl}/functions/v1/myfatoorah`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
      body: JSON.stringify({ action, ...args }),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Edge function "${action}" failed: ${res.status} ${text.slice(0, 240)}`,
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `Edge function "${action}" returned non-JSON: ${text.slice(0, 240)}`,
      );
    }
  }

  return {
    async listPaymentMethods({ amountFils, currency }): Promise<PaymentMethod[]> {
      if (isStubbed) {
        return [
          {
            id: 1,
            name: "KNET",
            label: "KNET",
            totalFils: amountFils,
            imageUrl: null,
          },
          {
            id: 9,
            name: "ApplePay",
            label: "Apple Pay",
            totalFils: amountFils,
            imageUrl: null,
          },
        ];
      }
      const data = await callEdge<{
        Data: {
          PaymentMethods: {
            PaymentMethodId: number;
            PaymentMethodEn: string;
            PaymentMethodAr: string;
            ImageUrl: string;
            TotalAmount: string;
            CurrencyIso: string;
          }[];
        };
      }>("list-methods", {
        amount: amountFils / 1000,
        currency,
      });
      return data.Data.PaymentMethods.map((m) => ({
        id: m.PaymentMethodId,
        name: canonicalName(m.PaymentMethodEn),
        label: m.PaymentMethodEn,
        totalFils: Math.round(parseFloat(m.TotalAmount) * 1000),
        imageUrl: m.ImageUrl ?? null,
      }));
    },

    async createIntent(args: CreateIntentArgs): Promise<PaymentIntent> {
      if (isStubbed) {
        const method = args.paymentMethodId ?? 0;
        const paymentRef = `MFT-DEV-${method}-${Date.now().toString(36).toUpperCase()}`;
        const paymentUrl = `${args.callbackUrl}?paymentRef=${encodeURIComponent(paymentRef)}&simulate=success`;
        return { paymentUrl, paymentRef };
      }
      const data = await callEdge<{
        Data: { PaymentURL: string; InvoiceId: number };
      }>("execute", {
        amount: args.amountFils / 1000,
        currency: args.currency,
        paymentMethodId: args.paymentMethodId ?? 0,
        customerName: args.customerName,
        customerPhone: args.customerPhone,
        callbackUrl: args.callbackUrl,
        bookingRef: args.bookingRef,
      });
      return {
        paymentUrl: data.Data.PaymentURL,
        paymentRef: String(data.Data.InvoiceId),
      };
    },

    async verify(paymentRef: string): Promise<PaymentStatusResult> {
      if (isStubbed) {
        return { paid: true, paymentRef };
      }
      const data = await callEdge<{
        Data: {
          InvoiceStatus: string;
          InvoiceTransactions?: { TransactionStatus: string }[];
        };
      }>("verify", {
        paymentRef,
        keyType: "PaymentId",
      });
      const status = data.Data.InvoiceStatus.toLowerCase();
      const paid =
        status === "paid" ||
        status === "successfull" ||
        status === "successful";
      return { paid, paymentRef };
    },
  };
}

function canonicalName(en: string): string {
  const lower = en.toLowerCase().replace(/\s+/g, "");
  if (lower.includes("knet")) return "KNET";
  if (lower.includes("apple")) return "ApplePay";
  if (lower.includes("googlepay")) return "GooglePay";
  if (lower.includes("mada")) return "Mada";
  if (lower.includes("visa") || lower.includes("master")) return "VisaMaster";
  if (lower.includes("benefit")) return "Benefit";
  return en.replace(/\s+/g, "");
}
