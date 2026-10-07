import { describe, it, expect } from "vitest";
import { evaluateQuizStep, type QuizEngineData } from "./quizEngine";
import { rankMajors, applyContextTieBreak, planTieBreak } from "./recommendationEngine";
import { computeUserContextVector } from "./contextAxisMap";
import { buildScoredPool } from "./scoredPool";
import { buildSessionData } from "./eval/engineData";
import type { RiasecQuestion } from "./riasec";

const legacy: QuizEngineData = buildSessionData({ roundMode: "legacy" });
const reserve: QuizEngineData = buildSessionData({ roundMode: "reserve" });

function answersFavoring(dims: string[], core: RiasecQuestion[]): Record<string, number> {
  return Object.fromEntries(
    core.map((q) => {
      const w = Object.entries(q.dimensions)
        .filter(([d]) => dims.includes(d))
        .reduce((s, [, v]) => s + (v ?? 0), 0);
      return [q.id, w > 0 ? 1 : w < 0 ? -1 : 0];
    })
  );
}

const baseInput = { extraQuestionsAsked: [], round: 0, branch: "علمي", grade: 90, subjectGrades: {}, timingsMs: {} };

describe("evaluateQuizStep -- وضع legacy مطابق للسلوك السابق حرفياً", () => {
  it("يعطي نفس قرار الترجيح ونفس الترتيب الذي كانت تحسبه الصفحة بنفسها", () => {
    for (const dims of [["R", "I"], ["S"], ["A", "E"], ["C"]]) {
      const answers = answersFavoring(dims, legacy.coreQuestions);
      const step = evaluateQuizStep({ ...baseInput, answers }, legacy);
      const ranked = applyContextTieBreak(
        rankMajors(
          { scoredAnswers: answers, questionPool: legacy.coreQuestions, branch: "علمي", grade: 90, subjectGrades: {} },
          legacy
        ),
        computeUserContextVector(
          answers,
          legacy.coreQuestions.map((q) => q.id)
        ),
        legacy.contextIndex
      );
      const decision = planTieBreak(ranked, 0, new Set(), legacy.tiebreakerPool, legacy.riasecProfiles);
      if (decision.candidates.length > 0) {
        expect(step.kind).toBe("askMore");
        if (step.kind === "askMore")
          expect(step.questions.map((q) => q.id)).toEqual(decision.candidates.map((q) => q.id));
      } else {
        expect(step.kind).toBe("final");
        if (step.kind === "final") expect(step.ranked.map((m) => m.id)).toEqual(ranked.map((m) => m.id));
      }
    }
  });
});

describe("evaluateQuizStep -- وضع reserve (جولة واحدة)", () => {
  it("لا جولة ثانية أبداً: بعد جولة واحدة النتيجة نهائية دائماً", () => {
    for (const dims of [["R", "I"], ["S"], ["A", "E"], ["C"], ["I"]]) {
      const answers = answersFavoring(dims, reserve.coreQuestions);
      const first = evaluateQuizStep({ ...baseInput, answers }, reserve);
      if (first.kind === "askMore") {
        expect(first.questions.length).toBeLessThanOrEqual(5);
        const withExtra = { ...answers, ...Object.fromEntries(first.questions.map((q) => [q.id, 0.5])) };
        const second = evaluateQuizStep(
          { ...baseInput, answers: withExtra, extraQuestionsAsked: first.questions, round: first.nextRound },
          reserve
        );
        expect(second.kind).toBe("final");
      }
    }
  });

  it("لا استسلام صامت حين يتوفر بنك احتياط", () => {
    const answers = answersFavoring(["R", "I"], reserve.coreQuestions);
    const first = evaluateQuizStep({ ...baseInput, answers }, reserve);
    if (first.kind === "final") expect(first.neededMoreButNoQuestions).toBe(false);
  });
});

describe("buildScoredPool", () => {
  it("يضمّ الأساسية + أسئلة الاحتياط المُجابة فقط، بلا تكرار", () => {
    const core: RiasecQuestion[] = [{ id: "a", text: "", dimensions: { R: 8 } }];
    const extra: RiasecQuestion[] = [
      { id: "x", text: "", dimensions: { I: 7 } },
      { id: "y", text: "", dimensions: { A: 7 } },
      { id: "a", text: "", dimensions: { R: 8 } },
    ];
    expect(buildScoredPool({ a: 1, x: 0.5 }, core, [extra, extra]).map((q) => q.id)).toEqual(["a", "x"]);
  });
});
