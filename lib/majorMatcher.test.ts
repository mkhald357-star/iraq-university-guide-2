import { describe, it, expect } from "vitest";
import {
  matchMajorToDepartment,
  findUniversitiesForMajor,
  rankUniversityOfferings,
  type Major,
  type MajorMapping,
  type University,
  type UniversityOffering,
} from "./majorMatcher";

// اختبارات تثبّت السلوك الحالي لمحرك مطابقة التخصص بالأقسام الجامعية —
// خصوصاً معالجة عطل "لا"/"ال" المعكوسة في طبقة نص PDF، ونظام الأولوية
// المتدرّجة (تطابق تام → مرادف → نمط)، قبل أي تعديل مستقبلي.

const baseMajor: Major = {
  id: "software_engineering",
  name: "هندسة البرمجيات",
  category: "تكنولوجيا",
  marketMultiplier: 1.5,
};

const baseMapping: MajorMapping = {
  majorId: "software_engineering",
  majorName: "هندسة البرمجيات",
  aliases: ["برمجيات"],
  departmentPatterns: ["برمج", "حاسوب"],
  priority: 1,
};

describe("matchMajorToDepartment", () => {
  it("تطابق تام حرفي = ثقة 100", () => {
    const { isMatch, confidence } = matchMajorToDepartment(baseMajor, "هندسة البرمجيات", baseMapping);
    expect(isMatch).toBe(true);
    expect(confidence).toBe(100);
  });

  it("تطابق عبر اسم بديل (alias) = ثقة 85", () => {
    const { isMatch, confidence } = matchMajorToDepartment(baseMajor, "برمجيات", baseMapping);
    expect(isMatch).toBe(true);
    expect(confidence).toBe(85);
  });

  it("تطابق نمط جزئي واحد فقط = ثقة 60 (عتبة القبول الدنيا)", () => {
    const { isMatch, confidence } = matchMajorToDepartment(baseMajor, "قسم البرمجة التطبيقية", baseMapping);
    expect(isMatch).toBe(true);
    expect(confidence).toBe(60);
  });

  it("تطابق نمطين معاً = ثقة 75", () => {
    const { isMatch, confidence } = matchMajorToDepartment(baseMajor, "قسم برمجة الحاسوب", baseMapping);
    expect(isMatch).toBe(true);
    expect(confidence).toBe(75);
  });

  it("بلا أي تطابق = isMatch false وثقة 0", () => {
    const { isMatch, confidence } = matchMajorToDepartment(baseMajor, "قسم التاريخ", baseMapping);
    expect(isMatch).toBe(false);
    expect(confidence).toBe(0);
  });

  it('يتجاوز عطل انعكاس "لا"/"ال" الشائع في طبقة نص PDF (مثال: الاتصالات ↔ االتصاالت)', () => {
    const mapping: MajorMapping = {
      majorId: "x",
      majorName: "هندسة الاتصالات",
      aliases: [],
      departmentPatterns: ["الاتصالات"],
      priority: 1,
    };
    const major: Major = { id: "x", name: "هندسة الاتصالات", category: "هندسة", marketMultiplier: 1 };
    // "االتصاالت" صيغة تالفة فعلية رُصدت في طبقة نص PDF (ألف مضاعفة/معكوسة)
    const { isMatch } = matchMajorToDepartment(major, "قسم هندسة االتصاالت", mapping);
    expect(isMatch).toBe(true);
  });

  it('تطابق حرف "ال" التعريف لا يُنتج التباساً كاذباً بين كلمتين مختلفتين تماماً تشترك أحرف عشوائية', () => {
    const mapping: MajorMapping = {
      majorId: "x",
      majorName: "علم النفس",
      aliases: [],
      departmentPatterns: ["علم النفس"],
      priority: 1,
    };
    const major: Major = { id: "x", name: "علم النفس", category: "إنسانيات", marketMultiplier: 1 };
    const { isMatch } = matchMajorToDepartment(major, "قسم علوم الحاسوب", mapping);
    expect(isMatch).toBe(false);
  });
});

