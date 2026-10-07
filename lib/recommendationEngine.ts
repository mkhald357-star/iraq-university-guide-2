/**
 * محرك ترتيب التخصصات -- مُستخرَج من app/quiz/page.tsx (كان حبيساً داخل
 * مكوّن React، صفر تغطية اختبارية لأخطر منطق حسابي في المنصة رغم 258
 * اختباراً في المشروع). هذا الاستخراج "المرحلة 1" من خطة إصلاح الخوارزمية:
 * بلا أي تغيير سلوكي -- كل رقم وكل شرط هنا مطابق حرفياً لما كان في المكوّن،
 * والدليل الوحيد المقبول هو lib/recommendationEngine.characterization.test.ts
 * (يُثبَّت *قبل* أي تعديل لاحق على هذا الملف).
 *
 * دوال خالصة بلا React ولا localStorage ولا fetch -- كل البيانات تُمرَّر
 * صراحةً (RankMajorsData)، فيسهل استدعاؤها من التطبيق ومن حزام محاكاة
 * الشخصيات (scripts/persona/) ومن الاختبارات بمصدر واحد لا تكرار.
 */
import {
  computeUserRiasecVector,
  computeMajorFitWith,
  computeCombinedRankingScore,
  findDivergentDimensions,
  selectQuestionsForDimensions,
  type RiasecDimension,
  type RiasecVector,
  type RiasecQuestion,
  type FitStrategy,
} from "./riasec";
import { computeSubjectAffinityVector, computeSubjectAffinityFit, type SubjectGrades } from "./subjectAffinity";
import { BRANCH_CATEGORY_MAP } from "./branchEligibility";
import { findMostDivergentContextAxis, type ContextVector } from "./contextAxisMap";

// مطابق حرفياً لـapp/quiz/page.tsx:515 (SUBJECT_AFFINITY_BLEND_WEIGHT) و:472
// (بوابة gradeIsHigh) و:543/247 (AMBIGUITY_THRESHOLD وMAX_TIEBREAK_ROUNDS).
export const SUBJECT_AFFINITY_BLEND_WEIGHT = 0.3;
export const MEDICAL_GATE_GRADE = 85;
export const AMBIGUITY_THRESHOLD = 6;
export const MAX_TIEBREAK_ROUNDS = 3;

/**
 * صيغة المطابقة التي يستخدمها المنتج فعلاً (الاختبار + /report) -- مصدر وحيد
 * كي لا يعرض التقرير نسبة توافق بصيغة غير التي رُتّبت بها النتيجة.
 */
export const PRODUCT_FIT_STRATEGY: FitStrategy = "level";

/**
 * أوزان البُعد الثانوية الصغيرة تُهمَل في متجه الطالب (computeUserRiasecVector)
 * -- تُقلّص بُعداً مثل C نحو 50 لأن ثلث وزنه يأتي من بنود يحرّكها بُعد آخر.
 * 0.5 مُثبَت بالمحاكاة (3 نماذج إجابة) وبالشخصيات المؤلَّفة معاً: تحسّن طفيف
 * ومتّسق في الدقة واسترجاع المرساة والمعايرة (QA-REPORT-ALGORITHM.md).
 */
