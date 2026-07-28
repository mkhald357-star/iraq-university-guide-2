import Hero from "./components/Hero";
import JourneyPanels from "./components/JourneyPanels";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* الـHero وأقسام JourneyPanels العمودية مصمَّمان بعرض الشاشة الكامل
          (full-bleed)، بينما <main> في layout.tsx يحصر كل الصفحات بعرض
          max-w-4xl ووسادة داخلية -- بدون هذا الكسر: خلفية Hero (التدرّج/
          الكرات العائمة) كانت ستُحصَر في عمود ضيّق، وأقسام JourneyPanels
          (بخلفياتها المتبادلة اللون وارتفاعها الكامل 100svh ومؤشّر النقاط
          الجانبي الثابت) كانت لتفقد معناها كأقسام تملأ الشاشة. */}
      <div className="relative left-1/2 right-1/2 -mx-[50vw] -mt-4 w-screen md:-mt-8">
        <Hero />
        <JourneyPanels />
      </div>
    </div>
  );
}
