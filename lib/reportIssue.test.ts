import { describe, it, expect } from "vitest";
import { buildReportText, telegramLink, mailtoLink } from "./reportIssue";

describe("نصّ البلاغ", () => {
  it("لا يحوي أي بيانات شخصية", () => {
    const t = buildReportText({ page: "/gpa-check", department: "الحاسوب" });
    for (const w of ["معدل", "معدّل", "الفرع", "المحافظة"]) expect(t).not.toContain(w);
  });

  it("يتضمّن السياق الممرَّر", () => {
    const t = buildReportText({ page: "/explorer", university: "بغداد", department: "المدني" });
    expect(t).toContain("بغداد");
    expect(t).toContain("المدني");
  });

  it("لا يتضمّن حقولاً غير ممرَّرة (لا أسطر فارغة زائفة)", () => {
    const t = buildReportText({ page: "/gpa-check" });
    expect(t).not.toContain("الجامعة:");
    expect(t).not.toContain("الكلية:");
    expect(t).not.toContain("القسم:");
  });

  it("الروابط مُرمَّزة بشكل صحيح", () => {
    const t = buildReportText({ page: "/x", department: "قسم اختبار" });
    expect(telegramLink(t)).not.toContain(" ");
    expect(mailtoLink(t)).toMatch(/^mailto:/);
    expect(mailtoLink(t)).not.toContain(" ");
  });

  it("رابط تلغرام يحمل النصّ نفسه بعد فك الترميز", () => {
    const t = buildReportText({ page: "/explorer", university: "جامعة الاختبار" });
    const link = telegramLink(t);
    const encoded = link.split("?text=")[1];
    expect(decodeURIComponent(encoded)).toBe(t);
  });
});