export const PRODUCT_MIN_LOADING_SHARE = 0.5;

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// المرحلة 3 (بصمة السياق): سقف صريح أقل من AMBIGUITY_THRESHOLD -- بالتصميم
// applyContextTieBreak لا يمكنه أبداً قلب فارق غير غامض (≥6)، فقط ترجيح
// داخل نطاق الغموض نفسه، تماماً كضمان منزلق السوق (computeCombinedRankingScore)
// "لا ينقلب فارق توافق حقيقي >15 نقطة". القيم مُشتقّة من فحص الأزواج
// الخمسة الحقيقية ذات بروفايل RIASEC شبه المتطابق (بكالوريوس مقابل دبلوم
// تقني -- electrical/renewable_energy/petroleum/electronics_comm/prosthetics):
// جميعها تتفرّق حصراً عبر appliedness بفارق حقيقي 10-15 نقطة. CONTEXT_MIN_AXIS_DIVERGENCE
// يستبعد فروقاً <10 (غالباً ضوضاء لا إشارة حقيقية بمقياس بياناتنا)، وWEIGHT/MAX_BONUS
// معايَران كي يكفي فارق 15 نقطة (أقوى الأزواج الخمسة) لترجيح كامل ضمن نطاق
// الغموض دون أن يتجاوزه أبداً.
export const CONTEXT_MIN_AXIS_DIVERGENCE = 10;
export const CONTEXT_TIEBREAK_MAX_BONUS = 5;
export const CONTEXT_TIEBREAK_WEIGHT = 0.3;

export interface MajorInput {
  id: string;
  name: string;
  category: string;
  marketMultiplier: number;
}

export interface RankedMajor extends MajorInput {
  fitPercent: number;
  riasecFitPercent: number;
  subjectFitPercent: number | null;
  combinedScore: number;
  /**
   * أي تعديل ترجيحي أُضيف على combinedScore بعد rankMajors (ترجيح السياق).
   * أي إعادة حساب لـcombinedScore (منزلق السوق في الواجهة) يجب أن تعيد إضافته،
   * وإلا ضاع أثر الترجيح بصمت من الشاشة.
   */
  tieBreakAdjustment?: number;
}

export interface RankMajorsInput {
  /** إجابات الأسئلة المُسجَّلة على RIASEC فقط (أسئلة التحقق مُستبعَدة مسبقاً). */
  scoredAnswers: Record<string, number>;
  /** حوض الأسئلة المستخدَم لتطبيع المتجه -- يجب أن يشمل أي أسئلة ترجيح عُرضت فعلياً. */
  questionPool: RiasecQuestion[];
  branch: string;
  grade: number;
  subjectGrades: SubjectGrades;
}

export interface RankMajorsData {
  majors: MajorInput[];
  riasecProfiles: Record<string, RiasecVector>;
  subjectWeights: Record<string, Partial<Record<string, number>>>;
  /** صيغة المطابقة -- الافتراضي "level" (computeMajorFit الحالية). البدائل قيد التقييم في lib/eval. */
  fitStrategy?: FitStrategy;
  /** computeUserRiasecVector(minLoadingShare) -- الافتراضي 0 (كل الأوزان). */
  minLoadingShare?: number;
}

/** يُطبَّق على التخصصات المُصفَّاة فعلياً (بعد الفرع والبوابة)، مرتَّبة تنازلياً. */
export function rankMajors(input: RankMajorsInput, data: RankMajorsData): RankedMajor[] {
  const userVector = computeUserRiasecVector(input.scoredAnswers, input.questionPool, data.minLoadingShare ?? 0);
  return rankMajorsFromVector(userVector, input, data);
}

/**
 * نفس rankMajors لكن بمتجه RIASEC جاهز بدل الإجابات -- تستخدمه أداة التقييم
 * (lib/eval) لحساب "الترتيب الحقيقي" من متجه الميول الكامن θ لطالب اصطناعي.
 */
