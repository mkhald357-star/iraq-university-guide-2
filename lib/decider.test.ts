import { describe, it, expect } from "vitest";
import { computeDimensionLeans, computeDeciderVerdict } from "./decider";

describe("computeDimensionLeans", () => {
  it("يحسب ميلاً موجباً نحو أ حين يكون المستخدم أقرب لبروفايلها على بُعد معيّن", () => {
    // R: مستخدم=90، أ=90 (بروفايل 9×10)، ب=10 (بروفايل 1×10) -- المستخدم أقرب لـ أ بفارق كبير
    const leans = computeDimensionLeans({ R: 90 } as any, { R: 9 }, { R: 1 }, ["R"]);
    expect(leans[0].leanToA).toBeGreaterThan(0);
  });

  it("يحسب ميلاً سالباً نحو ب حين يكون المستخدم أقرب لبروفايلها", () => {
    const leans = computeDimensionLeans({ R: 10 } as any, { R: 9 }, { R: 1 }, ["R"]);
    expect(leans[0].leanToA).toBeLessThan(0);
  });

  it("صفر عند تساوي المسافتين تماماً", () => {
    const leans = computeDimensionLeans({ R: 50 } as any, { R: 9 }, { R: 1 }, ["R"]);
    // أ=90، ب=10، المستخدم=50 -- المسافتان متساويتان (40 لكل منهما)
    expect(leans[0].leanToA).toBe(0);
  });

  it("يتعامل مع بُعد غائب من بروفايل التخصص كصفر (نفس اتفاقية computeMajorFit)", () => {
    const leans = computeDimensionLeans({ R: 50 } as any, {}, { R: 5 }, ["R"]);
    expect(leans[0].majorAScore).toBe(0);
  });

  it("يحسب أبعاداً متعدّدة بشكل مستقل، بلا تسرّب بين الأبعاد", () => {
    const leans = computeDimensionLeans({ R: 90, I: 10 } as any, { R: 9, I: 1 }, { R: 1, I: 9 }, ["R", "I"]);
    expect(leans).toHaveLength(2);
    expect(leans[0].leanToA).toBeGreaterThan(0); // R: المستخدم أقرب لـ أ
    expect(leans[1].leanToA).toBeGreaterThan(0); // I: المستخدم (10) أقرب لـ أ (10) من ب (90)
  });
});

describe("computeDeciderVerdict", () => {
  it("تعادل تام (ميل صفري) ⇒ leaningTowardA=null، strength=null", () => {
    const verdict = computeDeciderVerdict([
      { dimension: "R", userScore: 50, majorAScore: 90, majorBScore: 90, leanToA: 0 },
    ]);
    expect(verdict.leaningTowardA).toBeNull();
    expect(verdict.strength).toBeNull();
  });

  it("ميل صغير ضمن نطاق التعادل (أقل من 10% من أقصى مدى) لا يزال تعادلاً", () => {
    // بُعد واحد: أقصى مدى = 100، نطاق التعادل = أقل من 10
    const verdict = computeDeciderVerdict([
      { dimension: "R", userScore: 50, majorAScore: 60, majorBScore: 50, leanToA: 5 },
    ]);
    expect(verdict.leaningTowardA).toBeNull();
  });

  it("ميل كبير أحادي الجانب ⇒ leaningTowardA=true، strength='moderate'", () => {
    // بُعد واحد: leanToA=80 (80% من أقصى مدى 100) -- فوق عتبة moderate (1/3)
    const verdict = computeDeciderVerdict([
      { dimension: "R", userScore: 90, majorAScore: 90, majorBScore: 10, leanToA: 80 },
    ]);
    expect(verdict.leaningTowardA).toBe(true);
    expect(verdict.strength).toBe("moderate");
  });

  it("ميل متوسط (بين نطاق التعادل وعتبة moderate) ⇒ strength='weak'", () => {
    // بُعد واحد، أقصى مدى 100: leanToA=20 -- فوق نطاق التعادل (10) ودون عتبة moderate (33.3)
    const verdict = computeDeciderVerdict([
      { dimension: "R", userScore: 60, majorAScore: 70, majorBScore: 50, leanToA: 20 },
    ]);
    expect(verdict.leaningTowardA).toBe(true);
    expect(verdict.strength).toBe("weak");
  });

  it("يميل نحو ب (leanToA سالب كبير) ⇒ leaningTowardA=false", () => {
    const verdict = computeDeciderVerdict([
      { dimension: "R", userScore: 10, majorAScore: 90, majorBScore: 10, leanToA: -80 },
    ]);
    expect(verdict.leaningTowardA).toBe(false);
    expect(verdict.strength).toBe("moderate");
  });

  it("يجمع عدة أبعاد في netLean واحد قبل الحكم", () => {
    const verdict = computeDeciderVerdict([
      { dimension: "R", userScore: 90, majorAScore: 90, majorBScore: 10, leanToA: 80 },
      { dimension: "I", userScore: 10, majorAScore: 10, majorBScore: 90, leanToA: 80 },
    ]);
    expect(verdict.netLean).toBe(160);
    expect(verdict.leaningTowardA).toBe(true);
  });

  it("strength لا تكون أبداً غير weak/moderate عبر نطاق مدخلات واسع (لا 'قاطع' أبداً)", () => {
    const extremeVerdict = computeDeciderVerdict([
      { dimension: "R", userScore: 100, majorAScore: 100, majorBScore: 0, leanToA: 100 },
      { dimension: "I", userScore: 100, majorAScore: 100, majorBScore: 0, leanToA: 100 },
    ]);
    expect(["weak", "moderate"]).toContain(extremeVerdict.strength);
  });

  it("مصفوفة فارغة من الأبعاد ⇒ تعادل آمن (لا قسمة على صفر)", () => {
    const verdict = computeDeciderVerdict([]);
    expect(verdict.leaningTowardA).toBeNull();
    expect(verdict.strength).toBeNull();
  });
});
