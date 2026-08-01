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
