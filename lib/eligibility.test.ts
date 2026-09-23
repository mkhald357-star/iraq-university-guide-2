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

  it("قسم قبول مباشر بلا رقم لا يُحتسَب بلوغاً -- يُعَدّ مجهولاً (الإصدار 2)", () => {
    const offerings = [makeOffering({ isDirectAdmission: true, averageGrades: { صباحي: null, مسائي: null } })];
    const result = computeEligibility("علمي", 40, offerings);
    expect(result.reachableOffers).toHaveLength(0);
    expect(result.unknownOffers).toHaveLength(1);
    expect(result.lowestCutoff).toBeNull(); // لا حدّ تنافسي حقيقي أصلاً بين العروض
  });

  it("حدّ الدراسة المسائية يُحتسَب أيضاً كمسار بلوغ صالح حتى لو تجاوز الصباحي معدل الطالب", () => {
    // القسم يقدّم الدوامين فعلاً -- في البيانات الحقيقية لا يوجد قسم برقم
    // مسائي لا يُعلن دواماً مسائياً (0 من 1349).
    const offerings = [makeOffering({ sessions: ["صباحي", "مسائي"], averageGrades: { صباحي: 90, مسائي: 60 } })];
    const result = computeEligibility("علمي", 65, offerings);
    expect(result.reachableOffers).toHaveLength(1);
  });

  it("قسم صباحي فقط لا يُبلَغ بأرضية مسائية لا يقدّمها", () => {
    const offerings = [makeOffering({ sessions: ["صباحي"], averageGrades: { صباحي: 90, مسائي: 60 } })];
    expect(computeEligibility("علمي", 65, offerings).reachableOffers).toHaveLength(0);
  });

  it("قسم أهلي بلا حدّ منشور ليس «في المتناول» لأي معدل -- بل مجهول (عطل §32 الذي نجا في هذا الملف)", () => {
    const privateNoMin = makeOffering({
      universityType: "أهلية",
      isDirectAdmission: true,
      averageGrades: { صباحي: null, مسائي: null },
      statedMinimumGrade: null,
    });
    const result = computeEligibility("علمي", 50, [privateNoMin]);
    expect(result.reachableOffers).toHaveLength(0);
    expect(result.unknownOffers).toHaveLength(1);
  });

  it("قسم أهلي بحدّ معلن يُقارَن به كأي حدّ", () => {
    const privateWithMin = makeOffering({
      universityType: "أهلية",
      isDirectAdmission: true,
      averageGrades: { صباحي: null, مسائي: null },
      statedMinimumGrade: { value: 85, raw: "معدل ( 85 )%", source: "دليل", sourceYear: "2025-2026" },
    });
    expect(computeEligibility("علمي", 90, [privateWithMin]).reachableOffers).toHaveLength(1);
    expect(computeEligibility("علمي", 80, [privateWithMin]).reachableOffers).toHaveLength(0);
  });

  it("الحدّ التنافسي الأدنى يستبعد الأهلي والأرضية المسائية", () => {
    const offerings = [
      makeOffering({ averageGrades: { صباحي: 80, مسائي: 60 }, sessions: ["صباحي", "مسائي"] }),
      makeOffering({ universityType: "أهلية", isDirectAdmission: true, averageGrades: { صباحي: 50, مسائي: null } }),
    ];
    expect(computeEligibility("علمي", 70, offerings).lowestCutoff).toBe(80);
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

describe("eveningOnlyOffers (الإصدار 2، شرط المدقّق: المسائي بلوغ بأجور يُسمّى باسمه)", () => {
  it("قسم يُبلَغ بالمسائي وحده يُعلَّم، ويبقى ضمن reachableOffers", () => {
    const offerings = [makeOffering({ sessions: ["صباحي", "مسائي"], averageGrades: { صباحي: 90, مسائي: 60 } })];
    const r = computeEligibility("علمي", 65, offerings);
    expect(r.reachableOffers).toHaveLength(1);
    expect(r.eveningOnlyOffers).toHaveLength(1);
  });
  it("قسم يُبلَغ صباحاً لا يُعلَّم مسائياً فقط", () => {
    const offerings = [makeOffering({ sessions: ["صباحي", "مسائي"], averageGrades: { صباحي: 70, مسائي: 60 } })];
    const r = computeEligibility("علمي", 80, offerings);
    expect(r.eveningOnlyOffers).toHaveLength(0);
  });
});
