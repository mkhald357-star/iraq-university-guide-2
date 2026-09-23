/** تشغيل تقييم كامل: فرع × نموذج استجابة × مزيج أنماط، ببذرة ثابتة. */
import { BRANCH_CATEGORY_MAP } from "../branchEligibility";
import { generatePopulation, type ResponseStyle } from "./population";
import { simulateSession, type SessionData } from "./session";
import { summarize, type EvaluationSummary } from "./metrics";
import { createRng } from "./random";
import type { ResponseModel } from "./responseModels";

export interface EvaluationConfig {
  branch: string;
  model: ResponseModel;
  size: number;
  seed: number;
  styleMix?: Partial<Record<ResponseStyle, number>>;
  indifferentLowDims?: boolean;
}

export function runEvaluation(config: EvaluationConfig, data: SessionData): EvaluationSummary {
  // بذرتان منفصلتان: المجتمع نفسه ثابت عبر النسخ المقارنة، والإجابات مستقلة.
  const populationRng = createRng(config.seed);
  const answerRng = createRng(config.seed ^ 0x9e3779b9);
  const students = generatePopulation(populationRng, {
    size: config.size,
    branch: config.branch,
    majors: data.majors,
    profiles: data.riasecProfiles,
    styleMix: config.styleMix,
    indifferentLowDims: config.indifferentLowDims,
  });
  const pairs = students.map((student) => ({
    student,
    result: simulateSession(student, config.model, answerRng, data),
  }));
  const allowed = BRANCH_CATEGORY_MAP[config.branch] ?? [];
  const eligible = data.majors.filter((m) => allowed.includes(m.category)).map((m) => m.id);
  return summarize(pairs, eligible);
}
