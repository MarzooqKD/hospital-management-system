import type { SelectHTMLAttributes } from "react";
import { fieldControlClasses, FieldWrapper } from "./FieldWrapper";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Select({
  label,
  error,
  hint,
  required,
  className = "",
  id,
  children,
  ...props
}: SelectProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      {(generatedId) => (
        <select
          id={id ?? generatedId}
          className={`h-10 ${fieldControlClasses(!!error, className)}`}
          aria-invalid={!!error}
          required={required}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldWrapper>
  );
}
