import { describe, it, expect } from "vitest";
import { computeValidityRiskScore, computeAcquiescenceIndex } from "./validity";
import type { ContradictionPair, ScoredQuestionLike } from "./validity";

const NO_CONTRADICTIONS: ContradictionPair[] = [];
const CONTRADICTION_PAIRS: ContradictionPair[] = [
  { a: "q1", b: "q2", message: "تناقض 1" },
  { a: "q3", b: "q4", message: "تناقض 2" },
  { a: "q5", b: "q6", message: "تناقض 3" },
  { a: "q7", b: "q8", message: "تناقض 4" },
];

function baselineAnswers(n = 10): Record<string, number> {
  // نمط متمايز واقعي (لا خط مستقيم، لا حياد مفرط) كي لا يُثير أي مكوّن كشف بالخطأ.
  const values = [1, -1, 1, -1, 0, 1, -1, 1, -1, 0];
  const answers: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    answers[`base_q${i}`] = values[i % values.length];
  }
  return answers;
}

describe("computeValidityRiskScore", () => {
  it("نمط إجابات طبيعي متمايز بلا أي تناقض أو سؤال تحقق فاشل → low", () => {
    const result = computeValidityRiskScore(baselineAnswers(), {}, {}, NO_CONTRADICTIONS);
    expect(result.band).toBe("low");
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
    expect(result.triggeredContradictions).toEqual([]);
  });

  it("إجابات شبه متطابقة عبر كل الأسئلة (straight-lining ≥85%) تُصعِّد النتيجة", () => {
    const answers: Record<string, number> = {};
    for (let i = 0; i < 20; i++) answers[`q${i}`] = 1;
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.reasons).toContain("إجابات شبه متطابقة عبر كل الأسئلة");
  });

  it("تكرار كبير (70-85%) لنفس الإجابة يُصعِّد جزئياً فقط، أقل من straight-lining الكامل", () => {
    const answers: Record<string, number> = {};
    for (let i = 0; i < 10; i++) answers[`q${i}`] = i < 7 ? 1 : -1; // 70% نفس الإجابة بالضبط
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS);
    expect(result.reasons).toContain("تكرار كبير لنفس الإجابة عبر الأسئلة");
    expect(result.reasons).not.toContain("إجابات شبه متطابقة عبر كل الأسئلة");
  });

  it("تناقض منطقي واحد فقط يُصعِّد بأقل درجة، ويبقى ضمن triggeredContradictions", () => {
    const answers = { ...baselineAnswers(), q1: 1, q2: 1 };
    const result = computeValidityRiskScore(answers, {}, {}, [CONTRADICTION_PAIRS[0]]);
    expect(result.triggeredContradictions).toHaveLength(1);
    expect(result.reasons).toContain("تناقض منطقي واحد بين إجاباتك");
  });

  it("تناقضان مُفعَّلان يكفيان وحدهما لبلوغ medium (إصلاح موثَّق: لم يعد يعتمد على سقف +2 ثابت)", () => {
    const answers = { ...baselineAnswers(), q1: 1, q2: 1, q3: 1, q4: 1 };
    const result = computeValidityRiskScore(answers, {}, {}, CONTRADICTION_PAIRS.slice(0, 2));
    expect(result.triggeredContradictions).toHaveLength(2);
    expect(result.band).not.toBe("low");
  });

  it("أربعة تناقضات فأكثر تكفي وحدها لبلوغ high", () => {
    const answers = {
      ...baselineAnswers(),
      q1: 1,
      q2: 1,
      q3: 1,
      q4: 1,
      q5: 1,
      q6: 1,
      q7: 1,
      q8: 1,
    };
    const result = computeValidityRiskScore(answers, {}, {}, CONTRADICTION_PAIRS);
    expect(result.triggeredContradictions).toHaveLength(4);
    expect(result.band).toBe("high");
    expect(result.reasons).toContain("تناقضات منطقية متعددة وقوية بين إجاباتك");
  });

  it("عدم الإجابة كما طُلب في سؤال التحقق من الانتباه يُصعِّد النتيجة", () => {
    const result = computeValidityRiskScore(baselineAnswers(), { q_attention_check: 1 }, {}, NO_CONTRADICTIONS);
    expect(result.reasons).toContain("لم تُجب كما طُلب في سؤال التحقق من الانتباه");
    expect(result.score).toBeGreaterThanOrEqual(4);
  });

  it("إجابتان متناقضتان حول مساعدة الآخرين (توأم معكوس) تُكتشَفان", () => {
    const answers = { ...baselineAnswers(), q_help_others: 1 };
    const result = computeValidityRiskScore(answers, { q_help_others_reverse: 1 }, {}, NO_CONTRADICTIONS);
    expect(result.reasons).toContain("إجابتان متناقضتان منطقياً حول مساعدة الآخرين");
  });

  it("إجابة غير واقعية في مقياس الصدق (lie scale) تُسجَّل ضمن الأسباب", () => {
    const result = computeValidityRiskScore(baselineAnswers(), { q_lie_scale: 1 }, {}, NO_CONTRADICTIONS);
    expect(result.reasons).toContain("إجابة غير واقعية إحصائياً في سؤال الصدق");
  });

  it("موافقة على أغلب الأسئلة (>85% نعم) تُصعِّد النتيجة", () => {
    const answers: Record<string, number> = {};
    for (let i = 0; i < 20; i++) answers[`q${i}`] = i < 18 ? 1 : 0; // 90% نعم
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS);
    expect(result.reasons).toContain("موافقة على أغلب الأسئلة تقريباً بلا تمايز واضح");
  });

  it('ميل مفرط لإجابة "ربما" الحيادية (>70% حياد) يُصعِّد النتيجة', () => {
    const answers: Record<string, number> = {};
    for (let i = 0; i < 10; i++) answers[`q${i}`] = i < 8 ? 0 : 1; // 80% حياد
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS);
    expect(result.reasons).toContain('ميل مفرط لإجابة "ربما" الحيادية');
  });

  it("إجابات سريعة جداً (<1500ms بالمتوسط) تُصعِّد النتيجة", () => {
    const timings: Record<string, number> = { q1: 500, q2: 700, q3: 900 };
    const result = computeValidityRiskScore(baselineAnswers(), {}, timings, NO_CONTRADICTIONS);
    expect(result.reasons).toContain("إجابات سريعة جداً قد لا تعكس تفكيراً كافياً بكل سؤال");
  });

  it("إجابات بطيئة كافية (≥1500ms بالمتوسط) لا تُثير تحذير السرعة", () => {
    const timings: Record<string, number> = { q1: 3000, q2: 4000, q3: 5000 };
    const result = computeValidityRiskScore(baselineAnswers(), {}, timings, NO_CONTRADICTIONS);
    expect(result.reasons).not.toContain("إجابات سريعة جداً قد لا تعكس تفكيراً كافياً بكل سؤال");
  });

  it("بلا معطى زمني إطلاقاً (سجلّ فارغ) لا يُثار تحذير السرعة أبداً", () => {
    const result = computeValidityRiskScore(baselineAnswers(), {}, {}, NO_CONTRADICTIONS);
    expect(result.reasons).not.toContain("إجابات سريعة جداً قد لا تعكس تفكيراً كافياً بكل سؤال");
  });

  it("اتساق ضعيف داخل نفس البُعد (تصويت شبه متساوٍ) يُكتشَف عند تمرير questions", () => {
    const questions: ScoredQuestionLike[] = [
      { id: "d1", dimensions: { R: 1 } },
      { id: "d2", dimensions: { R: 1 } },
      { id: "d3", dimensions: { R: 1 } },
      { id: "d4", dimensions: { R: 1 } },
    ];
    // تصويت 2 مقابل 2 داخل نفس البُعد R -- ضجيج عشوائي بحت، لا خط مستقيم ولا حياد مفرط.
    const answers = { d1: 1, d2: -1, d3: 1, d4: -1 };
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS, questions);
    expect(result.reasons).toContain(
      "إجاباتك داخل نفس البُعد غير متسقة بشكل ملحوظ (نمط قد يوحي بعدم قراءة الأسئلة بعناية)"
    );
  });

  it("اتساق قوي داخل نفس البُعد (كل الإجابات بنفس الاتجاه) لا يُثير تحذير عدم الاتساق", () => {
    const questions: ScoredQuestionLike[] = [
      { id: "d1", dimensions: { R: 1 } },
      { id: "d2", dimensions: { R: 1 } },
      { id: "d3", dimensions: { R: -1 } }, // وزن سالب لكن نفس اتجاه الميل الحقيقي بعد ضرب الإشارة
    ];
    const answers = { d1: 1, d2: 1, d3: -1 };
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS, questions);
    expect(result.reasons).not.toContain(
      "إجاباتك داخل نفس البُعد غير متسقة بشكل ملحوظ (نمط قد يوحي بعدم قراءة الأسئلة بعناية)"
    );
  });

  it("بلا تمرير questions إطلاقاً: فحص الاتساق الداخلي غير مُفعَّل (لا يُحتسَب ضمن النتيجة)", () => {
    const answers = { d1: 1, d2: -1, d3: 1, d4: -1 };
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS);
    expect(result.reasons).not.toContain(
      "إجاباتك داخل نفس البُعد غير متسقة بشكل ملحوظ (نمط قد يوحي بعدم قراءة الأسئلة بعناية)"
    );
  });

  it("حدود النطاقات: نتيجة 0 هي دائماً low، ونتيجة ≥6 هي دائماً high", () => {
    const low = computeValidityRiskScore(baselineAnswers(), {}, {}, NO_CONTRADICTIONS);
    expect(low.score).toBe(0);
    expect(low.band).toBe("low");

    const high = computeValidityRiskScore(
      baselineAnswers(),
      { q_attention_check: 1 },
      {},
      CONTRADICTION_PAIRS.slice(0, 2),
      undefined
    );
    // سؤال التحقق (+4) + تناقضان (+3) = 7 ≥ 6
    const answersForHigh = { ...baselineAnswers(), q1: 1, q2: 1, q3: 1, q4: 1 };
    const result = computeValidityRiskScore(
      answersForHigh,
      { q_attention_check: 1 },
      {},
      CONTRADICTION_PAIRS.slice(0, 2)
    );
    expect(result.score).toBeGreaterThanOrEqual(6);
    expect(result.band).toBe("high");
  });

  it("مصفوفة إجابات فارغة تماماً لا تُسبِّب انهياراً وتُعيد نتيجة low", () => {
    const result = computeValidityRiskScore({}, {}, {}, NO_CONTRADICTIONS);
    expect(result.band).toBe("low");
    expect(result.score).toBe(0);
  });
});

