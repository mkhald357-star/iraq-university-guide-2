// يحسب إحصائيات الصفحة الرئيسية حياً من data/universities.json + data/majors.json
// + data/provinces.json وقت البناء، ويكتبها في data/homepage_stats.json.
//
// السبب: قبل هذا السكربت كانت هذه الأرقام ثوابت مكتوبة يدوياً في
// app/components/Hero.tsx وapp/components/StatsSection.tsx -- فجولات إصلاح
// تلوّث chapter3_additions.json (data/admission_rules.md §16-١٧) غيّرت
// الأعداد الحقيقية دون أن تتحدَّث الثوابت معها، فعرضت المنصة رقماً تعرف
// داخلياً أنه خاطئ (راجع تشخيص_المشاكل_وخطة_الإصلاح_الشاملة.md، المشكلة ١).
// من الآن، هذا الملف هو المصدر الوحيد -- أي رقم إحصائي جديد يُضاف مستقبلاً
// يمرّ عبره، لا يُكتب حرفياً في مكوّن React.
//
// الاستخدام: node scripts/compute-homepage-stats.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
const majors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/majors.json"), "utf8"));
const provinces = JSON.parse(fs.readFileSync(path.join(ROOT, "data/provinces.json"), "utf8"));

let governmentUniversities = 0;
let privateUniversities = 0;
let totalColleges = 0;
let totalDepartments = 0;
let directAdmissionDepartments = 0;
// حصراً الحكومي -- isDirectAdmission هناك مؤكَّد ثلاثياً (cutoffs.length===0
// فعلياً، لا فراغ رقم، انظر §12) فهو "بلا منافسة" حقيقي. الأهلي isDirectAdmission
// دائماً true بصرف النظر عن نشر حدّ من عدمه (§28) -- ضمّه لنفس الرقم يجعل
// الادّعاء "بلا حدّ قبول تنافسي" مضلِّلاً لمعظم الأهلي (الحدّ قد يكون منشوراً
// وغير مُستخرَج بعد، أو غير منشور أصلاً -- لا "لا حدّ" كالحكومي).
let directAdmissionDepartmentsGov = 0;
let governmentDepartments = 0;
const branchCounts = { علمي: 0, أدبي: 0, فنون: 0 };

// حقيقة المسائي (data/admission_rules.md §31): يُحسَب من البيانات دائماً --
// رقم مصلَّب يتقادم صامتاً (نفس درس "81 تخصصاً" في §26).
const morningValues = [];
const eveningValues = [];

for (const uni of universities) {
  if (uni.type === "حكومية") governmentUniversities++;
  else privateUniversities++;
  for (const college of uni.colleges) {
    totalColleges++;
    for (const dept of college.departments) {
      totalDepartments++;
      if (dept.isDirectAdmission) directAdmissionDepartments++;
      if (uni.type === "حكومية") {
        governmentDepartments++;
        if (dept.isDirectAdmission) directAdmissionDepartmentsGov++;
      }
      for (const b of dept.branch) {
        if (branchCounts[b] !== undefined) branchCounts[b]++;
      }
      if (typeof dept.averageGrades?.["صباحي"] === "number") morningValues.push(dept.averageGrades["صباحي"]);
      if (typeof dept.averageGrades?.["مسائي"] === "number") eveningValues.push(dept.averageGrades["مسائي"]);
    }
  }
}

const morningMin = morningValues.length ? Math.min(...morningValues) : null;
const morningMax = morningValues.length ? Math.max(...morningValues) : null;
const eveningMin = eveningValues.length ? Math.min(...eveningValues) : null;
const eveningMax = eveningValues.length ? Math.max(...eveningValues) : null;

const stats = {
  generatedAt: new Date().toISOString(),
  totalMajors: majors.length,
  totalUniversities: universities.length,
  governmentUniversities,
  privateUniversities,
  provinces: provinces.length,
  totalColleges,
  totalDepartments,
  directAdmissionDepartments,
  governmentDepartments,
  directAdmissionDepartmentsGov,
  branchCounts,
  morningMin,
  morningMax,
  eveningMin,
  eveningMax,
};

fs.writeFileSync(path.join(ROOT, "data/homepage_stats.json"), JSON.stringify(stats, null, 2) + "\n", "utf8");

console.log("Wrote data/homepage_stats.json:");
console.log(stats);
