"use client";
import { useEffect, useRef } from "react";
import {
  GraduationCap,
  Stethoscope,
  Scale,
  Palette,
  FlaskConical,
  Cog,
  Landmark,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

// أيقونات كبيرة معبِّرة عن تنوّع التخصصات (طب/قانون/فنون/علوم/هندسة/تعليم/
// جامعة/كتاب) منتشرة خلف نص الـHero -- ليست زخرفة عامة، بل تمثيل بصري مباشر
// لما تحتويه المنصة فعلاً (88 تخصصاً متنوّعاً). كل أيقونة بعمق مختلف (parallax
// speed مختلفة) فتتحرك بمعدّلات متفاوتة أثناء التمرير عبر الـHero، لا حركة
// طفو موحّدة بسيطة كباقي عناصر الموقع -- طلب المستخدم صراحة تمايزها.
const ICONS: {
  Icon: LucideIcon;
  top: string;
  side: "insetInlineStart" | "insetInlineEnd";
  offset: string;
  size: number;
  depth: number; // 0..1 -- 1 = أقرب/أسرع حركة، 0.2 = أبعد/أبطأ
  rotate: number;
}[] = [
  { Icon: Stethoscope, top: "8%", side: "insetInlineStart", offset: "4%", size: 64, depth: 0.35, rotate: -8 },
  { Icon: Scale, top: "62%", side: "insetInlineStart", offset: "10%", size: 56, depth: 0.6, rotate: 6 },
  { Icon: FlaskConical, top: "20%", side: "insetInlineEnd", offset: "6%", size: 72, depth: 0.5, rotate: 10 },
  { Icon: Cog, top: "70%", side: "insetInlineEnd", offset: "16%", size: 60, depth: 0.25, rotate: -12 },
  { Icon: Palette, top: "40%", side: "insetInlineStart", offset: "20%", size: 52, depth: 0.75, rotate: -5 },
  { Icon: GraduationCap, top: "12%", side: "insetInlineEnd", offset: "30%", size: 80, depth: 0.2, rotate: 4 },
  { Icon: Landmark, top: "80%", side: "insetInlineStart", offset: "36%", size: 58, depth: 0.45, rotate: 3 },
  { Icon: BookOpen, top: "48%", side: "insetInlineEnd", offset: "38%", size: 50, depth: 0.65, rotate: -6 },
];

export default function HeroIconField() {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return; // الأيقونات تبقى ظاهرة ثابتة بلا أي حركة -- لا حذف محتوى، فقط إيقاف الحركة

    const icons = Array.from(el.querySelectorAll<HTMLElement>("[data-depth]"));
    let ticking = false;

    function update() {
      const rect = el!.getBoundingClientRect();
      // 0 عند أعلى الـHero بمحاذاة أعلى الشاشة، 1 عند خروجه الكامل من الأعلى
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      for (const node of icons) {
        const depth = Number(node.dataset.depth);
        const rotate = Number(node.dataset.rotate);
        const travel = progress * 140 * depth; // كل أيقونة تسافر بمسافة مختلفة حسب عمقها
        node.style.transform = `translateY(${travel}px) rotate(${rotate + progress * depth * 25}deg)`;
      }
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    // القراءة الأولى مؤجَّلة لإطار رسم لاحق (rAF) عمداً لا استدعاء مباشر:
    // قياس Lighthouse فعلي كشف "forced reflow" حقيقياً (616ms) وقت التحميل،
    // سببه قراءة getBoundingClientRect متزامنة أثناء نفس دفعة تركيب مكوّنات
    // React الأخرى (Reveal/CountUp إلخ) التي تكتب DOM في نفس اللحظة -- تأجيل
    // القراءة إلى ما بعد الرسم يفصلها عن تلك الكتابات فلا يُجبَر التخطيط.
    window.requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={fieldRef} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {ICONS.map(({ Icon, top, side, offset, size, depth, rotate }, i) => (
        <span
          key={i}
          data-depth={depth}
          data-rotate={rotate}
          className="absolute text-white/[0.14]"
          style={{ top, [side]: offset, transform: `rotate(${rotate}deg)` }}
        >
          <Icon style={{ width: size, height: size }} strokeWidth={1.5} />
        </span>
      ))}
    </div>
  );
}
