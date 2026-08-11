import { describe, it, expect } from "vitest";
import {
  computeUserRiasecVector,
  computeMajorFit,
  computeCombinedRankingScore,
  topDimensions,
  computeDimensionGaps,
  findDivergentDimensions,
  primaryDimension,
  selectQuestionsForDimensions,
  RIASEC_DIMENSIONS,
  type RiasecQuestion,
} from "./riasec";
import tiebreakerQuestionsData from "../data/tiebreaker_questions.json";

// اختبارات تثبّت السلوك الحالي لمحرك RIASEC قبل أي إعادة هيكلة (فصل السوق
// عن الترتيب، محور القرابة الدراسية، إلخ) — أي تعديل مستقبلي يكسر هذه
// الاختبارات يعني انحداراً غير مقصود في أخطر منطق حسابي بالمنصة.

describe("computeUserRiasecVector", () => {
  const questions: RiasecQuestion[] = [
    { id: "q1", text: "", dimensions: { R: 8 } },
    { id: "q2", text: "", dimensions: { I: 6, C: 2 } },
    { id: "q3", text: "", dimensions: { A: 5, C: -2 } },
  ];

  it("يُرجع 50 (منتصف المدى) لكل الأبعاد عند عدم الإجابة على أي سؤال", () => {
    const vec = computeUserRiasecVector({}, questions);
    RIASEC_DIMENSIONS.forEach((d) => expect(vec[d]).toBe(50));
  });

  it("يُرجع 100 للبُعد عند أقصى إجابة موجبة ممكنة (نعم=1) على سؤال وزنه موجب بحت", () => {
    const vec = computeUserRiasecVector({ q1: 1 }, questions);
    expect(vec.R).toBe(100);
  });

  it("يُرجع 0 للبُعد عند أقصى إجابة معاكسة ممكنة (لا=-1) على سؤال وزنه موجب بحت", () => {
    const vec = computeUserRiasecVector({ q1: -1 }, questions);
    expect(vec.R).toBe(0);
  });

  it("يحسب بُعداً بوزنين متعاكسي الإشارة (سؤال إما/أو) بشكل صحيح: نعم يرفع البُعد الموجب ويخفض السالب", () => {
    // q3: A:5, C:-2 -- الإجابة "نعم" (ans=1) يجب أن ترفع A نحو الأقصى وتخفض C
    const vecYes = computeUserRiasecVector({ q3: 1 }, questions);
    const vecNo = computeUserRiasecVector({ q3: -1 }, questions);
    expect(vecYes.A).toBeGreaterThan(vecNo.A);
    expect(vecYes.C).toBeLessThan(vecNo.C);
  });

  it("يُبقي القيمة ضمن [0,100] دائماً حتى مع مدخلات متطرفة", () => {
    const vec = computeUserRiasecVector({ q1: 1, q2: 1, q3: 1 }, questions);
    RIASEC_DIMENSIONS.forEach((d) => {
      expect(vec[d]).toBeGreaterThanOrEqual(0);
      expect(vec[d]).toBeLessThanOrEqual(100);
    });
  });

  it("إجابة 'ربما' (0.5) تقع بين إجابتي نعم ولا على نفس البُعد", () => {
    const vecYes = computeUserRiasecVector({ q1: 1 }, questions).R;
    const vecMaybe = computeUserRiasecVector({ q1: 0.5 }, questions).R;
    const vecNo = computeUserRiasecVector({ q1: -1 }, questions).R;
    expect(vecMaybe).toBeGreaterThan(vecNo);
    expect(vecMaybe).toBeLessThan(vecYes);
  });
});

describe("computeMajorFit", () => {
  it("يُرجع 100 عند تطابق تام بين متجه المستخدم وبروفايل التخصص (بعد الضرب في 10)", () => {
    const userVector = { R: 80, I: 60, A: 20, S: 30, E: 40, C: 50 };
    const profile = { R: 8, I: 6, A: 2, S: 3, E: 4, C: 5 };
    expect(computeMajorFit(userVector, profile)).toBe(100);
  });

  it("يُرجع 0 عند أقصى تعاكس ممكن (0 مقابل 100 على كل بُعد)", () => {
    const userVector = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    const profile = { R: 10, I: 10, A: 10, S: 10, E: 10, C: 10 };
    expect(computeMajorFit(userVector, profile)).toBe(0);
  });

  it("لا يخرج عن مدى [0,100] أبداً", () => {
    const fit = computeMajorFit({ R: 100, I: 100, A: 100, S: 100, E: 100, C: 100 }, {});
    expect(fit).toBeGreaterThanOrEqual(0);
    expect(fit).toBeLessThanOrEqual(100);
  });

  it("تعامل الأبعاد الغائبة من بروفايل التخصص كصفر", () => {
    const userVector = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    const fitEmpty = computeMajorFit(userVector, {});
    const fitZero = computeMajorFit(userVector, { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 });
    expect(fitEmpty).toBe(fitZero);
  });
});

