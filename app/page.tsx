import { BookOpen, Target, Briefcase } from "lucide-react";
import Hero from "./components/Hero";

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

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-8 w-full py-16 max-w-6xl mx-auto px-5">
        <div className="glass p-8 rounded-3xl text-center space-y-4">
          <div className="bg-primary-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-primary-700">
            <Target className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">تحليل دقيق لشخصيتك</h3>
          <p className="text-slate-600 text-sm">
            أسئلة مبنية على نماذج علمية لتحليل الميول السلوكية والمهنية لتحديد التخصص الأنسب لك.
          </p>
        </div>

        <div className="glass p-8 rounded-3xl text-center space-y-4">
          <div className="bg-primary-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-primary-700">
            <Briefcase className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">متوافق مع السوق العراقي</h3>
          <p className="text-slate-600 text-sm">
            نحن نأخذ بعين الاعتبار &quot;مُعامل السوق العراقي&quot; لتوجيهك نحو التخصصات المطلوبة فعلياً.
          </p>
        </div>

        <div className="glass p-8 rounded-3xl text-center space-y-4">
          <div className="bg-primary-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-primary-700">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">دليل الجامعات الحكومية والأهلية</h3>
          <p className="text-slate-600 text-sm">
            نرشدك لأفضل الكليات الحكومية والأهلية المعترف بها التي توفر التخصص الأنسب لك.
          </p>
        </div>
      </div>
    </div>
  );
}
