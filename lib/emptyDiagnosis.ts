import type { EmptyDiagnosis } from "./viewState";

export interface GpaCheckFilters {
  grade: number;
  session: "both" | "صباحي" | "مسائي";
  province: string; // "" يعني كل المحافظات
}

/** يجب أن تطابق منطق الفلترة المستخدم في الصفحة نفسها -- لا يُعاد كتابته هنا. */
type Predicate<T> = (o: T, f: GpaCheckFilters) => boolean;

/** هل هذا العرض "قابل للوصول" بمعدّل ومجموعة جلسات معيّنة؟ يعيد أفضل فارق
    (سالب أو صفر = يصله فعلاً) عبر الجلسات المطلوب اعتبارها. */
type Reachable<T> = (o: T, grade: number, session: "صباحي" | "مسائي") => { ok: boolean; gap: number };

/**
 * تشخيص الفراغ بالتخفيف التدريجي: بدل قول "لا نتائج"، يعيد تشغيل الاستعلام
 * مع رفع فلتر واحد في كل مرة. أول فلتر يُنتج نتائج هو السبب والمخرج معاً.
 * data/admission_rules.md §31.
 */
export function diagnoseEmpty<T>(
  all: T[],
  filters: GpaCheckFilters,
  matches: Predicate<T>,
  reachable: Reachable<T>
): EmptyDiagnosis {
  if (!all.length) {
    return { code: "NO_DATA", relaxable: null, wouldYield: 0, nearest: [] };
  }

  const count = (f: Partial<GpaCheckFilters>) => all.filter((o) => matches(o, { ...filters, ...f })).length;

  // ١) المحافظة وحدها هي القيد؟
  if (filters.province !== "") {
    const n = count({ province: "" });
    if (n > 0) return { code: "PROVINCE_TOO_NARROW", relaxable: "province", wouldYield: n, nearest: [] };
  }

  // ٢) الجلسة وحدها هي القيد؟
  if (filters.session !== "both") {
    const n = count({ session: "both" });
    if (n > 0) return { code: "SESSION_UNAVAILABLE", relaxable: "session", wouldYield: n, nearest: [] };
  }

  // ٣) المعدّل هو القيد -- احسب الأقرب بفارق تصاعدي
  const sessions: Array<"صباحي" | "مسائي"> = filters.session === "both" ? ["صباحي", "مسائي"] : [filters.session];
  const gaps = all
    .map((o) => {
      const best = sessions
        .map((s) => reachable(o, filters.grade, s))
        .filter((r) => Number.isFinite(r.gap))
        .sort((a, b) => a.gap - b.gap)[0];
      return best ? { offering: o, gap: best.gap } : null;
    })
    .filter((x): x is { offering: T; gap: number } => x !== null)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 5);

  return { code: "GRADE_BELOW_ALL", relaxable: "grade", wouldYield: 0, nearest: gaps };
}
