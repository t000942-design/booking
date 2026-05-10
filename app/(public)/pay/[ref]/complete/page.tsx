import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth/guards";
import { getBookingByRef } from "@/lib/services/bookings";
import { completePaymentAction } from "@/lib/server/paymentActions";
import { BookingExpired } from "../BookingExpired";

interface PageProps {
  params: Promise<{ ref: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Gateway return URL. Verifies the payment server-side, then redirects to
 * /booking/[ref] on success or back to /pay/[ref] on failure.
 *
 * MyFatoorah callback shape: ?paymentId=...&Id=...
 *   - paymentId — passed back, use with KeyType="PaymentId"
 *   - Id        — the invoice id, use with KeyType="InvoiceId"
 * We prefer paymentId; fall back to Id; finally fall back to a synthesised
 * key (only used by the stub path).
 */
export default async function PaymentCompletePage({
  params,
  searchParams,
}: PageProps) {
  const session = await requireCustomer();
  const { ref } = await params;
  const search = await searchParams;

  const booking = await getBookingByRef(ref);
  if (!booking) {
    return <BookingExpired ref={ref} reason="not-found" />;
  }
  if (booking.customerPhone !== session.phone) {
    return <BookingExpired ref={ref} reason="wrong-account" />;
  }

  const paymentIdParam = pickString(search.paymentId);
  const idParam = pickString(search.Id);
  const paymentRefParam = pickString(search.paymentRef);

  const { paymentRef, keyType } = paymentRefParam
    ? { paymentRef: paymentRefParam, keyType: "PaymentId" as const }
    : paymentIdParam
    ? { paymentRef: paymentIdParam, keyType: "PaymentId" as const }
    : idParam
    ? { paymentRef: idParam, keyType: "InvoiceId" as const }
    : { paymentRef: `MFT-${booking.ref}`, keyType: "PaymentId" as const };

  const result = await completePaymentAction(ref, paymentRef, keyType);

  if (result.ok) {
    redirect(`/booking/${ref}`);
  }

  // Build a small debug list so you can see what the gateway sent us.
  const debugQuery = Object.entries(search)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : v}`);

  return (
    <div className="flex flex-col items-center gap-4 pt-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-white shadow-2xl">
        <span className="text-2xl">!</span>
      </div>
      <h1 className="text-2xl font-bold text-white">Payment didn&apos;t go through</h1>
      <p className="max-w-xs text-sm text-white/85">
        {result.error ?? "Try again or pick a different method."}
      </p>

      {debugQuery.length > 0 ? (
        <details className="max-w-xs rounded-xl bg-white/5 px-3 py-2 text-left text-[11px] text-white/70">
          <summary className="cursor-pointer font-semibold">
            Gateway returned {debugQuery.length} parameter
            {debugQuery.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-0.5 break-all font-mono">
            {debugQuery.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li className="pt-1 text-white/50">
              used: {paymentRef} / {keyType}
            </li>
          </ul>
        </details>
      ) : null}

      <Link
        href={`/pay/${ref}`}
        className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-pitch-900 shadow-lg hover:bg-pitch-50"
      >
        Try again
      </Link>
      <Link
        href="/book"
        className="text-xs font-medium text-white/80 underline-offset-4 hover:underline"
      >
        Back to slots
      </Link>
    </div>
  );
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
