import { describe, it, expect } from "vitest";
import { rankDemandLevel, computeComparisonHighlights, sanitizeSelection, MAX_COMPARE_MAJORS } from "./compareMajors";
import type { DetailedMajorProfile } from "./majorProfileClient";

function profile(overrides: Partial<DetailedMajorProfile> = {}): DetailedMajorProfile {
  return { id: "x", ...overrides };
}

describe("rankDemandLevel", () => {
  it("يرتّب المستويات المعروفة تصاعدياً بشكل صحيح", () => {
    expect(rankDemandLevel("شديد الانخفاض")).toBeLessThan(rankDemandLevel("منخفض")!);
    expect(rankDemandLevel("منخفض")).toBeLessThan(rankDemandLevel("متوسط")!);
    expect(rankDemandLevel("متوسط")).toBeLessThan(rankDemandLevel("مرتفع")!);
  });

  it("متشبع بنفس رتبة شديد الانخفاض (كلاهما أسوأ حالة)", () => {
    expect(rankDemandLevel("متشبع")).toBe(rankDemandLevel("شديد الانخفاض"));
  });

  it("قيمة غير معروفة أو غائبة تُعيد null، لا تخميناً", () => {
    expect(rankDemandLevel("غير متوفر")).toBeNull();
    expect(rankDemandLevel(undefined)).toBeNull();
    expect(rankDemandLevel(null)).toBeNull();
  });
});

describe("computeComparisonHighlights", () => {
  it("يُبرِز التخصص صاحب أدنى حدّ قبول حين تتوفر بيانات الكل وبلا تعادل", () => {
    const entries = [
      { majorId: "a", profile: profile({ eligibility: { observedCutoffRange: { min: 90, max: 95 } } }) },
      { majorId: "b", profile: profile({ eligibility: { observedCutoffRange: { min: 70, max: 85 } } }) },
    ];
    expect(computeComparisonHighlights(entries).lowestCutoffMajorId).toBe("b");
  });

  it("لا إبراز عند تعادل الحدّ الأدنى بين تخصصين", () => {
    const entries = [
      { majorId: "a", profile: profile({ eligibility: { observedCutoffRange: { min: 80, max: 90 } } }) },
      { majorId: "b", profile: profile({ eligibility: { observedCutoffRange: { min: 80, max: 88 } } }) },
    ];
    expect(computeComparisonHighlights(entries).lowestCutoffMajorId).toBeNull();
  });

  it("لا إبراز حين ينقص أحد التخصصات بيانات القبول (لا مقارنة غير عادلة)", () => {
    const entries = [
      { majorId: "a", profile: profile({ eligibility: { observedCutoffRange: { min: 80, max: 90 } } }) },
      { majorId: "b", profile: profile({}) },
    ];
    expect(computeComparisonHighlights(entries).lowestCutoffMajorId).toBeNull();
  });

  it("يُبرِز التخصص صاحب أعلى مستوى طلب حين لا تعادل", () => {
    const entries = [
      { majorId: "a", profile: profile({ market: { demandLevel: "منخفض" } }) },
      { majorId: "b", profile: profile({ market: { demandLevel: "مرتفع" } }) },
    ];
    expect(computeComparisonHighlights(entries).highestDemandMajorId).toBe("b");
  });

  it("لا إبراز طلب حين أحد المستويات غير مُصنَّف (مثل 'غير متوفر')", () => {
    const entries = [
      { majorId: "a", profile: profile({ market: { demandLevel: "مرتفع" } }) },
      { majorId: "b", profile: profile({ market: { demandLevel: "غير متوفر" } }) },
    ];
    expect(computeComparisonHighlights(entries).highestDemandMajorId).toBeNull();
  });

  it("يتعامل مع بروفايل null (فشل جلب) بلا كسر ودون إبراز مضلِّل", () => {
    const entries = [
      { majorId: "a", profile: profile({ eligibility: { observedCutoffRange: { min: 80, max: 90 } } }) },
      { majorId: "b", profile: null },
    ];
    const result = computeComparisonHighlights(entries);
    expect(result.lowestCutoffMajorId).toBeNull();
    expect(result.highestDemandMajorId).toBeNull();
  });

  it("يعمل مع ثلاثة تخصصات (لا اثنين فقط)", () => {
    const entries = [
      { majorId: "a", profile: profile({ eligibility: { observedCutoffRange: { min: 90, max: 95 } } }) },
      { majorId: "b", profile: profile({ eligibility: { observedCutoffRange: { min: 60, max: 75 } } }) },
      { majorId: "c", profile: profile({ eligibility: { observedCutoffRange: { min: 80, max: 88 } } }) },
    ];
    expect(computeComparisonHighlights(entries).lowestCutoffMajorId).toBe("b");
  });
});

describe("sanitizeSelection", () => {
  it("يحذف التكرارات مع الحفاظ على أول ظهور", () => {
    expect(sanitizeSelection(["medicine", "law", "medicine"])).toEqual(["medicine", "law"]);
  });

  it("يحذف الخانات الفارغة", () => {
    expect(sanitizeSelection(["medicine", "", "law"])).toEqual(["medicine", "law"]);
  });

  it(`لا يتجاوز الحد الأقصى ${MAX_COMPARE_MAJORS}`, () => {
    expect(sanitizeSelection(["a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
    expect(sanitizeSelection(["a", "b", "c", "d"]).length).toBe(MAX_COMPARE_MAJORS);
  });

  it("مصفوفة فارغة تُعيد مصفوفة فارغة", () => {
    expect(sanitizeSelection([])).toEqual([]);
  });
});
