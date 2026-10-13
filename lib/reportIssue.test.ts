import { describe, it, expect } from "vitest";
import { buildReportText, telegramLink, instagramLink } from "./reportIssue";

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

  it("روابط البلاغ هي حسابا المالك فقط، بلا أي نص أو بيانات في الرابط", () => {
    expect(telegramLink()).toBe("https://t.me/kaxfk");
    expect(instagramLink()).toBe("https://ig.me/m/ka_xf");
    for (const l of [telegramLink(), instagramLink()]) {
      expect(l).toMatch(/^https:\/\//);
      expect(l).not.toContain("?");
    }
  });
});
