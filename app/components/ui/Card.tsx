import type { HTMLAttributes, ReactNode } from "react";

type Variant = "glass" | "surface" | "muted";

const VARIANT_CLASSES: Record<Variant, string> = {
  glass: "glass",
  surface: "rounded-md border border-line bg-surface shadow-sm",
  muted: "rounded-2xl border border-line bg-surface-muted",
};

// نصف قطر الزوايا الافتراضي منفصل عن VARIANT_CLASSES عمداً (لا مدمَجاً فيه):
// إذا احتاج مستدعٍ نصف قطر مختلفاً عبر `radius`، فإن دمج "rounded-3xl" داخل
// نفس صنف الغلاف مع "rounded-2xl" في className يخلق صنفين متعارضين لنفس
// الخاصية دفعة واحدة -- ترتيب الفوز بينهما يحدّده ترتيب Tailwind الداخلي في
// ورقة الأنماط، لا ترتيب ظهورهما في className، فقد ينعكس الاستبدال بصمت.
const DEFAULT_RADIUS: Record<Variant, string> = {
  glass: "rounded-3xl",
  surface: "",
  muted: "",
};

export function Card({
  variant = "surface",
  radius,
  padding = "p-6",
  className = "",
  children,
  ...rest
}: {
  variant?: Variant;
  radius?: string;
  padding?: string;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const radiusClass = radius ?? DEFAULT_RADIUS[variant];
  return (
    <div className={`${VARIANT_CLASSES[variant]} ${radiusClass} ${padding} ${className}`} {...rest}>
      {children}
    </div>
  );
}