describe("computeCombinedRankingScore", () => {
  it("افتراضياً (بلا ترجيح من الطالب) السوق لا يؤثر إطلاقاً على الترتيب -- التوافق وحده يحكم", () => {
    expect(computeCombinedRankingScore(72, 1.5)).toBe(72);
    expect(computeCombinedRankingScore(72, 0.5)).toBe(72);
    expect(computeCombinedRankingScore(72, 1)).toBe(72);
  });

  it("معامل سوق = 1 (محايد) لا يغيّر نسبة التوافق حتى مع ترجيح كامل من الطالب", () => {
    expect(computeCombinedRankingScore(72, 1, 1)).toBe(72);
  });

  it("عند ترجيح الطالب الكامل (studentMarketWeight=1): معامل سوق > 1 يرفع الدرجة، ومعامل < 1 يخفضها", () => {
    const base = computeCombinedRankingScore(70, 1, 1);
    expect(computeCombinedRankingScore(70, 1.5, 1)).toBeGreaterThan(base);
    expect(computeCombinedRankingScore(70, 0.5, 1)).toBeLessThan(base);
  });

  it("عند ترجيح جزئي (0.5) يكون تأثير السوق نصف تأثيره الأقصى", () => {
    const full = computeCombinedRankingScore(70, 1.5, 1) - 70;
    const half = computeCombinedRankingScore(70, 1.5, 0.5) - 70;
    expect(half).toBeCloseTo(full / 2, 5);
  });

  it("لا يقلب أبداً فارق توافق حقيقي أكبر من مدى تأثير السوق الأقصى (±7.5 عند مضاعفات 0.5-1.5) حتى مع ترجيح كامل", () => {
    const highFitLowMarket = computeCombinedRankingScore(90, 0.5, 1); // 90 - 7.5 = 82.5
    const lowFitHighMarket = computeCombinedRankingScore(75, 1.5, 1); // 75 + 7.5 = 82.5
    // فارق التوافق الحقيقي هنا 15 نقطة -- يجب ألا ينقلب الترتيب
    expect(highFitLowMarket).toBeGreaterThanOrEqual(lowFitHighMarket);
  });

  it("يحدّ (clamp) وزن الطالب ضمن [0,1] حتى لو مُرِّرت قيمة خارج المدى", () => {
    const overWeighted = computeCombinedRankingScore(70, 1.5, 5);
    const fullWeighted = computeCombinedRankingScore(70, 1.5, 1);
    expect(overWeighted).toBe(fullWeighted);
  });
});

describe("topDimensions", () => {
  it("يُرجع أعلى n بُعداً مرتّبة تنازلياً", () => {
    const vec = { R: 10, I: 90, A: 50, S: 20, E: 70, C: 30 };
    const top2 = topDimensions(vec, 2);
    expect(top2.map((d) => d.dimension)).toEqual(["I", "E"]);
  });

  it("القيمة الافتراضية لعدد الأبعاد هي 2", () => {
    const vec = { R: 10, I: 90, A: 50, S: 20, E: 70, C: 30 };
    expect(topDimensions(vec)).toHaveLength(2);
  });
});

describe("computeDimensionGaps", () => {
  it("يُرجع الأبعاد الستة كاملة دائماً، لا أعلى بُعدين فقط", () => {
    const vec = { R: 50, I: 50, A: 50, S: 50, E: 50, C: 50 };
    const gaps = computeDimensionGaps(vec, { R: 5, I: 5, A: 5, S: 5, E: 5, C: 5 });
    expect(gaps).toHaveLength(6);
    expect(gaps.map((g) => g.dimension).sort()).toEqual([...RIASEC_DIMENSIONS].sort());
  });

  it("يحسب الفارق بالإشارة الصحيحة: موجب حين يفوق المستخدم التخصص", () => {
    const vec = { R: 80, I: 50, A: 50, S: 50, E: 50, C: 50 };
    const gaps = computeDimensionGaps(vec, { R: 3 }); // بروفايل التخصص 30 بعد الضرب في 10
    const rGap = gaps.find((g) => g.dimension === "R")!;
    expect(rGap.gap).toBe(50); // 80 - 30
  });

  it("يحسب الفارق بالإشارة الصحيحة: سالب حين يتطلب التخصص أكثر مما يميل له المستخدم", () => {
    const vec = { R: 20, I: 50, A: 50, S: 50, E: 50, C: 50 };
    const gaps = computeDimensionGaps(vec, { R: 9 }); // بروفايل التخصص 90 بعد الضرب في 10
    const rGap = gaps.find((g) => g.dimension === "R")!;
    expect(rGap.gap).toBe(-70); // 20 - 90
  });

  it("مرتّب تنازلياً بالقيمة المطلقة للفارق (أبرز فجوة أولاً بصرف النظر عن إشارتها)", () => {
    const vec = { R: 90, I: 10, A: 50, S: 50, E: 50, C: 50 };
    // R: 90-50=40 (موجب) | I: 10-90=-80 (سالب لكن أكبر قيمة مطلقة)
    const gaps = computeDimensionGaps(vec, { R: 5, I: 9, A: 5, S: 5, E: 5, C: 5 });
    expect(gaps[0].dimension).toBe("I");
    expect(gaps[1].dimension).toBe("R");
  });

  it("تعامل الأبعاد الغائبة من بروفايل التخصص كصفر", () => {
    const vec = { R: 50, I: 50, A: 50, S: 50, E: 50, C: 50 };
    const gaps = computeDimensionGaps(vec, {});
    gaps.forEach((g) => expect(g.majorScore).toBe(0));
  });
});

