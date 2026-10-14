import { describe, it, expect } from "vitest";
import { sanitizeGradeInput, gradeRangeMessage } from "./gradeInput";

describe("sanitizeGradeInput", () => {
  it("يُبقي الأرقام اللاتينية كما هي", () => {
    expect(sanitizeGradeInput("78")).toBe("78");
    expect(sanitizeGradeInput("78.5")).toBe("78.5");
  });

  it("يحوّل الأرقام العربية والفارسية والفاصلة العشرية", () => {
    expect(sanitizeGradeInput("٧٨")).toBe("78");
    expect(sanitizeGradeInput("۷۸٫۵")).toBe("78.5");
    expect(sanitizeGradeInput("٧٨،٢٥")).toBe("78.25");
    expect(sanitizeGradeInput("78,5")).toBe("78.5");
  });

  it("يحذف ما ليس رقماً ويقصّ الخانات", () => {
    expect(sanitizeGradeInput("a7b8%")).toBe("78");
    expect(sanitizeGradeInput("-5")).toBe("5");
    expect(sanitizeGradeInput("1234")).toBe("123");
    expect(sanitizeGradeInput("78.999")).toBe("78.99");
    expect(sanitizeGradeInput("7.8.5")).toBe("7.85");
    expect(sanitizeGradeInput("e+3")).toBe("3");
  });

  it("يسمح بالكتابة المرحلية (نقطة في الآخر، فارغ)", () => {
    expect(sanitizeGradeInput("")).toBe("");
    expect(sanitizeGradeInput("78.")).toBe("78.");
  });
});

describe("gradeRangeMessage", () => {
  it("فارغ أو صالح = بلا رسالة", () => {
    expect(gradeRangeMessage("", 100)).toBe("");
    expect(gradeRangeMessage("100", 100)).toBe("");
    expect(gradeRangeMessage("0", 100)).toBe("");
    expect(gradeRangeMessage("78.5", 100)).toBe("");
  });

  it("خارج المدى يعطي رسالة", () => {
    expect(gradeRangeMessage("101", 100)).toMatch(/بين 0 و100/);
    expect(gradeRangeMessage("120.5", 120)).toMatch(/بين 0 و120/);
  });
});
