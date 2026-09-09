// يبني data/major_context_index.json (88 تخصصاً) -- بصمة السياق لكل تخصص،
// المرحلة 3 من خطة إصلاح خوارزمية الترتيب (راجع lib/contextAxisMap.ts
// للتوثيق الكامل). أربعة محاور فقط مشتقّة حسابياً من حقول موثَّقة بالفعل في
// data/major_profiles_detailed.json وdata/subject_affinity_weights.json --
// صفر بيانات مؤلَّفة، وبلا لمس data/major_riasec_profiles.json إطلاقاً.
//
// الاستخدام: node scripts/build-major-context.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const detailedProfiles = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_profiles_detailed.json"), "utf8"));
const subjectAffinity = JSON.parse(fs.readFileSync(path.join(ROOT, "data/subject_affinity_weights.json"), "utf8"));

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// مجموعات كلمات دالة على تواصل مباشر مع أشخاص (طلاب/زبائن/مرضى/جمهور) --
// مأخوذة من نصوص career.realJobTitles/employerSectors الحقيقية الموجودة
// فعلاً، لا مُخترَعة. كل مجموعة تُحتسب مرة واحدة (لا تكرار مرادفات: "طالب"
// و"طلاب" نفس المفهوم) لمنع تضخيم المكافأة، وسقفها الإجمالي 30 نقطة.
const HUMAN_CONTACT_KEYWORD_GROUPS = [
  ["مدرس", "معلم", "روضة"], // تعليم مباشر
  ["طالب", "طلاب"], // تواصل مع طلاب
  ["زبائن", "زبون", "عملاء", "عميل"], // تواصل مع زبائن/عملاء
  ["مريض", "مرضى", "عيادة"], // تواصل مع مرضى (شبكة أمان لمهن مساندة clinical=0)
  ["جمهور", "مستفيد"], // تواصل مع جمهور/مستفيدين
];

function humanContactKeywordBonus(major) {
  const text = [...(major.career.realJobTitles || []), ...(major.career.employerSectors || [])].join(" ");
  const matchedGroups = HUMAN_CONTACT_KEYWORD_GROUPS.filter((group) => group.some((kw) => text.includes(kw)));
  return Math.min(30, matchedGroups.length * 10);
}

function yearsOfStudyToScore(years) {
  // 2 سنة → 0، 6 سنوات → 100 -- وصفي فقط للعرض (مقارنة مباشرة لاحقاً)، لا
  // يدخل computeContextFit إطلاقاً (راجع تعليق lib/contextAxisMap.ts).
  return clamp(((years - 2) / (6 - 2)) * 100, 0, 100);
}

const detailedById = new Map(detailedProfiles.map((m) => [m.id, m]));
const subjectWeights = subjectAffinity.weights || {};

const contextIndex = {};
const missingDetailed = [];
const missingSubjectWeight = [];

for (const majorId of new Set([...detailedById.keys(), ...Object.keys(subjectWeights)])) {
  const detailed = detailedById.get(majorId);
  const weights = subjectWeights[majorId];
  if (!detailed) {
    missingDetailed.push(majorId);
    continue;
  }
  if (!weights) {
    missingSubjectWeight.push(majorId);
    continue;
  }

  const nature = detailed.study.studyNature;
  const appliedRaw = nature.lab + nature.field + nature.clinical - nature.theoretical;

  contextIndex[majorId] = {
    appliedness: clamp((appliedRaw + 100) / 2, 0, 100),
    quantitative: clamp((weights.quantitative ?? 0) * 10, 0, 100),
    humanContact: clamp(nature.clinical + humanContactKeywordBonus(detailed), 0, 100),
    fieldwork: clamp(nature.field, 0, 100),
    yearsOfStudy: detailed.study.yearsOfStudy,
    studyLengthDisplayScore: yearsOfStudyToScore(detailed.study.yearsOfStudy),
  };
}

if (missingDetailed.length || missingSubjectWeight.length) {
  console.error("[FAIL] build-major-context: بيانات مصدر ناقصة");
  if (missingDetailed.length) console.error("  بلا major_profiles_detailed:", missingDetailed);
  if (missingSubjectWeight.length) console.error("  بلا subject_affinity_weights:", missingSubjectWeight);
  process.exit(1);
}

const output = {
  _meta: {
    purpose:
      "بصمة السياق (Context Fingerprint) -- المرحلة 3 من خطة إصلاح خوارزمية الترتيب: يفصل أزواج التوأمين (بكالوريوس/دبلوم تقني) التي يتطابق بروفايلاها في RIASEC والقرابة الدراسية تقريباً (مثال electrical_engineering/electrical_tech)، عبر محاور مشتقّة حسابياً من دراسة/مسار كل تخصص الموثَّقين في data/major_profiles_detailed.json، لا من بيانات جديدة.",
    axes: {
      appliedness: "(مختبري+ميداني+سريري) - نظري من study.studyNature -- 0=نظري بحت، 100=تطبيقي بحت",
      quantitative: "subject_affinity_weights.quantitative × 10",
      humanContact:
        "study.studyNature.clinical + مكافأة كلمات دالة على تواصل مباشر (طلاب/زبائن/مرضى/جمهور) من career.realJobTitles/employerSectors، سقفها 30",
      fieldwork: "study.studyNature.field",
    },
    excludedAxis:
      "studyLength (yearsOfStudy) وصفي فقط -- لا سؤال حقيقي بين الأربعين يقيس استعداد الطالب لمدة دراسة أطول/أقصر، فبقي جانب التخصص فقط بلا اختراع وزن طالب مقابل له.",
    generatedBy: "scripts/build-major-context.js",
    generatedAt: new Date().toISOString().slice(0, 10),
  },
  contexts: contextIndex,
};

fs.writeFileSync(path.join(ROOT, "data/major_context_index.json"), JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(`[OK] data/major_context_index.json -- ${Object.keys(contextIndex).length} تخصصاً`);
