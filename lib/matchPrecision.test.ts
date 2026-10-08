import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { findUniversitiesForMajor, type Major, type MajorMapping, type University } from "./majorMatcher";
import { normalizeForPatternMatch } from "./departmentNormalizer";
import mappingFile from "../data/major_department_mapping.json";
import majorsFile from "../data/majors.json";
import universitiesFile from "../data/universities.json";

/**
 * حارس دقّة مطابقة الأقسام بالتخصصات (PLAN-ADMISSION-FIX، المرحلة 3).
 * حادثة 2026-10-08: مطبّع جديد دمج الألفات وحوّل ئ->ي فصار نمط "االعالم" الجذر "علم"
 * فطابق "علم النفس" و"علم الأرض" و"معلم الصفوف" مع الإعلام، وصارت "كهربائية" تحوي "بيئة".
 */
const mappings = mappingFile.mappings as unknown as MajorMapping[];
const majors = majorsFile as unknown as Major[];
const universities = universitiesFile.universities as unknown as University[];
const requireCjs = createRequire(import.meta.url);
const jsNormalizer = requireCjs("../scripts/departmentNormalizer.js");

const offeringsOf = (majorId: string) => {
  const major = majors.find((m) => m.id === majorId)!;
  return findUniversitiesForMajor(major, universities, mappings);
};
const deptText = (o: { collegeName: string; departmentName: string }) => `${o.collegeName} / ${o.departmentName}`;

describe("دقّة مطابقة الأقسام بالتخصصات (بيانات حقيقية)", () => {
  it("الإعلام لا يطابق أقسام العلوم ولا علم النفس ولا معلم الصفوف", () => {
    const bad = offeringsOf("media_journalism").filter((o) =>
      /علم (النفس|الارض|األرض|الحاسوب|الاحياء|األحياء|الاجتماع|االجتماع)|معلم|علم$/.test(o.departmentName)
    );
    expect(bad.map(deptText)).toEqual([]);
  });

  it("الهندسة البيئية لا تطابق الهندسة/التقنيات الكهربائية", () => {
    const bad = offeringsOf("environmental_engineering").filter((o) => /كهرب/.test(o.departmentName));
    expect(bad.map(deptText)).toEqual([]);
  });

  it("علوم الحاسوب والتصميم الجرافيكي لا يطابقان قسم التصميم والتصنيع المعان بالحاسوب", () => {
    for (const id of ["computer_science", "graphic_design"]) {
      const bad = offeringsOf(id).filter((o) => /التصميم والتصنيع/.test(o.departmentName));
      expect(bad.map(deptText)).toEqual([]);
    }
  });

  it("الكليات وحيدة القسم ('عام') تُطابَق باسم الكلية: تمريض/قانون/علوم سياسية/تربية بدنية", () => {
    for (const [id, collegeRe] of [
      ["nursing", /تمريض/],
      ["law", /قانون|حقوق/],
      ["political_science", /سياسية/],
      ["physical_education", /تربية البدنية/],
    ] as const) {
      const hits = offeringsOf(id).filter((o) => o.departmentName === "عام" && collegeRe.test(o.collegeName));
      expect(hits.length, id).toBeGreaterThan(0);
    }
  });

  it("هندسة تقنيات الذكاء الاصطناعي (الحلة/سومر) ما زالت مطابقة لتخصص ai", () => {
    const ids = new Set(offeringsOf("ai").map((o) => o.universityId));
    expect(ids.has("hilla")).toBe(true);
    expect(ids.has("somo")).toBe(true);
  });

  it("المكامن النفطية/الموصل تبقى ضمن الهندسة النفطية برقمها الرسمي 90", () => {
    const o = offeringsOf("petroleum_engineering").find(
      (x) => x.universityId === "mosul" && /المكامن النفطية/.test(x.departmentName)
    );
    expect(o?.averageGrades["صباحي"]).toBe(90);
  });
});

describe("تطبيع مطابقة الأنماط", () => {
  it("نسخة TypeScript مطابقة لنسخة JS حرفياً", () => {
    for (const s of ["االعالم", "الإعلام", "قسم علم النفس", "كهربائية", "البيئة", "االنتاج", "اللغة اإلنكليزية"]) {
      expect(normalizeForPatternMatch(s)).toBe(jsNormalizer.normalizeForPatternMatch(s));
    }
  });

  it("لا يتصادم نمط الإعلام ولا نمط البيئة مع ما لا علاقة له به", () => {
    expect(normalizeForPatternMatch("قسم علم النفس")).not.toContain(normalizeForPatternMatch("االعالم"));
    expect(normalizeForPatternMatch("قسم علم الارض")).not.toContain(normalizeForPatternMatch("االعالم"));
    expect(normalizeForPatternMatch("قسم معلم الصفوف الاولى")).not.toContain(normalizeForPatternMatch("االعالم"));
    expect(normalizeForPatternMatch("تقنيات الهندسة الكهربائية")).not.toContain(normalizeForPatternMatch("البيئة"));
    expect(normalizeForPatternMatch("تقنيات الهندسة الكهربائية")).not.toContain(normalizeForPatternMatch("البيئية"));
  });
});
