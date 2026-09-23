/**
 * إعداد المنتج الفعلي كما تستخدمه صفحة الاختبار -- لأداة التقييم واختبار
 * الانحدار (lib/eval/shortForm.test.ts)، كي يُقاس ما يراه الطالب حرفياً.
 */
import questionsData from "../../data/questions.json";
import reserveQuestionsData from "../../data/reserve_questions.json";
import contradictionPairsData from "../../data/contradiction_pairs.json";
import type { RiasecQuestion } from "../riasec";
import { PRODUCT_FIT_STRATEGY, PRODUCT_MIN_LOADING_SHARE } from "../recommendationEngine";
import { DEFAULT_RESERVE_ROUND_CONFIG } from "../adaptiveRound";
import { buildSessionData } from "./engineData";
import type { SessionData } from "./session";

export function buildProductSessionData(): SessionData {
  return {
    ...buildSessionData({
      coreQuestions: questionsData as RiasecQuestion[],
      reservePool: reserveQuestionsData as RiasecQuestion[],
      roundMode: "reserve",
      fitStrategy: PRODUCT_FIT_STRATEGY,
      minLoadingShare: PRODUCT_MIN_LOADING_SHARE,
      contextTieBreak: false,
      reserveConfig: DEFAULT_RESERVE_ROUND_CONFIG,
    }),
    contradictionPairs: contradictionPairsData,
  };
}
