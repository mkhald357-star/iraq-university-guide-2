import CountUp from "./CountUp";
import homepageStats from "../../data/homepage_stats.json";

// الأرقام محسوبة حياً وقت البناء (scripts/compute-homepage-stats.js من
// data/universities.json مباشرة) -- لا ثوابت مكتوبة يدوياً. كانت هذه القيم
// ثوابت جامدة سابقاً فانحرفت عن البيانات الحقيقية بعد جولات إصلاح تلوّث
// chapter3_additions.json (راجع تشخيص_المشاكل_وخطة_الإصلاح_الشاملة.md،
// المشكلة ١) -- هذا الملف يمنع تكرار الانحراف.
const OVERVIEW = [
  { value: homepageStats.governmentUniversities, label: "جامعة حكومية" },
  { value: homepageStats.privateUniversities, label: "جامعة وكلية أهلية" },
  { value: homepageStats.totalColleges, label: "كلية" },
  { value: homepageStats.provinces, label: "محافظة" },
];

const BRANCHES = [
  { label: "علمي", value: homepageStats.branchCounts.علمي, tone: "var(--c-primary-600)" },
  { label: "أدبي", value: homepageStats.branchCounts.أدبي, tone: "var(--c-primary-400)" },
  { label: "فنون", value: homepageStats.branchCounts.فنون, tone: "var(--c-primary-200)" },
];
const BRANCH_TOTAL = BRANCHES.reduce((s, b) => s + b.value, 0);

export default function StatsSection() {
  return (
    <section dir="rtl" className="py-24">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-sm font-bold text-primary-text">بالأرقام</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight text-ink md:text-4xl">
          {homepageStats.totalDepartments.toLocaleString("ar-IQ")} قسماً جامعياً، من{" "}
          {homepageStats.totalUniversities} جامعة وكلية معتمدة
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
          كل رقم هنا محسوب من الدليل الرسمي، لا تقديراً. هذا ما تختار من بينه فعلياً.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OVERVIEW.map((s) => (
            <div key={s.label} className="rounded-md border border-line bg-surface p-5 shadow-sm">
              <div className="text-3xl font-extrabold text-primary-text">
                <CountUp to={s.value} />
              </div>
              <div className="mt-1 text-sm text-ink-soft">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* حصراً الحكومي -- isDirectAdmission هناك مؤكَّد (غياب منافسة حقيقي)،
              بخلاف الأهلي حيث القيمة true دائماً بصرف النظر عن نشر حدّ من عدمه
              (data/admission_rules.md §28). ضمّ الأهلي هنا كان يجعل الادّعاء
              مضلِّلاً ("أكثر من نصف") لرقم لا يعكس غياب حدّ فعلياً لمعظمه. */}
          <div className="rounded-md border border-line bg-band-safe-bg p-6">
            <div className="text-4xl font-extrabold text-band-safe">
              <CountUp to={homepageStats.directAdmissionDepartmentsGov} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              قسم حكومي بقبول مباشر (من أصل {homepageStats.governmentDepartments.toLocaleString("ar-IQ")} قسماً
              حكومياً) بلا حدّ قبول تنافسي مُعلَن — أي طالب مؤهَّل بفرعه يُقبَل دونما منافسة على المعدل. الأقسام
              الأهلية لها شروط قبول منشورة جزئياً في دليل منفصل، ولا تُحتسَب هنا.
            </p>
          </div>

          <div className="rounded-md border border-line bg-surface p-6 shadow-sm">
            <p className="text-sm font-bold text-ink-muted">توزيع الأقسام حسب الفرع</p>
            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full">
              {BRANCHES.map((b) => (
                <span
                  key={b.label}
                  style={{ width: `${(b.value / BRANCH_TOTAL) * 100}%`, background: b.tone }}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {BRANCHES.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.tone }} />
                  <span className="font-bold text-ink">{b.label}</span>
                  <span className="text-ink-muted">{b.value.toLocaleString("ar-IQ")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
