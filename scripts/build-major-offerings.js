// يبني ملفاً صغيراً منفصلاً لكل تخصص (public/data/major-offerings/<majorId>.json)
// يحوي كل عروض الجامعات المطابقة له وطنياً (نفس منطق findUniversitiesForMajor في
// lib/majorMatcher.ts، مُعاد تطبيقه هنا بجافاسكربت خام لأن هذا سكربت بناء)، بدل
// أن يستورد app/report/page.tsx ملف data/universities.json الكامل (2+ ميجابايت)
// مباشرة داخل حزمة العميل. راجع PROJECT.md §7 بند 1 لخلفية المشكلة.
//
// الاستخدام: node scripts/build-major-offerings.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/data/major-offerings");
const BRANCH_OUT_DIR = path.join(ROOT, "public/data/by-branch");
const BRANCHES = ["علمي", "أدبي", "فنون"];

const majors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/majors.json"), "utf8"));
const universitiesFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
const universities = universitiesFile.universities;
const mappingFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_department_mapping.json"), "utf8"));
const mappings = mappingFile.mappings;

const { normalizeForPatternMatch } = require("./departmentNormalizer");

function stripCollegePrefix(name) {
  return (name || "").replace(/^(كلية|كليات|معهد|المعهد)\s+/, "").trim() || name;
}

function startsWithAnyPrefix(departmentName, prefixes) {
  const stripped = departmentName.trim().replace(/^قسم\s+/, "");
  return prefixes.some((p) => stripped.startsWith(p));
}

function matchMajorToDepartment(major, departmentName, mapping) {
  if (
    mapping.excludeIfDepartmentStartsWith &&
    startsWithAnyPrefix(departmentName, mapping.excludeIfDepartmentStartsWith)
  ) {
    return { isMatch: false, confidence: 0 };
  }
  const depNorm = normalizeForPatternMatch(departmentName);
  const majorNameNorm = normalizeForPatternMatch(major.name);
  const mappingNameNorm = normalizeForPatternMatch(mapping.majorName);
  let score = 0;
  if (depNorm === majorNameNorm || depNorm === mappingNameNorm) {
    score = 100;
  } else if (mapping.aliases.some((alias) => normalizeForPatternMatch(alias) === depNorm)) {
    score = 85;
  } else {
    const matchingPatterns = mapping.departmentPatterns.filter((pattern) =>
      depNorm.includes(normalizeForPatternMatch(pattern))
    );
    if (matchingPatterns.length > 1) score = 75;
    else if (matchingPatterns.length === 1) score = 60;
  }
  return { isMatch: score >= 60, confidence: score };
}

function findUniversitiesForMajor(major, mapping) {
  const offerings = [];
  const m = mapping || {
    majorId: major.id,
    majorName: major.name,
    aliases: [major.name],
    departmentPatterns: [major.name],
    priority: 1,
  };
  for (const uni of universities) {
    for (const college of uni.colleges) {
      for (const dept of college.departments) {
        let matchRes = matchMajorToDepartment(major, dept.name, m);
        if (!matchRes.isMatch && (dept.name === "عام" || dept.isCollegeLevelProgram)) {
          const collegeStripped = stripCollegePrefix(college.name);
          const fallbackRes = matchMajorToDepartment(major, collegeStripped, m);
          if (fallbackRes.isMatch) {
            matchRes = fallbackRes;
          }
        }
        if (matchRes.isMatch) {
          offerings.push({
            universityId: uni.id,
            universityName: uni.name,
            universityType: uni.type,
            universityRanking: uni.ranking,
            province: uni.province,
            collegeId: college.id,
            collegeName: college.displayName ?? college.name,
            departmentName: dept.displayName ?? dept.name,
            departmentBranches: dept.branch,
            sessions: dept.sessions,
            averageGrades: dept.averageGrades,
            cutoffs: dept.cutoffs,
            isDirectAdmission: dept.isDirectAdmission,
            statedMinimumGrade: dept.statedMinimumGrade ?? null,
            confidence: matchRes.confidence,
            // أهلية فقط، undefined->null دائماً للحكومية (غياب بنيوي مقصود --
            // القبول الحكومي مركزي بلا أجر مماثل). راجع data/admission_rules.md §41.
            tuitionFees: dept.tuitionFees ?? null,
            admissionSuspended: dept.admissionSuspended ?? false,
          });
        }
      }
    }
  }
  return offerings;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
// نظّف مخرجات جولة سابقة أولاً كي لا يبقى ملف تخصص محذوف من majors.json يتيماً.
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith(".json")) fs.unlinkSync(path.join(OUT_DIR, f));
}

