// تدقيق: الحد المسائي لكل قسم حكومي مقابل القاعدة الرسمية للدراسة المسائية.
// المصدر: data/raw/dalel.full.txt السطور 3506-3517 («5 - أولاً»، وبند «ثانياً»: للجامعة تخفيض حتى 3 درجات
// عدا الفقرات د، هـ، و، ي).
//
//   أ تمريض 70 | ب طب بيطري 65 | ج تقنيات طبية وصحية 75 | د هندسة 65 | هـ تقنيات هندسية 60
//   و علوم وحاسوب وتكنولوجيا معلومات 60 | ز قانون 65 | ح علوم سياسية وإدارة واقتصاد 60
//   ط باقي التخصصات 58 | ي تربية بدنية: 57 ذكور و55 إناث
//
// هذا تصنيف **مرجعي للقياس** (للقراءة فقط). كليات يلتبس تصنيفها نصاً (المعاهد، تربية العلوم الصرفة،
// القانون والعلوم السياسية…) تُعدّ "ملتبسة" ولا تُحسب خطأ حتى يحسمها المالك (PLAN-ADMISSION-ACCURACY.md §3).
// المخرجات: reports/admission-fix/audit/evening-audit.json
const fs = require("fs");
const path = require("path");
const { fixLamAlef } = require("../displayName");

const ROOT = path.join(__dirname, "..", "..");
const universities = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities.filter(
  (u) => u.type === "حكومية"
);

const norm = (s) =>
  fixLamAlef(s || "")
    .replace(/([ون])\1{2,}/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();

// يُعيد { category, min, ambiguous?: سبب }
function referenceFor(collegeName) {
  const c = norm(collegeName.split("/")[0]);
  const has = (re) => re.test(c);
  const amb = (why, category = "؟") => ({ category, min: null, ambiguous: why });
  if (has(/(^|\s)(معهد|المعهد)(\s|$)/)) return amb("المعاهد غير مذكورة نصاً في البند (القراءة الحرفية: ط=58)", "معهد");
  if (has(/تمريض/)) return { category: "أ", min: 70 };
  if (has(/بيطري/)) return { category: "ب", min: 65 };
  if (has(/(التقنية|التقنيات|تقنيات)\s.*(صحية|طبية)|(صحية|طبية)\s.*(تقنية|تقنيات)/)) return { category: "ج", min: 75 };
  if (has(/بوليتكنك/)) return amb("بوليتكنك: كلية بتخصصات هندسية وإدارية وطبية معاً", "بوليتكنك");
  if (has(/الكلية التقنية الهندسية|الكلية التقنية الاقسام الهندسية|هندسة تقنيات/)) return { category: "هـ", min: 60 };
  if (has(/الكلية التقنية|كلية التقنيات|كلية تقنيات/))
    return amb("كلية تقنية بلا تخصيص هندسي/طبي: لا فقرة صريحة", "تقنية");
  if (has(/(^|\s)(ال)?هندسة(\s|$)/)) return { category: "د", min: 65 };
  if (has(/تربية بدنية|التربية البدنية/)) return { category: "ي", min: null, genderSplit: { ذكر: 57, أنثى: 55 } };
  if (has(/قانون|القانون|حقوق|الحقوق/)) {
    return /سياسية/.test(c) ? amb("قانون وعلوم سياسية معاً: 65 أم 60", "ز/ح") : { category: "ز", min: 65 };
  }
  if (has(/السياسية|الادارة|اداره|اقتصاد|الاقتصاد|اقتصاديات/)) return { category: "ح", min: 60 };
  if (has(/علوم الحاسوب|الحاسوب|تكنولوجيا المعلومات|الذكاء الاصطناعي|معلوماتية/)) return { category: "و", min: 60 };
  if (has(/التربية.*للعلوم$|التربية للعلوم الصرفة|العلوم الطبية|التقنيات الاحيائية/))
    return amb("اسم يحوي «علوم» لكنه ليس كلية علوم صريحة: 60 أم 58", "و؟");
  // كلية علوم صريحة: "العلوم"، "العلوم للبنات"، "علوم البيئة"، "علوم الاغذية"… (لا الإسلامية/السياحية/الإنسانية)
  if (has(/^(كلية )?(ال)?علوم(?!\s+(ال)?(اس[لا]{1,2}مية|سياحية|انسانية|طبية|سياسية))/))
    return { category: "و", min: 60 };
  return { category: "ط", min: 58 };
}

const stat = {
  departments: 0,
  withEvening: 0,
  correct: 0,
  wrong: 0,
  ambiguous: 0,
  fabricatedPhysicalEducation56: 0,
  nonFloorCategoriesNeedLoweringNote: 0,
};
const wrong = [];
const ambiguous = [];
const byCollege = new Map();
for (const u of universities) {
  for (const c of u.colleges) {
    const ref = referenceFor(c.name);
    for (const d of c.departments) {
      stat.departments++;
      const v = d.averageGrades["مسائي"];
      if (v == null) continue;
      stat.withEvening++;
      if (ref.category === "ي" && v === 56) stat.fabricatedPhysicalEducation56++;
      if (!["د", "هـ", "و", "ي"].includes(ref.category)) stat.nonFloorCategoriesNeedLoweringNote++;
      if (ref.ambiguous) {
        stat.ambiguous++;
        ambiguous.push({ university: u.name, college: c.name, department: d.name, platform: v, why: ref.ambiguous });
        continue;
      }
      const expected = ref.genderSplit ? null : ref.min;
      const ok = ref.genderSplit ? v === 57 || v === 55 : v === expected;
      if (ok) {
        stat.correct++;
        continue;
      }
      stat.wrong++;
      wrong.push({
        university: u.name,
        college: c.name,
        department: d.name,
        category: ref.category,
        platform: v,
        expected: ref.genderSplit ? "57 ذكور / 55 إناث" : expected,
      });
      const k = `${norm(c.name.split("/")[0])} (${ref.category}): منصة ${v} ≠ ${ref.genderSplit ? "57/55" : expected}`;
      byCollege.set(k, (byCollege.get(k) || 0) + 1);
    }
  }
}

const outDir = path.join(ROOT, "reports", "admission-fix", "audit");
fs.mkdirSync(outDir, { recursive: true });
const groups = [...byCollege.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ group: k, departments: n }));
fs.writeFileSync(
  path.join(outDir, "evening-audit.json"),
  JSON.stringify({ summary: stat, groups, wrong, ambiguous }, null, 2) + "\n",
  "utf8"
);
console.log(JSON.stringify(stat, null, 1));
groups.slice(0, 25).forEach((g) => console.log(String(g.departments).padStart(4), g.group));
if (process.argv.includes("--strict") && (stat.wrong || stat.fabricatedPhysicalEducation56)) process.exit(1);
