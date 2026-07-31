/** القيم الفعلية في data/major_profiles_detailed.json (career.licensingRequirement.required، career.postgradNeededForPractice). */
export type TriStateRaw = boolean | "جزئياً" | null | undefined;

/** الحالة المُطبَّعة -- أربع حالات، لا اثنتان. */
export type TriState = "yes" | "no" | "partial" | "unknown";

/**
 * يُطبّع قيمة ثلاثية الحالات.
 * أي قيمة غير متوقّعة ⇒ "unknown" -- فشل آمن: نقول "لم نتحقّق" بدل ادّعاء
 * خاطئ في أي اتجاه (انظر data/admission_rules.md §21).
 */
export function normalizeTriState(v: TriStateRaw): TriState {
  if (v === true) return "yes";
  if (v === false) return "no";
  if (typeof v === "string" && v.trim() === "جزئياً") return "partial";
  return "unknown";
}
