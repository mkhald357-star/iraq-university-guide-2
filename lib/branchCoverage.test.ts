import { describe, it, expect } from "vitest";
import universities from "../data/universities.json";

const list: any[] = Array.isArray(universities) ? universities : (universities as any).universities || [];

const allDepts = list.flatMap((u) =>
  (u.colleges || []).flatMap((c: any) => (c.departments || []).map((d: any) => ({ ...d, uniType: u.type })))
);

describe("تغطية الفرع (data/admission_rules.md §29)", () => {
  it("كل قسم يحمل branchSource صريحاً", () => {
    const missing = allDepts.filter((d) => !d.branchSource);
    expect(missing.length).toBe(0);
  });

  it("لا قيمة فرع خارج المجموعة المعروفة", () => {
    const ALLOWED = new Set(["علمي", "أدبي", "فنون"]);
    const bad = allDepts.flatMap((d) => (d.branch || []).filter((b: string) => !ALLOWED.has(b)));
    expect([...new Set(bad)]).toEqual([]);
  });

  it("الأقسام الأهلية لم تعد كلها بلا فرع", () => {
    const priv = allDepts.filter((d) => d.uniType !== "حكومية");
    const known = priv.filter((d) => (d.branch || []).length > 0);
    expect(known.length).toBeGreaterThan(0); // العطل الأصلي: صفر
  });

  it("كل قسم حكومي مستخرَج فعلياً -- لا derived ولا unknown للحكومي", () => {
    const gov = allDepts.filter((d) => d.uniType === "حكومية");
    const bad = gov.filter((d) => d.branchSource !== "extracted");
    expect(bad.length).toBe(0);
  });
});
