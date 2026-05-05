import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth/guards";
import { getBookingByRef } from "@/lib/services/bookings";
import { completePaymentAction } from "@/lib/server/paymentActions";

interface PageProps {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{
    paymentRef?: string;
    paymentId?: string;
    Id?: string;
    simulate?: string;
  }>;
}

/**
 * Gateway return URL. Verifies the payment server-side, then redirects to
 * /booking/[ref] on success or back to /pay/[ref] on failure.
 */
export default async function PaymentCompletePage({
  params,
  searchParams,
}: PageProps) {
  const session = await requireCustomer();
  const { ref } = await params;
  const search = await searchParams;

  const booking = await getBookingByRef(ref);
  if (!booking) notFound();
  if (booking.customerPhone !== session.phone) redirect("/book");

  // Different gateways pass the id under different names.
  const paymentRef =
    search.paymentRef ?? search.paymentId ?? search.Id ?? `MFT-${booking.ref}`;

  const result = await completePaymentAction(ref, paymentRef);

  if (result.ok) {
    redirect(`/booking/${ref}`);
  }

  return (
    <div className="flex flex-col items-center gap-4 pt-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-white shadow-2xl">
        <span className="text-2xl">!</span>
      </div>
      <h1 className="text-2xl font-bold text-white">Payment didn&apos;t go through</h1>
      <p className="max-w-xs text-sm text-white/85">
        {result.error ?? "Try again or pick a different method."}
      </p>
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
