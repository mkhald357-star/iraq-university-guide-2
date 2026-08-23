"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary-solid text-white hover:bg-primary-solid-hover",
  secondary: "border border-line bg-surface text-ink hover:border-primary-300 hover:bg-primary-50",
  ghost: "text-primary-text hover:bg-primary-50",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors duration-200 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { href?: undefined };
type ButtonAsLink = CommonProps & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

// زر واحد يغطي حالتي <button>/<Link> -- يمنع تكرار نفس صفّ الأصناف (classes)
// عبر أكثر من 20 موضعاً كان مبعثراً في الصفحات سابقاً (bg-primary-solid إلخ).
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, loading, children, className = "", ...rest },
  ref,
) {
  const cls = `${BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;

  if ("href" in rest && rest.href) {
    const { href } = rest;
    return (
      <Link href={href} className={cls}>
        {icon}
        {children}
      </Link>
    );
  }

  const { disabled, ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      ref={ref}
      type={buttonRest.type ?? "button"}
      className={cls}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      {...buttonRest}
    >
      {loading ? (
        <span
          role="status"
          aria-label="جارٍ التحميل"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
});
