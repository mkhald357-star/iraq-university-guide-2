import { describe, it, expect } from "vitest";
import { buildProductSessionData } from "./productConfig";
import { runEvaluation } from "./runEvaluation";
import { generatePopulation } from "./population";
import { simulateSession } from "./session";
import { createRng } from "./random";

// اختبار انحدار دائم للاختبار القصير (23 + 3 تحقق + جولة احتياط واحدة ≤5)
// على إعداد المنتج الفعلي، ببذور ثابتة. الحدود أدنى قليلاً من القيم المقيسة
// (QA-REPORT-ALGORITHM.md) -- أي تعديل مستقبلي يُسقط الدقة أو يطيل الاختبار
// أو يعيد الاستسلام الصامت يكسر البناء بدل أن يمرّ صامتاً.
const data = buildProductSessionData();

describe("الاختبار القصير -- حدود المنتج", () => {
  it("لا جولة ثانية أبداً، ولا أكثر من 5 أسئلة إضافية، ولا استسلام صامت", () => {
    const students = generatePopulation(createRng(31), {
      size: 300,
      branch: "علمي",
      majors: data.majors,
      profiles: data.riasecProfiles,
    });
    const rng = createRng(32);
    for (const s of students) {
      const r = simulateSession(s, "linear", rng, data);
      expect(r.rounds).toBeLessThanOrEqual(1);
      expect(r.extraQuestions).toBeLessThanOrEqual(5);
      expect(r.screens).toBeLessThanOrEqual(26 + 5);
      expect(r.silentFailure).toBe(false);
    }
  });

  it("دقة الاسترجاع وطول الاختبار ضمن الحدود المُثبَتة (علمي/أدبي)", () => {
    const sci = runEvaluation({ branch: "علمي", model: "linear", size: 600, seed: 424242 }, data);
    expect(sci.top1Accuracy).toBeGreaterThanOrEqual(0.55);
    expect(sci.top3Overlap).toBeGreaterThanOrEqual(0.75);
    expect(sci.meanScreens).toBeLessThanOrEqual(29.5);
    const lit = runEvaluation({ branch: "أدبي", model: "linear", size: 600, seed: 424242 }, data);
    expect(lit.top1Accuracy).toBeGreaterThanOrEqual(0.7);
    expect(lit.top3Overlap).toBeGreaterThanOrEqual(0.9);
  });

  it("كشف الموافقة الدائمة يعمل دون إنذار كاذب على الطالب العادي", () => {
    const s = runEvaluation(
      { branch: "علمي", model: "linear", size: 600, seed: 99, styleMix: { normal: 1, acquiescent: 1 } },
      data
    );
    expect(s.flaggedRateByStyle.normal ?? 1).toBeLessThanOrEqual(0.03);
    expect(s.flaggedRateByStyle.acquiescent ?? 0).toBeGreaterThanOrEqual(0.7);
    expect(s.top1AccuracyByStyle.acquiescent ?? 0).toBeGreaterThanOrEqual(0.45);
  });
});