export function rankMajorsFromVector(
  userVector: Record<RiasecDimension, number>,
  input: Pick<RankMajorsInput, "branch" | "grade" | "subjectGrades">,
  data: RankMajorsData
): RankedMajor[] {
  const allowedCategories = BRANCH_CATEGORY_MAP[input.branch] || [];
  const gradeIsHigh = input.grade >= MEDICAL_GATE_GRADE;
  const subjectVector = computeSubjectAffinityVector(input.subjectGrades, input.grade);

  const processed: RankedMajor[] = data.majors
    .map((major) => {
      const profile = data.riasecProfiles[major.id] ?? {};
      const riasecFitPercent = computeMajorFitWith(data.fitStrategy ?? "level", userVector, profile);
      const majorSubjectWeights = data.subjectWeights[major.id] ?? {};
      const subjectFitPercent = computeSubjectAffinityFit(subjectVector, majorSubjectWeights);
      const fitPercent =
        subjectFitPercent === null
          ? riasecFitPercent
          : riasecFitPercent * (1 - SUBJECT_AFFINITY_BLEND_WEIGHT) + subjectFitPercent * SUBJECT_AFFINITY_BLEND_WEIGHT;
      const combinedScore = computeCombinedRankingScore(fitPercent, major.marketMultiplier);
      return { ...major, fitPercent, riasecFitPercent, subjectFitPercent, combinedScore };
    })
    .filter((m) => {
      let valid = allowedCategories.includes(m.category);
      // فئة "تقنيات طبية مساندة" مُستثناة عمداً من هذه البوابة (انظر التعليق
      // الأصلي في app/quiz/page.tsx) -- حدودها الدنيا الحقيقية منخفضة نسبياً
      // خلافاً لفئة "طبي" (طب/أسنان/صيدلة) المخصَّصة لها هذه البوابة حصراً.
      if (!gradeIsHigh && m.category === "طبي") valid = false;
      return valid;
    });

  processed.sort((a, b) => b.combinedScore - a.combinedScore);
  return processed;
}

export interface TieBreakDecision {
  needsTieBreak: boolean;
  targetDimensions: RiasecDimension[];
  candidates: RiasecQuestion[];
  tieBreakInfo: { a: string; b: string } | null;
}

/**
 * نقطة التكيّف متعددة الجولات: يفحص إن كان الفارق بين أفضل تخصصين ضمن حدود
 * الغموض (AMBIGUITY_THRESHOLD)، ويختار أسئلة ترجيح مستهدفة من حوض الترجيح.
 * `candidates` قد تكون فارغة رغم `needsTieBreak` الحسابي لو نفدت أسئلة
 * البُعدين المستهدفين -- المستدعي (app/quiz/page.tsx) يتحقّق من طول
 * candidates فعلياً قبل بدء جولة جديدة، لا من needsTieBreak وحدها.
 */
export function planTieBreak(
  ranked: RankedMajor[],
  round: number,
  alreadyAskedIds: Set<string>,
  tiebreakerPool: RiasecQuestion[],
  riasecProfiles: Record<string, RiasecVector>
): TieBreakDecision {
  const empty: TieBreakDecision = { needsTieBreak: false, targetDimensions: [], candidates: [], tieBreakInfo: null };
  if (round >= MAX_TIEBREAK_ROUNDS || ranked.length < 2) return empty;

  const gap = ranked[0].combinedScore - ranked[1].combinedScore;
  if (gap >= AMBIGUITY_THRESHOLD) return empty;

  const profileA = riasecProfiles[ranked[0].id] ?? {};
  const profileB = riasecProfiles[ranked[1].id] ?? {};
  const targetDimensions = findDivergentDimensions(profileA, profileB, 2);
  const candidates = selectQuestionsForDimensions(tiebreakerPool, targetDimensions, alreadyAskedIds);

  return {
    needsTieBreak: candidates.length > 0,
    targetDimensions,
    candidates,
    tieBreakInfo: { a: ranked[0].name, b: ranked[1].name },
  };
}

