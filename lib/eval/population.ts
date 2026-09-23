/**
 * مجتمع طلاب اصطناعي لأداة التقييم (lib/eval) -- لكل طالب متجه ميول
 * "حقيقي" θ معروف مسبقاً (هذا ما لا نملكه لطالب حقيقي، وهو سبب قيمة
 * المحاكاة: نقيس كم يقترب المحرك من الحقيقة، لا من نفسه).
 *
 * مزيج من مصدرين:
 * - طلاب حول بروفايل تخصص مؤهَّل (بضوضاء) -- كي يملك كل تخصص طلاباً
 *   يناسبهم فعلاً، فيمكن قياس هل يكبته المحرك أو ينفخه.
 * - طلاب عامّون مسحوبون ببنية سداسي هولاند (الأبعاد المتجاورة مترابطة
 *   موجباً، المتقابلة سالباً).
 */
import { RIASEC_DIMENSIONS, type RiasecDimension, type RiasecVector } from "../riasec";
import { BRANCH_CATEGORY_MAP } from "../branchEligibility";
import type { SubjectGrades } from "../subjectAffinity";
import { clamp, gaussian, pick, type Rng } from "./random";

export type ResponseStyle = "normal" | "acquiescent" | "extreme" | "midpoint" | "random" | "social_desirability";

export interface SimStudent {
  id: number;
  theta: Record<RiasecDimension, number>;
  branch: string;
  grade: number;
  subjectGrades: SubjectGrades;
  style: ResponseStyle;
  anchorMajorId: string | null;
}

export interface PopulationOptions {
  size: number;
  branch: string;
  majors: { id: string; category: string }[];
  profiles: Record<string, RiasecVector>;
  anchoredShare?: number;
  anchorSpread?: number;
  broadSpread?: number;
  subjectGradesShare?: number;
  styleMix?: Partial<Record<ResponseStyle, number>>;
  /**
   * واقعية "اللامبالاة": الطالب الحقيقي محايد غالباً تجاه ما لا يهمه، لا
   * كارهاً له. عند true تُقلَّص أبعاد التخصص المنخفضة (<50) نحو 50 بنسبة
   * عشوائية 40-70% بدل نسخها كما هي (بروفايل "لا يحتاجه التخصص" ≠ "يكرهه الطالب").
   */
  indifferentLowDims?: boolean;
}

// ترابط الأبعاد حسب المسافة على السداسي (R-I-A-S-E-C): 0/1/2/3 خطوات.
const HEXAGON_CORRELATION_BY_DISTANCE = [1, 0.3, 0.05, -0.15];

function hexagonCholesky(): number[][] {
  const n = RIASEC_DIMENSIONS.length;
  const cov = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const d = Math.min(Math.abs(i - j), n - Math.abs(i - j));
      return HEXAGON_CORRELATION_BY_DISTANCE[d];
    })
  );
  const L = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = cov[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(sum) : sum / L[j][j];
    }
  }
  return L;
}

const CHOLESKY = hexagonCholesky();

function correlatedNormals(rng: Rng): number[] {
  const z = RIASEC_DIMENSIONS.map(() => gaussian(rng));
  return CHOLESKY.map((row) => row.reduce((s, l, k) => s + l * z[k], 0));
}

const SUBJECTS_BY_BRANCH: Record<string, (keyof SubjectGrades)[]> = {
  علمي: ["math", "physics", "chemistry", "biology", "arabic", "english"],
  أدبي: ["arabic", "english", "history", "geography"],
  فنون: ["arabic", "english"],
};

const DEFAULT_STYLE_MIX: Record<ResponseStyle, number> = {
  normal: 1,
  acquiescent: 0,
  extreme: 0,
  midpoint: 0,
  random: 0,
  social_desirability: 0,
};

function pickStyle(rng: Rng, mix: Record<ResponseStyle, number>): ResponseStyle {
  const entries = Object.entries(mix) as [ResponseStyle, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [style, w] of entries) {
    r -= w;
    if (r <= 0) return style;
  }
  return entries[entries.length - 1][0];
}

export function generatePopulation(rng: Rng, opts: PopulationOptions): SimStudent[] {
  const allowed = BRANCH_CATEGORY_MAP[opts.branch] ?? [];
  const eligible = opts.majors.filter((m) => allowed.includes(m.category));
  const anchoredShare = opts.anchoredShare ?? 0.7;
  const anchorSpread = opts.anchorSpread ?? 12;
  const broadSpread = opts.broadSpread ?? 20;
  const subjectShare = opts.subjectGradesShare ?? 0.4;
  const styleMix = { ...DEFAULT_STYLE_MIX, ...(opts.styleMix ?? {}) };
  const subjects = SUBJECTS_BY_BRANCH[opts.branch] ?? [];

  const students: SimStudent[] = [];
  for (let i = 0; i < opts.size; i++) {
    const theta = {} as Record<RiasecDimension, number>;
    let anchorMajorId: string | null = null;
    if (eligible.length > 0 && rng() < anchoredShare) {
      const anchor = pick(rng, eligible);
      anchorMajorId = anchor.id;
      const profile = opts.profiles[anchor.id] ?? {};
      RIASEC_DIMENSIONS.forEach((d) => {
        let target = (profile[d] ?? 0) * 10;
        if (opts.indifferentLowDims && target < 50) target = 50 - (50 - target) * (0.3 + rng() * 0.3);
        theta[d] = clamp(target + gaussian(rng) * anchorSpread, 0, 100);
      });
    } else {
      const z = correlatedNormals(rng);
      RIASEC_DIMENSIONS.forEach((d, k) => {
        theta[d] = clamp(50 + z[k] * broadSpread, 0, 100);
      });
    }

    const grade = Math.round(50 + rng() * 50);
    const subjectGrades: SubjectGrades = {};
    if (rng() < subjectShare) {
      subjects.forEach((s) => {
        subjectGrades[s] = Math.round(clamp(grade + gaussian(rng) * 6, 50, 100));
      });
    }

    students.push({
      id: i,
      theta,
      branch: opts.branch,
      grade,
      subjectGrades,
      style: pickStyle(rng, styleMix),
      anchorMajorId,
    });
  }
  return students;
}
