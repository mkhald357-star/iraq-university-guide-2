import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "app");

function pages(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) pages(full, out);
    else if (e.name === "page.tsx" || e.name === "page.ts") out.push(full);
  }
  return out;
}

/** مؤشّرات أن الصفحة تعرض حدود قبول */
const SHOWS_CUTOFFS = ["UniversitiesTable", "averageGrades", "isDirectAdmission", "fetchOfferingsFor"];

describe("تغطية تنويه القناة العامة", () => {
  it("كل صفحة تعرض حدوداً تعرض ChannelNotice", () => {
    const offenders = pages(APP).filter((p) => {
      const src = fs.readFileSync(p, "utf8");
      const shows = SHOWS_CUTOFFS.some((k) => src.includes(k));
      return shows && !src.includes("ChannelNotice");
    });

    expect(offenders.map((p) => path.relative(process.cwd(), p))).toEqual([]);
  });

  it("قالب تصدير PDF يحمل نصّ التنويه", () => {
    const report = path.join(APP, "report", "page.tsx");
    if (!fs.existsSync(report)) return; // تخطَّ إن اختلف المسار
    const src = fs.readFileSync(report, "utf8");
    expect(src).toContain("CHANNEL_NOTICE_PLAIN");
  });

  it("لا نصّ تنويه مكتوب يدوياً خارج الملف المركزي", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name)) {
          const src = fs.readFileSync(full, "utf8");
          if (src.includes("القناة العامة") && !src.includes("admissionDisclosure")) {
            offenders.push(path.relative(process.cwd(), full));
          }
        }
      }
    };
    walk(APP);
    expect(offenders).toEqual([]);
  });
});
