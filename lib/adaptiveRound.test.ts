import { describe, it, expect } from "vitest";
import { planReserveRound, DEFAULT_RESERVE_ROUND_CONFIG } from "./adaptiveRound";
import { measureDimensions } from "./measurement";
import { RIASEC_DIMENSIONS, type RiasecQuestion, type RiasecVector } from "./riasec";
import type { RankedMajor } from "./recommendationEngine";

const major = (id: string, score: number): RankedMajor => ({
  id,
  name: id,
  category: "x",
  marketMultiplier: 1,
  fitPercent: score,
  riasecFitPercent: score,
  subjectFitPercent: null,
  combinedScore: score,
});

const q = (id: string, dimensions: RiasecVector): RiasecQuestion => ({ id, text: id, dimensions });

const core: RiasecQuestion[] = RIASEC_DIMENSIONS.flatMap((d) => [
  q(`${d}1`, { [d]: 8 }),
  q(`${d}2`, { [d]: 7 }),
  q(`${d}3`, { [d]: 6 }),
]);
const reserve: RiasecQuestion[] = RIASEC_DIMENSIONS.flatMap((d) => [
  q(`res_${d}1`, { [d]: 8 }),
  q(`res_${d}2`, { [d]: 7, I: d === "I" ? 7 : 2 }),
]);
const decisiveAnswers = Object.fromEntries(
  core.map((x) => [x.id, x.id.startsWith("R") || x.id.startsWith("I") ? 1 : -1])
);
const neutralVector = { R: 50, I: 50, A: 50, S: 50, E: 50, C: 50 };
const profiles: Record<string, RiasecVector> = {
  eng: { R: 8, I: 7, A: 1, S: 1, E: 3, C: 5 },
  art: { R: 2, I: 3, A: 9, S: 4, E: 4, C: 2 },
  eng_twin: { R: 8, I: 7, A: 1, S: 2, E: 3, C: 5 },
};

describe("planReserveRound", () => {
  it("فارق فوق epsilon (0.5) لا يُطلق جولة -- يُفصَح عنه للطالب فقط (الجولة نادرة، ≤15%)", () => {
    const plan = planReserveRound(
      [major("eng", 80), major("art", 79)],
      neutralVector,
      decisiveAnswers,
      core,
      reserve,
      profiles
    );
    expect(plan.trigger).toBeNull();
  });

  it("لا جولة حين يتصدّر تخصص بفارق واضح والقياس قوي", () => {
    const plan = planReserveRound(
      [major("eng", 90), major("art", 60)],
      neutralVector,
      decisiveAnswers,
      core,
      reserve,
      profiles
    );
    expect(plan.trigger).toBeNull();
    expect(plan.questions).toEqual([]);
  });

  it("التقارب القابل للحسم (دون epsilon) يُطلق جولة واحدة بأربعة أسئلة كحد أقصى، بلا تكرار لبند مُجاب ولا أوزان مكرّرة", () => {
    const plan = planReserveRound(
      [major("eng", 80), major("art", 79.7)],
      neutralVector,
      decisiveAnswers,
      core,
      reserve,
      profiles
    );
    expect(plan.trigger).toMatch(/ambiguity|both/);
    expect(plan.questions.length).toBeGreaterThan(0);
    expect(plan.questions.length).toBeLessThanOrEqual(DEFAULT_RESERVE_ROUND_CONFIG.maxQuestions);
    plan.questions.forEach((x) => expect(decisiveAnswers[x.id]).toBeUndefined());
    const signatures = plan.questions.map((x) => JSON.stringify(x.dimensions));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("تقارب زوج توأمين يُطلق الجولة افتراضياً (minResolvableSpread=0) -- تخطّيه كان يُسوِّئ ترتيبهم (المدقّق C1)", () => {
    const plan = planReserveRound(
      [major("eng", 80), major("eng_twin", 79.7)],
      neutralVector,
      decisiveAnswers,
      core,
      reserve,
      profiles
    );
    expect(plan.trigger).toMatch(/ambiguity|both/);
  });

  it("عدد أسئلة الجولة يتدرّج مع شدّة الالتباس: 3 لتخصصين متقاربين، و5 لعنقود من أربعة", () => {
    const two = planReserveRound(
      [major("eng", 80), major("art", 79.7)],
      neutralVector,
      decisiveAnswers,
      core,
      reserve,
      profiles
    );
    expect(two.questions.length).toBe(3);
    const four = planReserveRound(
      [major("eng", 80), major("art", 79.9), major("eng_twin", 79.8), major("art2", 79.7)],
      neutralVector,
      decisiveAnswers,
      core,
      reserve,
      { ...profiles, art2: { A: 8, S: 5, I: 3 } }
    );
    expect(four.questions.length).toBe(5);
  });

  it("عتبة minResolvableSpread حين تُضبط صراحةً تتخطّى عنقوداً متطابق البروفايل", () => {
    const plan = planReserveRound(
      [major("eng", 80), major("eng_twin", 79.7)],
      neutralVector,
      decisiveAnswers,
      core,
      reserve,
      profiles,
      {
        ...DEFAULT_RESERVE_ROUND_CONFIG,
        minResolvableSpread: 18,
      }
    );
    expect(plan.trigger).toBeNull();
  });

  it("ضعف قياس بُعد تتباين فيه التخصصات المتصدّرة يُطلق جولة تستهدف ذلك البُعد", () => {
    const answers = { ...decisiveAnswers, A1: 0, A2: 0, A3: 0 };
    const plan = planReserveRound(
      [major("eng", 90), major("art", 70)],
      neutralVector,
      answers,
      core,
      reserve,
      profiles
    );
    expect(plan.weakDimensions).toContain("A");
    expect(plan.questions.some((x) => (x.dimensions.A ?? 0) !== 0)).toBe(true);
  });
});

describe("measureDimensions", () => {
  it("يقيس التغطية والإشارة والاتساق لكل بُعد", () => {
    const m = measureDimensions({ R1: 1, R2: -1, R3: 1, I1: 0, I2: 0, I3: 0 }, core);
    expect(m.R.coverage).toBe(21);
    expect(m.R.evidenceRatio).toBe(1);
    expect(m.R.consistency).toBeCloseTo(2 / 3);
    expect(m.I.evidenceRatio).toBe(0);
    expect(m.I.nonNeutralItems).toBe(0);
    // بُعد بلا أي بند مُجاب لا يُعدّ مُقاساً
    expect(m.A.coverage).toBe(0);
  });
});
