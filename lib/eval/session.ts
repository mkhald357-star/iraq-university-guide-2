/**
 * جلسة اختبار كاملة لطالب اصطناعي، عبر نفس دالة المنتج (evaluateQuizStep)
 * خطوةً بخطوة -- بما فيها الجولات الإضافية وإجاباتها -- ثم مقارنة النتيجة
 * بالترتيب "الحقيقي" المحسوب من θ مباشرة (rankMajorsFromVector).
 *
 * مصدر الإجابة قابل للاستبدال: إما سحب حيّ من نموذج استجابة (simulateSession)،
 * أو ذاكرة إجابات محسوبة مسبقاً لكل البنود المرشَّحة (runSession) -- إجابة
 * الطالب على بند لا تتوقف على أي بنود أخرى سُئلت، فيمكن تقييم آلاف
 * التشكيلات المختلفة للبنك على نفس الإجابات، بسرعة وبعدالة مقارنة تامة.
 */
import type { FitStrategy, RiasecQuestion } from "../riasec";
import { MAX_TIEBREAK_ROUNDS, rankMajorsFromVector, type RankedMajor } from "../recommendationEngine";
import { evaluateQuizStep, type QuizEngineData } from "../quizEngine";
import type { SimStudent } from "./population";
import { answerScoredItem, answerTimingMs, answerValidityItem, type ResponseModel } from "./responseModels";
import type { Rng } from "./random";
import { groupScreens, type FormattedItemLike } from "../itemFormats";
import { precomputeFormatAnswers } from "./formatSession";

export interface ValidityItemLike {
  id: string;
  validity: { type: "instructed" | "reverse_twin" | "lie_scale"; pairsWith?: string };
}

export interface SessionData extends QuizEngineData {
  validityItems: ValidityItemLike[];
  /** صيغة "الحقيقة" (مطابقة θ بالبروفايل) -- ثابتة عبر كل النسخ المقارنة. */
  truthStrategy?: FitStrategy;
}

export interface SessionResult {
  shown: string[];
  /** الترتيب النهائي الكامل (كل التخصصات المؤهَّلة) -- لفحص أزواج التوأمين وقابلية الوصول. */
  rankedAll: string[];
  truth: string[];
  truthScores: number[];
  shownGap: number;
  extraQuestions: number;
  rounds: number;
  screens: number;
  silentFailure: boolean;
  closeCall: boolean;
  vrsBand: "low" | "medium" | "high";
  answers: Record<string, number>;
}

export type AnswerSource = (q: RiasecQuestion) => number;

export function runSession(
  student: SimStudent,
  answerFor: AnswerSource,
  validityAnswers: Record<string, number>,
  timingsMs: Record<string, number>,
  data: SessionData
): SessionResult {
  const answers: Record<string, number> = { ...validityAnswers };
  data.coreQuestions.forEach((q) => (answers[q.id] = answerFor(q)));

  const asked: RiasecQuestion[] = [];
  let round = 0;
  let final: Extract<ReturnType<typeof evaluateQuizStep>, { kind: "final" }> | null = null;
  for (let guard = 0; guard <= MAX_TIEBREAK_ROUNDS + 1; guard++) {
    const step = evaluateQuizStep(
      {
        answers,
        extraQuestionsAsked: asked,
        round,
        branch: student.branch,
        grade: student.grade,
        subjectGrades: student.subjectGrades,
        timingsMs,
      },
      data
    );
    if (step.kind === "final") {
      final = step;
      break;
    }
    step.questions.forEach((q) => (answers[q.id] = answerFor(q)));
    asked.push(...step.questions);
    round = step.nextRound;
  }
  if (!final) throw new Error("runSession: الجلسة لم تنتهِ ضمن حد الجولات");

  // الحقيقة تُحسب دائماً بصيغة ثابتة مهما كانت صيغة المحرك قيد التقييم،
  // وإلا صارت كل صيغة "صحيحة" بالقياس إلى نفسها.
  const truthRanked: RankedMajor[] = rankMajorsFromVector(student.theta, student, {
    ...data,
    fitStrategy: data.truthStrategy ?? "level",
  });
  const shownGap = final.ranked.length >= 2 ? final.ranked[0].combinedScore - final.ranked[1].combinedScore : Infinity;

  return {
    shown: final.ranked.slice(0, 3).map((m) => m.id),
    rankedAll: final.ranked.map((m) => m.id),
    truth: truthRanked.slice(0, 3).map((m) => m.id),
    truthScores: truthRanked.slice(0, 3).map((m) => m.combinedScore),
    shownGap,
    extraQuestions: asked.length,
    rounds: round,
    // شاشات لا عبارات: شاشة الموقف أو الأقرب/الأبعد تضم عدة عبارات.
    screens: groupScreens(data.coreQuestions as FormattedItemLike[]).length + data.validityItems.length + asked.length,
    // استسلام صامت = المحرك احتاج أسئلة أكثر ولم يجد ما يسأله (يُبلغ عنه المحرك نفسه)
    silentFailure: final.neededMoreButNoQuestions,
    closeCall: final.closeCall,
    vrsBand: final.vrs.band,
    answers,
  };
}

/** إجابات طالب على كل البنود المرشَّحة + أسئلة التحقق، محسوبة مرة واحدة. */
export interface CachedAnswers {
  scored: Record<string, number>;
  validity: Record<string, number>;
  timingsMs: Record<string, number>;
}

export function precomputeAnswers(
  student: SimStudent,
  model: ResponseModel,
  rng: Rng,
  candidateItems: RiasecQuestion[],
  validityItems: ValidityItemLike[]
): CachedAnswers {
  const scored: Record<string, number> = {};
  const timingsMs: Record<string, number> = {};
  candidateItems.forEach((q) => {
    scored[q.id] = answerScoredItem(q, student, model, rng);
    timingsMs[q.id] = answerTimingMs(student, rng);
  });
  const validity: Record<string, number> = {};
  validityItems.forEach((v) => {
    const paired = v.validity.pairsWith ? (scored[v.validity.pairsWith] ?? 0) : 0;
    validity[v.id] = answerValidityItem(v.validity.type, student, paired, rng);
    timingsMs[v.id] = answerTimingMs(student, rng);
  });
  return { scored, validity, timingsMs };
}

export function simulateSession(student: SimStudent, model: ResponseModel, rng: Rng, data: SessionData): SessionResult {
  const pool = [...data.coreQuestions, ...data.tiebreakerPool, ...(data.reservePool ?? [])];
  const unique = [...new Map(pool.map((q) => [q.id, q])).values()];
  // بنك متعدد الأشكال يُجاب بنموذج الأشكال الواقعي (ضوضاء مترابطة داخل الموقف،
  // اختيار ثورستوني للأقرب/الأبعد)؛ بنك العبارات المفردة كما كان.
  const formatBank = (data.coreQuestions as FormattedItemLike[]).some(
    (q) => q.format === "grid" || q.format === "pick"
  );
  const cached = formatBank
    ? precomputeFormatAnswers(student, model, rng, unique as (RiasecQuestion & FormattedItemLike)[], data.validityItems)
    : precomputeAnswers(student, model, rng, unique, data.validityItems);
  return runSession(student, (q) => cached.scored[q.id], cached.validity, cached.timingsMs, data);
}
