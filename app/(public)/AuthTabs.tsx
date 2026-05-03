import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type AuthMode = "signin" | "signup";

export function AuthTabs({ active }: { active: AuthMode }) {
  return (
    <div className="grid grid-cols-2 rounded-xl bg-pitch-50 p-1 text-sm font-semibold">
      <Tab label="Sign in" mode="signin" active={active} />
      <Tab label="Sign up" mode="signup" active={active} />
    </div>
  );
}

function Tab({
  label,
  mode,
  active,
}: {
  label: string;
  mode: AuthMode;
  active: AuthMode;
}) {
  const isActive = mode === active;
  return (
    <Link
      href={mode === "signin" ? "/" : "/?mode=signup"}
      scroll={false}
      replace
      className={cn(
        "flex h-10 items-center justify-center rounded-lg transition",
        isActive
          ? "bg-white text-pitch-900 shadow"
          : "text-pitch-900/60 hover:text-pitch-900",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
