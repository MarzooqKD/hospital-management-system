import type { InputHTMLAttributes, ReactNode } from "react";
import { fieldControlClasses, FieldWrapper } from "./FieldWrapper";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Icon rendered inside the field's left edge (e.g. an envelope on an email input). */
  leftIcon?: ReactNode;
  /** Arbitrary control rendered inside the field's right edge (e.g. a show/hide-password toggle). */
  rightElement?: ReactNode;
}

export function Input({
  label,
  error,
  hint,
  required,
  className = "",
  id,
  leftIcon,
  rightElement,
  style,
  ...props
}: InputProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      {(generatedId) => (
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {leftIcon}
            </span>
          )}
          <input
            id={id ?? generatedId}
            className={`h-10 ${fieldControlClasses(!!error, className)}`}
            style={{
              paddingLeft: leftIcon ? "2.5rem" : undefined,
              paddingRight: rightElement ? "2.5rem" : undefined,
              ...style,
            }}
            aria-invalid={!!error}
            required={required}
            {...props}
          />
          {rightElement && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</span>
          )}
        </div>
      )}
    </FieldWrapper>
  );
}
