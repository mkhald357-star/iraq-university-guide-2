const FAQS = [
  {
    q: "هل المنصة مجانية؟",
    a: "نعم، بالكامل. بلا حساب، بلا اشتراك، وبلا إعلانات.",
  },
  {
    q: "من وين تجي أرقام الحدود الدنيا؟",
    a: "من الدليل الرسمي لوزارة التعليم العالي والبحث العلمي العراقية للعام الدراسي الحالي (دليل الطالب + الحدود الدنيا للقبول المركزي + دليل الجامعات الأهلية). ما نقدّر أي رقم بأنفسنا.",
  },
  {
    q: "هل الحدود ثابتة كل سنة؟",
    a: "لا. القبول المركزي تنافسي، وتتغيّر الحدود كل عام حسب أداء الطلاب. الأرقام المعروضة خاصة بالعام الدراسي الحالي فقط، وممكن تختلف السنة الجاية.",
  },
  {
    q: "هل تشمل المنصة جامعات إقليم كردستان؟",
    a: "لا حالياً. نظام القبول هناك منفصل تماماً عن القبول المركزي العام، ونفضّل ما نعرض بيانات غير مؤكدة بدل تخمينها.",
  },
  {
    q: "شنو يعني \"قبول مباشر\"؟",
    a: "قسم بلا حدّ قبول تنافسي مُعلَن ضمن الدليل الرسمي — أي طالب مؤهَّل بفرعه يُقبَل فيه دون منافسة على المعدل، وهذا ليس نقصاً في البيانات.",
  },
  {
    q: "ليش بعض الأدوات مكتوب عليها \"قيد التطوير\"؟",
    a: "لأننا ما ننشر أداة قبل ما نوثّق بياناتها من مصدر رسمي. نفضّل التأخير على نشر رقم غير موثوق.",
  },
];

// FAQPage JSON-LD من نفس محتوى FAQS أعلاه حرفياً -- لا محتوى جديد، لا مخاطرة
// افتعال. < يمنع أي احتمال كسر وسم <script> إن احتوى نص سؤال/جواب لاحقاً
// على "</script>" (لا يحدث حالياً، لكن حماية صحيحة عموماً لأي JSON مُضمَّن).
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function FAQSection() {
  return (
    <section dir="rtl" className="py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-3xl px-5">
        <p className="text-sm font-bold text-primary-700">أسئلة شائعة</p>
        <h2 className="mt-2 text-3xl font-extrabold leading-tight text-ink md:text-4xl">
          أسئلة يسألها الطلاب فعلاً
        </h2>

        <div className="mt-10 grid gap-3">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-md border border-line bg-surface p-5 open:shadow-sm"
            >
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-4
                           font-bold text-ink focus-visible:outline focus-visible:outline-2
                           focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                {item.q}
                <svg
                  className="h-5 w-5 shrink-0 text-ink-muted transition-transform duration-200
                             group-open:rotate-45"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
