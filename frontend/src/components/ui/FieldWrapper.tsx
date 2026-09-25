import { useId, type ReactNode } from "react";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (id: string) => ReactNode;
}

/** Shared label/error/hint chrome for Input, Select, and Textarea — kept in
 * one place so the three don't each reimplement the same id-wiring and
 * error-vs-hint display rule. */
export function FieldWrapper({ label, error, hint, required, children }: FieldWrapperProps) {
  const generatedId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={generatedId} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children(generatedId)}
      {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
      {error && (
        <span className="text-xs font-medium text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export const fieldControlClasses = (hasError: boolean, extra = "") =>
  [
    "w-full rounded-xl border bg-white px-3.5 text-sm text-navy-900 placeholder:text-slate-400",
    "transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500",
    "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
    hasError ? "border-red-400 focus:border-red-500 focus:ring-red-500/30" : "border-slate-300",
    extra,
  ].join(" ");
