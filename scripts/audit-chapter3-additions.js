// تدقيق data/raw/chapter3_additions.json ضد النص الخام لدليل الطالب الرسمي
// (data/raw/dalel.full.txt) -- تشخيص فقط، لا يعدّل أي بيانات ولا يُفشل البناء.
// السبب: هذا الملف هو المصدر الوحيد غير المُتحقَّق منه آلياً في خط أنابيب
// بناء data/universities.json (جدول الحدود الدنيا التنافسي مُدقَّق مسبقاً 3
// مرات مستقلة، انظر data/admission_rules.md §12) -- وهو نفسه مصدر عطلَين
// مؤكَّدَين (جامعة تكنولوجيا المعلومات والاتصالات، جامعة البصرة للنفط والغاز)
// أُصلحا يدوياً في جولة سابقة، موثَّقة في data/admission_rules.md §16.
//
// منهجية مُتعلَّمة من فشل محاولة أولى سابقة (سكربت تحقّق مؤقت غير محفوظ):
// "من عنوان الجامعة حتى العنوان التالي" ينتج 168/178 نتيجة كاذبة لأن الوثيقة
// تُدرج بيانات نفس الجامعة أحياناً في أقسام غير متجاورة (مثال: كليات هندسة
// النفط والغاز لجامعة الحمدانية). البديل هنا: نافذة حول *كل* ظهور لاسم
// الجامعة في الوثيقة كاملة (لا قسم متجاور واحد)، واتحاد كل النوافذ.
//
// الاستخدام: node scripts/audit-chapter3-additions.js
// المخرَج: reports/chapter3-audit.csv (بيانات: يحتاج مراجعة يدوية، لا حكماً نهائياً)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WINDOW_LINES = 40; // أسطر قبل/بعد كل ظهور لاسم الجامعة

function normalizeArabic(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/(^|\s)ال/g, "$1")
    .replace(/ا/g, "")
    .replace(/\s+/g, "");
}

const rawLines = fs.readFileSync(path.join(ROOT, "data/raw/dalel.full.txt"), "utf8").split("\n");
const additions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/chapter3_additions.json"), "utf8"));

// كلمة مرساة لكل جامعة: آخر كلمة محتوى (>2 أحرف بعد التطبيع) في اسمها --
// عادة الأكثر تمييزاً (تتفادى كلمات عامة كـ"جامعة"/"كلية" في بداية الاسم).
function anchorWord(uniName) {
  const words = uniName.split(/\s+/).filter((w) => normalizeArabic(w).length > 2);
  return words.length ? words[words.length - 1] : uniName;
}

function findWindows(uniName) {
  const anchor = normalizeArabic(anchorWord(uniName));
  const hits = [];
  rawLines.forEach((line, idx) => {
    if (normalizeArabic(line).includes(anchor)) hits.push(idx);
  });
  // ادمج النوافذ المتقاطعة/المتلاصقة إلى نطاقات موحّدة
  const ranges = hits
    .map((i) => [Math.max(0, i - WINDOW_LINES), Math.min(rawLines.length - 1, i + WINDOW_LINES)])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push(r);
  }
  return { anchor, hitCount: hits.length, ranges: merged };
}

const rows = [];
let found = 0;
let needsReview = 0;

for (const entry of additions) {
  const { anchor, hitCount, ranges } = findWindows(entry.university);
  const deptNorm = normalizeArabic(entry.department);
  const collegeNorm = normalizeArabic(entry.college);

  let deptFoundIn = null;
  for (const [start, end] of ranges) {
    const windowText = normalizeArabic(rawLines.slice(start, end + 1).join(" "));
    if (windowText.includes(deptNorm)) {
      deptFoundIn = [start + 1, end + 1]; // أرقام أسطر 1-indexed للمراجعة اليدوية
      break;
    }
  }

  const collegeFoundAnywhere = ranges.some(([start, end]) =>
    normalizeArabic(rawLines.slice(start, end + 1).join(" ")).includes(collegeNorm)
  );

  const status = deptFoundIn ? "FOUND" : "NEEDS_REVIEW";
  if (status === "FOUND") found++;
  else needsReview++;

  rows.push({
    university: entry.university,
    college: entry.college,
    department: entry.department,
    anchorWord: anchor,
    anchorHits: hitCount,
    status,
    collegeFoundAnywhereInWindows: collegeFoundAnywhere,
    lineRangeIfFound: deptFoundIn ? `${deptFoundIn[0]}-${deptFoundIn[1]}` : "",
  });
}

const OUT_DIR = path.join(ROOT, "reports");
fs.mkdirSync(OUT_DIR, { recursive: true });

const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = [
  "university,college,department,anchorWord,anchorHits,status,collegeFoundAnywhereInWindows,lineRangeIfFound",
  ...rows.map((r) =>
    [
      r.university,
      r.college,
      r.department,
      r.anchorWord,
      r.anchorHits,
      r.status,
      r.collegeFoundAnywhereInWindows,
      r.lineRangeIfFound,
    ]
      .map(esc)
      .join(",")
  ),
].join("\n");
fs.writeFileSync(path.join(OUT_DIR, "chapter3-audit.csv"), "﻿" + csv);

console.log(`إجمالي السجلات: ${additions.length}`);
console.log(`FOUND (القسم موجود ضمن نافذة نصّية قريبة من اسم الجامعة): ${found}`);
console.log(`NEEDS_REVIEW (يحتاج تحقّقاً يدوياً مباشراً -- ليس حكماً نهائياً بالخطأ): ${needsReview}`);
console.log(`\nالتقرير الكامل: reports/chapter3-audit.csv`);
process.exit(0); // تشخيص فقط -- لا يُفشل البناء
