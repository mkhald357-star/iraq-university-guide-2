/**
 * نظام حالة واحد مشترك لأي صفحة تعتمد على بيانات مجلوبة: تحميل → فشل | فراغ
 * | جاهز. راجع data/admission_rules.md §31 لخلفية القرار (ثلاث رقع كانت
 * ستترك حالة رابعة تظهر لاحقاً في مكان جديد).
 */

export type FetchFailureKind = "network" | "timeout" | "notFound" | "parse" | "unknown";

export class DataFetchError extends Error {
  kind: FetchFailureKind;
  url: string;

  constructor(kind: FetchFailureKind, url: string, message?: string) {
    super(message ?? kind);
    this.name = "DataFetchError";
    this.kind = kind;
    this.url = url;
  }
}

export type ViewState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: DataFetchError }
  | { status: "empty"; diagnosis: EmptyDiagnosis }
  | { status: "ready"; data: T };

/** سبب الفراغ -- ليس شيئاً واحداً، ولكلٍّ مخرج مختلف */
export type EmptyReasonCode =
  | "GRADE_BELOW_ALL" // المعدّل دون كل الحدود المتاحة
  | "SESSION_UNAVAILABLE" // الجلسة المختارة لا تحوي خياراً ضمن المعدّل
  | "PROVINCE_TOO_NARROW" // المحافظة وحدها هي القيد
  | "FILTERS_TOO_NARROW" // تركيبة فلاتر
  | "NO_DATA"; // لا بيانات أصلاً (يشير لعطل)

export interface EmptyDiagnosis {
  code: EmptyReasonCode;
  /** الفلتر الذي لو رُفع لظهرت نتائج */
  relaxable: "province" | "session" | "grade" | null;
  /** كم نتيجة تظهر لو رُفع */
  wouldYield: number;
  /** أقرب الخيارات بفارق المعدّل -- للعرض المحترم */
  nearest: Array<{ offering: unknown; gap: number }>;
}
