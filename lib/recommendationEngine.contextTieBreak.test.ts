import { describe, it, expect } from "vitest";
import {
  applyContextTieBreak,
  AMBIGUITY_THRESHOLD,
  CONTEXT_TIEBREAK_MAX_BONUS,
  type RankedMajor,
} from "./recommendationEngine";
import majorContextIndexData from "../data/major_context_index.json";
import type { ContextVector } from "./contextAxisMap";

// المرحلة 3 من خطة إصلاح الخوارزمية -- إثبات مباشر (لا افتراض) أن بصمة
// السياق تحسّن تمييز أزواج "التوأمين" (M2 من خطة القياس) حيث RIASEC وحده
// غير كافٍ (بروفايلا electrical_engineering/electrical_tech شبه متطابقين
// بتصميم موثَّق في data/major_riasec_profiles.json._meta). المشهد أدناه
// مأخوذ حرفياً من lib/recommendationEngine.characterization.test.ts
// ("يطلق ترجيحاً عند فارق أقل من AMBIGUITY_THRESHOLD... 80 مقابل 77")
// -- نفس فارق حقيقي رصده الاختبار التوصيفي قبل هذه المرحلة.

const CONTEXT_INDEX = majorContextIndexData.contexts as Record<string, ContextVector>;

function pair(scoreA: number, scoreB: number): RankedMajor[] {
  return [
    {
      id: "electrical_engineering",
      name: "هندسة الكهرباء",
      category: "هندسة",
      marketMultiplier: 1,
      fitPercent: scoreA,
      riasecFitPercent: scoreA,
      subjectFitPercent: null,
      combinedScore: scoreA,
    },
    {
      id: "electrical_tech",
      name: "تقنيات الكهرباء",
      category: "تقنيات",
      marketMultiplier: 1,
      fitPercent: scoreB,
      riasecFitPercent: scoreB,
      subjectFitPercent: null,
      combinedScore: scoreB,
    },
  ];
}

describe("applyContextTieBreak -- بصمة السياق تفصل زوجاً حقيقياً RIASEC وحده يفشل فيه", () => {
  it("طالب يميل بوضوح للتطبيقي يقلب الترتيب لصالح الدبلوم التقني ضمن نطاق الغموض", () => {
    // نفس سيناريو الاختبار التوصيفي بالضبط: هندسة الكهرباء 80، تقنيات
    // الكهرباء 77 (فارق 3 < AMBIGUITY_THRESHOLD=6). قبل هذه المرحلة، كان
    // هذا الفارق الضئيل يُحسَم فقط بأسئلة ترجيح RIASEC إضافية -- لا شيء
    // يلتقط أن الطالب فعلياً يفضّل "بناء أداة ملموسة" على "التعمق النظري"،
    // وهو بالضبط الفارق الحقيقي الموثَّق بين هذين التخصصين (study.studyNature).
    const ranked = pair(80, 77);
    const appliedPersonaVector: ContextVector = { appliedness: 100, quantitative: 50, humanContact: 50, fieldwork: 50 };

    const result = applyContextTieBreak(ranked, appliedPersonaVector, CONTEXT_INDEX);

    expect(result[0].id).toBe("electrical_tech");
    expect(result[1].id).toBe("electrical_engineering");
    expect(result[0].combinedScore).toBeGreaterThan(result[1].combinedScore);
  });

  it("طالب يميل بوضوح للنظري يبقي هندسة الكهرباء متصدّرة (لا قلب في الاتجاه المعاكس)", () => {
    const ranked = pair(80, 77);
    const theoreticalPersonaVector: ContextVector = { appliedness: 0, quantitative: 50, humanContact: 50, fieldwork: 50 };

    const result = applyContextTieBreak(ranked, theoreticalPersonaVector, CONTEXT_INDEX);

    expect(result[0].id).toBe("electrical_engineering");
    expect(result[1].id).toBe("electrical_tech");
  });

  it("طالب في منتصف المسافة تماماً بين بصمتَي التخصصين (62.5 = (55+70)/2) لا يغيّر الترتيب الأصلي", () => {
    // appliedness عند electrical_engineering=55 وelectrical_tech=70 --
    // منتصف المسافة بينهما (62.5) يعني عدم تفضيل أيّهما على الإطلاق عبر
    // هذا المحور، فلا يوجد أساس لأي ترجيح (bonus=0 بالضبط).
    const ranked = pair(80, 77);
    const indifferentVector: ContextVector = { appliedness: 62.5, quantitative: 50, humanContact: 50, fieldwork: 50 };

    const result = applyContextTieBreak(ranked, indifferentVector, CONTEXT_INDEX);

    expect(result[0].id).toBe("electrical_engineering");
    expect(result[1].combinedScore).toBe(77);
  });
});

