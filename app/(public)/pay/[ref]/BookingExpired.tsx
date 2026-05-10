import Link from "next/link";

/**
 * Friendly page for when a booking ref isn't found in storage. Most often
 * happens on Vercel when SUPABASE_URL isn't configured — bookings live in
 * per-worker memory and disappear between cold starts.
 */
export function BookingExpired({
  ref,
  reason,
}: {
  ref: string;
  reason: "not-found" | "wrong-account";
}) {
  return (
    <div className="flex flex-col items-center gap-4 pt-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-amber-500 text-white shadow-2xl">
        <span className="text-2xl">!</span>
      </div>
      <h1 className="text-2xl font-bold text-white">
        {reason === "wrong-account"
          ? "Different account"
          : "Booking not on file"}
      </h1>
      <p className="max-w-xs text-sm text-white/85">
        {reason === "wrong-account" ? (
          <>
            Booking <span className="font-mono">{ref}</span> belongs to a
            different account. Sign out and sign in with the phone you used to
            book it.
          </>
        ) : (
          <>
            Booking <span className="font-mono">{ref}</span> isn&apos;t in the
            store. If this happened right after picking a slot, the booking
            may have been lost between server workers — please book again.
          </>
        )}
      </p>
      <Link
        href="/book"
        className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-pitch-900 shadow-lg hover:bg-pitch-50"
      >
        Pick a new slot
      </Link>
      <Link
        href="/"
        className="text-xs font-medium text-white/80 underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
