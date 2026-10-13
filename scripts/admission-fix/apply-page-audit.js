// يطبّق سجل تدقيق صفحات الفصل 3 (reports/admission-fix/completion/page-audit.json) على data/raw/chapter3_additions.json.
// سجل التدقيق نتاج قراءة بصرية لصور صفحات الدليل (PDF 34-64) ومقارنتها بأقسام المنصة (PLAN-ADMISSION-COMPLETION.md).
//
// الأنواع المطبَّقة:
//   add          قسم/أقسام غائبة في كلية موجودة  → سجل إضافة بصفحة PDF ورقم الصف
//   addCollege   كلية غائبة بأقسامها             → سجل إضافة (يُنشئ البناء الكلية)
//   branchFix    قسم قائم فرعه غير معروف         → سجل إضافة بنفس اسم القسم القائم (يملأ directBranches)
//   removeAddition  حذف سجلات إضافة مؤكَّد خطؤها (تسرّب تجاور بين جامعتين)
// الأنواع غير المطبَّقة آلياً (تُذكر في التقرير فقط): note, collegeAlias, misplaced, campusFix, directApply.
//
// ثابت التكرار (idempotent): المفتاح جامعة|كلية|قسم؛ يُعاد تشغيله بلا تكرار. لا يمسّ سجلاً لم يكتبه
// بنفسه إلا بحذف صريح (removeAddition).
// الاستخدام: node scripts/admission-fix/apply-page-audit.js [--dry]
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const { normalizeForDedupMatch, toDisplayName } = require("../displayName");

const AUDIT = JSON.parse(fs.readFileSync(path.join(ROOT, "reports/admission-fix/completion/page-audit.json"), "utf8"));
const ADD_PATH = path.join(ROOT, "data/raw/chapter3_additions.json");
const additions = JSON.parse(fs.readFileSync(ADD_PATH, "utf8"));
const universities = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities;
const byId = new Map(universities.map((u) => [u.id, u]));
const DRY = process.argv.includes("--dry");

// بداية محتوى كل صفحة PDF في dalel.full.txt (علامة «-- N of 110 --» تُغلق الصفحة N)
const lines = fs.readFileSync(path.join(ROOT, "data/raw/dalel.full.txt"), "utf8").split("\n");
const pageStartLine = new Map();
let lastMarker = 0;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^-- (\d+) of \d+ --/);
  if (m) {
    pageStartLine.set(+m[1] + 1, i + 2); // الصفحة التالية تبدأ بعد العلامة
    lastMarker = +m[1];
  }
}
void lastMarker;

const keyOf = (s) => normalizeForDedupMatch(String(s || "").replace(/^قسم\s+/, ""));
const dispOf = (x) => x.displayName ?? x.name;
const jaccard = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  let i = 0;
  for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i || 1);
};
const toks = (s) =>
  toDisplayName(s)
    .replace(/^قسم\s+/, "")
    .split(/\s+/)
    .map((w) => normalizeForDedupMatch(w))
    .filter((w) => w.length >= 2);

function resolveCollege(u, display) {
  const want = normalizeForDedupMatch(display);
  const all = u.colleges.filter((c) => normalizeForDedupMatch(dispOf(c)) === want);
  if (all.length === 1) return all[0];
  if (all.length > 1) {
    const exact = all.filter((c) => dispOf(c).trim() === display.trim());
    if (exact.length === 1) return exact[0];
    // تعدّد أحرم: أكبر كلية أقساماً (الأساسية) — يُسجَّل في التقرير
    return all.sort((a, b) => b.departments.length - a.departments.length)[0];
  }
  // اسم بلاحقة حرم في المنصة ("الكلية التقنية الادارية/الكوفة"): يطابق ما قبل «/»
  const pref = u.colleges.filter((c) => normalizeForDedupMatch(dispOf(c).split("/")[0]) === want);
  if (pref.length === 1) return pref[0];
  return null;
}

const report = {
  applied: 0,
  addedDepartments: 0,
  branchFixes: 0,
  removed: 0,
  skippedExisting: [],
  unresolvedCollege: [],
  nearDuplicates: [],
  newColleges: [],
  notApplied: {},
};

const have = new Map(); // مفتاح جامعة|كلية|قسم → سجل إضافة قائم
for (const a of additions) have.set(`${a.university}|${a.college}|${keyOf(a.department)}`, a);

