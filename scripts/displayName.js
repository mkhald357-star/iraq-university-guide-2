// يصلح أثر انعكاس رابطة "لا" في أسماء الأقسام/الكليات المستخرَجة من PDF
// لعرضها للطالب فقط -- لا يمسّ حقل name (مفتاح المطابقة في majorMatcher.ts)
// إطلاقاً. راجع data/admission_rules.md لتوثيق الأثر، وscripts/audit-display-
// names.js للتدقيق الكامل قبل ملء data/name-corrections.json.
//
// أثر تفكيك رابطة "لا": بعض استخراجات PDF تعكس ترتيب حرفَي "ل" و"ا" ضمن
// الرابطة، فينتج تسلسل "اا" (ألف مضاعفة) أينما وردت "لا" وسط كلمة -- تسلسل
// مستحيل في عربية صحيحة، فهو إشارة كشف موثوقة. الاستبدال الآمن هو
// "اال" -> "الا" (وليس "ال" -> "لا"، الذي كان سيحذف أداة التعريف الحقيقية
// "ال" من كل كلمة تقريباً).
const fs = require("fs");
const path = require("path");

const CORRECTIONS_PATH = path.join(__dirname, "..", "data", "name-corrections.json");

let corrections = {};
try {
  corrections = JSON.parse(fs.readFileSync(CORRECTIONS_PATH, "utf8"));
} catch (e) {
  corrections = {};
}

function fixLamAlef(s) {
  return s.replace(/اال/g, "الا");
}

// طبقة تصحيح يدوية إضافية (مراجَعة بشرياً، انظر بروتوكول المراجعة في الخطة)
// تُطبَّق *بعد* الإصلاح الآلي -- تغطي الحالات المتبقية التي لا يكتشفها نمط
// "اا" (تصحيح استثنائي بالاسم الكامل بعد الإصلاح الآلي)، أو تصحّح إصلاحاً
// آلياً غير دقيق لحالة بعينها.
function applyCorrections(s) {
  return Object.prototype.hasOwnProperty.call(corrections, s) ? corrections[s] : s;
}

function toDisplayName(s) {
  if (!s) return s;
  return applyCorrections(fixLamAlef(s));
}

module.exports = { fixLamAlef, applyCorrections, toDisplayName };
