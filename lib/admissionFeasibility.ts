/**
 * واقعية القبول (الإصدار 2، المسار C-D): هل يبلغ معدل الطالب هذا التخصص؟
 * تدخل الترتيب **فقط عبر منزلق بيد الطالب، مطفأ افتراضياً** (قرار المالك) --
 * بنفس نمط منزلق السوق، فلا يتغيّر ترتيب من لا يحرّكه.
 *
 * **الترتيب الأساسي لا يعرفها**: لو دخلت rankMajors لورثتها الحقيقة المجمّدة
 * في أداة المدقّق وصار القياس دائرياً. هي إعادة تقييم للعرض، مثل السوق.
 *
 * المرساة: **أدنى حدّ تنافسي صباحي حكومي منشور** -- سؤال الطالب "هل أدخل هذا
 * التخصص في أي مكان؟"، وأدنى حدّ حقيقي هو أسهل باب موثَّق.
 *
 * ما لا يُحتسب باباً، ولماذا (data/admission_rules.md):
 * - الأهلي: لا حدّ منشور لـ98% منه -- "مجهول" لا "سهل" (§28، §32).
 * - المسائي: أرضية ثابتة حسب نوع الكلية لا نتيجة تنافس (§5، §31).
 * - الحكومي "بلا حدّ منشور" (isDirectAdmission): موجود في 61 من 88 تخصصاً، ومنه
 *   قسم الطب في جامعة تلعفر -- كلية حديثة غائبة عن جدول الحدود على الأرجح، لا
 *   باب مفتوح لأي معدل. لو احتُسب "سهلاً" لصار المنزلق مسطّحاً لأغلب التخصصات
 *   ولوعد الطبَّ كل طالب. يُعَدّ ويُفصَح عنه، ولا يرجّح.
 */
import indexData from "../data/major_admission_index.json";

export type FeasibilityConfidence = "high" | "medium" | "low" | "none";

export interface MajorAdmissionEntry {
  competitiveOfferings: number;
  directAdmissionOfferings: number;
  privateOfferings: number;
  statedPrivateMinCount: number;
  unknownOfferings: number;
  suspendedOfferings: number;
  cutoffMin: number | null;
  cutoffP25: number | null;
  cutoffMedian: number | null;
  cutoffMax: number | null;
  coverage: number;
  confidence: FeasibilityConfidence;
}

export type AdmissionIndex = Record<string, MajorAdmissionEntry>;
export const ADMISSION_INDEX = indexData.majors as AdmissionIndex;

/** فارق المعدل (نقاط) الذي يُشبع المنحدر: +10 فوق أسهل باب = 100، −10 تحته = 0. */
export const FEASIBILITY_SATURATION_MARGIN = 10;

/**
 * 0..100، و50 = المعدل على أسهل باب تماماً. `null` = لا حدّ تنافسي موثَّق،
 * فلا يحرّكه المنزلق أبداً (المجهول ليس سهلاً ولا صعباً).
 */
export function computeFeasibilityPercent(grade: number, entry: MajorAdmissionEntry | undefined): number | null {
  if (!entry || entry.confidence === "none" || entry.cutoffMin === null) return null;
  const raw = 50 + ((grade - entry.cutoffMin) / FEASIBILITY_SATURATION_MARGIN) * 50;
  return Math.max(0, Math.min(100, raw));
}

export type FeasibilityTone = "above" | "near" | "below" | "unknown";

export interface FeasibilityNote {
  tone: FeasibilityTone;
  text: string;
}

/** سطر يفهمه الطالب -- بلا كلمة "سهل" أبداً، والرقم دائماً نتيجة العام الماضي. */
export function feasibilityNote(grade: number, entry: MajorAdmissionEntry | undefined): FeasibilityNote {
  if (!entry || entry.cutoffMin === null) {
    return { tone: "unknown", text: "لا يتوفّر حدّ تنافسي حكومي منشور لهذا التخصص" };
  }
  const gap = +(grade - entry.cutoffMin).toFixed(1);
  const min = entry.cutoffMin;
  if (gap >= 0) {
    return { tone: gap >= 5 ? "above" : "near", text: `أدنى حدّ حكومي منشور ${min}٪ — معدلك يتجاوزه بـ${gap} نقطة` };
  }
  return { tone: "below", text: `أدنى حدّ حكومي منشور ${min}٪ — أعلى من معدلك بـ${Math.abs(gap)} نقطة` };
}
