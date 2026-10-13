// م5 البند 3: تصنيف الأقسام الحكومية التي لم تُطابَق مع جدول «الفروع المقبولة» في الدليل (audit-guide-branches).
// الفئات (لكل قسم سبب صريح، لا قسم بلا تصنيف):
//   college-not-in-guide : لا صف في الدليل لكليته أصلاً (مطابقة الكلية بدرجة ≥ 2 فاشلة)
//   name-variant         : للقسم نظير قريب في بنود كليته (تشابه كلمات ≥ 0.5): اختلاف تسمية أو تشوّه نص
//   official-table-only  : القسم موجود في جدول الحدود الرسمي (له حد منشور) وغائب عن جدول الدليل
//   chapter3-only        : مصدره إضافة يدوية من الدليل نفسه (chapter3_additions) بصياغة لا يلتقطها المطابِق
//   new-or-unlisted      : لا حد منشور ولا صف دليل (مسائي فقط/مستحدث): فرعه «غير معروف» ولا يُعدّ مؤهِّلاً
// للقراءة فقط. المخرجات: reports/admission-fix/unmatched-guide-classification.csv و.json
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const { toDisplayName } = require("../displayName");
const { _internals } = require("../guideBranches");
const { guideKey, words, collegeLevel } = _internals;

const guide = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/chapter3_branches.json"), "utf8"));
const unis = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities;
const audit = JSON.parse(
  fs.readFileSync(path.join(ROOT, "reports/admission-fix/audit/guide-branches-audit.json"), "utf8")
);
const additions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/chapter3_additions.json"), "utf8"));

const addKey = new Set(additions.map((a) => `${a.university}|${a.college}|${a.department}`));
const site = (u) => (u.website || "").replace(/^www\./, "");
const byUni = new Map(unis.map((u) => [u.name, u]));
const rowsBySite = new Map();
for (const g of guide) (rowsBySite.get(g.website) || rowsBySite.set(g.website, []).get(g.website)).push(g);

const jaccard = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  let i = 0;
  for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i || 1);
};
const keys = (s) =>
  words(toDisplayName(s || ""))
    .map(guideKey)
    .filter((k) => k.length >= 2);

const out = [];
for (const r of audit.unmatched) {
  const u = byUni.get(r.university);
  const c = u && u.colleges.find((x) => (x.displayName ?? x.name) === r.college || x.name === r.college);
  const d = c && c.departments.find((x) => x.name === r.department || (x.displayName ?? x.name) === r.department);
  const rows = (u && rowsBySite.get(site(u))) || [];
  const matchedRows = c
    ? rows.filter((g) => collegeLevel(c.name, { ...g, entryWords: (g.entry || g.items).flatMap((t) => words(t)) }) >= 2)
    : [];
  let cat;
  let nearest = null;
  let line = null;
  if (!matchedRows.length) {
    cat = "college-not-in-guide";
  } else {
    const dk = keys(r.department.replace(/^قسم\s+/, ""));
    let best = { s: 0 };
    for (const g of matchedRows)
      for (const it of g.items) {
        const s = jaccard(dk, keys(it));
        if (s > best.s) best = { s, it, line: g.sourceLine };
      }
    if (best.s >= 0.5) {
      cat = "name-variant";
      nearest = best.it;
      line = best.line;
    } else if (d && addKey.has(`${r.university}|${c.name}|${d.name}`)) {
      cat = "chapter3-only";
    } else if (d && d.cutoffs && d.cutoffs.length && d.branchBasis !== "chapter3") {
      cat = "official-table-only";
    } else {
      cat = "new-or-unlisted";
    }
  }
  out.push({
    university: r.university,
    college: r.college,
    department: r.department,
    branches: r.branches,
    category: cat,
    nearestGuideItem: nearest,
    sourceLine: line,
    hasOfficialCutoff: !!(d && d.cutoffs && d.cutoffs.length),
  });
}
const summary = out.reduce((m, x) => ((m[x.category] = (m[x.category] || 0) + 1), m), {});
const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(
  path.join(ROOT, "reports/admission-fix/unmatched-guide-classification.csv"),
  "﻿" +
    ["الجامعة,الكلية,القسم,الفروع,الفئة,أقرب بند في الدليل,سطر المصدر,له حد رسمي"]
      .concat(
        out.map((x) =>
          [
            x.university,
            x.college,
            x.department,
            (x.branches || []).join("+"),
            x.category,
            x.nearestGuideItem,
            x.sourceLine,
            x.hasOfficialCutoff ? "نعم" : "لا",
          ]
            .map(q)
            .join(",")
        )
      )
      .join("\n") +
    "\n",
  "utf8"
);
fs.writeFileSync(
  path.join(ROOT, "reports/admission-fix/unmatched-guide-classification.json"),
  JSON.stringify({ total: out.length, summary, rows: out }, null, 2) + "\n",
  "utf8"
);
console.log(JSON.stringify({ total: out.length, summary }, null, 1));
