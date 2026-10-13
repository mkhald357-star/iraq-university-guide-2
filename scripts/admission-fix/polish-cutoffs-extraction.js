// يحوّل مخرجات extract-cutoffs-hierarchy.py (rows.json) إلى ملفات القراءة النهائية بأسماء مصحَّحة
// (إصلاح تشوّه «ال» عبر scripts/displayName.js) وفرز عربي:
//   1-with-department.csv · 2-college-or-track-only.csv · all-rows-ordered.csv · hierarchy.md · hierarchy.json
const fs = require("fs");
const path = require("path");
const { toDisplayName } = require("../displayName");

const DIR = path.join(__dirname, "..", "..", "reports", "admission-fix", "cutoffs-extraction");
// طبقة نص الـPDF تعكس الأقواس في النص العربي («)صالح الدين(») وتبدّل «لا»: يُصلَح للعرض فقط
const clean = (v) =>
  toDisplayName(v || "")
    .replace(/\)([^()]*)\(/g, "($1)")
    .replace(/صالح الدين/g, "صلاح الدين");
const rows = JSON.parse(fs.readFileSync(path.join(DIR, "rows.json"), "utf8")).map((r) => ({
  ...r,
  college: clean(r.college),
  campus: clean(r.campus),
  track: clean(r.track),
  department: clean(r.department),
}));

const ar = new Intl.Collator("ar");
const cmp = (a, b) =>
  ar.compare(a.province, b.province) ||
  ar.compare(a.university, b.university) ||
  ar.compare(a.college, b.college) ||
  ar.compare(a.campus, b.campus) ||
  ar.compare(a.track, b.track) ||
  ar.compare(a.department, b.department) ||
  ar.compare(a.branch, b.branch) ||
  ar.compare(a.gender, b.gender) ||
  b.average - a.average;
rows.sort(cmp);

const HEAD = [
  ["province", "المحافظة"],
  ["university", "الجامعة"],
  ["college", "الكلية/المعهد"],
  ["campus", "الحرم"],
  ["track", "المسار"],
  ["department", "القسم"],
  ["level", "مستوى الصف"],
  ["branch", "الفرع"],
  ["gender", "الجنس"],
  ["quota", "حصة"],
  ["total", "المجموع"],
  ["average", "المعدل"],
  ["rank", "المفاضلة"],
  ["page", "صفحة الملف"],
  ["row_on_page", "رقم الصف في الصفحة"],
];
const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
function csv(list) {
  return (
    "\uFEFF" +
    [HEAD.map((h) => q(h[1])).join(",")].concat(list.map((r) => HEAD.map((h) => q(r[h[0]])).join(","))).join("\r\n") +
    "\r\n"
  );
}
fs.writeFileSync(path.join(DIR, "all-rows-ordered.csv"), csv(rows));
fs.writeFileSync(path.join(DIR, "1-with-department.csv"), csv(rows.filter((r) => r.department)));
fs.writeFileSync(path.join(DIR, "2-college-or-track-only.csv"), csv(rows.filter((r) => !r.department)));

// الشجرة
const tree = {};
for (const r of rows) {
  const col = [r.college, r.campus, r.track].filter(Boolean).join(" / ");
  const dep = r.department || "—";
  ((((tree[r.province] ||= {})[r.university] ||= {})[col] ||= {})[dep] ||= []).push(r);
}
const val = (r) =>
  `${r.branch}${r.gender === "مختلط" ? "" : " " + r.gender}${r.quota ? " (حصة)" : ""} ${r.average.toFixed(2)}`;
const L = [
  "# الحدود الدنيا للقبول المركزي 2025-2026 — ترتيب هرمي",
  "",
  "المحافظة ← الجامعة ← الكلية/المعهد (+الحرم/المسار) ← القسم. تحت كل كلية: الأقسام التي لها صف باسمها أولاً، ثم سطر «حد الكلية/المسار» إن وُجد.",
  "الأرقام: المعدل لكل فرع (والجنس إن خُصِّص). المصدر: PDF الوزارة، طبقة النص، 1,222 صفاً.",
  "",
];
const stats = {
  provinces: 0,
  universities: 0,
  colleges: 0,
  collegesWithBoth: 0,
  collegesOnlyCollegeLevel: 0,
  collegesOnlyDept: 0,
};
for (const prov of Object.keys(tree).sort(ar.compare)) {
  stats.provinces++;
  L.push(`## ${prov}`);
  for (const uni of Object.keys(tree[prov]).sort(ar.compare)) {
    stats.universities++;
    L.push(`### ${uni}`);
    for (const col of Object.keys(tree[prov][uni]).sort(ar.compare)) {
      stats.colleges++;
      const deps = tree[prov][uni][col];
      const named = Object.keys(deps)
        .filter((d) => d !== "—")
        .sort(ar.compare);
      const hasCollegeLevel = !!deps["—"];
      if (named.length && hasCollegeLevel) stats.collegesWithBoth++;
      else if (named.length) stats.collegesOnlyDept++;
      else stats.collegesOnlyCollegeLevel++;
      L.push(`- **${col}**`);
      for (const d of named) L.push(`  - ${d}: ${deps[d].map(val).join(" · ")}`);
      if (hasCollegeLevel)
        L.push(
          `  - ↳ حد ${named.length ? "الكلية/المسار (للأقسام بلا صف خاص)" : "الكلية/المسار (لا أقسام مذكورة)"}: ${deps["—"].map(val).join(" · ")}`
        );
    }
  }
  L.push("");
}
// قائمة الكليات/المعاهد (سطر لكل كلية) بحالتها: أقسام فقط | أقسام + حد كلية | حد كلية فقط (لا أقسام مذكورة)
const colRows = [];
for (const prov of Object.keys(tree).sort(ar.compare))
  for (const uni of Object.keys(tree[prov]).sort(ar.compare))
    for (const col of Object.keys(tree[prov][uni]).sort(ar.compare)) {
      const deps = tree[prov][uni][col];
      const named = Object.keys(deps).filter((d) => d !== "—");
      const cl = deps["—"];
      colRows.push({
        province: prov,
        university: uni,
        college: col,
        status: named.length ? (cl ? "أقسام + حد كلية/مسار" : "أقسام فقط") : "حد كلية/مسار فقط (لا أقسام مذكورة)",
        departments: named.length,
        collegeLevel: cl ? cl.map(val).join(" · ") : "",
        names: named.sort(ar.compare).join(" | "),
      });
    }
const CH = [
  ["province", "المحافظة"],
  ["university", "الجامعة"],
  ["college", "الكلية/المعهد (+الحرم/المسار)"],
  ["status", "الحالة"],
  ["departments", "عدد الأقسام ذات الصف الخاص"],
  ["collegeLevel", "حد الكلية/المسار"],
  ["names", "الأقسام ذات الصف الخاص"],
];
fs.writeFileSync(
  path.join(DIR, "3-colleges-status.csv"),
  "﻿" +
    [CH.map((h) => q(h[1])).join(",")].concat(colRows.map((r) => CH.map((h) => q(r[h[0]])).join(","))).join("\r\n") +
    "\r\n"
);
fs.writeFileSync(path.join(DIR, "hierarchy.md"), L.join("\n") + "\n");
fs.writeFileSync(path.join(DIR, "hierarchy.json"), JSON.stringify(tree, null, 1));
console.log(JSON.stringify({ rows: rows.length, ...stats }));
