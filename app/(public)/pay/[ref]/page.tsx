import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ ref: string }>;
}

/**
 * Online payment is currently disabled — bookings confirm immediately on
 * creation. Anyone landing here is bounced to the confirmation page.
 *
 * The MyFatoorah flow is preserved in lib/payments/ and lib/server/paymentActions.ts;
 * to re-enable, restore the original /pay/[ref] page, swap memory.create
 * back to status="PENDING", and point createBookingAction's redirect at
 * /pay/[ref] again.
 */
export default async function PayPage({ params }: PageProps) {
  const { ref } = await params;
  redirect(`/booking/${ref}`);
}
