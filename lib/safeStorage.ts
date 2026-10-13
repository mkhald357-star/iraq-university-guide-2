/**
 * قراءة آمنة لما تحفظه المنصة في متصفح الطالب (localStorage) — خطة الأمن س1-4 (SECURITY-PLAN.md).
 *
 * كل ما يُحفظ هنا على جهاز الطالب وحده ولا يُرسَل لأي خادم. لكنه مُدخَل غير موثوق عند القراءة:
 * قد يكون تالفاً، أو عُدِّل يدوياً، أو كُتب بإصدار أقدم. لذلك:
 *  - التحليل يُسقط المفاتيح الخطرة (`__proto__` و`constructor` و`prototype`) فلا يُلوَّث نموذج الكائنات.
 *  - القيمة تُقبل فقط إن مرّت بفحص شكلها، وإلا تُعاد القيمة الافتراضية.
 *  - أي خطأ (تخزين معطَّل، وضع خاص، بيانات تالفة) يُعيد القيمة الافتراضية بلا كسر الصفحة.
 */

/** مفاتيح المنصة في التخزين المحلي — المصدر الوحيد لزر «امسح بياناتي». */
export const APP_STORAGE_KEYS = [
  "quizResults",
  "quizResultsV2",
  "userAnswers",
  "subjectGrades",
  "needsReview",
  "filterSettings",
  "wishlistPlan",
  "theme",
] as const;

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** JSON.parse يُسقط المفاتيح التي تلوّث نموذج الكائنات. */
export function safeParse(raw: string): unknown {
  return JSON.parse(raw, (key, value) => (FORBIDDEN_KEYS.has(key) ? undefined : value));
}

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** يقرأ مفتاحاً ويعيده فقط إن مرّ بفحص الشكل؛ وإلا fallback. */
export function readStored<T>(key: string, isValid: (v: unknown) => v is T, fallback: T): T;
export function readStored<T>(key: string, isValid: (v: unknown) => v is T, fallback: null): T | null;
export function readStored<T>(key: string, isValid: (v: unknown) => v is T, fallback: T | null): T | null {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = safeParse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** يمسح كل ما حفظته المنصة على هذا الجهاز. يعيد عدد المفاتيح التي كانت موجودة. */
export function clearAppData(): number {
  let n = 0;
  try {
    for (const k of APP_STORAGE_KEYS) {
      if (window.localStorage.getItem(k) != null) n++;
      window.localStorage.removeItem(k);
    }
  } catch {
    // تخزين معطَّل: لا شيء يُمسح
  }
  return n;
}
