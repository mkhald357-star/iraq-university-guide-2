import { describe, it, expect } from "vitest";
import { fixLamAlef, applyCorrections, toDisplayName } from "./displayName.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ملاحظة مهمّة اكتُشفت أثناء كتابة هذا الاختبار: normalizeArabic الكاملة
// (lib/majorMatcher.ts، بما فيها حذف "ال" التعريف من أول الكلمة تحديداً) لا
// تُعطي بالضرورة نفس النتيجة قبل وبعد fixLamAlef -- لأن انعكاس "لا" الأصلي قد
// يُخفي أو يُظهر نمط "ال" في أول الكلمة بالصدفة (مثال حقيقي من البيانات:
// "طب االسنان" الخام لا يبدأ سطره الفرعي بـ"ال" فلا تُسقَط اللام، بينما بعد
// الإصلاح "طب الاسنان" يبدأ فعلاً بـ"ال" فتُسقَط) -- وهذا غير ضارّ إطلاقاً
// لأن المطابقة الفعلية تعمل دائماً على d.name الخام فقط، لا على displayName
// أبداً، فلا يتقاطع المساران. الاختبار الصحيح هنا هو اختبار أضيق وحقيقي دوماً:
// fixLamAlef لا يفعل شيئاً غير إعادة ترتيب حرفي "ا"/"ل" المتجاورين (يستبدل
// 3 أحرف بنفس الأحرف الثلاثة بترتيب مختلف) -- فحذف كل الألفات (بلا قاعدة "ال"
// الخاصة بأول الكلمة) يجب أن يبقى مطابقاً تماماً قبل وبعد الإصلاح دائماً.
function stripAllAlef(text) {
  return text.toLowerCase().trim().replace(/[أإآ]/g, "ا").replace(/ا/g, "").replace(/\s+/g, "");
}

describe("fixLamAlef", () => {
  it("يصلح انعكاس رابطة لا وسط الكلمة", () => {
    expect(fixLamAlef("قسم االلكترونيك واالتصاالت")).toBe("قسم الالكترونيك والاتصالات");
  });

  it("يصلح كلية الإدارة والاقتصاد المشوَّهة", () => {
    expect(fixLamAlef("كلية االدارة واالقتصاد")).toBe("كلية الادارة والاقتصاد");
  });

  it("يصلح قسم الكيمياء الحيائية المشوَّه", () => {
    expect(fixLamAlef("قسم الكيميائية االحيائية")).toBe("قسم الكيميائية الاحيائية");
  });

  it("لا يمسّ أداة التعريف العادية (ال) بلا أثر انعكاس", () => {
    expect(fixLamAlef("كلية العلوم")).toBe("كلية العلوم");
    expect(fixLamAlef("قسم اللغة العربية")).toBe("قسم اللغة العربية");
  });

  it("لا يغيّر اسماً خالياً من نمط اا إطلاقاً", () => {
    expect(fixLamAlef("قسم الرياضيات")).toBe("قسم الرياضيات");
  });
});

describe("applyCorrections", () => {
  it("يعيد النص كما هو إن لم يوجد تصحيح يدوي له", () => {
    expect(applyCorrections("اسم غير موجود في القاموس")).toBe("اسم غير موجود في القاموس");
  });
});

describe("toDisplayName", () => {
  it("يطبّق الإصلاح الآلي على الأسماء المشوَّهة", () => {
    expect(toDisplayName("قسم االلكترونيك واالتصاالت")).toBe("قسم الإلكترونيك والاتصالات");
  });

  it("يعيد null/undefined/فارغ كما هو بلا خطأ", () => {
    expect(toDisplayName("")).toBe("");
    expect(toDisplayName(null)).toBe(null);
    expect(toDisplayName(undefined)).toBe(undefined);
  });

  it("اختبار الحماية: fixLamAlef إعادة ترتيب حرفي بحت -- حذف كل الألفات يبقى مطابقاً قبل وبعد الإصلاح", () => {
    const samples = [
      "قسم االلكترونيك واالتصاالت",
      "كلية االدارة واالقتصاد",
      "قسم الكيميائية االحيائية",
      "كلية هندسة الذكاء االصطناعي",
      "قسم الرياضيات",
      "كلية العلوم",
    ];
    for (const raw of samples) {
      expect(stripAllAlef(toDisplayName(raw))).toBe(stripAllAlef(raw));
    }
  });

  it("اختبار الحماية عبر عيّنة حقيقية من data/universities.json (كل الكليات والأقسام)", () => {
    const ROOT = path.join(__dirname, "..");
    const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
    let checked = 0;
    for (const uni of universities) {
      for (const college of uni.colleges) {
        expect(stripAllAlef(toDisplayName(college.name))).toBe(stripAllAlef(college.name));
        checked++;
        for (const dept of college.departments) {
          expect(stripAllAlef(toDisplayName(dept.name))).toBe(stripAllAlef(dept.name));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