describe("applyContextTieBreak -- ضمانات السلامة (لا يمسّ إلا نطاق الغموض)", () => {
  it("لا يقلب أبداً فارقاً غير غامض (>= AMBIGUITY_THRESHOLD) حتى مع أقوى إشارة سياق ممكنة", () => {
    const ranked = pair(90, 90 - AMBIGUITY_THRESHOLD); // فارق = العتبة تماماً، غير غامض
    const extremeVector: ContextVector = { appliedness: 100, quantitative: 50, humanContact: 50, fieldwork: 50 };

    const result = applyContextTieBreak(ranked, extremeVector, CONTEXT_INDEX);

    expect(result).toEqual(ranked); // بلا أي تعديل -- المصفوفة نفسها بالقيم
  });

  it("لا يمسّ إلا أفضل تخصصين -- الثالث فما بعده يبقى بلا تغيير", () => {
    const ranked: RankedMajor[] = [
      ...pair(80, 77),
      { id: "mechanical_engineering", name: "هندسة ميكانيك", category: "هندسة", marketMultiplier: 1, fitPercent: 60, riasecFitPercent: 60, subjectFitPercent: null, combinedScore: 60 },
    ];
    const appliedPersonaVector: ContextVector = { appliedness: 100, quantitative: 50, humanContact: 50, fieldwork: 50 };

    const result = applyContextTieBreak(ranked, appliedPersonaVector, CONTEXT_INDEX);

    expect(result[2]).toEqual(ranked[2]);
  });

  it("المكافأة القصوى الممكنة لا تتجاوز CONTEXT_TIEBREAK_MAX_BONUS أبداً", () => {
    const ranked = pair(80.001, 80); // أضيق فارق ممكن ضمن نطاق الغموض
    const appliedPersonaVector: ContextVector = { appliedness: 100, quantitative: 0, humanContact: 0, fieldwork: 0 };

    const result = applyContextTieBreak(ranked, appliedPersonaVector, CONTEXT_INDEX);
    const adjusted = result.find((m) => m.id === "electrical_tech")!;

    expect(adjusted.combinedScore - 80).toBeLessThanOrEqual(CONTEXT_TIEBREAK_MAX_BONUS);
  });

  it("لا تغيير حين تخصص واحد فقط في القائمة", () => {
    const single = pair(80, 77).slice(0, 1);
    const result = applyContextTieBreak(single, { appliedness: 100, quantitative: 50, humanContact: 50, fieldwork: 50 }, CONTEXT_INDEX);
    expect(result).toEqual(single);
  });

  it("لا تغيير حين لا توجد بصمة سياق لأحد التخصصين (معرّف غير معروف)", () => {
    const ranked: RankedMajor[] = [
      { id: "unknown_major_xyz", name: "غير معروف", category: "x", marketMultiplier: 1, fitPercent: 80, riasecFitPercent: 80, subjectFitPercent: null, combinedScore: 80 },
      { id: "electrical_tech", name: "تقنيات الكهرباء", category: "تقنيات", marketMultiplier: 1, fitPercent: 77, riasecFitPercent: 77, subjectFitPercent: null, combinedScore: 77 },
    ];
    const result = applyContextTieBreak(ranked, { appliedness: 100, quantitative: 50, humanContact: 50, fieldwork: 50 }, CONTEXT_INDEX);
    expect(result).toEqual(ranked);
  });
});

describe("applyContextTieBreak -- عتبة الحد الأدنى للفارق الحقيقي (CONTEXT_MIN_AXIS_DIVERGENCE)", () => {
  it("لا يرجّح بين تخصصين تتشابه بصمتاهما السياقية أيضاً (لا إشارة حقيقية للاستغلال)", () => {
    // renewable_energy/renewable_energy_tech: فارق appliedness الحقيقي 10
    // فقط (أضعف الأزواج الخمسة) -- لا يزال ≥ العتبة فيُرجَّح. هنا نبني
    // زوجاً اصطناعياً ببصمتين شبه متطابقتين (فارق 2 فقط) للتأكد أن العتبة
    // تمنع الترجيح حين لا يوجد فارق حقيقي أصلاً.
    const ranked = pair(80, 77);
    const tinyDivergenceIndex: Record<string, ContextVector> = {
      electrical_engineering: { appliedness: 50, quantitative: 50, humanContact: 50, fieldwork: 50 },
      electrical_tech: { appliedness: 52, quantitative: 50, humanContact: 50, fieldwork: 50 },
    };
    const result = applyContextTieBreak(ranked, { appliedness: 100, quantitative: 50, humanContact: 50, fieldwork: 50 }, tinyDivergenceIndex);
    expect(result).toEqual(ranked);
  });
});
