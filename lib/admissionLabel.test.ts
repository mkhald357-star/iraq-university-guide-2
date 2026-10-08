import { describe, it, expect } from "vitest";
import { formatGrade, admissionCell, GOV_NO_PUBLISHED_CUTOFF } from "./admissionLabel";
import universities from "../data/universities.json";

describe("formatGrade -- الرقم أولاً، ولا قبول مباشر للحكومي (PLAN-ADMISSION-FIX.md)", () => {
  it("قسم بقيمة حقيقية يعرض النسبة دائماً حتى لو كانت هناك راية مباشر قديمة (الرقم أولاً)", () => {
    expect(formatGrade(78.5, true, false)).toEqual({ text: "78.5%", isDirect: false });
    expect(formatGrade(60, true, true)).toEqual({ text: "60%", isDirect: false });
  });

  it("قسم بلا رقم متاح يعرض 'لا حدّ منشور في دليل 2025-2026'", () => {
    expect(formatGrade(null, true, false)).toEqual({ text: GOV_NO_PUBLISHED_CUTOFF, isDirect: false });
  });

  it("جلسة غير متاحة أصلاً تعرض شرطة بصرف النظر عن أي راية", () => {
    expect(formatGrade(null, false, false)).toEqual({ text: "—", isDirect: false });
    expect(formatGrade(null, false, true)).toEqual({ text: "—", isDirect: false });
  });
});

describe("admissionCell -- لا قبول مباشر في أي قسم حكومي أو أهلي (PLAN-ADMISSION-FIX.md)", () => {
  it("أهلي بشرط معدّل معلَن يعرض الشرط، لا 'قبول مباشر'", () => {
    expect(admissionCell("أهلية", true, true, null, { value: 90 })).toEqual({
      text: "يشترط معدل 90% فأكثر",
      tone: "stated",
    });
  });

  it("أهلي بلا شرط معلَن يعرض 'الحدّ الأدنى غير متوفّر' -- لا 'قبول مباشر'", () => {
    expect(admissionCell("أهلية", true, true, null, null)).toEqual({
      text: "الحدّ الأدنى غير متوفّر",
      tone: "unstated",
    });
  });

  it("جلسة أهلي غير متاحة تعرض شرطة بصرف النظر عن الشرط", () => {
    expect(admissionCell("أهلية", false, true, null, { value: 90 })).toEqual({ text: "—", tone: "none" });
  });

  it("حكومي برقم معلن يعرض النسبة دائماً", () => {
    expect(admissionCell("حكومية", true, false, 78.5, null)).toEqual({ text: "78.5%", tone: "competitive" });
  });

  it("حكومي بلا رقم منشور يعرض 'لا حدّ منشور في دليل 2025-2026' ولا يعرض 'قبول مباشر' أبداً", () => {
    expect(admissionCell("حكومية", true, false, null, null)).toEqual({
      text: GOV_NO_PUBLISHED_CUTOFF,
      tone: "unstated",
    });
    // حتى لو كانت الراية القديمة true خطأً:
    expect(admissionCell("حكومية", true, true, null, null)).toEqual({
      text: GOV_NO_PUBLISHED_CUTOFF,
      tone: "unstated",
    });
  });

  it("فحص بنيوي شامل على كل أقسام universities.json: صفر قبول مباشر في الحكومي والأهلي عبر admissionCell", () => {
    const list: any[] = Array.isArray(universities) ? universities : (universities as any).universities;
    const offenders: string[] = [];
    for (const u of list) {
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
