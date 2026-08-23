import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12">
      <div className="glass p-10 rounded-3xl text-center space-y-6 max-w-md">
        <div className="bg-primary-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-primary-text">
          <Compass className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-primary-text">الصفحة غير موجودة</h1>
          <p className="text-ink-soft">
            الرابط الذي فتحته غير صحيح أو لم يعد متاحاً. جرّب العودة للصفحة الرئيسية وابدأ من هناك.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-primary-solid text-white px-6 py-3 rounded-full font-bold hover:bg-primary-solid-hover transition-all shadow-lg hover:shadow-primary/50 hover:-translate-y-1"
        >
          <span>العودة للصفحة الرئيسية</span>
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
