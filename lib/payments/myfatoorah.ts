import type {
  CreateIntentArgs,
  PaymentClient,
  PaymentIntent,
  PaymentMethod,
  PaymentStatusResult,
} from "./types";

/**
 * MyFatoorah hosted-checkout client with three modes — picked at boot
 * based on which env vars are set:
 *
 *  1. **direct** — `MYFATOORAH_API_TOKEN` is set on Next.js. We call
 *     MyFatoorah directly. Simplest path for testing the hosted-checkout
 *     UI; the real KNET / Apple Pay page renders and accepts the test
 *     cards from https://docs.myfatoorah.com/docs/test-cards.
 *
 *  2. **edge** — `SUPABASE_URL` + `SUPABASE_ANON_KEY` are set, but no
 *     direct token. We POST to the `myfatoorah` Supabase Edge Function
 *     which holds the token as a secret.
 *
 *  3. **stub** — neither configured. Simulates a successful payment
 *     without leaving the app, so the rest of the flow stays exercisable
 *     in dev.
 *
 * direct beats edge so you can drop the token into .env.local (or Vercel
 * env vars) and immediately see the real gateway, even if the edge
 * function isn't deployed yet.
 */
export type PaymentMode = "direct" | "edge" | "stub";

export function detectPaymentMode(): PaymentMode {
  const directToken = process.env.MYFATOORAH_API_TOKEN ?? "";
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";
  if (directToken) return "direct";
  if (supabaseUrl && supabaseKey) return "edge";
  return "stub";
}

export function createMyFatoorahClient(): PaymentClient {
  const directToken = process.env.MYFATOORAH_API_TOKEN ?? "";
  const directBase =
    process.env.MYFATOORAH_BASE_URL ?? "https://apitest.myfatoorah.com";
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";

  const mode: PaymentMode = detectPaymentMode();

  // ---- Direct (Next.js → MyFatoorah) ----
  async function directFetch(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${directBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${directToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `MyFatoorah ${path} failed: ${res.status} ${text.slice(0, 240)}`,
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `MyFatoorah ${path} returned non-JSON: ${text.slice(0, 240)}`,
      );
    }
  }

  // ---- Edge (Next.js → Supabase Edge Function → MyFatoorah) ----
  async function edgeFetch<T>(action: string, args: object): Promise<T> {
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
      if (mode === "stub") {
        return [
          { id: 1, name: "KNET", label: "KNET", totalFils: amountFils, imageUrl: null },
          { id: 11, name: "ApplePay", label: "Apple Pay", totalFils: amountFils, imageUrl: null },
        ];
      }

      const body =
        mode === "direct"
          ? ((await directFetch("/v2/InitiatePayment", {
              InvoiceAmount: amountFils / 1000,
              CurrencyIso: currency,
            })) as InitiateResponse)
          : await edgeFetch<InitiateResponse>("list-methods", {
              amount: amountFils / 1000,
              currency,
            });

      return body.Data.PaymentMethods.map((m) => ({
        id: m.PaymentMethodId,
        name: canonicalName(m.PaymentMethodEn),
        label: m.PaymentMethodEn,
        totalFils: Math.round(parseFloat(m.TotalAmount) * 1000),
        imageUrl: m.ImageUrl ?? null,
      }));
    },

    async createIntent(args: CreateIntentArgs): Promise<PaymentIntent> {
      if (mode === "stub") {
        const method = args.paymentMethodId ?? 0;
        const paymentRef = `MFT-DEV-${method}-${Date.now().toString(36).toUpperCase()}`;
        const paymentUrl = `${args.callbackUrl}?paymentRef=${encodeURIComponent(paymentRef)}&simulate=success`;
        return { paymentUrl, paymentRef };
      }

      const body =
        mode === "direct"
          ? ((await directFetch("/v2/ExecutePayment", {
              PaymentMethodId: args.paymentMethodId ?? 0,
              InvoiceValue: args.amountFils / 1000,
              CustomerName: args.customerName,
              CustomerMobile: args.customerPhone,
              CurrencyIso: args.currency,
              CallBackUrl: args.callbackUrl,
              ErrorUrl: args.callbackUrl,
              CustomerReference: args.bookingRef,
              Language: "en",
            })) as ExecuteResponse)
          : await edgeFetch<ExecuteResponse>("execute", {
              amount: args.amountFils / 1000,
              currency: args.currency,
              paymentMethodId: args.paymentMethodId ?? 0,
              customerName: args.customerName,
              customerPhone: args.customerPhone,
              callbackUrl: args.callbackUrl,
              bookingRef: args.bookingRef,
            });

      return {
        paymentUrl: body.Data.PaymentURL,
        paymentRef: String(body.Data.InvoiceId),
      };
    },

    async verify(paymentRef: string): Promise<PaymentStatusResult> {
      if (mode === "stub") {
        return { paid: true, paymentRef };
      }
      const body =
        mode === "direct"
          ? ((await directFetch("/v2/getPaymentStatus", {
              Key: paymentRef,
              KeyType: "PaymentId",
            })) as VerifyResponse)
          : await edgeFetch<VerifyResponse>("verify", {
              paymentRef,
              keyType: "PaymentId",
            });
      const status = body.Data.InvoiceStatus.toLowerCase();
      const paid =
        status === "paid" || status === "successfull" || status === "successful";
      return { paid, paymentRef };
    },
  };
}

interface InitiateResponse {
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
}

interface ExecuteResponse {
  Data: { PaymentURL: string; InvoiceId: number };
}

interface VerifyResponse {
  Data: {
    InvoiceStatus: string;
    InvoiceTransactions?: { TransactionStatus: string }[];
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
