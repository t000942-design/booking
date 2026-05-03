import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "default" | "success" | "muted" | "warn" | "danger";

const tones: Record<Tone, string> = {
  default: "bg-pitch-100 text-pitch-900",
  success: "bg-emerald-100 text-emerald-900",
  muted: "bg-slate-100 text-slate-700",
  warn: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-900",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
