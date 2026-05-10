// Supabase Edge Function: myfatoorah
//
// One endpoint, three actions, one secret.
//   POST {SUPABASE_URL}/functions/v1/myfatoorah
//   Body: { action: "list-methods" | "execute" | "verify", ...args }
//
// Holds MYFATOORAH_API_TOKEN as a Supabase secret so the token never lives
// on the Vercel side. Next.js calls this function, this function calls
// MyFatoorah.
//
// Deploy:
//   supabase functions deploy myfatoorah --no-verify-jwt
//   supabase secrets set MYFATOORAH_API_TOKEN=<your test key>
//   supabase secrets set MYFATOORAH_BASE_URL=https://apitest.myfatoorah.com
//
// Docs: https://docs.myfatoorah.com/docs/api-key
//
// deno-lint-ignore-file no-explicit-any

const TOKEN = Deno.env.get("MYFATOORAH_API_TOKEN") ?? "";
const BASE =
  Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!TOKEN) {
    return jsonResponse(
      { error: "MYFATOORAH_API_TOKEN is not configured on the edge function." },
      500,
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    switch (body.action) {
      case "list-methods": {
        if (typeof body.amount !== "number" || typeof body.currency !== "string") {
          return jsonResponse({ error: "amount and currency are required" }, 400);
        }
        const r = await fetch(`${BASE}/v2/InitiatePayment`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            InvoiceAmount: body.amount,
            CurrencyIso: body.currency,
          }),
        });
        return passthrough(r);
      }

      case "execute": {
        const required = [
          "amount",
          "currency",
          "customerName",
          "customerPhone",
          "callbackUrl",
          "bookingRef",
        ];
        for (const k of required) {
          if (body[k] == null) {
            return jsonResponse({ error: `Missing field: ${k}` }, 400);
          }
        }
        const r = await fetch(`${BASE}/v2/ExecutePayment`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            PaymentMethodId: body.paymentMethodId ?? 0,
            InvoiceValue: body.amount,
            CustomerName: body.customerName,
            CustomerMobile: body.customerPhone,
            CurrencyIso: body.currency,
            CallBackUrl: body.callbackUrl,
            ErrorUrl: body.callbackUrl,
            CustomerReference: body.bookingRef,
            Language: "en",
            ...(body.webhookUrl ? { WebhookEndpoint: body.webhookUrl } : {}),
          }),
        });
        return passthrough(r);
      }

      case "verify": {
        if (!body.paymentRef) {
          return jsonResponse({ error: "paymentRef is required" }, 400);
        }
        const r = await fetch(`${BASE}/v2/getPaymentStatus`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            Key: body.paymentRef,
            KeyType: body.keyType ?? "PaymentId",
          }),
        });
        return passthrough(r);
      }

      default:
        return jsonResponse(
          {
            error:
              "Unknown action. Use one of: list-methods, execute, verify.",
          },
          400,
        );
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 502);
  }
});

async function passthrough(r: Response): Promise<Response> {
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}
