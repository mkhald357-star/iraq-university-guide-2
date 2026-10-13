// يبني public/data/hierarchy.json: الحدود الدنيا الرسمية (2025-2026) مرتبة محافظة ← جامعة ← كلية ← قسم،
// لصفحة /hierarchy. المدخل: reports/admission-fix/cutoffs-extraction/rows.json (ناتج
// scripts/admission-fix/extract-cutoffs-hierarchy.py من PDF الوزارة، 1,222 صفاً مطابقاً للخام).
// لا يضيف رقماً ولا يستنتج: يعيد تجميع ما في الصفوف فقط، ويتحقق من تطابقه مع data/raw/cutoffs_2025_2026.json.
const fs = require("fs");
const path = require("path");
const { toDisplayName } = require("./displayName");

const ROOT = path.join(__dirname, "..");
const ROWS = path.join(ROOT, "reports", "admission-fix", "cutoffs-extraction", "rows.json");
const RAW = path.join(ROOT, "data", "raw", "cutoffs_2025_2026.json");
const OUT = path.join(ROOT, "public", "data", "hierarchy.json");

// طبقة نص الـPDF تعكس الأقواس وتبدّل «لا»: إصلاح للعرض فقط
const clean = (v) =>
  toDisplayName(v || "")
    .replace(/\)([^()]*)\(/g, "($1)")
    .replace(/صالح الدين/g, "صلاح الدين")
    .trim();

const rows = JSON.parse(fs.readFileSync(ROWS, "utf8"));
const raw = JSON.parse(fs.readFileSync(RAW, "utf8"));

// تحقق: نفس عدد الصفوف، ونفس مجموعة (المجموع، المعدل، المفاضلة، الفرع، الجنس) الخام
const key = (t, a, r, b, g) => [Number(t).toFixed(2), Number(a).toFixed(2), r, b, g].join("|");
const rawKeys = new Map();
for (const r of raw) {
  const k = key(r.totalScore, r.averagePercent, r.rank, r.branch, r.gender);
  rawKeys.set(k, (rawKeys.get(k) || 0) + 1);
}
for (const r of rows) {
  const k = key(r.total, r.average, r.rank, r.branch, r.gender);
  const n = rawKeys.get(k);
  if (!n) {
    console.error(`صف بلا نظير في الخام: ${r.source_text} (${k})`);
    process.exit(1);
  }
  rawKeys.set(k, n - 1);
}
if (rows.length !== raw.length || [...rawKeys.values()].some((n) => n !== 0)) {
  console.error(`عدم تطابق مع الخام: ${rows.length} صفاً مقابل ${raw.length}`);
  process.exit(1);
}

const ar = new Intl.Collator("ar");
const byProv = new Map();
for (const r of rows) {
  const prov = byProv.get(r.province) || byProv.set(r.province, new Map()).get(r.province);
  const uni = prov.get(r.university) || prov.set(r.university, new Map()).get(r.university);
  const colName = [clean(r.college), clean(r.campus), clean(r.track)].filter(Boolean).join(" / ");
  const col =
    uni.get(colName) || uni.set(colName, { departments: new Map(), collegeLevel: [], level: "college" }).get(colName);
  const entry = [r.branch, r.gender, r.average, r.quota ? 1 : 0];
  if (r.department) {
    const d = clean(r.department);
    (col.departments.get(d) || col.departments.set(d, []).get(d)).push(entry);
  } else {
    col.collegeLevel.push(entry);
    col.level = r.level; // "كلية" أو "مسار"
  }
}
const ORDER = { علمي: 0, أدبي: 1, فنون: 2 };
const sortVals = (v) =>
  v.sort((a, b) => (ORDER[a[0]] ?? 9) - (ORDER[b[0]] ?? 9) || ar.compare(a[1], b[1]) || b[2] - a[2]);

const out = {
  year: "2025-2026",
  source: "وزارة التعليم العالي والبحث العلمي — الحدود الدنيا للقبول المركزي (القناة العامة) 2025-2026",
  rows: rows.length,
  provinces: [...byProv.keys()].sort(ar.compare).map((pName) => ({
    name: pName,
    universities: [...byProv.get(pName).keys()].sort(ar.compare).map((uName) => ({
      name: uName,
      colleges: [...byProv.get(pName).get(uName).keys()].sort(ar.compare).map((cName) => {
        const c = byProv.get(pName).get(uName).get(cName);
        return {
          name: cName,
          ...(c.collegeLevel.length
            ? { level: c.level === "مسار" ? "track" : "college", collegeLevel: sortVals(c.collegeLevel) }
            : {}),
          departments: [...c.departments.keys()]
            .sort(ar.compare)
            .map((dName) => ({ name: dName, v: sortVals(c.departments.get(dName)) })),
        };
      }),
    })),
  })),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`hierarchy.json: ${rows.length} صفاً، ${out.provinces.length} محافظة، ${kb} KB`);
