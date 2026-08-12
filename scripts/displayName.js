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

// حالة حافة حقيقية اكتُشفت أثناء التدقيق (2026-07-30): كلمة تحمل انعكاسَي
// "لا" متجاورين (مثال حقيقي من البيانات: "واالالت" الصحيحة "والالات" --
// "المكائن والآلات") -- استبدال /اال/g بلا تراكب (non-overlapping) يمرّ مرة
// واحدة فقط فيصحّح انعكاساً واحداً، لكن ناتج ذلك الاستبدال بالضبط يُنتج نمط
// "اال" جديداً عند حدود الاستبدال (ألف الاستبدال الأخيرة + ألف الحرف التالي
// الأصلي)، فيبقى غير مُصحَّح بالكامل بمرة واحدة. الحل: تكرار الاستبدال حتى
// الاستقرار (نقطة ثابتة) بدل الاعتماد على مرة واحدة.
function fixLamAlef(s) {
  let result = s;
  let previous;
  do {
    previous = result;
    result = result.replace(/اال/g, "الا");
  } while (result !== previous);
  return result;
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

// تطبيع لمطابقة تكرار الأقسام (لا للعرض) -- يبدأ من toDisplayName (يُصلح
// انعكاس "لا" أولاً، وإلا "طب االسنان" لا تُطابَق "طب الأسنان" إطلاقاً)، ثم
// يُسقط الهمزات وأداة التعريف وكل ألف متبقية وتاء مربوطة لمقارنة متسامحة.
// مُختبَر يدوياً (data/admission_rules.md §41) على أزواج حقيقية موجَبة
// وسالبة معاً -- ليس تضمين نصّي (containment) عمداً، لأن ذلك يُنتج مطابقات
// كاذبة خطيرة (مثال حقيقي فحصته: "علم النفس الاكلينيكي" يتضمّن جذوراً
// مشتركة مع "الإعلام" بعد إسقاط الألف، فتضمين ساذج كان سيدمجهما خطأً).
function normalizeForDedupMatch(s) {
  if (!s) return "";
  return toDisplayName(s)
    .replace(/[أإآ]/g, "ا")
    .replace(/(^|\s)ال/g, "$1")
    .replace(/ا/g, "")
    .replace(/ة/g, "ه")
    .replace(/[\/\-]/g, "")
    .replace(/\s+/g, "");
}

module.exports = { fixLamAlef, applyCorrections, toDisplayName, normalizeForDedupMatch };
