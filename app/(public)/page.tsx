import Link from "next/link";
import { branding } from "@/lib/config/branding";
import { getSession } from "@/lib/auth/session";
import { signOutAction } from "@/lib/server/authActions";
import { PitchScene } from "@/components/PitchScene";
import { Button } from "@/components/ui/Button";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";
import { AuthTabs, type AuthMode } from "./AuthTabs";

interface PageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const session = await getSession();

  const params = await searchParams;
  const mode: AuthMode = params.mode === "signup" ? "signup" : "signin";

  return (
    <div className="flex flex-col gap-8 pt-6">
      <PitchScene />
      <section className="rounded-3xl bg-white/95 px-5 py-6 text-center text-black shadow-2xl backdrop-blur">
        <h1 className="text-5xl font-black tracking-tight text-black">
          {branding.pitchName}
        </h1>
      </section>

      {session ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/95 p-4 text-emerald-950 shadow-md backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
            You&apos;re signed in
          </div>
          <div className="mt-0.5 text-sm font-semibold">
            {session.role === "admin" ? "Owner · " : ""}
            <span className="font-mono">{session.phone}</span>
            {session.name ? ` · ${session.name}` : ""}
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              href={session.role === "admin" ? "/admin" : "/book"}
              className="flex-1"
            >
              <Button size="md" variant="primary" className="w-full">
                Continue →
              </Button>
            </Link>
            <form action={signOutAction}>
              <Button size="md" variant="outline" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="field-card rounded-2xl p-5 text-pitch-950">
        <AuthTabs active={mode} />
        <h2 className="mt-4 text-lg font-bold tracking-tight">
          {session
            ? "Or sign in as someone else"
            : mode === "signup"
            ? "Create your account"
            : "Welcome back"}
        </h2>
        <p className="mt-1 text-sm text-pitch-900/70">
          {mode === "signup"
            ? "Enter your name and phone to get started."
            : "Enter your phone to continue."}
        </p>
        <div className="mt-4">
          {mode === "signup" ? <SignUpForm /> : <SignInForm />}
        </div>
      </section>

      <section className="grid grid-cols-4 gap-2 text-center text-xs">
        <Stat label="Slot" value="60 min" />
        <Stat label="Open" value={`${branding.openingHour}:00–${branding.closingHour}:00`} />
        <Stat label="Price" value={`KWD ${(branding.priceFils / 1000).toFixed(0)}`} />
        <Stat label="Fields" value={String(branding.pitches.length)} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="field-card-dark rounded-xl px-2 py-3">
      <div className="text-[10px] uppercase tracking-widest text-white/60">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
