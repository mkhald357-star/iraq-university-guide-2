import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import universities from "../data/universities.json";

const require = createRequire(import.meta.url);
const { checkName } = require("../scripts/departmentNameHealth.js");

describe("سلامة أسماء الأقسام", () => {
  it("لا اسم قسم أو كلية معطوب في كل البيانات", () => {
    const list: any[] = Array.isArray(universities) ? universities : (universities as any).universities || [];
    const bad: string[] = [];

    for (const u of list)
      for (const c of u.colleges || []) {
        if (checkName(c.name).length) bad.push(`${u.name} / ${c.name} [كلية]`);
        for (const p of c.departments || [])
          if (checkName(p.name).length) bad.push(`${u.name} / ${c.name} / ${p.name}`);
      }

    expect(bad).toEqual([]);
  });

  it("الكاشف يعمل فعلاً", () => {
    expect(checkName(")%").length).toBeGreaterThan(0);
    expect(checkName("طب الاسنان فأك ثر").length).toBeGreaterThan(0);
    expect(checkName("هندسة الحاسوب")).toEqual([]);
  });
});
