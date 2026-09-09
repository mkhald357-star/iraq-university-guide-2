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
  computeMajorFit,
  computeCombinedRankingScore,
  findDivergentDimensions,
  selectQuestionsForDimensions,
  type RiasecDimension,
  type RiasecVector,
  type RiasecQuestion,
} from "./riasec";
import { computeSubjectAffinityVector, computeSubjectAffinityFit, type SubjectGrades } from "./subjectAffinity";
import { BRANCH_CATEGORY_MAP } from "./branchEligibility";
import { computeContextFit, type ContextVector } from "./contextAxisMap";

// مطابق حرفياً لـapp/quiz/page.tsx:515 (SUBJECT_AFFINITY_BLEND_WEIGHT) و:472
// (بوابة gradeIsHigh) و:543/247 (AMBIGUITY_THRESHOLD وMAX_TIEBREAK_ROUNDS).
export const SUBJECT_AFFINITY_BLEND_WEIGHT = 0.3;
export const MEDICAL_GATE_GRADE = 85;
export const AMBIGUITY_THRESHOLD = 6;
export const MAX_TIEBREAK_ROUNDS = 3;

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// المرحلة 3 (بصمة السياق): سقف صريح أقل من AMBIGUITY_THRESHOLD -- بالتصميم
// applyContextTieBreak لا يمكنه أبداً قلب فارق غير غامض (≥6)، فقط ترجيح
// داخل نطاق الغموض نفسه، تماماً كضمان منزلق السوق (computeCombinedRankingScore)
// "لا ينقلب فارق توافق حقيقي >15 نقطة".
export const CONTEXT_TIEBREAK_MAX_BONUS = 4;
export const CONTEXT_TIEBREAK_WEIGHT = 0.15;

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
}

/** يُطبَّق على التخصصات المُصفَّاة فعلياً (بعد الفرع والبوابة)، مرتَّبة تنازلياً. */
export function rankMajors(input: RankMajorsInput, data: RankMajorsData): RankedMajor[] {
  const userVector = computeUserRiasecVector(input.scoredAnswers, input.questionPool);
  const allowedCategories = BRANCH_CATEGORY_MAP[input.branch] || [];
  const gradeIsHigh = input.grade >= MEDICAL_GATE_GRADE;
  const subjectVector = computeSubjectAffinityVector(input.subjectGrades, input.grade);

  const processed: RankedMajor[] = data.majors
    .map((major) => {
      const profile = data.riasecProfiles[major.id] ?? {};
      const riasecFitPercent = computeMajorFit(userVector, profile);
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
