import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// حارس ضد تكرار البيانات الحرجة عبر أكثر من ملف -- المشروع اكتشف فعلياً
// (خطة "إصلاح خوارزمية ترتيب التخصصات") أن branchMap كان مكرَّراً حرفياً في
// app/quiz/page.tsx وlib/offeringsClient.ts، مع نسخة ثالثة في
// scripts/archive/persona-simulation-harness.mts انحرفت صامتاً (نسيت
// "تقنيات طبية مساندة" فتعاملت كل محاكاة سابقة مع 58 تخصصاً علمياً لا 67).
// هذا الاختبار يمنع تكرار نفس الخطأ لأي بيانات حرجة مستقبلية.

const ROOT = path.join(__dirname, "..");
const SCAN_DIRS = ["app", "lib", "scripts"];
const EXTENSIONS = [".ts", ".tsx", ".mts"];
const EXCLUDE_DIR_SEGMENTS = ["node_modules", ".next", ".claude", "archive"];

function collectSourceFiles(): string[] {
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDE_DIR_SEGMENTS.includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        files.push(full);
      }
    }
  }
  for (const d of SCAN_DIRS) {
    const full = path.join(ROOT, d);
    if (fs.existsSync(full)) walk(full);
  }
  return files;
}

const SOURCE_FILES = collectSourceFiles();

function filesContaining(literal: string): string[] {
  return SOURCE_FILES.filter((f) => fs.readFileSync(f, "utf8").includes(literal)).map((f) =>
    path.relative(ROOT, f).replace(/\\/g, "/")
  );
}

describe("مصدر وحيد للبيانات الحرجة -- لا نسخ مكرَّرة صامتة", () => {
  it("مصفوفة الفروع الحرفية (BRANCH_CATEGORY_MAP) موجودة ككائن فعلي في lib/branchEligibility.ts فقط", () => {
    // نبحث عن التسلسل الحرفي الفعلي للمصفوفة (لا مجرد ذكر اسم فئة في تعليق
    // توضيحي، وهو استخدام مشروع منفصل تماماً موجود فعلاً في عدة ملفات).
    const literalArray = ["تكنولوجيا", "هندسة", "طبي", "تقنيات طبية مساندة", "علوم", "زراعة", "إدارة وتسويق"].join(
      '", "'
    );
    const hits = filesContaining(literalArray).filter((f) => f !== "lib/singleSourceOfTruth.test.ts");
    expect(hits).toEqual(["lib/branchEligibility.ts"]);
  });

  it('بوابة "المعدل >= 85" لا تظهر إلا في المواضع المعروفة والمُوثَّقة حالياً', () => {
    // ⚠️ هذه القائمة مؤقتة عمداً: البوابة لا تزال حبيسة app/quiz/page.tsx (لم
    // تُستخرَج إلى lib/recommendationEngine.ts بعد -- تلك مرحلة لاحقة من
    // الخطة). نسخة scripts/persona تحاكيها عمداً لتطابق سلوك المنصّة الفعلي.
    // أي ملف ثالث يحتوي هذا النمط = نسخة جديدة غير مقصودة، اكتشفها هذا الاختبار.
    const pattern = /grade\s*>=\s*85/;
    const hits = SOURCE_FILES.filter((f) => pattern.test(fs.readFileSync(f, "utf8"))).map((f) =>
      path.relative(ROOT, f).replace(/\\/g, "/")
    );
    expect(hits.sort()).toEqual(["app/quiz/page.tsx", "scripts/persona/persona-simulation-harness.mts"].sort());
  });

  it("scripts/archive لم يعد يحتوي أي نسخة من محرّك محاكاة الشخصيات (انتقل كاملاً إلى scripts/persona)", () => {
    const archiveDir = path.join(ROOT, "scripts", "archive");
    if (!fs.existsSync(archiveDir)) return;
    const stray = fs.readdirSync(archiveDir).filter((f) => f.startsWith("persona"));
    expect(stray).toEqual([]);
  });
});
