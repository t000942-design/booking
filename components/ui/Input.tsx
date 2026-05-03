import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-12 w-full rounded-xl border bg-white px-4 text-base text-pitch-950 placeholder:text-pitch-900/40 outline-none transition focus:border-pitch-600 focus:ring-2 focus:ring-pitch-500/30",
        invalid ? "border-red-400" : "border-pitch-900/15",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
