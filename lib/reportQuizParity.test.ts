import { describe, it, expect } from "vitest";
import { evaluateQuizStep } from "./quizEngine";
import { computeUserRiasecVector } from "./riasec";
import { rankMajorsFromVector, PRODUCT_FIT_STRATEGY, PRODUCT_MIN_LOADING_SHARE } from "./recommendationEngine";
import { buildScoredPool } from "./scoredPool";
import { buildProductSessionData } from "./eval/productConfig";

/**
 * تطابق /report مع /quiz (الإصدار 2، المسار C-C). كان التقرير يعيد حساب
 * التوافق بلا مزج درجات المواد (30%) لأن الاختبار لم يكن يحفظها، فيعرض لنفس
 * التخصص نسبة تختلف عمّا رآه الطالب. هذا الاختبار يعيد إنتاج مسار التقرير
 * حرفياً (buildScoredPool ← computeUserRiasecVector ← rankMajorsFromVector)
 * ويقارنه بمخرج محرك الاختبار نفسه.
 */
describe("تطابق نسبة التوافق بين /report و/quiz", () => {
  const data = buildProductSessionData();
  // بلا جولة فكّ حيرة: نريد المخرج النهائي مباشرةً للمقارنة
  const noRound = { ...data, reserveConfig: { ...data.reserveConfig!, epsilon: 0, weakEvidenceRatio: 0, weakConsistency: 0 } };
  const answers = Object.fromEntries(data.coreQuestions.map((q, i) => [q.id, [1, 0.5, 0, -0.5, -1][i % 5]]));

  for (const subjectGrades of [{}, { math: 97, physics: 58, chemistry: 71, biology: 88 }]) {
    const label = Object.keys(subjectGrades).length ? "مع درجات مواد (الحالة التي كانت تنكسر)" : "بلا درجات مواد";
    it(label, () => {
      const step = evaluateQuizStep(
        { answers, extraQuestionsAsked: [], round: 0, branch: "علمي", grade: 90, subjectGrades, timingsMs: {} },
        noRound
      );
      expect(step.kind).toBe("final");
      if (step.kind !== "final") return;

      // مسار التقرير حرفياً كما في app/report/page.tsx
      const pool = buildScoredPool(answers, data.coreQuestions, [data.reservePool ?? [], data.tiebreakerPool]);
      const vector = computeUserRiasecVector(answers, pool, PRODUCT_MIN_LOADING_SHARE);
      const reportFit = Object.fromEntries(
        rankMajorsFromVector(
          vector,
          { branch: "علمي", grade: 90, subjectGrades },
          {
            fitStrategy: PRODUCT_FIT_STRATEGY,
            minLoadingShare: PRODUCT_MIN_LOADING_SHARE,
            majors: data.majors,
            riasecProfiles: data.riasecProfiles,
            subjectWeights: data.subjectWeights,
          }
        ).map((m) => [m.id, m.fitPercent])
      );

      expect(step.ranked.length).toBeGreaterThan(0);
      for (const m of step.ranked) expect(reportFit[m.id], m.id).toBeCloseTo(m.fitPercent, 9);
    });
  }
});
