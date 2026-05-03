import Link from "next/link";
import { branding } from "@/lib/config/branding";
import { cn } from "@/lib/utils/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 font-bold tracking-tight",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-lg bg-white/95 text-pitch-700 shadow-sm"
      >
        <BallIcon className="h-5 w-5" />
      </span>
      <span>{branding.pitchName}</span>
    </Link>
  );
}

export function BallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3l3 4-1 5-4 1-3-3 1-4z" fill="currentColor" stroke="none" />
      <path d="M12 21l-2-3 2-3 4 1 1 3" />
      <path d="M21 12l-3 1-1 4" />
      <path d="M3 12l3-1 2 4" />
    </svg>
  );
}
