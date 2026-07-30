const { describe, it, expect } = require("vitest");
const { fixLamAlef, applyCorrections, toDisplayName } = require("./displayName");
const fs = require("fs");
const path = require("path");

// نسخة مطابقة لـnormalizeArabic في lib/majorMatcher.ts -- تُستخدَم هنا فقط
// لاختبار الحماية: toDisplayName يجب ألا يغيّر نتيجة التطبيع إطلاقاً (أي لا
// يمسّ مفتاح المطابقة الفعلي، فقط ينظّف ما يُعرَض للطالب).
function normalizeArabic(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/(^|\s)ال/g, "$1")
    .replace(/ا/g, "")
    .replace(/\s+/g, "");
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
    expect(toDisplayName("قسم االلكترونيك واالتصاالت")).toBe("قسم الالكترونيك والاتصالات");
  });

  it("يعيد null/undefined/فارغ كما هو بلا خطأ", () => {
    expect(toDisplayName("")).toBe("");
    expect(toDisplayName(null)).toBe(null);
    expect(toDisplayName(undefined)).toBe(undefined);
  });

  it("اختبار الحماية: لا يغيّر نتيجة التطبيع (normalizeArabic) لأي اسم -- الإصلاح عرض فقط، لا يمسّ مطابقة", () => {
    const samples = [
      "قسم االلكترونيك واالتصاالت",
      "كلية االدارة واالقتصاد",
      "قسم الكيميائية االحيائية",
      "كلية هندسة الذكاء االصطناعي",
      "قسم الرياضيات",
      "كلية العلوم",
    ];
    for (const raw of samples) {
      expect(normalizeArabic(toDisplayName(raw))).toBe(normalizeArabic(raw));
    }
  });

  it("اختبار الحماية عبر عيّنة حقيقية من data/universities.json (كل الكليات والأقسام)", () => {
    const ROOT = path.join(__dirname, "..");
    const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
    let checked = 0;
    for (const uni of universities) {
      for (const college of uni.colleges) {
        expect(normalizeArabic(toDisplayName(college.name))).toBe(normalizeArabic(college.name));
        checked++;
        for (const dept of college.departments) {
          expect(normalizeArabic(toDisplayName(dept.name))).toBe(normalizeArabic(dept.name));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