// اختبارات مقياس الخمس نقاط (-1/-0.5/0/0.5/1) -- مرحلة 2026-09 من خطة إصلاح
// الخوارزمية. القاعدة الحاكمة: كل ما أعلاه بمقياس 3 نقاط يبقى صحيحاً حرفياً
// (تحقّقت الاختبارات أعلاه دون أي تعديل)؛ هذه الاختبارات تغطّي فقط ما هو
// جديد أو متدرّج بفضل الدقة الإضافية.
describe("computeValidityRiskScore — مقياس الخمس نقاط", () => {
  it("موافقة معتدلة (0.5) على زوج تناقض تُكتشَف تماماً كموافقة كاملة (>=0.5 صريحة لا >0 وحدها)", () => {
    const answers = { ...baselineAnswers(), q1: 0.5, q2: 0.5 };
    const result = computeValidityRiskScore(answers, {}, {}, [CONTRADICTION_PAIRS[0]]);
    expect(result.triggeredContradictions).toHaveLength(1);
    expect(result.reasons).toContain("تناقض منطقي واحد بين إجاباتك");
  });

  it("موافقة معتدلة (0.5) واحدة فقط من زوج تناقض (الطرف الآخر محايد) لا تُطلِق التناقض", () => {
    const answers = { ...baselineAnswers(), q1: 0.5, q2: 0 };
    const result = computeValidityRiskScore(answers, {}, {}, [CONTRADICTION_PAIRS[0]]);
    expect(result.triggeredContradictions).toHaveLength(0);
  });

  it("كل الإجابات ±1 بلا أي درجة وسيطة = إشارة 'بلا درجة وسيطة' (الأقوى)", () => {
    const answers: Record<string, number> = {};
    // إجابات طرفية متنوّعة (لا خط مستقيم -- نصفها 1 ونصفها -1) كي لا يُثير
    // modeRatio بالخطأ.
    for (let i = 0; i < 20; i++) answers[`q${i}`] = i % 2 === 0 ? 1 : -1;
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS);
    expect(result.reasons).toContain("كل إجاباتك غير المحايدة في أقصى طرفي المقياس، بلا أي درجة وسيطة واحدة");
  });

  it("درجة وسيطة واحدة تُسقط الإشارة الأقوى إلى تحذير الميل الشديد للأطراف", () => {
    const answers: Record<string, number> = {};
    for (let i = 0; i < 20; i++) answers[`q${i}`] = i % 2 === 0 ? 1 : -1;
    answers.q1 = -0.5; // 19 من 20 طرفية: فوق عتبة pExtreme ودون شرط "بلا وسيطة"
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS);
    expect(result.reasons).toContain("ميل شديد لأقصى طرفي مقياس الإجابة في كل الأسئلة تقريباً، بلا أي إجابة وسيطة");
    expect(result.reasons).not.toContain("كل إجاباتك غير المحايدة في أقصى طرفي المقياس، بلا أي درجة وسيطة واحدة");
  });

  it("إجابات معتدلة متنوّعة (0.5/-0.5 لا 1/-1) لا تُثير تحذير الميل الشديد للأطراف", () => {
    const answers: Record<string, number> = {};
    for (let i = 0; i < 20; i++) answers[`q${i}`] = i % 2 === 0 ? 0.5 : -0.5;
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS);
    expect(result.reasons).not.toContain(
      "ميل شديد لأقصى طرفي مقياس الإجابة في كل الأسئلة تقريباً، بلا أي إجابة وسيطة"
    );
  });

  it("انحراف جزئي (0.5) واحد عن سؤال التحقق من الانتباه أخفّ من انحراف كامل (1)، لكن كلاهما يُصعِّد", () => {
    const partial = computeValidityRiskScore(baselineAnswers(), { q_attention_check: 0.5 }, {}, NO_CONTRADICTIONS);
    const full = computeValidityRiskScore(baselineAnswers(), { q_attention_check: 1 }, {}, NO_CONTRADICTIONS);
    expect(partial.reasons).toContain("لم تُجب كما طُلب في سؤال التحقق من الانتباه");
    expect(partial.score).toBeGreaterThan(0);
    expect(partial.score).toBeLessThan(full.score);
  });

  it("موافقة جزئية (0.5) على مقياس الصدق تُسجَّل ضمن الأسباب لكنها وحدها لا تكفي لبلوغ عتبة تركيبة sdScore>=1 (بخلاف الموافقة الكاملة)", () => {
    // pYes > 0.6 مطلوب لتفعيل تركيبة "الرغبة بصورة مثالية" (sdScore>=1 &&
    // pYes>0.6) -- هنا 8 من 10 نعم = 80%.
    const highYesAnswers: Record<string, number> = {};
    for (let i = 0; i < 10; i++) highYesAnswers[`q${i}`] = i < 8 ? 1 : -1;

    const partial = computeValidityRiskScore(highYesAnswers, { q_lie_scale: 0.5 }, {}, NO_CONTRADICTIONS);
    const full = computeValidityRiskScore(highYesAnswers, { q_lie_scale: 1 }, {}, NO_CONTRADICTIONS);

    expect(partial.reasons).toContain("إجابة غير واقعية إحصائياً في سؤال الصدق");
    expect(full.reasons).toContain("نمط إجابات يوحي برغبة في تقديم صورة مثالية");
    // موافقة جزئية (sdScore=0.5) لا تبلغ عتبة sdScore>=1 وحدها -- التركيبة لا تُطلَق
    expect(partial.reasons).not.toContain("نمط إجابات يوحي برغبة في تقديم صورة مثالية");
    expect(partial.score).toBeLessThan(full.score);
  });

  it("عتبة الخط المستقيم المُعاد معايرتها (0.65/0.80 بدل 0.70/0.85) تكتشف تكراراً جزئياً على مقياس أدقّ", () => {
    const answers: Record<string, number> = {};
    // 65% من الإجابات نفس القيمة الحرفية (0.5) بالضبط -- تحت عتبة 3 نقاط
    // القديمة (0.70) لكن فوق العتبة الجديدة (0.65).
    for (let i = 0; i < 20; i++) answers[`q${i}`] = i < 13 ? 0.5 : -0.5;
    const result = computeValidityRiskScore(answers, {}, {}, NO_CONTRADICTIONS);
    expect(result.reasons).toContain("تكرار كبير لنفس الإجابة عبر الأسئلة");
  });
});

