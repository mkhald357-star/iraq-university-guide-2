import { PRIVATE_NO_PUBLISHED_MIN, privateStatedMin } from "./admissionDisclosure";

/**
 * "قبول مباشر" يُشتَقّ حصراً من isDirectAdmission (الحقل الحقيقي المحسوب في
 * scripts/build-universities-data.js من طول مصفوفة cutoffs الفعلية) -- لا من
 * فراغ القيمة. فراغ القيمة بدون isDirectAdmission يعني بيانات مفقودة فعلياً
 * (فجوة استخراج)، لا قبولاً مباشراً، وهذان معنيان متناقضان تماماً لا يجوز
 * دمجهما (انظر data/admission_rules.md §17). دالة مستقلة (لا داخل مكوّن React)
 * لتبقى قابلة للاختبار المباشر بلا حاجة لبنية اختبار مكوّنات جديدة.
 */
export function formatGrade(value: number | null | undefined, sessionAvailable: boolean, isDirectAdmission: boolean) {
  if (!sessionAvailable) return { text: "—", isDirect: false };
  if (isDirectAdmission) return { text: "قبول مباشر", isDirect: true };
  if (value == null) return { text: "غير متوفر", isDirect: false };
  return { text: `${value}%`, isDirect: false };
}

export type AdmissionCellTone = "direct" | "stated" | "unstated" | "competitive" | "none";

/**
 * خلية عرض حدّ القبول -- تفرّع حسب نوع الجامعة (data/admission_rules.md §28).
 * الحكومي: كما formatGrade تماماً (isDirectAdmission يعني غياب منافسة حقيقي
 * مؤكَّد بـcutoffs.length===0). الأهلي: "قبول مباشر" غير دقيق بنيوياً (الدليل
 * ينشر شرط معدّل انتقائياً) -- إمّا شرط معلَن (statedMinimumGrade) أو "الحدّ
 * الأدنى غير متوفّر"، أبداً "قبول مباشر".
 */
export function admissionCell(
  universityType: string | undefined,
  sessionAvailable: boolean,
  isDirectAdmission: boolean,
  averageValue: number | null | undefined,
  statedMinimumGrade: { value: number } | null | undefined
): { text: string; tone: AdmissionCellTone } {
  if (!sessionAvailable) return { text: "—", tone: "none" };

  if (universityType === "أهلية") {
    if (statedMinimumGrade?.value != null) {
      return { text: privateStatedMin(statedMinimumGrade.value), tone: "stated" };
    }
    return { text: PRIVATE_NO_PUBLISHED_MIN, tone: "unstated" };
  }

  if (isDirectAdmission) return { text: "قبول مباشر", tone: "direct" };
  if (averageValue == null) return { text: "غير متوفر", tone: "unstated" };
  return { text: `${averageValue}%`, tone: "competitive" };
}