/**
 * المرحلة 3 من خطة إصلاح الخوارزمية -- يُستدعى *بعد* rankMajors و*قبل*
 * planTieBreak (لا يمسّ rankMajors نفسه، والترتيب الأساسي لغير الحالات
 * الغامضة يبقى مطابقاً 100% لما كان -- كل اختبارات
 * recommendationEngine.characterization.test.ts السابقة على rankMajors
 * تبقى صحيحة بلا تعديل). يعالج تحديداً حالة "التوأمين" (مثال:
 * electrical_engineering/electrical_tech) حيث RIASEC وحده لا يفرّق لأن
 * بروفايليهما شبه متطابقين بتصميم: يقرأ بصمة سياق كل تخصص
 * (data/major_context_index.json) ويحدّد *المحور الوحيد* الذي يفرّق
 * بينهما فعلياً (findMostDivergentContextAxis) بدل متوسط أربعة محاور (كان
 * يخفّف الإشارة بمحاور مشتركة لا تحمل معلومة -- راجع تعليق computeContextFit)،
 * ويرجّح بذلك المحور *فقط* بين أفضل تخصصين حين يكونان أصلاً ضمن نطاق
 * الغموض (|gap| < AMBIGUITY_THRESHOLD) -- لا يُستدعى ولا يغيّر شيئاً خارج
 * هذا النطاق، ولا حين يكون الفارق بين التخصصين على ذلك المحور تحت
 * CONTEXT_MIN_AXIS_DIVERGENCE (لا إشارة حقيقية تستحق الترجيح). السقف
 * CONTEXT_TIEBREAK_MAX_BONUS < AMBIGUITY_THRESHOLD يضمن عدم القدرة على قلب
 * فارق ≥6 حتى لو حاول. *لا يُعدَّل* سوى نقاط الزوج المتصدّر، لكن الترتيب
 * الناتج يُعاد فرزه كاملاً (لا فقط تبديل الزوج الأول) -- ثبت فعلياً أن
 * تعديل الزوج المتصدّر فقط بلا إعادة فرز كامل قد يترك تخصصاً بالمركز
 * الثالث بنقاط أعلى من المركز الثاني (حين يكون المركزان 2/3 متقاربين
 * أيضاً)، فينكسر ترتيب النتيجة النهائية. معالجة عناقيد 3+ تخصصات (تحديد
 * أيّها فعلاً "متقاربة" وترجيحها معاً) كاملة مؤجَّلة لإعادة بناء الترجيح في
 * المرحلة 4 -- هنا فقط ضمان أن ما يُعاد لا يزال مرتَّباً تنازلياً بصحة.
 */
export function applyContextTieBreak(
  ranked: RankedMajor[],
  userContextVector: ContextVector,
  contextIndex: Record<string, ContextVector>
): RankedMajor[] {
  if (ranked.length < 2) return ranked;

  const gap = ranked[0].combinedScore - ranked[1].combinedScore;
  if (Math.abs(gap) >= AMBIGUITY_THRESHOLD) return ranked;

  const contextA = contextIndex[ranked[0].id];
  const contextB = contextIndex[ranked[1].id];
  if (!contextA || !contextB) return ranked;

  const axis = findMostDivergentContextAxis(contextA, contextB);
  const majorAxisGap = Math.abs(contextA[axis] - contextB[axis]);
  if (majorAxisGap < CONTEXT_MIN_AXIS_DIVERGENCE) return ranked;

  const fitA = 100 - Math.abs(userContextVector[axis] - contextA[axis]);
  const fitB = 100 - Math.abs(userContextVector[axis] - contextB[axis]);
  const bonus = clampNumber(
    (fitB - fitA) * CONTEXT_TIEBREAK_WEIGHT,
    -CONTEXT_TIEBREAK_MAX_BONUS,
    CONTEXT_TIEBREAK_MAX_BONUS
  );
  if (bonus === 0) return ranked;

  const adjustedSecond: RankedMajor = {
    ...ranked[1],
    combinedScore: ranked[1].combinedScore + bonus,
    tieBreakAdjustment: (ranked[1].tieBreakAdjustment ?? 0) + bonus,
  };
  // فرز كامل لا فرز الزوج الأول فقط -- إن كان المركزان 2/3 متقاربين أيضاً
  // (حالة حقيقية رُصدت فعلياً)، تعديل نقاط المركز الثاني وحده دون إعادة
  // مقارنته بالمركز الثالث قد يكسر ترتيب النتيجة النهائية تنازلياً.
  return [ranked[0], adjustedSecond, ...ranked.slice(2)].sort((a, b) => b.combinedScore - a.combinedScore);
}
