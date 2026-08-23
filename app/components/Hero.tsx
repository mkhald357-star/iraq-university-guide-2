"use client";

import Link from "next/link";
import { GraduationCap, Building2, Landmark, MapPin, type LucideIcon } from "lucide-react";
import CountUp from "./CountUp";
import HeroIconField from "./HeroIconField";
import homepageStats from "../../data/homepage_stats.json";

// الأرقام محسوبة حياً وقت البناء (scripts/compute-homepage-stats.js) -- لا
// ثوابت مكتوبة يدوياً، تفادياً للتضارب المكتشَف بين هذه البطاقات والبيانات
// الحقيقية بعد جولات إصلاح تلوّث chapter3_additions.json (راجع
// تشخيص_المشاكل_وخطة_الإصلاح_الشاملة.md، المشكلة ١).
const STATS: { value: number; label: string; Icon: LucideIcon }[] = [
  { value: homepageStats.totalMajors, label: "تخصصاً موثّقاً", Icon: GraduationCap },
  { value: homepageStats.totalDepartments, label: "قسماً جامعياً", Icon: Building2 },
  { value: homepageStats.totalUniversities, label: "جامعة وكلية", Icon: Landmark },
  { value: homepageStats.provinces, label: "محافظة", Icon: MapPin },
];

export default function Hero() {
  return (
    <section dir="rtl" className="relative min-h-[86svh] w-full overflow-hidden flex items-center isolate">
      {/* ── الطبقة ١: الخلفية -- تدرّج لوني بدل صورة فوتوغرافية (لا صورة
          حقيقية متاحة حالياً؛ هذا البديل الخفيف صفر كيلوبايت، مذكور صراحة
          كخيار في تصميم القسم نفسه) ── */}
      <div className="absolute inset-0 -z-20" style={{ background: "var(--g-primary)" }} />

      {/* ── الطبقة ٢: كرات ضوئية عائمة ── */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
        <span
          className="absolute h-72 w-72 rounded-full blur-2xl a-float"
          style={{ background: "var(--g-orb)", top: "12%", insetInlineStart: "6%" }}
        />
        <span
          className="absolute h-96 w-96 rounded-full blur-3xl a-float"
          style={{ background: "var(--g-orb)", bottom: "-8%", insetInlineEnd: "10%", animationDelay: "2.5s" }}
        />
      </div>

      {/* ── المحتوى ── */}
      <div className="relative mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <p
          className="a-rise d-1 mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10
                      px-4 py-1.5 text-sm text-white/90 backdrop-blur-sm"
        >
          <span className="h-2 w-2 rounded-full bg-primary-300" />
          بيانات رسمية من وزارة التعليم العالي
        </p>

        <h1 className="a-rise d-2 max-w-3xl text-4xl font-extrabold leading-[1.25] text-white md:text-6xl">
          اختر تخصصك الجامعي
          <span className="block text-primary-300">بالأرقام الحقيقية، لا بالتخمين</span>
        </h1>

        <p className="a-rise d-3 mt-6 max-w-xl text-lg leading-relaxed text-white/85">
          اختبار شخصية علمي، ومطابقة بحدود القبول الفعلية لكل قسم في العراق. مجاناً بالكامل، وبلا حساب.
        </p>

        <div className="a-rise d-4 mt-9 flex flex-wrap gap-3">
          {/* زر الدعوة الأساسي أبيض صريح (لا يستخدم --g-primary كخلفية) --
              بما أن خلفية القسم نفسها أصبحت تدرّج --g-primary (بلا صورة)،
              زر بنفس التدرّج كان سيختفي بصرياً في خلفيته. الأبيض الصريح هو
              التباين الأعلى الممكن هنا، ويُبقي الزر الثانوي (رتّب رغباتك)
              هو الخيار الأخف بصرياً كما صُمِّم أصلاً. */}
          <Link
            href="/quiz"
            className="rounded-lg bg-white px-7 py-3.5 font-bold text-[#115e59] shadow-lg
                       transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#f0fdfa]
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-white"
          >
            ابدأ الاختبار مجاناً
          </Link>

          <Link
            href="/wishlist"
            className="rounded-lg border border-white/35 bg-white/10 px-7 py-3.5 font-bold text-white
                       backdrop-blur-sm transition-colors duration-200 hover:bg-white/20"
          >
            رتّب رغباتك
          </Link>
        </div>

        {/* شريط الأرقام الحقيقية -- مستطيلات كبيرة 2×2، كل واحد بأيقونة
            خلفية معبِّرة عن معناه (تخرّج/مبنى/معلَم/موقع) بشفافية خفيفة +
            حركة "طفو" بطيئة مستمرة (a-float، نفس حركة الكرات الضوئية أعلاه)،
            بدل صفّ نصوص مسطّح بلا شخصية بصرية. */}
        <div className="mt-14 grid max-w-2xl grid-cols-2 gap-4">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`a-rise d-${i + 2} relative overflow-hidden rounded-2xl border border-white/20
                          bg-white/10 p-5 backdrop-blur-sm md:p-7`}
            >
              <s.Icon
                aria-hidden="true"
                className="a-float pointer-events-none absolute -end-3 -top-3 h-20 w-20 text-white/15 md:h-24 md:w-24"
                style={{ animationDelay: `${i * 0.7}s` }}
              />
              <div className="relative text-3xl font-extrabold text-white md:text-4xl">
                <CountUp to={s.value} />
              </div>
              <div className="relative mt-1 text-sm text-white/70">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* مؤشر التمرير */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-7 flex justify-center">
        <svg
          className="a-hint h-6 w-6 text-white/70"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}
