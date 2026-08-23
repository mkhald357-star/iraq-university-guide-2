import type { HTMLAttributes, ReactNode } from "react";

type Variant = "glass" | "surface" | "muted";

const VARIANT_CLASSES: Record<Variant, string> = {
  glass: "glass rounded-3xl",
  surface: "rounded-md border border-line bg-surface shadow-sm",
  muted: "rounded-2xl border border-line bg-surface-muted",
};

// غلاف بطاقة موحّد لثلاثة أنماط كانت مكرَّرة حرفياً عبر الصفحات:
// glass rounded-3xl (13 موضعاً)، rounded-md border bg-surface shadow-sm، وبطاقات
// المعلومات الخافتة bg-surface-muted.
export function Card({
  variant = "surface",
  padding = "p-6",
  className = "",
  children,
  ...rest
}: {
  variant?: Variant;
  padding?: string;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${VARIANT_CLASSES[variant]} ${padding} ${className}`} {...rest}>
      {children}
    </div>
  );
}
