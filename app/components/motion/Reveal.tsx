"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

// مراقب واحد مشترك لكل نسخ Reveal في الصفحة، لا مراقب مستقل لكل عنصر --
// قياس Lighthouse فعلي (npx lighthouse على /) أظهر "Style & Layout" كأكبر
// بند عمل على الخيط الرئيسي (1.48s) مع مهمّتين طويلتين (~450-500ms) قرب وقت
// الترطيب (hydration)، متزامنتين مع إنشاء 27+ كائن IntersectionObserver
// مستقلاً على الصفحة الرئيسية دفعة واحدة. تجميعها في مراقب واحد (نفس مبدأ
// ScrollTrigger.batch الموصى به في دليل motion-system، معمَّم على
// IntersectionObserver الأصلي) يقلّل عبء الإنشاء والجدولة بشكل مباشر.
let sharedObserver: IntersectionObserver | null = null;
const pending = new Map<Element, () => void>();

function getSharedObserver(): IntersectionObserver {
  if (sharedObserver) return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const onVisible = pending.get(entry.target);
        if (!onVisible) continue;
        onVisible();
        sharedObserver!.unobserve(entry.target);
        pending.delete(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
  );
  return sharedObserver;
}

// الغلاف الوحيد لعقد data-anim="reveal" في هذا المشروع -- كشف عند التمرير
// بـIntersectionObserver الأصلي (بلا GSAP/Framer، مطابقةً لقرار المشروع
// القائم بعدم إضافة مكتبة حركة جديدة، انظر WEBCRAFT.md). يعيد استخدام صنف
// riseIn/--t-slow/--ease الموجودين أصلاً بدل تعريف حركة جديدة موازية.
export function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = getSharedObserver();
    pending.set(el, () => setVisible(true));
    observer.observe(el);
    return () => {
      observer.unobserve(el);
      pending.delete(el);
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
