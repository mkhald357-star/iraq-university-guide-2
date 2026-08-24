import meta from "../../data/universities_meta.json";
import provincesData from "../../data/provinces.json";
import { UNCOVERED_PROVINCES, UNCOVERED_PROVINCES_REASON } from "../../lib/admissionDisclosure";
import { Card } from "./ui";
import { Reveal } from "./motion/Reveal";

const TOTAL_PROVINCES = provincesData.length + UNCOVERED_PROVINCES.length;

export default function TrustSection() {
  return (
    <section dir="rtl" className="py-24" style={{ background: "var(--g-surface)" }}>
      <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 md:grid-cols-2">
        <Reveal>
          <p className="text-sm font-bold text-primary-text">من وين هذي الأرقام؟</p>
          <h2 className="mt-2 text-3xl font-extrabold leading-tight text-ink md:text-4xl">
            بيانات رسمية، لا تخمين
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
            كل حدّ قبول وكل قسم على المنصة مأخوذ حرفياً من دليل وزارة التعليم العالي والبحث العلمي
            العراقية للعام الدراسي {meta.academicYear}. ما نقدّر رقماً، وما ننشره إلا بعد التأكد
            من مصدره.
          </p>

          <a
            href="https://cap.mohesr.gov.iq"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 font-bold text-primary-text hover:underline"
          >
            القبول المركزي التابع لوزارة التعليم العالي والبحث العلمي
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </Reveal>

        <Reveal delayMs={100}>
        <Card variant="surface" padding="p-6" className="space-y-5">
          <dl>
            <div>
              <dt className="text-xs font-bold text-ink-muted">المصدر</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink">{meta.source}</dd>
            </div>
          </dl>
          {/* ملاحظة بنيوية: زوجا dt/dd هنا في dl منفصلَين، لا متداخلَين داخل
              dl واحد -- axe-core (فحص definition-list/dlitem، §39) رفض تعشيش
              div إضافي حول كل زوج ضمن dl واحد (المواصفة تسمح فقط بـ (dt+)(dd+)
              مسطَّحة داخل div مباشر تحت dl، لا div متداخل داخل div آخر). */}
          <div className="grid grid-cols-2 gap-5">
            <dl>
              <div>
                <dt className="text-xs font-bold text-ink-muted">العام الدراسي</dt>
                <dd className="mt-1 text-sm font-bold text-ink">{meta.academicYear}</dd>
              </div>
            </dl>
            <dl>
              <div>
                <dt className="text-xs font-bold text-ink-muted">آخر تحديث للبيانات</dt>
                <dd className="mt-1 text-sm font-bold text-ink">{meta.lastUpdated}</dd>
              </div>
            </dl>
          </div>
          <dl className="grid gap-5">
            <div>
              <dt className="text-xs font-bold text-ink-muted">التغطية الجغرافية</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-soft">
                {provincesData.length} من {TOTAL_PROVINCES} محافظة عراقية. لا تشمل بعد محافظات إقليم كردستان الثلاث (
                {UNCOVERED_PROVINCES.join("، ")}) — {UNCOVERED_PROVINCES_REASON}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-ink-muted">ما لا تشمله المنصة حالياً</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-soft">
                محافظات إقليم كردستان الثلاث أعلاه، ومعاهد خريجي الفروع المهنية. نفضّل عدم عرض بيانات غير مؤكدة بدل
                تخمينها.
              </dd>
            </div>
          </dl>
        </Card>
        </Reveal>
      </div>
    </section>
  );
}
