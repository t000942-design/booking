import Link from "next/link";
import { BrandMark } from "@/components/Brand";
import { branding } from "@/lib/config/branding";
import { getSession } from "@/lib/auth/session";
import { signOutAction } from "@/lib/server/authActions";
import { Button } from "@/components/ui/Button";

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="pitch-bg min-h-screen text-white">
      {/* Sticky brand + sign-out so it stays reachable while scrolling. */}
      <header className="sticky top-0 z-30 mx-auto w-full max-w-md border-b border-white/10 bg-pitch-950/55 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <BrandMark className="text-white" />
          {session ? (
            <form action={signOutAction}>
              <Button
                variant="secondary"
                size="md"
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 shadow-lg"
              >
                <SignOutIcon />
                Sign out
              </Button>
            </form>
          ) : null}
        </div>
        {session ? (
          <div className="mt-1 text-[11px] text-white/65">
            Signed in as <span className="font-mono">{session.phone}</span>
            {session.name ? ` · ${session.name}` : ""}
          </div>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-md px-4 pb-16 pt-4">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-md px-4 pb-8 pt-2">
        <div className="rounded-2xl bg-white/95 px-4 py-3 text-center text-xs text-black shadow-lg">
          <p className="font-semibold">{branding.pitchName}</p>
          <p className="mt-0.5">{branding.location}</p>
          <p className="mt-0.5">
            <Link
              href={`tel:${branding.ownerPhone.replace(/\s/g, "")}`}
              className="underline-offset-4 hover:underline"
            >
              {branding.ownerPhone}
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
