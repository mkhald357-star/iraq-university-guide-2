/**
 * خطوة تقييم الاختبار كاملةً كدالة خالصة: ما كان يفعله runRecommendationEngine
 * داخل app/quiz/page.tsx (فصل التحقق، التناقضات، الترتيب، ترجيح السياق،
 * قرار جولة الترجيح، VRS). الصفحة وأداة المحاكاة (lib/eval) تستدعيان هذه
 * الدالة نفسها -- فلا يمكن للمحاكاة أن تقيس محركاً مختلفاً عمّا يراه الطالب.
 *
 * وضعان للجولات الإضافية:
 * - "legacy": السلوك الحالي (planTieBreak، حتى MAX_TIEBREAK_ROUNDS جولات).
 * - "reserve": جولة احتياط واحدة (lib/adaptiveRound.ts) -- قيد التقييم.
 */
import { computeUserRiasecVector, topDimensions, type RiasecDimension, type RiasecQuestion } from "./riasec";
import { computeValidityRiskScore, type ContradictionPair, type ValidityCheckResult } from "./validity";
import type { SubjectGrades } from "./subjectAffinity";
import { computeUserContextVector, type ContextVector } from "./contextAxisMap";
import {
  rankMajors,
  applyContextTieBreak,
  planTieBreak,
  AMBIGUITY_THRESHOLD,
  MAX_TIEBREAK_ROUNDS,
  type RankMajorsData,
  type RankedMajor,
} from "./recommendationEngine";
import {
  planReserveRound,
  DEFAULT_RESERVE_ROUND_CONFIG,
  type ReserveRoundConfig,
  type ReserveTrigger,
} from "./adaptiveRound";

export type RoundMode = "legacy" | "reserve";

export interface QuizEngineData extends RankMajorsData {
  coreQuestions: RiasecQuestion[];
  tiebreakerPool: RiasecQuestion[];
  validityIds: ReadonlySet<string>;
  contextIndex: Record<string, ContextVector>;
  contradictionPairs: ContradictionPair[];
  roundMode?: RoundMode;
  /**
   * ترجيح بصمة السياق (applyContextTieBreak، المرحلة 3) -- الافتراضي true
   * لحفظ مطابقة وضع legacy للسلوك السابق في المقارنات. المنتج يوقفه: قِيس
   * ضاراً في المحاكاة (−10 نقاط في دقة الأول، يُسوِّئ ترتيب التوأمين) وبلا
   * أي فائدة على الشخصيات المؤلَّفة (التوأمان 9/10 معه وبدونه).
   */
  contextTieBreak?: boolean;
  /** بنك الاحتياط لوضع "reserve" (بلا حد للعدد). الافتراضي: tiebreakerPool. */
  reservePool?: RiasecQuestion[];
  reserveConfig?: ReserveRoundConfig;
}

export interface QuizStepInput {
  /** كل الإجابات حتى الآن (مُسجَّلة + تحقق + ترجيح). */
  answers: Record<string, number>;
  /** أسئلة الترجيح/الاحتياط التي عُرضت فعلاً حتى الآن (تراكمية). */
  extraQuestionsAsked: RiasecQuestion[];
  /** عدد الجولات الإضافية المُنجَزة فعلاً (0 = بعد الأسئلة الأساسية مباشرة). */
  round: number;
  branch: string;
  grade: number;
  subjectGrades: SubjectGrades;
  timingsMs: Record<string, number>;
}

export type QuizStepResult =
  | {
      kind: "askMore";
      questions: RiasecQuestion[];
      tieBreakInfo: { a: string; b: string } | null;
      trigger: ReserveTrigger | "legacy_tiebreak";
      weakDimensions: RiasecDimension[];
      nextRound: number;
    }
  | {
      kind: "final";
      ranked: RankedMajor[];
      userVector: Record<RiasecDimension, number>;
      topUserDimensions: { dimension: RiasecDimension; score: number }[];
      vrs: ValidityCheckResult;
      warnings: string[];
      scoredAnswers: Record<string, number>;
      /** المحرك احتاج أسئلة أكثر ولم يجد ما يسأله (الاستسلام الصامت). */
      neededMoreButNoQuestions: boolean;
      /** فارق أول تخصصين لا يزال ضمن هامش التقارب عند الإنهاء. */
      closeCall: boolean;
      /** الفارق النهائي بين أول تخصصين (Infinity إن كان واحداً فقط) -- لمستوى الإفصاح. */
      finalGap: number;
    };

