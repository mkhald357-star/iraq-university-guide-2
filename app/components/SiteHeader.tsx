import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { SITE_NAME } from "../../lib/siteMeta";

// اسم المنصة كان غائباً تماماً عن الواجهة (موجوداً فقط في وسوم <title>/OG
// غير المرئية) -- شريط علوي ثابت عبر كل الصفحات، لا الرئيسية فقط، ليكون
// اسم المنصة أول ما يراه الزائر بصرف النظر عن الصفحة التي دخل منها.
export default function SiteHeader() {
  return (
    <header dir="rtl" className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-4xl items-center px-4 py-3.5 md:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-md
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4
                     focus-visible:outline-primary-600"
        >
          <span
            className="inline-flex shrink-0 rounded-lg p-1.5 text-white transition-transform duration-200 group-hover:scale-105"
            style={{ background: "var(--g-primary)" }}
          >
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-extrabold leading-none text-ink md:text-xl">{SITE_NAME}</span>
        </Link>
      </div>
    </header>
  );
}
