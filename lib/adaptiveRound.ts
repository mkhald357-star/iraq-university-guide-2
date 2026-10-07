/**
 * جولة الاحتياط الواحدة -- تحلّ محلّ جولات الترجيح المتعددة القديمة
 * (planTieBreak: حتى 3 جولات، ويستسلم صامتاً حين ينفد بنك البُعدين).
 *
 * تُطلَق في حالتين فقط، وكلتاهما مشروطة بأن الإجابة الإضافية *قد تغيّر
 * النتيجة فعلاً* (لا نسأل عن بُعد لا تختلف فيه التخصصات المتصدّرة):
 * 1. تقارب: أكثر من تخصص ضمن هامش epsilon من المتصدّر (عنقود لا زوج).
 * 2. ضعف قياس: بُعد إجاباته محايدة غالباً أو متضاربة، *و*تتباين فيه
 *    التخصصات المتصدّرة بما يكفي ليؤثر حسمه في الترتيب.
 * تُختار حتى maxQuestions بنوداً من بنك الاحتياط بمكسب المعلومة: وزن البند
 * على كل بُعد × تباين التخصصات المرشّحة فيه × عدم يقين الطالب فيه (أقصاه عند 50).
 */
import { RIASEC_DIMENSIONS, type RiasecDimension, type RiasecQuestion, type RiasecVector } from "./riasec";
import { measureDimensions } from "./measurement";
import type { RankedMajor } from "./recommendationEngine";

export interface ReserveRoundConfig {
  /** هامش التقارب الذي يُطلق الجولة (على combinedScore). */
  epsilon: number;
  /**
   * هامش الإفصاح للطالب بعد الإنهاء ("أول خيارين متقاربان") -- منفصل عن
   * epsilon: تحت 4 نقاط لا تتجاوز دقة المركز الأول 75% (المدقّق C1)، فنُفصح
   * حتى لو لم يستحقّ الفارق جولة أسئلة إضافية.
   */
  disclosureGap: number;
  /** أدنى عدد أسئلة للجولة حين تُطلَق (الجولة بقرار المالك: 3-5 حسب الحاجة). */
  minQuestions: number;
  maxQuestions: number;
  clusterMax: number;
  relevanceTopK: number;
  relevanceSpread: number;
  weakEvidenceRatio: number;
  weakConsistency: number;
  /**
   * أدنى تباين (0-100) بين تخصصات العنقود على بُعد واحد على الأقل كي يكون
   * التقارب "قابلاً للحسم" بأسئلة ميول. تخصصات بروفايلاتها شبه متطابقة لا
   * يفصلها أي سؤال RIASEC -- نسأل الطالب عبثاً ونطيل الاختبار بلا فائدة.
   */
  minResolvableSpread: number;
}

// مُعايَرة على البنك متعدد الأشكال (scripts/eval/select-formats.mts --sweep):
// جولة "نادرة" بقرار المالك -- ≤4 عبارات ولنحو 15% من الطلاب أو أقل. epsilon
// 0.5 أظهرها لنحو 12% على أداة التقييم و16-18% على أداة المدقّق (1 → 25%،
// 1.5 → 35%) بفارق دقة المركز الأول أقل من نقطة، فخُفّض إلى 0.4؛ ما دون 4
// نقاط يُفصَح عنه للطالب ("متقاربان") بدل جولة أسئلة.
// عتبتا ضعف البُعد خُفِّضتا لأن البنك الغني (نحو 55 عبارة) يقيس كل بُعد بما
// يكفي، ولم تُضف العتبتان الأصليتان دقة تُذكر مقابل جولات أكثر.
export const DEFAULT_RESERVE_ROUND_CONFIG: ReserveRoundConfig = {
  epsilon: 0.4,
  disclosureGap: 4,
  minQuestions: 3,
  maxQuestions: 5,
  clusterMax: 5,
  relevanceTopK: 5,
  relevanceSpread: 18,
  weakEvidenceRatio: 0.04,
  weakConsistency: 0.2,
  // 0 = معطَّل. قيمة 18 (ضُبطت أولاً لخفض الشاشات) ألغت الجولة لنحو 75% من طلاب
  // أزواج التوأمين (فرقها ~10 نقاط على بُعد) فتراجع ترتيبهم -- تشخيص المدقّق C1.
  // طول الاختبار يُضبط بطول البنك وعدد أسئلة الجولة، لا بتخطّي هؤلاء الطلاب.
  minResolvableSpread: 0,
};

export type ReserveTrigger = "ambiguity" | "weak_dimension" | "both";

export interface ReserveRoundPlan {
  trigger: ReserveTrigger | null;
  questions: RiasecQuestion[];
  clusterIds: string[];
  weakDimensions: RiasecDimension[];
}

