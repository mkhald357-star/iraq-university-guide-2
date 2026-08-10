// منطق "الموازنة بين التخصصات" -- خدمة "compare" في data/services.ts، كانت
// "قيد التطوير" (status: "soon"). لا بيانات جديدة هنا؛ إعادة استخدام كاملة
// لِـ DetailedMajorProfile (lib/majorProfileClient.ts) المبني أصلاً من
// data/major_profiles_detailed.json المُتحقَّق منه لكل الـ88 تخصصاً.

import type { DetailedMajorProfile } from "./majorProfileClient";

export const MAX_COMPARE_MAJORS = 3;
export const MIN_COMPARE_MAJORS = 2;

/** ترتيب مستويات الطلب الفعلية في data/major_profiles_detailed.json (تحقّقت
 * القيم الست بفحص مباشر للملف -- لا افتراضاً). "غير متوفر" بلا ترتيب: لا
 * نملك ما يكفي لتصنيفه أعلى أو أدنى من غيره. */
const DEMAND_LEVEL_RANK: Record<string, number> = {
  "متشبع": 1,
  "شديد الانخفاض": 1,
  "منخفض": 2,
  "متوسط": 3,
  "مرتفع": 4,
};

export function rankDemandLevel(level?: string | null): number | null {
  if (!level) return null;
  return DEMAND_LEVEL_RANK[level] ?? null;
}

export interface CompareEntry {
  majorId: string;
  profile: DetailedMajorProfile | null;
}

export interface CompareHighlights {
  /** معرّف التخصص صاحب أدنى حدّ قبول ملحوظ -- null إن تعادلا أو نقصت البيانات
   * لبعضهم (لا نُبرِز مقارنة غير عادلة). */
  lowestCutoffMajorId: string | null;
  /** معرّف التخصص صاحب أعلى مستوى طلب مُرتَّب -- نفس شرط عدم التعادل. */
  highestDemandMajorId: string | null;
}

/** يُبرِز "الفائز" فقط حين يملك الكل بيانات قابلة للمقارنة والنتيجة فريدة بلا
 * تعادل -- إبراز رقم واحد أعلى من نقص بيانات لدى غيره يوهم بمقارنة عادلة لم
 * تحدث فعلاً. */
export function computeComparisonHighlights(entries: CompareEntry[]): CompareHighlights {
  const withCutoff = entries
    .map((e) => ({ majorId: e.majorId, min: e.profile?.eligibility?.observedCutoffRange?.min }))
    .filter((e): e is { majorId: string; min: number } => typeof e.min === "number");

  let lowestCutoffMajorId: string | null = null;
  if (withCutoff.length === entries.length && entries.length >= MIN_COMPARE_MAJORS) {
    const min = Math.min(...withCutoff.map((e) => e.min));
    const winners = withCutoff.filter((e) => e.min === min);
    if (winners.length === 1) lowestCutoffMajorId = winners[0].majorId;
  }

  const withDemand = entries
    .map((e) => ({ majorId: e.majorId, rank: rankDemandLevel(e.profile?.market?.demandLevel) }))
    .filter((e): e is { majorId: string; rank: number } => e.rank !== null);

  let highestDemandMajorId: string | null = null;
  if (withDemand.length === entries.length && entries.length >= MIN_COMPARE_MAJORS) {
    const max = Math.max(...withDemand.map((e) => e.rank));
    const winners = withDemand.filter((e) => e.rank === max);
    if (winners.length === 1) highestDemandMajorId = winners[0].majorId;
  }

  return { lowestCutoffMajorId, highestDemandMajorId };
}

/** يمنع اختيار نفس التخصص مرتين، ويسقط أي خانة فارغة، ويحدّ العدد بحد أقصى
 * MAX_COMPARE_MAJORS -- منطق اختيار خالص، لا واجهة. */
export function sanitizeSelection(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_COMPARE_MAJORS) break;
  }
  return out;
}
