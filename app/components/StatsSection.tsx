import CountUp from "./CountUp";

/* الأرقام محسوبة من data/universities.json وقت الكتابة (36 حكومية + 85 أهلية،
   961 كلية، 3206 قسم، 1742 منها بقبول مباشر، 15 محافظة) -- نفس أسلوب
   الثوابت الحقيقية المستخدَمة في Hero.tsx، لا استيراد حيّ للملف كاملاً
   (كبير الحجم) داخل حزمة العميل. */
const OVERVIEW = [
  { value: 36, label: "جامعة حكومية" },
  { value: 85, label: "جامعة وكلية أهلية" },
  { value: 961, label: "كلية" },
  { value: 15, label: "محافظة، بغداد وحدها 42 مؤسسة" },
];

const BRANCHES = [
  { label: "علمي", value: 1827, tone: "var(--c-primary-600)" },
  { label: "أدبي", value: 735, tone: "var(--c-primary-400)" },
  { label: "فنون", value: 119, tone: "var(--c-primary-200)" },
];
const BRANCH_TOTAL = BRANCHES.reduce((s, b) => s + b.value, 0);

export default function StatsSection() {
  return (
    <section dir="rtl" className="py-24">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-sm font-bold text-primary-700">بالأرقام</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight text-ink md:text-4xl">
          3,206 قسماً جامعياً، من 121 جامعة وكلية معتمدة
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
          كل رقم هنا محسوب من الدليل الرسمي، لا تقديراً. هذا ما تختار من بينه فعلياً.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OVERVIEW.map((s) => (
            <div key={s.label} className="rounded-md border border-line bg-surface p-5 shadow-sm">
              <div className="text-3xl font-extrabold text-primary-700">
                <CountUp to={s.value} />
              </div>
              <div className="mt-1 text-sm text-ink-soft">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* الإحصائية الأكثر إفادة: أكثر من نصف الأقسام بلا منافسة معدل */}
          <div className="rounded-md border border-band-safe/30 bg-band-safe-bg p-6">
            <div className="text-4xl font-extrabold text-band-safe">
              <CountUp to={1742} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              قسم بقبول مباشر — أكثر من نصف الأقسام الجامعية في العراق (من أصل 3,206) بلا حدّ قبول
              تنافسي مُعلَن. أي طالب مؤهَّل بفرعه يُقبَل دونما منافسة على المعدل.
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
