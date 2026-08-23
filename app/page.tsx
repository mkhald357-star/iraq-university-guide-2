import Hero from "./components/Hero";
import ServiceSections from "./components/ServiceSections";
import StatsSection from "./components/StatsSection";
import TrustSection from "./components/TrustSection";
import FAQSection from "./components/FAQSection";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* كل أقسام الصفحة الرئيسية بعرض الشاشة الكامل (full-bleed)، بينما
          <main> في layout.tsx يحصر كل الصفحات بعرض max-w-4xl ووسادة داخلية --
          بدون هذا الكسر: خلفية Hero (التدرّج/الكرات العائمة) كانت ستُحصَر في
          عمود ضيّق. ServiceSections تعرض الخدمات الـ13 كأقسام/بطاقات مستقلة
          ظاهرة مباشرة (بدل نظام لوحات كامل الشاشة + حوار مخفي سابق)، بخلفيات
          متبادلة بين أقسام المراحل الأربع لكسر التسطّح. */}
      <div className="relative left-1/2 right-1/2 -mx-[50vw] -mt-4 w-screen md:-mt-8">
        <Hero />
        <ServiceSections />
        <StatsSection />
        <TrustSection />
        <FAQSection />
      </div>
    </div>
  );
}