let totalBytes = 0;
let maxFile = { id: null, bytes: 0 };
// فهرس "قسم -> أفضل تخصص مطابق" (أعلى confidence)، يُبنى أثناء نفس الحلقة
// أدناه بلا أي مطابقة إضافية -- يُستخدَم لاحقاً في تمريرة ملفات by-branch
// لإرفاق majorId/majorName بأفضل جهد بلا تكرار منطق matchMajorToDepartment.
const deptMajorIndex = new Map();
function deptKey(o) {
  return `${o.universityId}|${o.collegeId}|${o.departmentName}`;
}

for (const major of majors) {
  const mapping = mappings.find((m) => m.majorId === major.id) || null;
  const offerings = findUniversitiesForMajor(major, mapping);
  const json = JSON.stringify(offerings);
  fs.writeFileSync(path.join(OUT_DIR, `${major.id}.json`), json, "utf8");
  totalBytes += json.length;
  if (json.length > maxFile.bytes) maxFile = { id: major.id, bytes: json.length };

  for (const o of offerings) {
    const key = deptKey(o);
    const existing = deptMajorIndex.get(key);
    if (!existing || o.confidence > existing.confidence) {
      deptMajorIndex.set(key, { majorId: major.id, majorName: major.name, confidence: o.confidence });
    }
  }
}

// ── ملفات by-branch: كل قسم جامعي حقيقي مصنَّفاً حسب فرعه (علمي/أدبي/فنون)،
// مبنية مباشرة من universities.json (مصدر الحقيقة الخام) لا من ملفات
// major-offerings -- يضمن تغطية كل الأقسام الـ3,206 فعلياً حتى غير المطابَق
// منها لأي من التخصصات الـ88 المنسَّقة (خدمتا "فاحص المعدل"/"مستكشف
// الجامعات" وعدتا بتصفّح كل قسم، لا فقط الأقسام المطابقة لتخصص معروف).
// شكل مُخفَّف عمداً (بلا cutoffs[]/confidence/universityRanking/collegeId)
// لأن classifyOffering (lib/wishlistPlanner.ts) لا يقرأ فعلياً إلا
// isDirectAdmission وaverageGrades[session] -- توفير ٣٥٪ من الحجم مقيس فعلياً.
fs.mkdirSync(BRANCH_OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(BRANCH_OUT_DIR)) {
  if (f.endsWith(".json")) fs.unlinkSync(path.join(BRANCH_OUT_DIR, f));
}

