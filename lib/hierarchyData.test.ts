import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import raw from "../data/raw/cutoffs_2025_2026.json";
import provinces from "../data/provinces.json";

// public/data/hierarchy.json (يبنيه scripts/build-hierarchy-data.js من PDF الوزارة): كل صف رسمي يظهر مرة واحدة، بلا رقم مخترَع.

type Value = [string, string, number, number];
interface Hier {
  year: string;
  rows: number;
  provinces: {
    name: string;
    universities: {
      name: string;
      colleges: {
        name: string;
        level?: string;
        collegeLevel?: Value[];
        departments: { name: string; v: Value[] }[];
      }[];
    }[];
  }[];
}
const data: Hier = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "data", "hierarchy.json"), "utf8"));

const all: { value: Value; dept: boolean }[] = [];
for (const p of data.provinces)
  for (const u of p.universities)
    for (const c of u.colleges) {
      for (const v of c.collegeLevel ?? []) all.push({ value: v, dept: false });
      for (const d of c.departments) for (const v of d.v) all.push({ value: v, dept: true });
    }

describe("hierarchy.json", () => {
  it("1,222 صفاً، بعدد صفوف الخام نفسه", () => {
    expect(data.rows).toBe(1222);
    expect(all).toHaveLength(1222);
    expect(all).toHaveLength((raw as unknown[]).length);
  });

  it("كل معدل في الملف له صف خام بالمعدل والفرع والجنس نفسها (بالتعداد)", () => {
    const pool = new Map<string, number>();
    for (const r of raw as { averagePercent: number; branch: string; gender: string }[]) {
      const k = `${r.averagePercent.toFixed(2)}|${r.branch}|${r.gender}`;
      pool.set(k, (pool.get(k) ?? 0) + 1);
    }
    for (const { value } of all) {
      const k = `${value[2].toFixed(2)}|${value[0]}|${value[1]}`;
      const n = pool.get(k) ?? 0;
      expect(n, k).toBeGreaterThan(0);
      pool.set(k, n - 1);
    }
    expect([...pool.values()].every((n) => n === 0)).toBe(true);
  });

  it("المحافظات كلها ضمن قائمة المحافظات المعتمدة، والأسماء غير فارغة ولا مشوّهة", () => {
    const known = new Set(
      (provinces as unknown as (string | { name: string })[]).map((p) => (typeof p === "string" ? p : p.name))
    );
    for (const p of data.provinces) {
      expect(known.has(p.name), p.name).toBe(true);
      for (const u of p.universities) {
        expect(u.name.trim()).not.toBe("");
        for (const c of u.colleges) {
          expect(c.name.trim(), u.name).not.toBe("");
          expect(c.name).not.toMatch(/اآل|االل|\)[^()]*\(/);
          for (const d of c.departments) expect(d.name.trim()).not.toBe("");
        }
      }
    }
  });

  it("الجنس لا يظهر إلا لقيمة أنثى/ذكر، والبقية «مختلط»", () => {
    for (const { value } of all) expect(["مختلط", "أنثى", "ذكر"]).toContain(value[1]);
  });

  it("المعهد التقني الدور في صلاح الدين لا نينوى", () => {
    const sal = data.provinces.find((p) => p.name === "صلاح الدين")!;
    const names = sal.universities.flatMap((u) => u.colleges.map((c) => c.name));
    expect(names.some((n) => n.includes("الدور"))).toBe(true);
    const nin = data.provinces.find((p) => p.name === "نينوى")!;
    expect(nin.universities.flatMap((u) => u.colleges.map((c) => c.name)).some((n) => n.includes("الدور"))).toBe(false);
  });
});
