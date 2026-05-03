import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-500 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary:
          "bg-pitch-600 text-white hover:bg-pitch-700 shadow-lg shadow-pitch-900/20",
        secondary:
          "bg-white text-pitch-900 hover:bg-pitch-50 border border-pitch-200",
        ghost:
          "bg-transparent text-pitch-50 hover:bg-white/10",
        danger:
          "bg-red-600 text-white hover:bg-red-700",
        outline:
          "bg-transparent text-pitch-900 border border-pitch-700/40 hover:bg-pitch-50",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-base",
        lg: "h-14 px-6 text-lg",
        block: "h-14 w-full px-6 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
