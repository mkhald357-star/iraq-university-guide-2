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

  it('بوابة "المعدل >= 85" الحرفية لا تظهر في أي ملف -- القيمة الآن ثابت وحيد مُسمّى', () => {
    // بعد استخراج lib/recommendationEngine.ts (MEDICAL_GATE_GRADE) من
    // app/quiz/page.tsx، وتحويل حزام محاكاة الشخصيات لاستدعاء rankMajors()
    // مباشرة بدل إعادة تنفيذ البوابة محلياً، لم يعد الرقم 85 مكتوباً حرفياً
    // كمقارنة في أي مكان -- فقط في تعريف الثابت نفسه. أي ظهور جديد لهذا
    // النمط = نسخة موازية غير مقصودة، يكتشفها هذا الاختبار فوراً.
    const pattern = /grade\s*>=\s*85/;
    const hits = SOURCE_FILES.filter((f) => pattern.test(fs.readFileSync(f, "utf8"))).map((f) =>
      path.relative(ROOT, f).replace(/\\/g, "/")
    );
    expect(hits).toEqual([]);
  });

  it("خط أنابيب الترتيب (rankMajors) مصدر وحيد، ولا مكوّن/سكربت يعيد تنفيذه محلياً", () => {
    // نبحث عن بصمة إعادة التنفيذ القديمة (فرز بحسب combinedScore + فلترة
    // بحسب فئة التخصص معاً في نفس الملف) خارج lib/recommendationEngine.ts
    // نفسه وملف اختباره التوصيفي.
    const signature = ["combinedScore", "allowedCat"];
    const allowList = new Set([
      "lib/recommendationEngine.ts",
      "lib/recommendationEngine.characterization.test.ts",
      "app/quiz/page.tsx", // يستهلك RankedMajor.combinedScore لإعادة الفرز التفاعلي بمنزلق السوق فقط، لا إعادة حساب
    ]);
    const hits = SOURCE_FILES.filter((f) => {
      const rel = path.relative(ROOT, f).replace(/\\/g, "/");
      if (allowList.has(rel)) return false;
      const content = fs.readFileSync(f, "utf8");
      return signature.every((s) => content.includes(s));
    }).map((f) => path.relative(ROOT, f).replace(/\\/g, "/"));
    expect(hits).toEqual([]);
  });

  it("scripts/archive لم يعد يحتوي أي نسخة من محرّك محاكاة الشخصيات (انتقل كاملاً إلى scripts/persona)", () => {
    const archiveDir = path.join(ROOT, "scripts", "archive");
    if (!fs.existsSync(archiveDir)) return;
    const stray = fs.readdirSync(archiveDir).filter((f) => f.startsWith("persona"));
    expect(stray).toEqual([]);
  });
});
