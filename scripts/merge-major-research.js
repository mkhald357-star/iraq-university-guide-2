// يدمج نتائج أبحاث الوكلاء السبعة (74 تخصصاً) + الحقول المحسوبة تلقائياً
// (eligibility/nearest_competitors) + الراتب الحكومي الأساسي الموحّد في
// data/major_profiles_detailed.json، محافظاً على الـ14 تخصصاً الموجودة سابقاً.
//
// الاستخدام: node scripts/merge-major-research.js [--scratch=<dir>]
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const scratchArg = process.argv.find((a) => a.startsWith("--scratch="));
const SCRATCH = scratchArg
  ? scratchArg.slice("--scratch=".length)
  : "C:/Users/al-faris/AppData/Local/Temp/claude/e------/b89db03c-c0b5-4871-a660-6699520ca7b3/scratchpad/major_research";

const existingPath = path.join(ROOT, "data/major_profiles_detailed.json");
const existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
const majors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/majors.json"), "utf8"));
const majorIds = new Set(majors.map((m) => m.id));

const derived = JSON.parse(fs.readFileSync(path.join(SCRATCH, "derived_fields.json"), "utf8"));

// الراتب الحكومي الأساسي الاسمي عند التعيين الأول لحملة البكالوريوس -- موحّد
// عبر كل التخصصات لأن القانون العراقي يربطه بالشهادة لا بالتخصص (لا يوجد
// "راتب حكومي خاص بكل تخصص" فعلياً في نظام الرواتب العراقي). المصدر: قانون
// رواتب موظفي الدولة والقطاع العام رقم 22 لسنة 2008 المعدّل بقرار مجلس
// الوزراء رقم 366 لسنة 2015 (جدول الرواتب الملحق) -- تحقّق عبر صفحة الشؤون
// المالية الرسمية لجامعة كربلاء وصفحة كلية علوم الحاسوب/جامعة القادسية
// اللتين تنشران نص القانون وجدول رواتبه. يوجد سلم رواتب جديد قيد الإقرار
// حالياً (2026) قد يُعدّل هذا الرقم مستقبلاً -- مذكور صراحة في scope.
const GOVERNMENT_BASE_SALARY = {
  amount: 296000,
  currency: "IQD",
  basis:
    "الدرجة السابعة، المرتبة الأولى -- راتب حملة شهادة البكالوريوس الاسمي عند التعيين الحكومي الأول، قبل العلاوات (الاجتماعية/النقل/المنصبية) وأي مخصصات مهنية أو نقابية خاصة بمهنة بعينها",
  scope:
    "القطاع الحكومي فقط (تعيين مركزي أول) -- رقم موحّد لكل حملة البكالوريوس بصرف النظر عن التخصص لأن سلم الرواتب العراقي يصنّف حسب الشهادة لا حسب التخصص. لا يمثّل سوق العمل الخاص إطلاقاً، ولا يشمل مخصصات نقابية إضافية موثّقة لبعض المهن (كالطب والهندسة) لعدم توفر أرقام محددة موثّقة لها حالياً. يوجد سلم رواتب جديد قيد الإقرار (2026) قد يُعدّل هذا الرقم.",
  source:
    "قانون رواتب موظفي الدولة والقطاع العام رقم 22 لسنة 2008 المعدَّل بقرار مجلس الوزراء رقم 366 لسنة 2015 (جدول الرواتب الملحق)، كما ورد في صفحة الشؤون المالية الرسمية لجامعة كربلاء (fa.uokerbala.edu.iq) وصفحة كلية علوم الحاسوب وتكنولوجيا المعلومات/جامعة القادسية (cm.qu.edu.iq)",
  lastVerified: "2026-07",
};

const REQUIRED_KEYS = ["study", "career", "market", "personality_translation"];

function loadBatch(file) {
  const p = path.join(SCRATCH, file);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing batch file: ${p}`);
  }
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(data)) throw new Error(`${file} is not a JSON array`);
  return data;
}

const batchFiles = [
  "batch1.json",
  "batch2.json",
  "batch3.json",
  "batch4.json",
  "batch5.json",
  "batch6.json",
  "batch7.json",
];
const allResearched = batchFiles.flatMap(loadBatch);

const seenIds = new Set(existing.map((e) => e.id));
// نلحق الراتب الحكومي الموحّد بالتخصصات الـ14 الموجودة مسبقاً أيضاً (لم يكن
// هذا الحقل موجوداً حين بُنيت أصلاً) كي يتّسق كل التخصصات الـ88.
const merged = existing.map((e) => ({
  ...e,
  career: { ...e.career, governmentBaseSalary: e.career?.governmentBaseSalary ?? GOVERNMENT_BASE_SALARY },
}));
const problems = [];

for (const entry of allResearched) {
  if (!entry.id) {
    problems.push(`Entry with no id in a batch: ${JSON.stringify(entry).slice(0, 100)}`);
    continue;
  }
  if (!majorIds.has(entry.id)) {
    problems.push(`Unknown major id from research: ${entry.id}`);
    continue;
  }
  if (seenIds.has(entry.id)) {
    problems.push(`Duplicate id (already exists or duplicated across batches): ${entry.id}`);
    continue;
  }
  for (const key of REQUIRED_KEYS) {
    if (!entry[key]) problems.push(`${entry.id}: missing required key "${key}"`);
  }
  const d = derived[entry.id];
  if (!d) {
    problems.push(`${entry.id}: no derived eligibility/nearest_competitors computed`);
    continue;
  }
  const career = { ...entry.career, governmentBaseSalary: GOVERNMENT_BASE_SALARY };
  merged.push({
    id: entry.id,
    study: entry.study,
    career,
    market: entry.market,
    personality_translation: entry.personality_translation,
    eligibility: d.eligibility,
    nearest_competitors: d.nearest_competitors,
  });
  seenIds.add(entry.id);
}

const missing = majors.map((m) => m.id).filter((id) => !seenIds.has(id));

console.log(`Existing profiles: ${existing.length}`);
console.log(`Newly merged profiles: ${merged.length - existing.length}`);
console.log(`Total profiles: ${merged.length} / ${majors.length} majors`);
if (missing.length) {
  console.log(`\nStill missing (${missing.length}):`, missing.join(", "));
}
if (problems.length) {
  console.log(`\n${problems.length} PROBLEMS found:`);
  problems.forEach((p) => console.log(" - " + p));
}

const outArg = process.argv.find((a) => a.startsWith("--write"));
if (outArg) {
  fs.writeFileSync(existingPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${merged.length} profiles to ${existingPath}`);
} else {
  console.log("\n(dry run -- pass --write to actually write data/major_profiles_detailed.json)");
}
