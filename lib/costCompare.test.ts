import { describe, it, expect } from "vitest";
import {
  computeEffectiveFee,
  splitOfferings,
  sortByFeeAscending,
  computeCheapestHighlight,
  offeringKey,
} from "./costCompare";
import type { UniversityOffering } from "./majorMatcher";

function offering(overrides: Partial<UniversityOffering> = {}): UniversityOffering {
  return {
    universityId: "u1",
    universityName: "جامعة الاختبار",
    universityType: "أهلية",
    universityRanking: null,
    province: "بغداد",
    collegeId: "c1",
    collegeName: "كلية الاختبار",
    departmentName: "قسم الاختبار",
    departmentBranches: ["علمي"],
    sessions: ["صباحي"],
    averageGrades: { صباحي: null, مسائي: null },
    cutoffs: [],
    isDirectAdmission: true,
    confidence: 100,
    ...overrides,
  };
}

describe("computeEffectiveFee", () => {
  it("يختار الأرخص حين تُوجَد قيمتان حقيقيتان معاً", () => {
    expect(computeEffectiveFee({ صباحي: 3000000, مسائي: 2000000 })).toBe(2000000);
  });
  it("يستخدم القيمة المنفردة حين تغيب الأخرى", () => {
    expect(computeEffectiveFee({ صباحي: 3000000, مسائي: null })).toBe(3000000);
    expect(computeEffectiveFee({ صباحي: null, مسائي: 2500000 })).toBe(2500000);
  });
  it("null حين تغيب القيمتان معاً", () => {
    expect(computeEffectiveFee({ صباحي: null, مسائي: null })).toBeNull();
  });
  it("null حين يغيب الحقل tuitionFees بالكامل", () => {
    expect(computeEffectiveFee(undefined)).toBeNull();
  });
});

describe("splitOfferings", () => {
  it("يفصل الحكومية عن الأهلية بشكل صحيح", () => {
    const offerings = [
      offering({ universityType: "أهلية", universityId: "priv1" }),
      offering({ universityType: "حكومية", universityId: "gov1" }),
    ];
    const { private: priv, government } = splitOfferings(offerings);
    expect(priv).toHaveLength(1);
    expect(government).toHaveLength(1);
  });

  it("يستبعد الجامعات غير الموثوقة بنيوياً (ishtar) إلى مجموعة منفصلة", () => {
    const offerings = [
      offering({ universityType: "أهلية", universityId: "ishtar" }),
      offering({ universityType: "أهلية", universityId: "turath" }),
    ];
    const { private: priv, unverifiedPrivate } = splitOfferings(offerings);
    expect(priv.map((o) => o.universityId)).toEqual(["turath"]);
    expect(unverifiedPrivate.map((o) => o.universityId)).toEqual(["ishtar"]);
  });
});

describe("sortByFeeAscending", () => {
  it("يرتّب المُسعَّرة تصاعدياً، وغير المُسعَّرة في النهاية", () => {
    const offerings = [
      { ...offering({ universityId: "b" }), effectiveFee: null },
      { ...offering({ universityId: "c" }), effectiveFee: 3000000 },
      { ...offering({ universityId: "a" }), effectiveFee: 1000000 },
    ];
    const sorted = sortByFeeAscending(offerings);
    expect(sorted.map((o) => o.universityId)).toEqual(["a", "c", "b"]);
  });
});

describe("computeCheapestHighlight", () => {
  it("يُبرِز العرض الأرخص من بين المُسعَّرة حين لا تعادل", () => {
    const offerings = [
      { ...offering({ universityId: "a", collegeId: "ca", departmentName: "قسم أ" }), effectiveFee: 3000000 },
      { ...offering({ universityId: "b", collegeId: "cb", departmentName: "قسم ب" }), effectiveFee: 1500000 },
    ];
    expect(computeCheapestHighlight(offerings)).toBe(offeringKey(offerings[1]));
  });

  it("لا إبراز عند تعادل الحدّ الأدنى", () => {
    const offerings = [
      { ...offering({ universityId: "a" }), effectiveFee: 2000000 },
      { ...offering({ universityId: "b" }), effectiveFee: 2000000 },
    ];
    expect(computeCheapestHighlight(offerings)).toBeNull();
  });

  it("لا إبراز مع أقل من عرضين مُسعَّرين (لا معنى لمقارنة عنصر واحد)", () => {
    const offerings = [{ ...offering({ universityId: "a" }), effectiveFee: 2000000 }];
    expect(computeCheapestHighlight(offerings)).toBeNull();
  });

  it("يتجاهل العروض غير المُسعَّرة عند حساب الأرخص (لا تُسقِط الإبراز كله)", () => {
    // هذا الفرق الجوهري عن lib/compareMajors.ts -- عرض واحد بلا سعر من أصل
    // عدد كبير لا يجب أن يُسقِط الإبراز عن بقية العروض المُسعَّرة فعلياً.
    const offerings = [
      { ...offering({ universityId: "a" }), effectiveFee: 3000000 },
      { ...offering({ universityId: "b" }), effectiveFee: 1500000 },
      { ...offering({ universityId: "c" }), effectiveFee: null },
    ];
    expect(computeCheapestHighlight(offerings)).toBe(offeringKey(offerings[1]));
  });

  it("لا إبراز إن كان عرض مُسعَّر واحد فقط وسط عروض غير مُسعَّرة", () => {
    const offerings = [
      { ...offering({ universityId: "a" }), effectiveFee: 3000000 },
      { ...offering({ universityId: "b" }), effectiveFee: null },
    ];
    expect(computeCheapestHighlight(offerings)).toBeNull();
  });
});