function makeUniversity(overrides: Partial<University> = {}): University {
  return {
    id: "u1",
    name: "جامعة الاختبار",
    nameEn: null,
    type: "حكومية",
    province: "بغداد",
    founded: 2000,
    website: null,
    ranking: 5,
    colleges: [
      {
        id: "c1",
        name: "كلية الهندسة",
        nameEn: null,
        departments: [
          {
            name: "قسم البرمجيات",
            branch: ["علمي"],
            sessions: ["صباحي"],
            cutoffs: [],
            averageGrades: { صباحي: 85, مسائي: null },
            isDirectAdmission: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("findUniversitiesForMajor", () => {
  it("يعثر على عرض واحد لجامعة فيها قسم مطابق", () => {
    const offerings = findUniversitiesForMajor(baseMajor, [makeUniversity()], [baseMapping]);
    expect(offerings).toHaveLength(1);
    expect(offerings[0].universityId).toBe("u1");
  });

  it("يُصفّي حسب المحافظة", () => {
    const uniBaghdad = makeUniversity({ id: "u1", province: "بغداد" });
    const uniBasrah = makeUniversity({ id: "u2", province: "البصرة" });
    const offerings = findUniversitiesForMajor(baseMajor, [uniBaghdad, uniBasrah], [baseMapping], {
      province: "البصرة",
    });
    expect(offerings).toHaveLength(1);
    expect(offerings[0].universityId).toBe("u2");
  });

  it("يُصفّي حسب نوع الجامعة (حكومية/أهلية)", () => {
    const gov = makeUniversity({ id: "u1", type: "حكومية" });
    const priv = makeUniversity({ id: "u2", type: "أهلية" });
    const offerings = findUniversitiesForMajor(baseMajor, [gov, priv], [baseMapping], { type: "أهلية" });
    expect(offerings).toHaveLength(1);
    expect(offerings[0].universityType).toBe("أهلية");
  });

  it("يستخدم خريطة افتراضية (اسم التخصص نفسه) عند غياب أي MajorMapping مطابقة", () => {
    const uni = makeUniversity();
    uni.colleges[0].departments[0].name = "هندسة البرمجيات"; // تطابق تام مع اسم التخصص مباشرة
    const offerings = findUniversitiesForMajor(baseMajor, [uni], []); // لا خرائط إطلاقاً
    expect(offerings).toHaveLength(1);
  });

  it("لا يُرجع أي عرض إن لم يطابق أي قسم في أي جامعة", () => {
    const uni = makeUniversity();
    uni.colleges[0].departments[0].name = "قسم التاريخ";
    const offerings = findUniversitiesForMajor(baseMajor, [uni], [baseMapping]);
    expect(offerings).toHaveLength(0);
  });
});

describe("rankUniversityOfferings", () => {
  function makeOffering(overrides: Partial<UniversityOffering>): UniversityOffering {
    return {
      universityId: "u",
      universityName: "ج",
      universityType: "حكومية",
      universityRanking: null,
      province: "بغداد",
      collegeId: "c",
      collegeName: "ك",
      departmentName: "ق",
      departmentBranches: ["علمي"],
      sessions: ["صباحي"],
      averageGrades: { صباحي: null, مسائي: null },
      cutoffs: [],
      isDirectAdmission: false,
      confidence: 60,
      ...overrides,
    };
  }

  it("يرتّب حسب الثقة تنازلياً أولاً", () => {
    const low = makeOffering({ universityId: "low", confidence: 60 });
    const high = makeOffering({ universityId: "high", confidence: 100 });
    const ranked = rankUniversityOfferings([low, high]);
    expect(ranked[0].universityId).toBe("high");
  });

  it("عند تساوي الثقة، يرتّب حسب معدل القبول الصباحي تنازلياً", () => {
    const lowGrade = makeOffering({
      universityId: "lowGrade",
      confidence: 80,
      averageGrades: { صباحي: 70, مسائي: null },
    });
    const highGrade = makeOffering({
      universityId: "highGrade",
      confidence: 80,
      averageGrades: { صباحي: 90, مسائي: null },
    });
    const ranked = rankUniversityOfferings([lowGrade, highGrade]);
    expect(ranked[0].universityId).toBe("highGrade");
  });

  it("عند تساوي الثقة والمعدل، يرتّب حسب ترتيب الجامعة تصاعدياً (رقم أصغر = أفضل)", () => {
    const rank10 = makeOffering({ universityId: "r10", confidence: 80, universityRanking: 10 });
    const rank1 = makeOffering({ universityId: "r1", confidence: 80, universityRanking: 1 });
    const ranked = rankUniversityOfferings([rank10, rank1]);
    expect(ranked[0].universityId).toBe("r1");
  });

  it("جامعة بلا ترتيب (null) تُعامَل كأسوأ خيار (تُدفَع للنهاية)", () => {
    const withRank = makeOffering({ universityId: "withRank", confidence: 80, universityRanking: 3 });
    const noRank = makeOffering({ universityId: "noRank", confidence: 80, universityRanking: null });
    const ranked = rankUniversityOfferings([noRank, withRank]);
    expect(ranked[0].universityId).toBe("withRank");
  });

  it("لا يُعدّل المصفوفة الأصلية (immutable)", () => {
    const original = [
      makeOffering({ universityId: "a", confidence: 60 }),
      makeOffering({ universityId: "b", confidence: 100 }),
    ];
    const originalOrder = original.map((o) => o.universityId);
    rankUniversityOfferings(original);
    expect(original.map((o) => o.universityId)).toEqual(originalOrder);
  });
});
