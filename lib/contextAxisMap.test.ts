import { describe, it, expect } from "vitest";
import { computeUserContextVector, findMostDivergentContextAxis, computeContextFit } from "./contextAxisMap";

describe("computeUserContextVector", () => {
  it("محايد (50) على كل محور حين لا يُجاب أي سؤال مُحمَّل على محاور السياق", () => {
    const vector = computeUserContextVector({}, ["q_hands_on", "q_math_logic"]);
    expect(vector).toEqual({ appliedness: 50, quantitative: 50, humanContact: 50, fieldwork: 50 });
  });

  it("appliedness=100 حين تُجاب الأسئلة الأربعة المُحمَّلة عليه بأقصى اتجاه تطبيقي", () => {
    // q_pure_theory_vs_applied_build وزنه سالب (appliedness: -8) -- "نعم" فيه
    // يعني تفضيلاً نظرياً، فالإجابة الأكثر تطبيقاً هي -1 (لا) لا +1.
    const vector = computeUserContextVector(
      { q_pure_theory_vs_applied_build: -1, q_hands_on: 1, q_tangible_result: 1, q_tinkering: 1 },
      ["q_pure_theory_vs_applied_build", "q_hands_on", "q_tangible_result", "q_tinkering"]
    );
    expect(vector.appliedness).toBe(100);
  });

  it("appliedness=0 حين تُجاب نفس الأسئلة بأقصى اتجاه نظري معاكس", () => {
    const vector = computeUserContextVector(
      { q_pure_theory_vs_applied_build: 1, q_hands_on: -1, q_tangible_result: -1, q_tinkering: -1 },
      ["q_pure_theory_vs_applied_build", "q_hands_on", "q_tangible_result", "q_tinkering"]
    );
    expect(vector.appliedness).toBe(0);
  });

  it("سؤال غير مُحمَّل على أي محور سياق (مثال: q_leadership) لا يؤثر إطلاقاً", () => {
    const withExtra = computeUserContextVector(
      { q_math_logic: 1, q_leadership: 1 },
      ["q_math_logic", "q_leadership"]
    );
    const withoutExtra = computeUserContextVector({ q_math_logic: 1 }, ["q_math_logic"]);
    expect(withExtra).toEqual(withoutExtra);
  });
});

describe("computeContextFit", () => {
  it("100 لمتجهين متطابقين", () => {
    const v = { appliedness: 70, quantitative: 30, humanContact: 10, fieldwork: 60 };
    expect(computeContextFit(v, v)).toBe(100);
  });

  it("0 لمتجهين متعاكسين تماماً (0 مقابل 100 على كل محور)", () => {
    const a = { appliedness: 0, quantitative: 0, humanContact: 0, fieldwork: 0 };
    const b = { appliedness: 100, quantitative: 100, humanContact: 100, fieldwork: 100 };
    expect(computeContextFit(a, b)).toBe(0);
  });
});

describe("findMostDivergentContextAxis", () => {
  it("يختار المحور الأكبر فارقاً بين تخصصين، لا أول محور في الترتيب", () => {
    const a = { appliedness: 55, quantitative: 90, humanContact: 0, fieldwork: 20 };
    const b = { appliedness: 70, quantitative: 90, humanContact: 0, fieldwork: 20 };
    // الفارق الوحيد هنا فعلياً هو appliedness (15) -- البقية صفر
    expect(findMostDivergentContextAxis(a, b)).toBe("appliedness");
  });

  it("يختار fieldwork حين يكون هو الأكبر فارقاً بدل appliedness", () => {
    const a = { appliedness: 50, quantitative: 50, humanContact: 50, fieldwork: 10 };
    const b = { appliedness: 55, quantitative: 50, humanContact: 50, fieldwork: 80 };
    expect(findMostDivergentContextAxis(a, b)).toBe("fieldwork");
  });
});
