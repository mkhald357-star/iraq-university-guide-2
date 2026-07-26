import { describe, it, expect } from "vitest";
import { computeEligibility } from "./eligibility";
import type { UniversityOffering } from "./majorMatcher";

function makeOffering(overrides: Partial<UniversityOffering>): UniversityOffering {
  return {
    universityId: "u1",
    universityName: "جامعة الاختبار",
    universityType: "حكومية",
    universityRanking: null,
    province: "بغداد",
    collegeId: "c1",
    collegeName: "كلية الاختبار",
    departmentName: "قسم الاختبار",
    departmentBranches: ["علمي"],
    sessions: ["صباحي"],
    averageGrades: { صباحي: 80, مسائي: null },
    cutoffs: [],
    isDirectAdmission: false,
    confidence: 100,
    ...overrides,
  };
}

describe("computeEligibility", () => {
  it("مؤهَّل بالفرع وله عروض يبلغها معدله فعلاً", () => {
    const offerings = [
      makeOffering({ averageGrades: { صباحي: 70, مسائي: null } }),
      makeOffering({ averageGrades: { صباحي: 95, مسائي: null } }), // فوق معدله
    ];
    const result = computeEligibility("علمي", 80, offerings);
    expect(result.branchEligible).toBe(true);
    expect(result.reachableOffers).toHaveLength(1);
    expect(result.reachableOffers[0].averageGrades["صباحي"]).toBe(70);
    expect(result.lowestCutoff).toBe(70);
    expect(result.gapToLowest).toBe(10);
  });

  it("مؤهَّل بالفرع لكن بلا أي عرض يبلغه معدله حالياً (كلها أعلى من معدله)", () => {
    const offerings = [makeOffering({ averageGrades: { صباحي: 95, مسائي: null } })];
    const result = computeEligibility("علمي", 80, offerings);
    expect(result.branchEligible).toBe(true);
    expect(result.reachableOffers).toHaveLength(0);
    expect(result.lowestCutoff).toBe(95);
    expect(result.gapToLowest).toBe(-15);
  });

  it("غير مؤهَّل بالفرع إطلاقاً (فرعه غير مذكور في أي عرض)", () => {
    const offerings = [makeOffering({ departmentBranches: ["فنون"] })];
    const result = computeEligibility("علمي", 80, offerings);
    expect(result.branchEligible).toBe(false);
    expect(result.allowedBranches).toEqual(["فنون"]);
  });

  it("بلا أي عروض إطلاقاً لهذا التخصص: غير مؤهَّل، لا أهلية بلا خيارات", () => {
    const result = computeEligibility("علمي", 80, []);
    expect(result.branchEligible).toBe(false);
    expect(result.reachableOffers).toEqual([]);
    expect(result.lowestCutoff).toBeNull();
    expect(result.gapToLowest).toBeNull();
  });

  it("قسم قبول مباشر (بلا حدّ تنافسي) يُعتبر دائماً بالمتناول بصرف النظر عن المعدل", () => {
    const offerings = [makeOffering({ isDirectAdmission: true, averageGrades: { صباحي: null, مسائي: null } })];
    const result = computeEligibility("علمي", 40, offerings);
    expect(result.reachableOffers).toHaveLength(1);
    expect(result.lowestCutoff).toBeNull(); // لا حدّ تنافسي حقيقي أصلاً بين العروض
  });

  it("حدّ الدراسة المسائية يُحتسَب أيضاً كمسار بلوغ صالح حتى لو تجاوز الصباحي معدل الطالب", () => {
    const offerings = [makeOffering({ averageGrades: { صباحي: 90, مسائي: 60 } })];
    const result = computeEligibility("علمي", 65, offerings);
    expect(result.reachableOffers).toHaveLength(1);
  });

  it("تُجمَع الفروع المسموحة من كل العروض دون تكرار", () => {
    const offerings = [
      makeOffering({ departmentBranches: ["علمي"] }),
      makeOffering({ departmentBranches: ["علمي", "أدبي"] }),
    ];
    const result = computeEligibility("أدبي", 80, offerings);
    expect(result.allowedBranches.sort()).toEqual(["أدبي", "علمي"]);
    expect(result.branchEligible).toBe(true);
  });
});
