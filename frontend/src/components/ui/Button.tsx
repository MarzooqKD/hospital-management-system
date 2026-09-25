import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  // Structural/brand actions — sign in, save, primary form submits.
  primary:
    "bg-navy-900 text-white hover:bg-navy-800 disabled:bg-navy-900/40 focus-visible:outline-navy-900",
  // Contextual highlight actions — book a slot, new appointment, dispense.
  accent:
    "bg-accent-500 text-white hover:bg-accent-600 disabled:bg-accent-500/40 focus-visible:outline-accent-500",
  secondary:
    "bg-white text-navy-900 border border-slate-300 hover:bg-slate-50 disabled:text-slate-300 focus-visible:outline-navy-900",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 disabled:text-slate-300 focus-visible:outline-navy-900",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 focus-visible:outline-red-600",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-4 text-sm gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-full font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}
