/**
 * بيانات المحرك الحقيقية لأداة التقييم -- نفس الملفات التي تستوردها
 * app/quiz/page.tsx، مع إمكانية استبدال بنك الأسئلة الأساسي/الترجيحي لقياس
 * بنك مرشَّح قبل اعتماده.
 */
import questionsData from "../../data/questions.json";
import validityQuestionsData from "../../data/validity_questions.json";
import contradictionPairsData from "../../data/contradiction_pairs.json";
import tiebreakerQuestionsData from "../../data/tiebreaker_questions.json";
import majorsData from "../../data/majors.json";
import riasecProfilesData from "../../data/major_riasec_profiles.json";
import subjectAffinityWeightsData from "../../data/subject_affinity_weights.json";
import majorContextIndexData from "../../data/major_context_index.json";
import type { RiasecQuestion } from "../riasec";
import type { RankMajorsData } from "../recommendationEngine";
import type { ContextVector } from "../contextAxisMap";
import type { SessionData, ValidityItemLike } from "./session";

export const REAL_CORE_QUESTIONS = questionsData as RiasecQuestion[];
export const REAL_TIEBREAKER_QUESTIONS = tiebreakerQuestionsData as RiasecQuestion[];
export const REAL_VALIDITY_ITEMS = validityQuestionsData as unknown as ValidityItemLike[];
export const REAL_MAJORS = majorsData as RankMajorsData["majors"];
export const REAL_PROFILES = riasecProfilesData.profiles as RankMajorsData["riasecProfiles"];

export function buildSessionData(
  overrides: Partial<
    Pick<SessionData, "coreQuestions" | "tiebreakerPool" | "fitStrategy" | "truthStrategy" | "roundMode" | "reservePool" | "reserveConfig" | "minLoadingShare" | "contextIndex" | "contextTieBreak">
  > = {}
): SessionData {
  return {
    fitStrategy: overrides.fitStrategy,
    roundMode: overrides.roundMode,
    minLoadingShare: overrides.minLoadingShare,
    contextTieBreak: overrides.contextTieBreak,
    reservePool: overrides.reservePool,
    reserveConfig: overrides.reserveConfig,
    truthStrategy: overrides.truthStrategy,
    majors: REAL_MAJORS,
    riasecProfiles: REAL_PROFILES,
    subjectWeights: subjectAffinityWeightsData.weights as RankMajorsData["subjectWeights"],
    coreQuestions: overrides.coreQuestions ?? REAL_CORE_QUESTIONS,
    tiebreakerPool: overrides.tiebreakerPool ?? REAL_TIEBREAKER_QUESTIONS,
    validityIds: new Set(REAL_VALIDITY_ITEMS.map((v) => v.id)),
    validityItems: REAL_VALIDITY_ITEMS,
    contextIndex: overrides.contextIndex ?? (majorContextIndexData.contexts as Record<string, ContextVector>),
    contradictionPairs: contradictionPairsData,
  };
}
