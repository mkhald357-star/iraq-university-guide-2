import Hero from "./components/Hero";
import JourneyShowcase from "./components/JourneyShowcase";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* الـHero مصمَّم بعرض الشاشة الكامل (full-bleed)، بينما <main> في
          layout.tsx يحصر كل الصفحات بعرض max-w-4xl ووسادة داخلية -- بدون
          هذا الكسر، خلفية التدرّج/الكرات العائمة كانت ستُحصَر في عمود ضيّق
          بدل امتدادها الفعلي كامل عرض الشاشة كما صُمِّم القسم. */}
      <div className="relative left-1/2 right-1/2 -mx-[50vw] -mt-4 w-screen md:-mt-8">
        <Hero />
      </div>

      <JourneyShowcase />
    </div>
  );
}