function spreadByDimension(
  majors: RankedMajor[],
  profiles: Record<string, RiasecVector>
): Record<RiasecDimension, number> {
  const out = {} as Record<RiasecDimension, number>;
  RIASEC_DIMENSIONS.forEach((d) => {
    const values = majors.map((m) => (profiles[m.id]?.[d] ?? 0) * 10);
    if (values.length < 2) {
      out[d] = 0;
      return;
    }
    const mean = values.reduce((s, x) => s + x, 0) / values.length;
    out[d] = Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length);
  });
  return out;
}

function sameDimensions(a: RiasecQuestion, b: RiasecQuestion): boolean {
  return RIASEC_DIMENSIONS.every((d) => (a.dimensions[d] ?? 0) === (b.dimensions[d] ?? 0));
}

export function planReserveRound(
  ranked: RankedMajor[],
  userVector: Record<RiasecDimension, number>,
  answers: Record<string, number>,
  answeredPool: RiasecQuestion[],
  reservePool: RiasecQuestion[],
  profiles: Record<string, RiasecVector>,
  config: ReserveRoundConfig = DEFAULT_RESERVE_ROUND_CONFIG
): ReserveRoundPlan {
  const none: ReserveRoundPlan = { trigger: null, questions: [], clusterIds: [], weakDimensions: [] };
  if (ranked.length < 2) return none;

  const top = ranked[0].combinedScore;
  const cluster = ranked.filter((m) => top - m.combinedScore < config.epsilon).slice(0, config.clusterMax);
  const clusterSpread = spreadByDimension(cluster, profiles);
  const resolvable = RIASEC_DIMENSIONS.some((d) => clusterSpread[d] >= config.minResolvableSpread);
  const ambiguous = cluster.length >= 2 && resolvable;

  const topK = ranked.slice(0, config.relevanceTopK);
  const topKSpread = spreadByDimension(topK, profiles);
  const measurement = measureDimensions(answers, answeredPool);
  const weakDimensions = RIASEC_DIMENSIONS.filter((d) => {
    const m = measurement[d];
    const weak =
      m.evidenceRatio < config.weakEvidenceRatio || (m.nonNeutralItems >= 2 && m.consistency < config.weakConsistency);
    return weak && topKSpread[d] >= config.relevanceSpread;
  });

  if (!ambiguous && weakDimensions.length === 0) return none;
  const trigger: ReserveTrigger =
    ambiguous && weakDimensions.length > 0 ? "both" : ambiguous ? "ambiguity" : "weak_dimension";

  const targetSpread = ambiguous ? clusterSpread : topKSpread;
  const weakSet = new Set(weakDimensions);
  const uncertainty = {} as Record<RiasecDimension, number>;
  RIASEC_DIMENSIONS.forEach((d) => {
    const base = Math.max(0.2, 1 - Math.abs((userVector[d] ?? 50) - 50) / 50);
    uncertainty[d] = weakSet.has(d) ? Math.min(1, base * 1.5 + 0.3) : base;
  });

  // عدد أسئلة الجولة "حسب الحاجة" (قرار المالك: 3-5): كلما اتّسع عنقود
  // التخصصات المتعادلة أو تعدّدت الأبعاد الضعيفة، احتجنا أسئلة أكثر لحسمها.
  // عنقود من تخصصين أو بُعد ضعيف واحد = 3؛ ثلاثة = 4؛ أربعة فأكثر = 5.
  const severity = Math.max(ambiguous ? cluster.length - 1 : 0, weakDimensions.length);
  const wanted = Math.min(config.maxQuestions, Math.max(config.minQuestions, 2 + severity));

  const answeredIds = new Set(Object.keys(answers));
  const candidates = reservePool.filter((q) => !answeredIds.has(q.id));
  const chosen: RiasecQuestion[] = [];
  const valueOf = (q: RiasecQuestion) =>
    RIASEC_DIMENSIONS.reduce((s, d) => s + Math.abs(q.dimensions[d] ?? 0) * targetSpread[d] * uncertainty[d], 0);

  while (chosen.length < wanted) {
    let best: RiasecQuestion | null = null;
    let bestValue = 0;
    for (const q of candidates) {
      if (chosen.includes(q) || chosen.some((c) => sameDimensions(c, q))) continue;
      const v = valueOf(q);
      if (v > bestValue) {
        best = q;
        bestValue = v;
      }
    }
    if (!best) break;
    chosen.push(best);
    // تناقص العائد: بُعد سُئل عنه للتوّ صار أقل غموضاً
    RIASEC_DIMENSIONS.forEach((d) => {
      if ((best!.dimensions[d] ?? 0) !== 0) uncertainty[d] *= 0.6;
    });
  }

  return { trigger, questions: chosen, clusterIds: cluster.map((m) => m.id), weakDimensions };
}