// قسم بمصفوفة branch فارغة (كل الأقسام الأهلية اليوم -- الدليل الرسمي لا
// يذكر الفرع إطلاقاً، تحقَّق مباشرةً في data/admission_rules.md §29) لا
// يُكتَب في أي من ملفات الثلاثة أعلاه فيختفي بنيوياً من /explorer وgpa-check.
// ملف رابع منفصل (لا تكرار في الثلاثة -- يضخّم كل ملف بلا داعٍ) يجمعها
// موسومةً branchKnown:false، يُجلَب مرة ويُدمَج مع أي فرع (lib/offeringsClient.ts).
const UNKNOWN_BRANCH_KEY = "unknown";
const branchRecords = Object.fromEntries([...BRANCHES, UNKNOWN_BRANCH_KEY].map((b) => [b, []]));
for (const uni of universities) {
  for (const college of uni.colleges) {
    for (const dept of college.departments) {
      // مفتاح البحث في الفهرس يجب أن يستخدم displayName (لا name الخام) --
      // نفس الأساس المستخدَم عند بناء الفهرس أعلاه من departmentName المُسطَّح
      // في offerings (الذي أصبح أيضاً dept.displayName ?? dept.name)، وإلا
      // يفشل البحث صامتاً لكل قسم مشوَّه الاسم.
      const match = deptMajorIndex.get(`${uni.id}|${college.id}|${dept.displayName ?? dept.name}`) || null;
      const record = {
        majorId: match ? match.majorId : null,
        majorName: match ? match.majorName : null,
        universityId: uni.id,
        universityName: uni.name,
        universityType: uni.type,
        province: uni.province,
        collegeName: college.displayName ?? college.name,
        departmentName: dept.displayName ?? dept.name,
        departmentBranches: dept.branch,
        sessions: dept.sessions,
        averageGrades: dept.averageGrades,
        isDirectAdmission: dept.isDirectAdmission,
        statedMinimumGrade: dept.statedMinimumGrade ?? null,
        branchKnown: dept.branch.length > 0,
      };
      if (dept.branch.length === 0) {
        branchRecords[UNKNOWN_BRANCH_KEY].push(record);
        continue;
      }
      for (const b of dept.branch) {
        if (!branchRecords[b]) continue;
        // سجل الفرع يحمل حدّ ذلك الفرع نفسه (morningByBranch) لا أدنى حد بين كل الفروع:
        // طالب العلمي يرى حد علم النفس/بغداد 81.71 لا 60 (حد الأدبي). فرع يقبله الدليل بلا
        // حد منشور له = null ("لا حد منشور") لا رقم فرع آخر.
        const morning = dept.morningByBranch ? (dept.morningByBranch[b] ?? null) : dept.averageGrades["صباحي"];
        // وحد المسائي لهذا الفرع كذلك (جدول حدود التقديم يختلف بحسب الفرع: data/evening-rules.json)
        const evening = dept.eveningByBranch ? (dept.eveningByBranch[b] ?? null) : dept.averageGrades["مسائي"];
        branchRecords[b].push({
          ...record,
          averageGrades: { ...dept.averageGrades, صباحي: morning, مسائي: evening },
          ...(dept.evening ? { evening: dept.evening } : {}),
        });
      }
    }
  }
}

let branchTotalBytes = 0;
for (const b of [...BRANCHES, UNKNOWN_BRANCH_KEY]) {
  const json = JSON.stringify(branchRecords[b]);
  fs.writeFileSync(path.join(BRANCH_OUT_DIR, `${b}.json`), json, "utf8");
  branchTotalBytes += json.length;
  console.log(`  by-branch/${b}.json: ${branchRecords[b].length} records, ${(json.length / 1024).toFixed(0)} KB`);
}

// نسخة صغيرة من meta فقط (تنبيه حداثة البيانات في الواجهة لا يحتاج البيانات
// الكاملة، فقط تاريخ التحديث وحقول meta الوصفية الأخرى).
fs.writeFileSync(
  path.join(ROOT, "data/universities_meta.json"),
  JSON.stringify(universitiesFile.meta, null, 2) + "\n",
  "utf8"
);

console.log(`Wrote ${majors.length} per-major offering files to ${OUT_DIR}`);
console.log(
  `Total size: ${(totalBytes / 1024).toFixed(0)} KB (avg ${(totalBytes / majors.length / 1024).toFixed(1)} KB/file)`
);
console.log(`Largest: ${maxFile.id} at ${(maxFile.bytes / 1024).toFixed(1)} KB`);
console.log(
  `Wrote ${BRANCHES.length} by-branch offering files to ${BRANCH_OUT_DIR}, total ${(branchTotalBytes / 1024).toFixed(0)} KB`
);
console.log(`Wrote data/universities_meta.json`);