export function evaluateQuizStep(input: QuizStepInput, data: QuizEngineData): QuizStepResult {
  const scoredAnswers: Record<string, number> = {};
  const validityAnswers: Record<string, number> = {};
  Object.entries(input.answers).forEach(([id, val]) => {
    if (data.validityIds.has(id)) validityAnswers[id] = val;
    else scoredAnswers[id] = val;
  });

  const warnings = data.contradictionPairs
    .filter((pair) => (scoredAnswers[pair.a] ?? 0) > 0 && (scoredAnswers[pair.b] ?? 0) > 0)
    .map((pair) => pair.message);

  // نطاق التطبيع يجب أن يشمل الأسئلة الإضافية المعروضة فعلياً، وإلا تُحسَب
  // مساهمتها بمقياس خاطئ.
  const questionPool = [...data.coreQuestions, ...input.extraQuestionsAsked];
  const userVector = computeUserRiasecVector(scoredAnswers, questionPool, data.minLoadingShare ?? 0);

  const ranked = rankMajors(
    { scoredAnswers, questionPool, branch: input.branch, grade: input.grade, subjectGrades: input.subjectGrades },
    data
  );
  const userContextVector = computeUserContextVector(
    scoredAnswers,
    questionPool.map((q) => q.id)
  );
  const contextRanked =
    data.contextTieBreak === false ? ranked : applyContextTieBreak(ranked, userContextVector, data.contextIndex);

  const mode = data.roundMode ?? "legacy";
  let neededMoreButNoQuestions = false;
  let closeThreshold = AMBIGUITY_THRESHOLD;

  if (mode === "legacy") {
    const alreadyAskedIds = new Set(input.extraQuestionsAsked.map((q) => q.id));
    const decision = planTieBreak(contextRanked, input.round, alreadyAskedIds, data.tiebreakerPool, data.riasecProfiles);
    if (decision.candidates.length > 0) {
      return {
        kind: "askMore",
        questions: decision.candidates,
        tieBreakInfo: decision.tieBreakInfo,
        trigger: "legacy_tiebreak",
        weakDimensions: [],
        nextRound: input.round + 1,
      };
    }
    const gap = contextRanked.length >= 2 ? contextRanked[0].combinedScore - contextRanked[1].combinedScore : Infinity;
    neededMoreButNoQuestions = gap < AMBIGUITY_THRESHOLD && input.round < MAX_TIEBREAK_ROUNDS;
  } else {
    const config = data.reserveConfig ?? DEFAULT_RESERVE_ROUND_CONFIG;
    closeThreshold = config.disclosureGap;
    if (input.round === 0) {
      const plan = planReserveRound(
        contextRanked,
        userVector,
        scoredAnswers,
        questionPool,
        data.reservePool ?? data.tiebreakerPool,
        data.riasecProfiles,
        config
      );
      if (plan.questions.length > 0) {
        return {
          kind: "askMore",
          questions: plan.questions,
          tieBreakInfo:
            contextRanked.length >= 2 ? { a: contextRanked[0].name, b: contextRanked[1].name } : null,
          trigger: plan.trigger ?? "ambiguity",
          weakDimensions: plan.weakDimensions,
          nextRound: 1,
        };
      }
      neededMoreButNoQuestions = plan.trigger !== null;
    }
  }

  const vrs = computeValidityRiskScore(
    scoredAnswers,
    validityAnswers,
    input.timingsMs,
    data.contradictionPairs,
    data.coreQuestions
  );
  const finalGap =
    contextRanked.length >= 2 ? contextRanked[0].combinedScore - contextRanked[1].combinedScore : Infinity;

  return {
    kind: "final",
    ranked: contextRanked,
    userVector,
    topUserDimensions: topDimensions(userVector, 2),
    vrs,
    warnings,
    scoredAnswers,
    neededMoreButNoQuestions,
    closeCall: finalGap < closeThreshold,
    finalGap,
  };
}
