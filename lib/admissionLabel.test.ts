import { describe, it, expect } from "vitest";
import { formatGrade, admissionCell } from "./admissionLabel";
import universities from "../data/universities.json";

describe("formatGrade -- لا تخلط بين 'قبول مباشر' و'بيانات مفقودة'", () => {
  it("قسم بقبول مباشر حقيقي يعرض 'قبول مباشر' حتى لو كانت القيمة null", () => {
    expect(formatGrade(null, true, true)).toEqual({ text: "قبول مباشر", isDirect: true });
  });

  it("قسم تنافسي (isDirectAdmission=false) بقيمة null يعرض 'غير متوفر' -- لا 'قبول مباشر'", () => {
    expect(formatGrade(null, true, false)).toEqual({ text: "غير متوفر", isDirect: false });
  });

  it("قسم تنافسي بقيمة حقيقية يعرض النسبة", () => {
    expect(formatGrade(78.5, true, false)).toEqual({ text: "78.5%", isDirect: false });
  });

  it("جلسة غير متاحة أصلاً تعرض شرطة بصرف النظر عن isDirectAdmission", () => {
    expect(formatGrade(null, false, false)).toEqual({ text: "—", isDirect: false });
    expect(formatGrade(null, false, true)).toEqual({ text: "—", isDirect: false });
  });

  it("قسم بقبول مباشر ورقم موجود (حالة مسائي المُشتقّة من eveningMinGradeFor) يعرض 'قبول مباشر' لا الرقم -- القبول المباشر أولوية دلالية أعلى من أي رقم مصاحب", () => {
    expect(formatGrade(60, true, true)).toEqual({ text: "قبول مباشر", isDirect: true });
  });
});

describe("admissionCell -- الأهلي لا يعرض 'قبول مباشر' إطلاقاً (data/admission_rules.md §28)", () => {
  it("أهلي بشرط معدّل معلَن يعرض الشرط، لا 'قبول مباشر'", () => {
    expect(admissionCell("أهلية", true, true, null, { value: 90 })).toEqual({
      text: "يشترط معدل 90% فأكثر",
      tone: "stated",
    });
  });

  it("أهلي بلا شرط معلَن يعرض 'الحدّ الأدنى غير متوفّر' -- لا 'قبول مباشر' رغم isDirectAdmission=true", () => {
    expect(admissionCell("أهلية", true, true, null, null)).toEqual({
      text: "الحدّ الأدنى غير متوفّر",
      tone: "unstated",
    });
  });

  it("جلسة أهلي غير متاحة تعرض شرطة بصرف النظر عن الشرط", () => {
    expect(admissionCell("أهلية", false, true, null, { value: 90 })).toEqual({ text: "—", tone: "none" });
  });

  it("حكومي بقبول مباشر حقيقي يعرض 'قبول مباشر' كالسابق تماماً -- لم يتغيّر سلوك الحكومي", () => {
    expect(admissionCell("حكومية", true, true, null, null)).toEqual({ text: "قبول مباشر", tone: "direct" });
  });

  it("حكومي تنافسي بقيمة حقيقية يعرض النسبة كالسابق", () => {
    expect(admissionCell("حكومية", true, false, 78.5, null)).toEqual({ text: "78.5%", tone: "competitive" });
  });

  it("حكومي تنافسي بقيمة null يعرض 'غير متوفر' كالسابق", () => {
    expect(admissionCell("حكومية", true, false, null, null)).toEqual({ text: "غير متوفر", tone: "unstated" });
  });

  it("فحص بنيوي على بيانات حقيقية: لا قسم أهلي واحد ينتج 'قبول مباشر' عبر admissionCell", () => {
    const list: any[] = Array.isArray(universities) ? universities : (universities as any).universities;
    const offenders: string[] = [];
    for (const u of list) {
      if (u.type !== "أهلية") continue;
      for (const c of u.colleges || []) {
        for (const d of c.departments || []) {
          for (const session of ["صباحي", "مسائي"] as const) {
            const available = !!d.sessions?.includes(session);
            const cell = admissionCell(
              u.type,
              available,
              !!d.isDirectAdmission,
              d.averageGrades?.[session],
              d.statedMinimumGrade
            );
            if (cell.text === "قبول مباشر") offenders.push(`${u.name}/${c.name}/${d.name}/${session}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
