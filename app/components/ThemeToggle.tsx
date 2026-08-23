"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  // null حتى أول تأثير جانبي بعد الترطيب -- تفادي عدم تطابق SSR/عميل، لأن
  // القيمة الحقيقية تُقرأ من localStorage/تفضيل النظام (سكربت app/layout.tsx
  // يضبط data-theme على <html> قبل الرسم، هنا فقط نقرأ نفس الحالة لعرض الأيقونة).
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // تخزين محلي معطَّل (وضع خاص صارم مثلاً) -- التبديل يبقى يعمل لهذه
      // الجلسة فقط، بلا حفظ، وهذا سلوك مقبول بلا حاجة لإبلاغ المستخدم.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "التبديل للوضع الفاتح" : "التبديل للوضع الداكن"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft
                 transition-colors hover:border-primary-300 hover:text-primary-text
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
    >
      {isDark === null ? null : isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
