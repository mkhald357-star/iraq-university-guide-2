// م4: مطابقة صارمة صفاً بصف بين نص PDF «الحدود الدنيا للقبول المركزي» (data/raw/hodod.full.txt)
// والخام المستخرَج (data/raw/cutoffs_2025_2026.json) لكل الصفحات 1-24، مستقلة عن parse-cutoffs.js:
//  1) كل سطر بيانات في النص يقابله صف خام بنفس الترتيب والعدد، بالمجموع والمعدل والمفاضلة والفرع والجنس.
//  2) فحص حسابي مستقل للنص نفسه: المعدل = المجموع ÷ 7 (سقف المجموع 700 = 100%) بدقة ±0.01، فيكشف
//     رقماً مشوَّهاً في الاستخراج من PDF حتى لو طابق الخام النص.
//  3) صفحة كل صف، وعدد الصفوف في كل صفحة.
// للقراءة فقط. المخرجات: reports/admission-fix/audit/raw-vs-text-audit.json
//
// الاستخدام: node scripts/admission-fix/audit-raw-vs-text.js [--strict]
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "reports", "admission-fix", "audit");
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/cutoffs_2025_2026.json"), "utf8"));
const lines = fs.readFileSync(path.join(ROOT, "data/raw/hodod.full.txt"), "utf8").split("\n");

const BRANCHES = new Set(["علمي", "ادبي", "أدبي", "فنون"]);
const GENDERS = new Set(["مختلط", "ذكر", "انثى", "أنثى"]);
const normBranch = (b) => (b === "ادبي" ? "أدبي" : b);
const normGender = (g) => (g === "انثى" ? "أنثى" : g);

const textRows = [];
let page = 0;
for (const line of lines) {
  const pm = line.match(/^-- (\d+) of \d+ --/);
  if (pm) {
    page = +pm[1];
    continue;
  }
  if (!line.includes("\t")) continue;
  const t = line
    .split("\t")
    .map((x) => x.trim())
    .filter(Boolean);
  if (t.length < 6) continue;
  const gender = t[t.length - 1];
  const branch = t[t.length - 2];
  const rank = t[t.length - 3];
  const avg = t[t.length - 4];
  const total = t[t.length - 5];
  if (!GENDERS.has(gender) || !BRANCHES.has(branch)) continue;
  if (!/^\d+$/.test(rank) || !/^\d+(\.\d+)?$/.test(avg) || !/^\d+(\.\d+)?$/.test(total)) continue;
  if (t.length - 5 === 0) continue;
  textRows.push({
    page,
    path: t.slice(0, t.length - 5).join(" "),
    total: +total,
    avg: +avg,
    rank: +rank,
    branch: normBranch(branch),
    gender: normGender(gender),
  });
}

const problems = [];
const perPage = {};
const n = Math.max(textRows.length, raw.length);
for (let i = 0; i < n; i++) {
  const t = textRows[i];
  const r = raw[i];
  if (!t || !r) {
    problems.push({ idx: i + 1, kind: "countMismatch", text: !!t, raw: !!r });
    continue;
  }
  perPage[t.page] = (perPage[t.page] || 0) + 1;
  const diffs = [];
  if (t.total !== r.totalScore) diffs.push(`المجموع نص ${t.total} / خام ${r.totalScore}`);
  if (t.avg !== r.averagePercent) diffs.push(`المعدل نص ${t.avg} / خام ${r.averagePercent}`);
  if (t.rank !== r.rank) diffs.push(`المفاضلة نص ${t.rank} / خام ${r.rank}`);
  if (t.branch !== normBranch(r.branch)) diffs.push(`الفرع نص ${t.branch} / خام ${r.branch}`);
  if (t.gender !== normGender(r.gender)) diffs.push(`الجنس نص ${t.gender} / خام ${r.gender}`);
  // المسار: جامعة وكلية وقسم الخام يجب أن تظهر كلها داخل مسار النص نفسه (بلا أي حرف مفقود)
  const squash = (s) => (s || "").replace(/[\s/]+/g, "");
  const tp = squash(t.path);
  for (const [k, v] of [
    ["الجامعة", r.university],
    ["الكلية", r.college],
    ["القسم", r.department],
    ...(r.qualifiers || []).map((q) => ["المؤهِّل", q]),
  ]) {
    if (v && !tp.includes(squash(v))) diffs.push(`${k} «${v}» غير موجود في مسار النص`);
  }
  if (diffs.length) problems.push({ idx: i + 1, page: t.page, path: t.path, diffs });
  const ratio = t.total / 7;
  if (Math.abs(ratio - t.avg) > 0.0101) {
    problems.push({
      idx: i + 1,
      page: t.page,
      path: t.path,
      kind: "avgNotTotalOver7",
      diffs: [`المجموع ${t.total} ÷ 7 = ${ratio.toFixed(2)} لا المعدل ${t.avg}`],
    });
  }
}

const summary = {
  textRows: textRows.length,
  rawRows: raw.length,
  pages: Object.keys(perPage).length,
  rowsCompared: Math.min(textRows.length, raw.length),
  problems: problems.length,
};
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, "raw-vs-text-audit.json"),
  JSON.stringify({ summary, rowsPerPage: perPage, problems }, null, 2) + "\n",
  "utf8"
);
console.log(JSON.stringify(summary, null, 1));
problems.slice(0, 30).forEach((p) => console.log(`  #${p.idx} ص${p.page ?? "?"} ${p.kind || "diff"}: ${(p.diffs || []).join(" | ")}`));
if (process.argv.includes("--strict") && problems.length) process.exit(1);