function pushAddition(u, collegeRaw, deptRaw, branch, rec, tag) {
  const k = `${u.name}|${collegeRaw}|${keyOf(deptRaw)}`;
  const exist = have.get(k);
  if (exist) {
    const merged = [...new Set([...(exist.branch || []), ...branch])];
    if (merged.length !== (exist.branch || []).length) {
      exist.branch = merged;
      report.branchFixes++;
    }
    return false;
  }
  const row = {
    university: u.name,
    college: collegeRaw,
    department: deptRaw,
    branch,
    sourceLine: pageStartLine.get(rec.pdfPage) ?? null,
    pdfPage: rec.pdfPage,
    pdfRow: rec.row ?? null,
    verifiedAt: "2026-10-12",
    sourceFile: "dalel_2025_22026.pdf (قراءة صورة الصفحة)",
    addedBy: `إتمام ${tag}: PLAN-ADMISSION-COMPLETION.md`,
  };
  additions.push(row);
  have.set(k, row);
  return true;
}

for (const rec of AUDIT.records) {
  const u = byId.get(rec.uni);
  if (rec.kind === "removeAddition") {
    const before = additions.length;
    for (let i = additions.length - 1; i >= 0; i--) {
      const a = additions[i];
      if (u && a.university === u.name && rec.colleges.includes(a.college)) additions.splice(i, 1);
    }
    report.removed += before - additions.length;
    continue;
  }
  if (!["add", "addCollege", "branchFix"].includes(rec.kind)) {
    report.notApplied[rec.kind] = (report.notApplied[rec.kind] || 0) + 1;
    continue;
  }
  if (!u) {
    report.unresolvedCollege.push({ ...rec, reason: "جامعة غير موجودة" });
    continue;
  }
  let col = resolveCollege(u, rec.college);
  if (!col && rec.kind !== "addCollege") {
    report.unresolvedCollege.push({ uni: rec.uni, college: rec.college, depts: rec.depts, pdfPage: rec.pdfPage });
    continue;
  }
  const collegeRaw = col ? col.name : rec.college;
  if (!col) report.newColleges.push({ uni: rec.uni, college: rec.college });
  for (const d of rec.depts) {
    const exist = col && col.departments.find((x) => keyOf(dispOf(x)) === keyOf(d) || keyOf(x.name) === keyOf(d));
    if (rec.kind === "branchFix") {
      if (!exist) {
        report.unresolvedCollege.push({
          uni: rec.uni,
          college: rec.college,
          dept: d,
          reason: "branchFix بلا قسم قائم",
        });
        continue;
      }
      if (pushAddition(u, collegeRaw, exist.name, rec.branch, rec, "تصحيح فرع")) report.branchFixes++;
      continue;
    }
    if (exist) {
      // قسم قائم: يُكمَّل فرعه فقط إن كان ناقصاً
      const missing = rec.branch.filter((b) => !(exist.branch || []).includes(b));
      if (missing.length && (exist.branch || []).length === 0) {
        if (pushAddition(u, collegeRaw, exist.name, rec.branch, rec, "تصحيح فرع")) report.branchFixes++;
      } else report.skippedExisting.push(`${u.id} | ${collegeRaw} | ${d}`);
      continue;
    }
    // تشابه كلمات مع قسم قائم في الكلية نفسها (تسمية بديلة محتملة): يُسجَّل للمراجعة ولا يُضاف
    if (col) {
      const near = col.departments.find((x) => jaccard(toks(d), toks(dispOf(x))) >= 0.67);
      if (near) {
        report.nearDuplicates.push({
          uni: rec.uni,
          college: collegeRaw,
          wanted: d,
          existing: dispOf(near),
          pdfPage: rec.pdfPage,
        });
        continue;
      }
    }
    const deptRaw = d === "عام" ? "عام" : `قسم ${d.replace(/^قسم\s+/, "")}`;
    if (pushAddition(u, collegeRaw, deptRaw, rec.branch, rec, rec.kind === "addCollege" ? "كلية غائبة" : "قسم غائب")) {
      report.addedDepartments++;
    }
  }
  report.applied++;
}

fs.mkdirSync(path.join(ROOT, "reports/admission-fix/completion"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "reports/admission-fix/completion/apply-report.json"),
  JSON.stringify(report, null, 1) + "\n",
  "utf8"
);
if (!DRY) fs.writeFileSync(ADD_PATH, JSON.stringify(additions, null, 2) + "\n", "utf8");
console.log(
  JSON.stringify(
    {
      records: AUDIT.records.length,
      addedDepartments: report.addedDepartments,
      branchFixes: report.branchFixes,
      removed: report.removed,
      skippedExisting: report.skippedExisting.length,
      unresolvedCollege: report.unresolvedCollege.length,
      nearDuplicates: report.nearDuplicates.length,
      newColleges: report.newColleges.length,
      notApplied: report.notApplied,
      dry: DRY,
    },
    null,
    1
  )
);
