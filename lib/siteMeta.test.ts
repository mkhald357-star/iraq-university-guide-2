import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SITE_URL, REPORT_TELEGRAM, REPORT_EMAIL } from "./siteMeta";

describe("بيانات الموقع", () => {
  it("النطاق بصيغة صحيحة (https://، بلا شرطة في النهاية)", () => {
    expect(SITE_URL).toMatch(/^https:\/\//);
    expect(SITE_URL).not.toMatch(/\/$/);
  });

  // النطاق حُسم في §37 (2026-08-10) -- iraqmajors.com متحقَّق منه حيّاً
  // (curl 200 + Playwright يؤكّد محتوى /compare مطابقاً لآخر بناء).
  it("SITE_URL ليس قيمة نائبة (حُسم -- §37)", () => {
    expect(SITE_URL).not.toMatch(/REPLACE_BEFORE_LAUNCH|\.invalid$/);
  });

  // 🔴 معلَّق عمداً -- قنوات الإبلاغ لم تُحدَّد بعد (بطلب المستخدم المباشر،
  // §33). أزِل .skip فور توفّر تلغرام/بريد حقيقيَّين في lib/siteMeta.ts.
  it.skip("قنوات الإبلاغ ليست قيماً نائبة (مُعلَّق حتى تُحدَّد القنوات الفعلية -- §33)", () => {
    expect(REPORT_TELEGRAM).not.toMatch(/REPLACE_BEFORE_LAUNCH/);
    expect(REPORT_EMAIL).not.toMatch(/REPLACE_BEFORE_LAUNCH/);
  });

  // فحص إيجابي يثبت أن الحارس أعلاه يعمل فعلاً لو فُعِّل -- لا يعتمد على
  // القيم الفعلية في siteMeta.ts، يختبر منطق المطابقة نفسه فقط.
  it("منطق كشف القيمة النائبة يعمل فعلاً (فحص مباشر بمعزل عن حالة siteMeta.ts الحالية)", () => {
    expect("https://REPLACE_WITH_REAL_DOMAIN.invalid").toMatch(/REPLACE_BEFORE_LAUNCH|\.invalid$/);
    expect("https://example-real-domain.iq").not.toMatch(/REPLACE_BEFORE_LAUNCH|\.invalid$/);
  });

  it("صورة المعاينة موجودة وضمن السقف (300 كيلوبايت)", () => {
    const p = path.join(process.cwd(), "public/og/cover.png");
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).size).toBeLessThan(300 * 1024);
  });
});

describe("وسوم الصفحات", () => {
  it("كل مسار له layout يُصدّر metadata بعنوان مميّز", () => {
    const app = path.join(process.cwd(), "app");
    const routes = fs
      .readdirSync(app, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("_") && e.name !== "components")
      .filter((e) => e.name !== "context" && e.name !== "hooks")
      .filter((e) => fs.existsSync(path.join(app, e.name, "page.tsx")));

    const titles = new Set<string>();
    const missing: string[] = [];

    for (const r of routes) {
      const lay = path.join(app, r.name, "layout.tsx");
      if (!fs.existsSync(lay)) {
        missing.push(r.name);
        continue;
      }
      const src = fs.readFileSync(lay, "utf8");
      if (!src.includes("metadata")) {
        missing.push(r.name);
        continue;
      }
      const m = src.match(/const TITLE = ['"](.+?)['"]/);
      if (m) titles.add(m[1]);
    }

    expect(missing).toEqual([]);
    expect(titles.size).toBe(routes.length); // لا عنوان مكرّر
  });
});
