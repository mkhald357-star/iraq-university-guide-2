import { PRIVATE_NO_PUBLISHED_MIN, privateStatedMin } from "./admissionDisclosure";

export const GOV_NO_PUBLISHED_CUTOFF = "لا حدّ منشور في دليل 2025-2026";

/**
 * لا يوجد قبول مباشر في أي قسم حكومي (PLAN-ADMISSION-FIX.md).
 * كل قسم حكومي إما له رقم تنافسي منشور رسمياً أو "لا حدّ منشور في دليل 2025-2026".
 * دالة مستقلة لتبقى قابلة للاختبار المباشر.
 */
export function formatGrade(value: number | null | undefined, sessionAvailable: boolean, isDirectAdmission?: boolean) {
  if (!sessionAvailable) return { text: "—", isDirect: false };
  if (value != null) return { text: `${value}%`, isDirect: false };
  if (isDirectAdmission) return { text: "قبول مباشر", isDirect: true };
  return { text: GOV_NO_PUBLISHED_CUTOFF, isDirect: false };
}

export type AdmissionCellTone = "direct" | "stated" | "unstated" | "competitive" | "none";

/**
 * خلية عرض حدّ القبول -- تفرّع حسب نوع الجامعة (PLAN-ADMISSION-FIX.md وdata/admission_rules.md §28).
 * الأهلي: شرط معلَن (statedMinimumGrade) أو "الحدّ الأدنى غير متوفّر".
 * الحكومي: الرقم منشوراً (XX%) أو "لا حدّ منشور في دليل 2025-2026". لا مسار يُنتج "قبول مباشر" لحكومي إطلاقاً.
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

  // حكومي: الرقم أولاً، ولا قبول مباشر في أي قسم حكومي إطلاقاً
  if (averageValue != null) {
    return { text: `${averageValue}%`, tone: "competitive" };
  }

  return { text: GOV_NO_PUBLISHED_CUTOFF, tone: "unstated" };
}
