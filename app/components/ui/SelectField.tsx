"use client";

import { forwardRef, type SelectHTMLAttributes, type ReactNode } from "react";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}

// حقل <select>+<label> موحّد -- كان نفس الصفّ الحرفي لأصناف Tailwind مكرَّراً
// عبر 9 صفحات (rounded-xl border border-line p-3 focus:ring-primary/40).
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, optional, hint, id, className = "", children, ...rest },
  ref
) {
  return (
    <div>
      <label className="mb-2 block font-bold" htmlFor={id}>
        {label} {optional && <span className="font-normal text-ink-muted">(اختياري)</span>}
      </label>
      <select
        ref={ref}
        id={id}
        className={`w-full rounded-xl border border-line p-3 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 ${className}`}
        {...rest}
      >
        {children}
      </select>
      {hint && (
        <p className="mt-1.5 text-sm text-ink-muted" id={id ? `${id}-hint` : undefined}>
          {hint}
        </p>
      )}
    </div>
  );
});
