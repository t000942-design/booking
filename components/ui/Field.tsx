import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
  className,
}: FieldProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("flex flex-col gap-1.5 text-sm", className)}
    >
      <span className="font-medium text-pitch-950">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-red-600">{error}</span>
      ) : hint ? (
        <span className="text-pitch-900/60">{hint}</span>
      ) : null}
    </label>
  );
}
