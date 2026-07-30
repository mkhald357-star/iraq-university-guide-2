// تشخيص فقط -- لا يعدّل أي بيانات ولا يُفشل البناء. يخرج تقريرين لمراجعة
// بشرية قبل ملء data/name-corrections.json (راجع قسم "بروتوكول المراجعة
// البشرية" في خطة إصلاح أسماء العرض):
//   reports/display-name-diff.csv  -- كل اسم كلية/قسم غيّره toDisplayName
//                                      فعلياً (قبل/بعد)، لمراجعة صحة الإصلاح
//                                      الآلي نفسه.
//   reports/unique-tokens.csv      -- كل كلمة فريدة عبر كل أسماء العرض
//                                      النهائية، مرتّبة بالتكرار -- تُراجَع
//                                      يدوياً بحثاً عن فساد متبقٍّ لا يحمل
//                                      نمط "اا" (غير قابل للكشف الآلي).
//
// الاستخدام: node scripts/audit-display-names.js
const fs = require("fs");
const path = require("path");
const { toDisplayName } = require("./displayName");

const ROOT = path.join(__dirname, "..");
const REPORTS_DIR = path.join(ROOT, "reports");
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));

const diffPairs = new Map(); // raw -> fixed
const tokenCounts = new Map();

function recordName(raw) {
  if (!raw) return;
  const fixed = toDisplayName(raw);
  if (fixed !== raw && !diffPairs.has(raw)) diffPairs.set(raw, fixed);
  for (const tok of fixed.split(/\s+/).filter(Boolean)) {
    tokenCounts.set(tok, (tokenCounts.get(tok) || 0) + 1);
  }
}

for (const uni of universities) {
  for (const college of uni.colleges) {
    recordName(college.name);
    for (const dept of college.departments) {
      recordName(dept.name);
    }
  }
}

function csvEscape(s) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const diffRows = [...diffPairs.entries()].sort((a, b) => a[0].localeCompare(b[0], "ar"));
fs.writeFileSync(
  path.join(REPORTS_DIR, "display-name-diff.csv"),
  ["raw,fixed", ...diffRows.map(([raw, fixed]) => `${csvEscape(raw)},${csvEscape(fixed)}`)].join("\n") + "\n",
  "utf8"
);

const tokenRows = [...tokenCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar"));
fs.writeFileSync(
  path.join(REPORTS_DIR, "unique-tokens.csv"),
  ["token,count", ...tokenRows.map(([tok, count]) => `${csvEscape(tok)},${count}`)].join("\n") + "\n",
  "utf8"
);

const remainingLamAlef = diffRows.filter(([, fixed]) => /اا/.test(fixed));

console.log(`display-name-diff.csv: ${diffRows.length} اسماً فريداً غيّره الإصلاح الآلي`);
console.log(`unique-tokens.csv: ${tokenCounts.size} كلمة فريدة عبر كل أسماء العرض النهائية`);
if (remainingLamAlef.length) {
  console.log(`تنبيه: ${remainingLamAlef.length} اسماً لا يزال يحمل نمط "اا" بعد الإصلاح الآلي -- راجعها يدوياً:`);
  for (const [raw, fixed] of remainingLamAlef) console.log(`  ${raw}  ->  ${fixed}`);
} else {
  console.log('لا يوجد أي اسم يحمل نمط "اا" بعد الإصلاح الآلي.');
}
