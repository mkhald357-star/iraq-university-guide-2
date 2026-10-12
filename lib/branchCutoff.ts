/**
 * الحد الصباحي بحسب فرع الطالب.
 *
 * `averageGrades.صباحي` في بيانات القسم هو **أدنى حد بين كل الفروع** (مثال: علم النفس/بغداد:
 * علمي 81.71، فنون 63.57، أدبي 60 ⇒ 60)، فعرضه لطالب العلمي يُوهمه أن حدّه 60. الحد الصحيح
 * لطالب فرع معيّن هو أدنى حد غير حصة **لذلك الفرع** من `cutoffs` الرسمية، وقسم لا يقبل فرعه
 * أصلاً لا يُعرض له.
 *
 * عروض بلا `cutoffs` (الأهلي، أو سجلات by-branch المُخفَّفة المحسوبة لكل فرع مسبقاً في
 * scripts/build-major-offerings.js) تُعاد كما هي.
 */
import type { UniversityOffering } from "./majorMatcher";

type Cutoffish = Pick<UniversityOffering, "cutoffs" | "averageGrades" | "universityType" | "departmentBranches"> & {
  eveningByBranch?: Record<string, number | null>;
};

export type CutoffLevel = "college" | "track" | "department";

interface ScopeCarrier {
  cutoffScope?: "college" | "track" | "department" | "mixed";
  collegeScopeBranches?: string[];
  trackScopeBranches?: string[];
  forBranch?: string;
}

/**
 * مستوى الحد الصباحي المعروض لفرع: حد الكلية (معلَن للكلية كلها)، أو حد المسار (للتخصصات الطبية/الهندسية…
 * في المعهد/الكلية التقنية)، أو حد القسم نفسه. سجل by-branch يحمل مستوى فرعه مسبقاً.
 */
export function cutoffLevelFor(o: ScopeCarrier, branch?: string | null): CutoffLevel {
  const b = branch ?? o.forBranch;
  if (o.cutoffScope === "college") return "college";
  if (o.cutoffScope === "track") return "track";
  if (o.cutoffScope === "mixed" && b) {
    if ((o.trackScopeBranches ?? []).includes(b)) return "track";
    if ((o.collegeScopeBranches ?? []).includes(b)) return "college";
  }
  return "department";
}

/** فروع حدّها حد كلية/مسار لقسم mixed حين لا يُعرف فرع الطالب (للعرض)، وإلا []. */
export function scopedCutoffBranches(o: ScopeCarrier): { branch: string; level: CutoffLevel }[] {
  if (o.cutoffScope !== "mixed" || o.forBranch) return [];
  return [
    ...(o.collegeScopeBranches ?? []).map((branch) => ({ branch, level: "college" as CutoffLevel })),
    ...(o.trackScopeBranches ?? []).map((branch) => ({ branch, level: "track" as CutoffLevel })),
  ];
}

/** هل يقبل القسم فرع الطالب؟ قسم بلا فروع معروفة (كل الأهلي اليوم) لا يُستبعد. */
export function acceptsBranch(o: Pick<UniversityOffering, "departmentBranches">, branch: string): boolean {
  return !o.departmentBranches || o.departmentBranches.length === 0 || o.departmentBranches.includes(branch);
}

/** أدنى حد صباحي رسمي (غير حصة) لفرع الطالب، أو null إن لم يُنشر له حد في هذا القسم. */
export function morningCutoffForBranch(o: Cutoffish, branch: string): number | null {
  if (o.universityType === "أهلية" || !o.cutoffs || o.cutoffs.length === 0) return o.averageGrades["صباحي"];
  const values = o.cutoffs.filter((c) => !c.isQuota && c.branch === branch).map((c) => c.averagePercent);
  return values.length ? Math.min(...values) : null;
}

/**
 * حد التقديم المسائي لفرع الطالب (data/evening-rules.json: يختلف بحسب الفرع). عرض بلا eveningByBranch
 * (أهلي، أو سجل by-branch المحسوب مسبقاً لفرعه) يُعاد رقمه كما هو.
 */
export function eveningCutoffForBranch(o: Cutoffish, branch: string): number | null {
  if (o.universityType === "أهلية" || !o.eveningByBranch) return o.averageGrades["مسائي"];
  return o.eveningByBranch[branch] ?? null;
}

/** نسخة من العرض حدّاه الصباحي والمسائي هما حدا فرع الطالب، موسومة بالفرع (forBranch) ليعرف العارض ذلك. */
export function offeringForBranch<T extends Cutoffish>(o: T, branch: string): T & { forBranch: string } {
  return {
    ...o,
    averageGrades: {
      ...o.averageGrades,
      صباحي: morningCutoffForBranch(o, branch),
      مسائي: eveningCutoffForBranch(o, branch),
    },
    forBranch: branch,
  };
}

const BRANCH_ORDER = ["علمي", "أدبي", "فنون"];

/**
 * حدود القسم الصباحية لكل فرع (لعرضها حين لا يُعرف فرع الطالب): [{branch, min}] بترتيب
 * علمي/أدبي/فنون. يُعاد [] لعرض أهلي أو بلا cutoffs.
 */
export function morningCutoffsByBranch(o: {
  universityType?: string;
  cutoffs?: { branch: string; averagePercent: number; isQuota: boolean }[];
}): { branch: string; min: number }[] {
  if (o.universityType === "أهلية" || !o.cutoffs || o.cutoffs.length === 0) return [];
  const mins = new Map<string, number>();
  for (const c of o.cutoffs) {
    if (c.isQuota) continue;
    mins.set(c.branch, Math.min(mins.get(c.branch) ?? Infinity, c.averagePercent));
  }
  return [...mins.entries()]
    .map(([branch, min]) => ({ branch, min }))
    .sort((a, b) => BRANCH_ORDER.indexOf(a.branch) - BRANCH_ORDER.indexOf(b.branch));
}

/** عروض تقبل فرع الطالب فقط، كلٌّ بحد ذلك الفرع. بلا فرع معروف تُعاد القائمة كما هي. */
export function offeringsForBranch<T extends Cutoffish>(
  offerings: T[],
  branch: string | null | undefined
): (T & { forBranch?: string })[] {
  if (!branch) return offerings;
  return offerings.filter((o) => acceptsBranch(o, branch)).map((o) => offeringForBranch(o, branch));
}
