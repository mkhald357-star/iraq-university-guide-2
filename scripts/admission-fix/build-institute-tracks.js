// يربط كل قسم تقني بلا حد خاص بـ«مساره» (التخصصات الطبية/الهندسية/الإدارية/الزراعية، أو الفنون التطبيقية)
// بمصدر صريح لكل ربط، فيصل إليه حد المسار المنشور في «الحدود الدنيا للقبول المركزي».
// المخرجات: data/institute-tracks.json (تقرأه build-universities-data.js).
//
// المصادر (بالترتيب، وكلها نصية صريحة لا تخمين بالاسم):
//   evening   جدول الدراسة المسائية: اسم الكلية «…/التخصصات الهندسية» أو campusOrTrack = «التخصصات / االدارية»
//   pageAudit صفوف تدقيق صور الدليل (page-audit.json: صفحة PDF ورقم صف)، ومساره من عمود الكلية في ذلك الصف
//   guideText جدول الفروع المقبولة في نص الدليل (chapter3_branches.json)، ومساره في اسم الكلية نفسه
//   manual    قراءة بصرية موثَّقة بصفحة ورقم صف (حالات لا يلتقطها النص)
// تعارض مصدرين ← لا ربط ويُسجَّل في التقرير. بلا مصدر ← لا ربط.
//
// ⚠️ يقرأ المظلات من data/universities.json، فيجب أن يكون مبنياً **بلا** توزيع المسار:
//   SKIP_TRACKS=1 node scripts/build-universities-data.js
//   node scripts/admission-fix/build-institute-tracks.js
//   node scripts/build-universities-data.js
// الاستخدام: node scripts/admission-fix/build-institute-tracks.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const { normalizeForDedupMatch: ND, toDisplayName } = require("../displayName");
const { _internals: I } = require("../guideBranches");

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const universities = read("data/universities.json").universities.filter((u) => u.type === "حكومية");
const guide = read("data/raw/chapter3_branches.json");
const evRaw = read("data/raw/evening_study_2025_2026.json");
const evening = Array.isArray(evRaw) ? evRaw : evRaw.rows;
const pageAudit = read("reports/admission-fix/completion/page-audit.json").records.filter(
  (r) => r.kind === "add" || r.kind === "branchFix"
);

const { trackFromText, umbrellaTrack } = require("../instituteTracks");

const nd = (s) => ND(toDisplayName(String(s || "")).replace(/^قسم\s+/, ""));
const inst = (s) => ND(toDisplayName(String(s || "").split("/")[0]));

// (1) المسائي
const evMap = new Map();
for (const r of evening) {
  const t = trackFromText((r.college || "") + " " + (r.campusOrTrack || ""));
  if (!t || !r.department) continue;
  const k = nd(r.university) + "|" + inst(r.college) + "|" + nd(r.department);
  (evMap.get(k) || evMap.set(k, new Set()).get(k)).add(t);
}

// (2) صفوف صفحات الدليل: مسار كل صف من كتلة النص (علامة «-- N of 110 --» تُغلق الصفحة N)
const lines = fs.readFileSync(path.join(ROOT, "data/raw/dalel.full.txt"), "utf8").split("\n");
const pageStart = new Map();
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^-- (\d+) of \d+ --/);
  if (m) pageStart.set(+m[1] + 1, i + 1);
}
const rowTrack = new Map();
for (let p = 56; p <= 64; p++) {
  const s = pageStart.get(p);
  const e = pageStart.get(p + 1) || lines.length;
  let cur = null;
  let buf = "";
  const flush = () => {
    if (cur != null) {
      const t = trackFromText(buf);
      if (t) rowTrack.set(`${p}:${cur}`, t);
    }
    buf = "";
  };
  for (let i = s; i < e; i++) {
    const m = lines[i].match(/^(\d{1,2})(\s*\t.*|\s*)$/);
    if (m) {
      flush();
      cur = +m[1];
      buf = lines[i];
    } else buf += " " + lines[i];
  }
  flush();
}
const paMap = new Map();
for (const r of pageAudit) {
  const t = rowTrack.get(`${r.pdfPage}:${r.row}`);
  if (!t) continue;
  const u = universities.find((x) => x.id === r.uni);
  if (!u) continue;
  for (const d of r.depts) {
    const k = nd(u.name) + "|" + inst(r.college) + "|" + nd(d);
    (paMap.get(k) || paMap.set(k, new Set()).get(k)).add(t);
  }
}

