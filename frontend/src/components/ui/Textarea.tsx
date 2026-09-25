import type { TextareaHTMLAttributes } from "react";
import { fieldControlClasses, FieldWrapper } from "./FieldWrapper";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  label,
  error,
  hint,
  required,
  className = "",
  id,
  ...props
}: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      {(generatedId) => (
        <textarea
          id={id ?? generatedId}
          className={`min-h-20 py-2 ${fieldControlClasses(!!error, className)}`}
          aria-invalid={!!error}
          required={required}
          {...props}
        />
      )}
    </FieldWrapper>
  );
}
