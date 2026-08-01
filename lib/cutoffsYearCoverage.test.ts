import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "app");

function allFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) allFiles(full, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(full);
  }
  return out;
}

describe("تغطية سنة مصدر الحدود الدنيا (CUTOFFS_YEAR)", () => {
  it("كل مكوّن يعرض averagePercent/averageGrades يستورد admissionDisclosure", () => {
    const offenders = allFiles(APP).filter((p) => {
      const src = fs.readFileSync(p, "utf8");
      const shows = src.includes("averagePercent") || src.includes("averageGrades");
      return shows && !src.includes("admissionDisclosure");
    });

    expect(offenders.map((p) => path.relative(process.cwd(), p))).toEqual([]);
  });

  it("لا سنة دراسية مكتوبة يدوياً (2025-2026) خارج الملف المركزي", () => {
    const offenders: string[] = [];
    for (const p of allFiles(APP)) {
      const src = fs.readFileSync(p, "utf8");
      if (/2025-2026/.test(src) && !src.includes("admissionDisclosure")) {
        offenders.push(path.relative(process.cwd(), p));
      }
    }
    expect(offenders).toEqual([]);
  });
});