// (3) نص جدول الفروع المقبولة
const groupsBySite = new Map();
for (const g of guide) {
  const t = trackFromText((g.entry || []).join(" "));
  if (t) (groupsBySite.get(g.website) || groupsBySite.set(g.website, []).get(g.website)).push({ ...g, track: t });
}
const site = (u) => (u.website || "").replace(/^www\./, "");

// (4) يدوي موثَّق بصفحة PDF ورقم صف
const MANUAL = [
  {
    university: "الجامعة التقنية الوسطى",
    college: "كلية البوليتكنك بغداد",
    track: "فنون تطبيقية",
    departments: ["تقنيات التصميم الداخلي", "تقنيات الصياغة والمجوهرات", "تقنيات الخزف"],
    evidence: "dalel_2025_22026.pdf ص63 الصف 31: «كلية البوليتكنك بغداد / الفنون التطبيقية»",
  },
  {
    university: "الجامعة التقنية الشمالية",
    college: "المعهد التقني الدور",
    track: "ادارية",
    departments: ["تقنيات الادارة القانونية"],
    evidence:
      "dalel_2025_22026.pdf ص60 الصف 67: «المعهد التقني/الدور (صلاح الدين)/التخصصات الادارية: المحاسبة / الادارة القانونية»",
  },
];

const out = [];
const report = { linked: 0, conflict: [], bySource: {} };
for (const u of universities) {
  const gs = groupsBySite.get(site(u)) || [];
  for (const c of u.colleges) {
    const umbrellas = c.departments.filter((d) => umbrellaTrack(d.name) && d.cutoffs.length);
    if (!umbrellas.length) continue;
    const ik = inst(c.name);
    const cgs = gs.filter((g) => {
      const ew = (g.entry || g.items).flatMap((t) => I.words(t));
      return I.collegeLevel(c.name, { ...g, entryWords: ew }) >= 2;
    });
    for (const d of c.departments) {
      if (umbrellaTrack(d.name)) continue;
      if (d.cutoffs.some((x) => !x.isQuota)) continue;
      const k = nd(u.name) + "|" + ik + "|" + nd(d.name);
      const src = {};
      if (evMap.has(k)) src.evening = [...evMap.get(k)];
      if (paMap.has(k)) src.pageAudit = [...paMap.get(k)];
      const gt = new Set();
      for (const g of cgs) {
        const its = (g.items || []).map(I.guideKey);
        const cands = [...its];
        for (let i = 0; i + 1 < its.length; i++) cands.push(its[i] + its[i + 1]);
        const iw = (g.items || []).map(I.words);
        const windows = [...iw];
        for (let i = 0; i + 1 < iw.length; i++) windows.push([...iw[i], ...iw[i + 1]]);
        if (I.deptMatches(d.name, { cands, windows })) gt.add(g.track);
      }
      if (gt.size) src.guideText = [...gt];
      for (const m of MANUAL)
        if (m.university === u.name && m.college === c.name && m.departments.some((x) => nd(x) === nd(d.name)))
          src.manual = [m.track];
      const all = new Set(Object.values(src).flat());
      if (all.size === 1) {
        const track = [...all][0];
        if (umbrellas.some((x) => umbrellaTrack(x.name) === track)) {
          out.push({ university: u.name, college: c.name, department: d.name, track, sources: Object.keys(src) });
          report.linked++;
          for (const s of Object.keys(src)) report.bySource[s] = (report.bySource[s] || 0) + 1;
        }
      } else if (all.size > 1) report.conflict.push({ university: u.name, college: c.name, department: d.name, src });
    }
  }
}
out.sort((a, b) =>
  (a.university + a.college + a.department).localeCompare(b.university + b.college + b.department, "ar")
);
fs.writeFileSync(path.join(ROOT, "data/institute-tracks.json"), JSON.stringify(out, null, 1) + "\n", "utf8");
fs.writeFileSync(
  path.join(ROOT, "reports/admission-fix/completion/institute-tracks-report.json"),
  JSON.stringify(report, null, 1) + "\n",
  "utf8"
);
console.log(JSON.stringify({ linked: report.linked, bySource: report.bySource, conflicts: report.conflict.length }));
