// يقترح عائلات التخصصات بالتجميع الهرمي (متوسط الارتباط) على بروفايلات RIASEC،
// مقيَّداً بألا تضمّ العائلة تخصصات تختلف في الفروع الدراسية التي تقبلها --
// وإلا صارت "العائلة الثانية" فارغة لطالب أدبي.
//
// **اقتراح فقط**: المخرج يُراجَع بشرياً ويُثبَّت في data/major_families.json.
// التجميع وحده يدمج التوأمين (هندسة الكهرباء/تقنيات الكهرباء) ويفصل ما يجب
// جمعه (هندسة البرمجيات/علوم الحاسوب) -- وهذا سؤال معنى لا سؤال مسافة.
//
//   node scripts/derive-major-families.js [--threshold 78]
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

const majors = read("data/majors.json");
const profiles = read("data/major_riasec_profiles.json").profiles;
const { BRANCH_CATEGORY_MAP } = {
  BRANCH_CATEGORY_MAP: {
    علمي: ["تكنولوجيا", "هندسة", "طبي", "تقنيات طبية مساندة", "علوم", "زراعة", "إدارة وتسويق"],
    أدبي: ["إنسانيات", "لغات", "تربية", "إدارة وتسويق"],
    فنون: ["فنون وتصميم"],
  },
};
const arg = (k, d) => (process.argv.includes(k) ? Number(process.argv[process.argv.indexOf(k) + 1]) : d);
const THRESHOLD = arg("--threshold", 78);

// نفس دالة التشابه المستخدمة في scripts/generate-derived-profile-fields.js
const DIMS = ["R", "I", "A", "S", "E", "C"];
function profileSimilarity(a, b) {
  let s = 0;
  DIMS.forEach((d) => (s += ((a[d] ?? 0) * 10 - (b[d] ?? 0) * 10) ** 2));
  return Math.max(0, Math.min(100, 100 - Math.sqrt(s / DIMS.length)));
}
const branchesOf = (cat) =>
  Object.keys(BRANCH_CATEGORY_MAP)
    .filter((b) => BRANCH_CATEGORY_MAP[b].includes(cat))
    .sort()
    .join("|");
const branchKey = Object.fromEntries(majors.map((m) => [m.id, branchesOf(m.category)]));

// تجميع هرمي بمتوسط الارتباط
let clusters = majors.map((m) => ({ ids: [m.id], key: branchKey[m.id] }));
const sim = (A, B) => {
  if (A.key !== B.key) return -1; // قيد الفروع: لا تُدمج عائلة عبر فروع مختلفة
  let t = 0;
  A.ids.forEach((a) => B.ids.forEach((b) => (t += profileSimilarity(profiles[a], profiles[b]))));
  return t / (A.ids.length * B.ids.length);
};
for (;;) {
  let best = { v: -1, i: -1, j: -1 };
  for (let i = 0; i < clusters.length; i++)
    for (let j = i + 1; j < clusters.length; j++) {
      const v = sim(clusters[i], clusters[j]);
      if (v > best.v) best = { v, i, j };
    }
  if (best.v < THRESHOLD) break;
  const merged = { ids: [...clusters[best.i].ids, ...clusters[best.j].ids], key: clusters[best.i].key };
  clusters = clusters.filter((_, k) => k !== best.i && k !== best.j).concat([merged]);
}

const name = Object.fromEntries(majors.map((m) => [m.id, m.name]));
const cat = Object.fromEntries(majors.map((m) => [m.id, m.category]));
clusters.sort((a, b) => b.ids.length - a.ids.length);
console.log(
  `عتبة التشابه ${THRESHOLD} → ${clusters.length} عائلة (${clusters.filter((c) => c.ids.length === 1).length} منها تخصص واحد)\n`
);
clusters.forEach((c, i) => {
  const cats = [...new Set(c.ids.map((id) => cat[id]))];
  console.log(`${i + 1}. [${c.key}] (${c.ids.length}) فئات: ${cats.join("، ")}`);
  c.ids.forEach((id) => console.log(`     ${name[id]}  (${id})`));
});
// عدّ العائلات المتاحة لكل فرع -- شرط رضا المالك "ثلاث توصيات من عائلات مختلفة"
Object.keys(BRANCH_CATEGORY_MAP).forEach((b) => {
  const n = clusters.filter((c) => c.ids.some((id) => BRANCH_CATEGORY_MAP[b].includes(cat[id]))).length;
  console.log(`\nفرع ${b}: ${n} عائلة متاحة${n < 3 ? "  ← دون الثلاثة!" : ""}`);
});
