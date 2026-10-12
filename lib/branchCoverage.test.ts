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

  it("القسم الحكومي: فروعه من مصدر رسمي، أو «الفرع غير معروف» صراحةً (لا استدلال ولا derived)", () => {
    const gov = allDepts.filter((d) => d.uniType === "حكومية");
    const bad = gov.filter((d) => d.branchSource !== "extracted" && d.branchSource !== "unknown");
    expect(bad.length).toBe(0);
    // مصدر صريح لكل قسم حكومي، ولا قيمة استدلالية بعد الآن (م5)
    const allowedBasis = new Set(["cutoffs", "chapter3", "guide", "unknown"]);
    for (const d of gov) expect(allowedBasis.has(d.branchBasis as string), d.name).toBe(true);
    for (const d of gov) {
      expect(d.branchSource === "unknown", d.name).toBe((d.branch || []).length === 0);
      expect(d.branchBasis === "unknown", d.name).toBe((d.branch || []).length === 0);
    }
    // كانت 12 قسماً مسائياً بلا نصّ رسمي لفروعه؛ صارت صفراً بعد قراءة صفحات الفصل 3 بصرياً
    // (PLAN-ADMISSION-COMPLETION.md: reports/admission-fix/completion/page-audit.json)، وتبقى القاعدة: «الفرع غير معروف»
    // لا يظهر إلا لقسم بلا فرع، ولا يُستدَل فرع بلا مصدر.
    expect(gov.filter((d) => d.branchBasis === "unknown")).toHaveLength(0);
  });
});
