// يحسب حقلي eligibility وnearest_competitors تلقائياً من بيانات حقيقية
// (data/universities.json + data/major_riasec_profiles.json) لكل تخصص في
// data/majors.json، بدل تركهما لتخمين بحث خارجي -- كلاهما مُشتقّ حسابياً من
// نفس منطق lib/eligibility.ts و lib/majorMatcher.ts (مُعاد تطبيقه هنا بجافاسكربت
// خام لأن هذا سكربت أدوات وقت-البناء لا كوداً من جهة العميل).
//
// الاستخدام: node scripts/generate-derived-profile-fields.js
// يطبع كائن { [majorId]: { eligibility, nearest_competitors } } على
// scratchpad أو stdout حسب --out=<path>؛ لا يعدّل أي ملف بيانات مباشرة --
// الدمج النهائي في data/major_profiles_detailed.json يتم يدوياً/بسكربت دمج منفصل.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const majors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/majors.json"), "utf8"));
const universitiesFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
const universities = universitiesFile.universities;
const mappingFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_department_mapping.json"), "utf8"));
const mappings = mappingFile.mappings;
const riasecFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_riasec_profiles.json"), "utf8"));
const profiles = riasecFile.profiles;

function normalizeArabic(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/(^|\s)ال/g, "$1")
    .replace(/ا/g, "")
    .replace(/\s+/g, "");
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
  const depNorm = normalizeArabic(departmentName);
  const majorNameNorm = normalizeArabic(major.name);
  const mappingNameNorm = normalizeArabic(mapping.majorName);
  let score = 0;
  if (depNorm === majorNameNorm || depNorm === mappingNameNorm) {
    score = 100;
  } else if (mapping.aliases.some((alias) => normalizeArabic(alias) === depNorm)) {
    score = 85;
  } else {
    const matchingPatterns = mapping.departmentPatterns.filter((pattern) => depNorm.includes(normalizeArabic(pattern)));
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
        const { isMatch } = matchMajorToDepartment(major, dept.name, m);
        if (isMatch) {
          offerings.push({
            departmentBranches: dept.branch,
            averageGrades: dept.averageGrades,
            isDirectAdmission: dept.isDirectAdmission,
          });
        }
      }
    }
  }
  return offerings;
}

function computeEligibility(offerings) {
  const allowedBranches = [...new Set(offerings.flatMap((o) => o.departmentBranches))];
  const competitiveCutoffs = offerings
    .filter((o) => !o.isDirectAdmission && o.averageGrades["صباحي"] !== null)
    .map((o) => o.averageGrades["صباحي"]);
  const lowestCutoff = competitiveCutoffs.length > 0 ? Math.min(...competitiveCutoffs) : null;
  const highestCutoff = competitiveCutoffs.length > 0 ? Math.max(...competitiveCutoffs) : null;
  return {
    allowedBranches,
    observedCutoffRange: lowestCutoff !== null ? { min: lowestCutoff, max: highestCutoff } : null,
    hasDirectAdmissionOffers: offerings.some((o) => o.isDirectAdmission),
    offeringsCount: offerings.length,
    source: "محسوبة مباشرة من data/universities.json (لا تخميناً)",
  };
}

const RIASEC_DIMENSIONS = ["R", "I", "A", "S", "E", "C"];
function profileSimilarity(a, b) {
  let sumSquares = 0;
  RIASEC_DIMENSIONS.forEach((d) => {
    const av = (a[d] ?? 0) * 10;
    const bv = (b[d] ?? 0) * 10;
    sumSquares += (av - bv) ** 2;
  });
  const rmse = Math.sqrt(sumSquares / RIASEC_DIMENSIONS.length);
  return Math.max(0, Math.min(100, 100 - rmse));
}

function nearestCompetitors(majorId) {
  const own = profiles[majorId];
  if (!own) return [];
  const others = majors.filter((m) => m.id !== majorId);
  const scored = others.map((m) => ({
    id: m.id,
    name: m.name,
    similarity: Math.round(profileSimilarity(own, profiles[m.id] || {})),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, 2);
}

const result = {};
for (const major of majors) {
  const mapping = mappings.find((m) => m.majorId === major.id) || null;
  const offerings = findUniversitiesForMajor(major, mapping);
  result[major.id] = {
    eligibility: computeEligibility(offerings),
    nearest_competitors: nearestCompetitors(major.id),
  };
}

const outArg = process.argv.find((a) => a.startsWith("--out="));
const outPath = outArg ? outArg.slice("--out=".length) : null;
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  console.log(`Wrote derived fields for ${Object.keys(result).length} majors to ${outPath}`);
} else {
  console.log(JSON.stringify(result, null, 2));
}
