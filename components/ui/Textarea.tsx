import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-24 w-full rounded-xl border bg-white px-4 py-3 text-base text-pitch-950 placeholder:text-pitch-900/40 outline-none transition focus:border-pitch-600 focus:ring-2 focus:ring-pitch-500/30",
        invalid ? "border-red-400" : "border-pitch-900/15",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
