"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  optional?: boolean;
  hint?: string;
  compact?: boolean;
}

// حقل <input>+<label> موحّد -- نفس صفّ الأصناف كان مكرَّراً حرفياً لأكثر من
// 10 حقل درجات مادة + حقل المعدل الرئيسي في نموذج الاختبار.
export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, optional, hint, compact, id, className = "", ...rest },
  ref,
) {
  return (
    <div>
      <label className={`block font-bold ${compact ? "mb-1 text-xs text-ink-soft" : "mb-2"}`} htmlFor={id}>
        {label} {optional && <span className="font-normal text-ink-muted">(اختياري)</span>}
      </label>
      <input
        ref={ref}
        id={id}
        className={`w-full border border-line focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 ${
          compact ? "rounded-lg p-2 text-sm" : "rounded-xl p-3"
        } ${className}`}
        {...rest}
      />
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
});
