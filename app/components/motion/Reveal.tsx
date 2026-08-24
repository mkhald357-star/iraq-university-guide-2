"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

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
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
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