// اختُرِج findDivergentDimensions/selectQuestionsForDimensions من منطق
// التكيّف متعددة الجولات في app/quiz/page.tsx (2026-08-11) لاستخدامهما أيضاً
// في ميزة "حسم الحيرة" المستقلة — نفس مصدر الحقيقة لكلا التدفقين.

describe("findDivergentDimensions", () => {
  it("يُرجع أكبر n بُعداً تبايناً بين ملفَّي تخصصين، تنازلياً", () => {
    const a = { R: 9, I: 5, A: 5, S: 5, E: 5, C: 5 };
    const b = { R: 1, I: 5, A: 8, S: 5, E: 5, C: 5 };
    // R: فرق 8 | A: فرق 3 | الباقي: فرق 0
    expect(findDivergentDimensions(a, b, 2)).toEqual(["R", "A"]);
  });

  it("يحترم n المخصَّص (1 بدل الافتراضي 2)", () => {
    const a = { R: 9, I: 5, A: 5, S: 5, E: 5, C: 5 };
    const b = { R: 1, I: 5, A: 8, S: 5, E: 5, C: 5 };
    expect(findDivergentDimensions(a, b, 1)).toEqual(["R"]);
  });

  it("تعامل الأبعاد الغائبة من أي ملف كصفر", () => {
    const a = {};
    const b = { R: 10 };
    expect(findDivergentDimensions(a, b, 1)).toEqual(["R"]);
  });
});

describe("primaryDimension", () => {
  it("يختار البُعد الأعلى وزناً مطلقاً ضمن سؤال متعدّد الأبعاد", () => {
    const q: RiasecQuestion = { id: "q1", text: "", dimensions: { A: 5, C: -8 } };
    expect(primaryDimension(q)).toBe("C"); // |−8| > |5|
  });

  it("يُرجع null لسؤال بلا أبعاد", () => {
    const q: RiasecQuestion = { id: "q1", text: "", dimensions: {} };
    expect(primaryDimension(q)).toBeNull();
  });
});

describe("selectQuestionsForDimensions", () => {
  const pool: RiasecQuestion[] = [
    { id: "q1", text: "", dimensions: { R: 8 } },
    { id: "q2", text: "", dimensions: { I: 8 } },
    { id: "q3", text: "", dimensions: { A: 8, R: 2 } }, // R ثانوي فقط -- لا يجب أن يُطابَق بحثاً عن R
  ];

  it("يفلتر بالبُعد الأساسي فقط -- بُعد ثانوي مطابق لا يكفي", () => {
    const selected = selectQuestionsForDimensions(pool, ["R"]);
    expect(selected.map((q) => q.id)).toEqual(["q1"]); // لا q3 رغم احتوائه R كثانوي
  });

  it("يقبل مصفوفة أو Set لنفس النتيجة", () => {
    expect(selectQuestionsForDimensions(pool, ["I"])).toEqual(selectQuestionsForDimensions(pool, new Set(["I"])));
  });

  it("يستبعد معرّفات سبق طرحها", () => {
    const selected = selectQuestionsForDimensions(pool, ["R"], new Set(["q1"]));
    expect(selected).toEqual([]);
  });

  it("فحص انحداري بالبنك الحقيقي: أي زوج من الأبعاد الستة يُنتج 6 أسئلة بالضبط", () => {
    for (let i = 0; i < RIASEC_DIMENSIONS.length; i++) {
      for (let j = i + 1; j < RIASEC_DIMENSIONS.length; j++) {
        const selected = selectQuestionsForDimensions(tiebreakerQuestionsData as RiasecQuestion[], [
          RIASEC_DIMENSIONS[i],
          RIASEC_DIMENSIONS[j],
        ]);
        expect(selected.length).toBe(6);
      }
    }
  });
});
