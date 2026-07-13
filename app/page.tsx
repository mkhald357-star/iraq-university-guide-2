import Link from "next/link";
import { ArrowLeft, BookOpen, Target, Briefcase } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-12 py-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 max-w-3xl">
        <h1 className="text-5xl md:text-6xl font-black text-primary leading-tight">
          معدلك ما يحدد مستقبلك!
        </h1>
        <p className="text-xl md:text-2xl text-slate-600 font-light">
          اكتشف التخصص الجامعي الذي يضمن لك وظيفة تناسب شخصيتك في السوق العراقي في أقل من 5 دقائق.
        </p>
        
        <div className="pt-8">
          <Link 
            href="/quiz"
            className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-full text-xl font-bold hover:bg-blue-800 transition-all shadow-lg hover:shadow-primary/50 hover:-translate-y-1"
          >
            <span>ابدأ الاختبار مجاناً</span>
            <ArrowLeft className="w-6 h-6" />
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-8 w-full pt-16">
        <div className="glass p-8 rounded-3xl text-center space-y-4">
          <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-primary">
            <Target className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">تحليل دقيق لشخصيتك</h3>
          <p className="text-slate-600 text-sm">أسئلة مبنية على نماذج علمية لتحليل الميول السلوكية والمهنية لتحديد التخصص الأنسب لك.</p>
        </div>

        <div className="glass p-8 rounded-3xl text-center space-y-4">
          <div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-secondary">
            <Briefcase className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">متوافق مع السوق العراقي</h3>
          <p className="text-slate-600 text-sm">نحن نأخذ بعين الاعتبار "مُعامل السوق العراقي" لتوجيهك نحو التخصصات المطلوبة فعلياً.</p>
        </div>

        <div className="glass p-8 rounded-3xl text-center space-y-4">
          <div className="bg-emerald-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">دليل الجامعات الحكومية والأهلية</h3>
          <p className="text-slate-600 text-sm">نرشدك لأفضل الكليات الحكومية والأهلية المعترف بها التي توفر التخصص الأنسب لك.</p>
        </div>
      </div>
    </div>
  );
}
