/**
 * مصدر واحد لكل نصوص الإفصاح عن نطاق بيانات القبول. لا تكرّر هذه النصوص في
 * أي مكوّن -- استوردها من هنا.
 */
import universitiesMeta from "../data/universities_meta.json";

/** يُقرأ من data/universities_meta.json (academicYear موجود فعلاً هناك،
    ويُستخدَم أصلاً في app/components/TrustSection.tsx) -- لا يُكتب رقم يدوياً
    هنا كي لا يتضارب مصدرا حقيقة عند تحديث بيانات عام دراسي جديد. */
export const ADMISSION_YEAR = (universitiesMeta as { academicYear: string }).academicYear;

export const ADMISSION_CHANNEL = "القناة العامة";

export const SPECIAL_CHANNELS = [
  "ذوي الشهداء",
  "أوائل المحافظات",
  "الرياضيين",
  "أبناء التدريسيين",
  "ذوي الاحتياجات الخاصة",
] as const;

/** شارة مختصرة بجوار الجداول والبطاقات */
export const CHANNEL_BADGE = `${ADMISSION_CHANNEL} · ${ADMISSION_YEAR}`;

export const CHANNEL_NOTICE_TITLE = `الأرقام المعروضة تخصّ ${ADMISSION_CHANNEL} فقط`;

// ملاحظة صياغة مقصودة: "تكون عادةً أدنى" لا "أدنى دائماً" -- الثانية ادّعاء
// كمّي لا نملك دليلاً عليه لكل قناة خاصة وكل قسم على حدة.
export const CHANNEL_NOTICE_BODY =
  `هذه هي الحدود الدنيا لـ${ADMISSION_CHANNEL} وفق نتائج القبول المركزي ${ADMISSION_YEAR}. ` +
  `إذا كنت تتقدّم ضمن قناة خاصة (${SPECIAL_CHANNELS.join("، ")}) ` +
  `فالحدود التي تنطبق عليك تختلف، وتكون عادةً أدنى من المعروض هنا.`;

/** نصّ عادي للتصدير والقوالب غير التفاعلية (قالب PDF في app/report/page.tsx
    مثلاً -- HTML/CSS مستقل لا يلتقط مكوّنات React، انظر data/admission_rules.md §23). */
export const CHANNEL_NOTICE_PLAIN = `${CHANNEL_NOTICE_TITLE}. ${CHANNEL_NOTICE_BODY} المرجع الرسمي الوحيد هو دائرة القبول المركزي.`;
