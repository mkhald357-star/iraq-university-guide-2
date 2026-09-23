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

/** إعداد المنتج الحالي حرفياً -- كل ما لا يُمرَّر صراحةً يبقى عليه. */
const DEFAULTS: SessionData = {
  fitStrategy: undefined,
  roundMode: undefined,
  minLoadingShare: undefined,
  contextTieBreak: undefined,
  reservePool: undefined,
  reserveConfig: undefined,
  truthStrategy: undefined,
  majors: REAL_MAJORS,
  riasecProfiles: REAL_PROFILES,
  subjectWeights: subjectAffinityWeightsData.weights as RankMajorsData["subjectWeights"],
  coreQuestions: REAL_CORE_QUESTIONS,
  tiebreakerPool: REAL_TIEBREAKER_QUESTIONS,
  validityIds: new Set(REAL_VALIDITY_ITEMS.map((v) => v.id)),
  validityItems: REAL_VALIDITY_ITEMS,
  contextIndex: majorContextIndexData.contexts as Record<string, ContextVector>,
  contradictionPairs: contradictionPairsData,
};

/**
 * يبني إعداد جلسة محاكاة. **كل حقل قابل للحقن** -- كانت `majors` و
 * `riasecProfiles` و`subjectWeights` و`contradictionPairs` مثبَّتة حرفياً، فلم
 * يكن ممكناً قياس نسخة بديلة من معايير الأقسام بنفس الأداة (الإصدار 2، المسار أ).
 *
 * القيم `undefined` تُسقَط قبل الدمج: مستدعٍ يمرّر `{ fitStrategy: cfg.fitStrategy }`
 * وقيمتها غير معرَّفة يجب أن يحصل على سلوك اليوم نفسه، لا أن يمحو الافتراضي.
 */
export function buildSessionData(overrides: Partial<SessionData> = {}): SessionData {
  const defined = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)) as Partial<SessionData>;
  return { ...DEFAULTS, ...defined };
}
