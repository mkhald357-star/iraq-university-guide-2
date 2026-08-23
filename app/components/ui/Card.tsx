import type { HTMLAttributes, ReactNode } from "react";

type Variant = "glass" | "surface" | "muted";

// لا "rounded-*" داخل أيٍّ من هذه الثلاثة عمداً -- انظر تعليق DEFAULT_RADIUS.
const VARIANT_CLASSES: Record<Variant, string> = {
  glass: "glass",
  surface: "border border-line bg-surface shadow-sm",
  muted: "border border-line bg-surface-muted",
};

// نصف قطر الزوايا مفصول عن VARIANT_CLASSES لكل المتغيّرات الثلاثة عمداً، لا
// glass فقط: لو بقي "rounded-md" (مثلاً) داخل صنف surface نفسه، فتمرير
// `radius` صريحاً من مستدعٍ لاحق يخلق صنفي "rounded-*" متعارضين معاً في نفس
// className -- ترتيب الفوز بينهما يحدّده ترتيب Tailwind الداخلي في ورقة
// الأنماط، لا ترتيب ظهورهما في className، فقد ينعكس الاستبدال بصمت.
const DEFAULT_RADIUS: Record<Variant, string> = {
  glass: "rounded-3xl",
  surface: "rounded-md",
  muted: "rounded-2xl",
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
