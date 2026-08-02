import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SITE_URL, REPORT_TELEGRAM, REPORT_EMAIL } from "./siteMeta";

describe("بيانات الموقع", () => {
  it("النطاق بصيغة صحيحة (https://، بلا شرطة في النهاية)", () => {
    expect(SITE_URL).toMatch(/^https:\/\//);
    expect(SITE_URL).not.toMatch(/\/$/);
  });

  // 🔴 معلَّق عمداً -- النطاق الفعلي لم يُحسَم بعد (بطلب المستخدم المباشر،
  // data/admission_rules.md §33). SITE_URL نائبة صراحة (نطاق .invalid محجوز
  // من IANA، RFC 2606 -- لا يمكن أن يعمل صدفة). أزِل .skip وفعِّل هذا الفحص
  // فور ضبط النطاق الفعلي في lib/siteMeta.ts -- ابحث عن REPLACE_BEFORE_LAUNCH.
  it.skip("النطاق ليس قيمة نائبة (مُعلَّق حتى يُحسَم النطاق الفعلي -- §33)", () => {
    expect(SITE_URL).not.toMatch(/REPLACE_BEFORE_LAUNCH|\.invalid$/);
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