describe("مؤشر الموافقة المتوازن ومقياس الصدق (البنك ذو البنود المعكوسة)", () => {
  const balanced = [
    { id: "p1", dimensions: { R: 8 } },
    { id: "p2", dimensions: { S: 7 } },
    { id: "r1", dimensions: { R: -7 } },
    { id: "r2", dimensions: { S: -7 } },
  ];

  it("ميل حقيقي (يوافق البند ويخالف معكوسه) = مؤشر قرب الصفر", () => {
    expect(computeAcquiescenceIndex({ p1: 1, p2: 0.5, r1: -1, r2: -0.5 }, balanced)).toBeCloseTo(0);
  });

  it("من يوافق على العبارة وعكسها معاً يُكشف كموافقة تلقائية", () => {
    const answers = { p1: 1, p2: 1, r1: 1, r2: 0.5 };
    expect(computeAcquiescenceIndex(answers, balanced)).toBeGreaterThan(0.35);
    const result = computeValidityRiskScore(answers, {}, {}, [], balanced);
    expect(result.band).not.toBe("low");
  });

  it("بنك أحادي الاتجاه لا يسمح بالمؤشر (null) فلا يُطلق إنذاراً", () => {
    expect(computeAcquiescenceIndex({ p1: 1, p2: 1 }, balanced.slice(0, 2))).toBeNull();
  });

  it("موافقة كاملة على «لم أفشل قط» وحدها توصي بالمراجعة (medium)", () => {
    const result = computeValidityRiskScore({ p1: 1, r1: -1, p2: 0.5, r2: -0.5 }, { q_lie_scale: 1 }, {}, [], balanced);
    expect(result.band).toBe("medium");
  });
});
