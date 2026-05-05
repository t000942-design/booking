import { redirect } from "next/navigation";
import { branding } from "@/lib/config/branding";
import { getSession } from "@/lib/auth/session";
import { PitchScene } from "@/components/PitchScene";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";
import { AuthTabs, type AuthMode } from "./AuthTabs";

interface PageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "customer") redirect("/book");

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

      <section className="field-card rounded-2xl p-5 text-pitch-950">
        <AuthTabs active={mode} />
        <h2 className="mt-4 text-lg font-bold tracking-tight">
          {mode === "signup" ? "Create your account" : "Welcome back"}
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
