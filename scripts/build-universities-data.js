// Builds the canonical data/universities.json from the extracted cutoffs
// + evening-study raw data (data/raw/*.json), restricted to universities
// that are verifiably real and sourced from the official 2025-2026 guide,
// plus the existing curated data/private_universities.json.
//
// Run after scripts/extract-pdf-text.js, scripts/parse-cutoffs.js and
// scripts/parse-evening-study.js (or all at once via `npm run rebuild-data`).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const cutoffs = require(path.join(ROOT, "data/raw/cutoffs_2025_2026.json"));
const evening = require(path.join(ROOT, "data/raw/evening_study_2025_2026.json"));
const chapter3Additions = require(path.join(ROOT, "data/raw/chapter3_additions.json"));
const privateUnis = require(path.join(ROOT, "data/private_universities.json"));

// Verified by hand against the table of contents (dalel PDF, chapter 3
// heading list) -- the authoritative list of universities covered by the
// federal القبول المركزي system. Kurdistan-region universities (chapter 5
// of the guide) are deliberately NOT included: that chapter uses a
// separate regional admission system and its PDF text layer is too
// corrupted to extract reliably as of this pass -- see
// data/admission_rules.md for the known-gaps note.
const UNIVERSITIES = [
  { name: "جامعة بغداد", founded: 1958, website: "www.uobaghdad.edu.iq", province: "بغداد" },
  { name: "الجامعة المستنصرية", founded: 1963, website: "www.uomustansiriyah.edu.iq", province: "بغداد" },
  { name: "جامعة البصرة", founded: 1967, website: "www.uobasrah.edu.iq", province: "البصرة" },
  { name: "جامعة الموصل", founded: 1967, website: "www.uomosul.edu.iq", province: "نينوى" },
  { name: "الجامعة التكنولوجية", founded: 1975, website: "www.uotechnology.edu.iq", province: "بغداد" },
  { name: "جامعة النهرين", founded: 1987, website: "www.nahrainuniv.edu.iq", province: "بغداد" },
  { name: "جامعة الكوفة", founded: 1987, website: "www.uokufa.edu.iq", province: "النجف" },
  { name: "جامعة تكريت", founded: 1987, website: "www.tu.edu.iq", province: "صلاح الدين" },
  { name: "جامعة القادسية", founded: 1987, website: "www.qu.edu.iq", province: "الديوانية" },
  { name: "جامعة الأنبار", founded: 1987, website: "www.uoanbar.edu.iq", province: "الأنبار" },
  { name: "الجامعة العراقية", founded: 1989, website: "www.aliraqia.edu.iq", province: "بغداد" },
  { name: "جامعة بابل", founded: 1991, website: "www.uobabylon.edu.iq", province: "بابل" },
  { name: "جامعة ديالى", founded: 1998, website: "www.uodiyala.edu.iq", province: "ديالى" },
  { name: "جامعة كربلاء", founded: 2002, website: "www.uokerbala.edu.iq", province: "كربلاء" },
  { name: "جامعة ذي قار", founded: 2002, website: "www.utq.edu.iq", province: "ذي قار" },
  { name: "جامعة كركوك", founded: 2003, website: "www.uokirkuk.edu.iq", province: "كركوك" },
  { name: "جامعة واسط", founded: 2003, website: "www.uowasit.edu.iq", province: "واسط" },
  { name: "جامعة ميسان", founded: 2007, website: "www.uomisan.edu.iq", province: "ميسان" },
  { name: "جامعة المثنى", founded: 2007, website: "www.mu.edu.iq", province: "المثنى" },
  { name: "جامعة سامراء", founded: 2014, website: "www.uosamarra.edu.iq", province: "صلاح الدين" },
  { name: "جامعة سومر", founded: 2014, website: "www.uos.edu.iq", province: "ذي قار" },
  { name: "جامعة القاسم الخضراء", founded: 2014, website: "www.uoqasim.edu.iq", province: "بابل" },
  { name: "جامعة نينوى", founded: 2014, website: "www.uoninevah.edu.iq", province: "نينوى" },
  { name: "جامعة الفلوجة", founded: 2014, website: "www.uofallujah.edu.iq", province: "الأنبار" },
  { name: "جامعة جابر بن حيان للعلوم الطبية والصيدلانية", founded: 2014, website: "www.jmu.edu.iq", province: "النجف" },
  { name: "جامعة تلعفر", founded: 2014, website: "www.uotelafer.edu.iq", province: "نينوى" },
  { name: "جامعة البصرة للنفط والغاز", founded: 2014, website: "www.buog.edu.iq", province: "البصرة" },
  { name: "جامعة الحمدانية", founded: 2014, website: "www.uohamdaniya.edu.iq", province: "نينوى" },
  { name: "جامعة تكنولوجيا المعلومات والاتصالات", founded: 2014, website: "www.uoitc.edu.iq", province: "بغداد" },
  { name: "جامعة الكرخ للعلوم", founded: 2014, website: "www.kus.edu.iq", province: "بغداد" },
  { name: "جامعة ابن سينا للعلوم الطبية والصيدلانية", founded: 2014, website: "www.ibnsina.edu.iq", province: "بغداد" },
  { name: "جامعة الشطرة", founded: 2023, website: "shu.edu.iq", province: "ذي قار" },
  { name: "الجامعة التقنية الشمالية", founded: 2014, website: "www.fte.edu.iq", province: "نينوى" },
  { name: "جامعة الفرات الأوسط التقنية", founded: 2014, website: "www.atu.edu.iq", province: "بابل" },
  { name: "الجامعة التقنية الجنوبية", founded: 2014, website: "www.stu.edu.iq", province: "البصرة" },
  { name: "الجامعة التقنية الوسطى", founded: 2014, website: "www.mtu.edu.iq", province: "بغداد" },
];

const ID_OVERRIDES = {
  "جامعة بغداد": "baghdad", "الجامعة المستنصرية": "mustansiriyah", "جامعة البصرة": "basrah",
  "جامعة الموصل": "mosul", "الجامعة التكنولوجية": "technology", "جامعة النهرين": "nahrain",
  "جامعة الكوفة": "kufa", "جامعة تكريت": "tikrit", "جامعة القادسية": "qadisiyah",
  "جامعة الأنبار": "anbar", "الجامعة العراقية": "iraqia", "جامعة بابل": "babil",
  "جامعة ديالى": "diyala", "جامعة كربلاء": "karbala", "جامعة ذي قار": "dhiqar",
  "جامعة كركوك": "kirkuk", "جامعة واسط": "wasit", "جامعة ميسان": "maysan",
  "جامعة المثنى": "muthanna", "جامعة سامراء": "samarra", "جامعة سومر": "sumer",
  "جامعة القاسم الخضراء": "alqasim_alkhadraa", "جامعة نينوى": "ninevah",
  "جامعة الفلوجة": "fallujah", "جامعة جابر بن حيان للعلوم الطبية والصيدلانية": "jaber_ibn_hayyan",
  "جامعة تلعفر": "telafer", "جامعة البصرة للنفط والغاز": "basrah_oil_gas",
  "جامعة الحمدانية": "hamdaniya", "جامعة تكنولوجيا المعلومات والاتصالات": "uoitc",
  "جامعة الكرخ للعلوم": "karkh", "جامعة ابن سينا للعلوم الطبية والصيدلانية": "ibn_sina",
  "جامعة الشطرة": "shatrah", "الجامعة التقنية الشمالية": "northern_technical",
  "جامعة الفرات الأوسط التقنية": "middle_euphrates_technical", "الجامعة التقنية الجنوبية": "southern_technical",
  "الجامعة التقنية الوسطى": "middle_technical",
};

function slugify(name) {
  return name
    .replace(/^(جامعة|الجامعة)\s+/, "")
    .replace(/[إأآا]/g, "a").replace(/ة/g, "h").replace(/ى/g, "a")
    .replace(/[^a-zA-Z0-9؀-ۿ]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// PDF text extraction sometimes reorders the "لا" ligature (extracts as
// "ال" instead of "لا") and drops hamza diacritics. Stripping all bare
// alef characters collapses both spellings to the same key -- mirrors
// lib/majorMatcher.ts's normalizeArabic().
function normKey(s) {
  return (s || "").replace(/[أإآ]/g, "ا").replace(/ا/g, "").replace(/\s+/g, "").trim();
}

function eveningMinGradeFor(collegeName) {
  const c = collegeName || "";
  if (/تمريض/.test(c)) return 70;
  if (/بيطري/.test(c)) return 65;
  if (/تقنيات طبية|تقنيات صحية|طبية والصحية|صحية والطبية/.test(c)) return 75;
  if (/هندسة|الهندسة/.test(c) && !/تقنيات هندسية|تقنية هندسية/.test(c)) return 65;
  if (/تقنيات هندسية|تقنية هندسية|كلية تقنية/.test(c)) return 60;
  if (/علوم|حاسوب|تكنولوجيا المعلومات/.test(c)) return 60;
  if (/قانون|حقوق/.test(c)) return 65;
  if (/سياسية|ادارة|اقتصاد|إدارة/.test(c)) return 60;
  if (/تربية البدنية|علوم الرياضة/.test(c)) return 56; // avg of 57(m)/55(f); refine per-gender in UI if needed
  return 58;
}

function stripCollegePrefix(name) {
  return (name || "").replace(/^(كلية|كليات|معهد|المعهد)\s+/, "").trim() || name;
}

const universities = UNIVERSITIES.map((u) => ({
  id: ID_OVERRIDES[u.name] || slugify(u.name),
  name: u.name,
  nameEn: null,
  type: "حكومية",
  province: u.province,
  founded: u.founded,
  website: u.website,
  ranking: null,
  _collegesMap: new Map(),
}));

const byName = new Map(universities.map((u) => [normKey(u.name), u]));

function getCollege(uni, collegeName) {
  const key = collegeName.trim();
  if (!uni._collegesMap.has(key)) uni._collegesMap.set(key, { name: key, departmentsMap: new Map() });
  return uni._collegesMap.get(key);
}

function getDept(college, deptName, collegeNameForFallback) {
  const effectiveName = deptName && deptName.trim() ? deptName.trim() : null;
  const key = effectiveName || "__COLLEGE_LEVEL__";
  if (!college.departmentsMap.has(key)) {
    college.departmentsMap.set(key, {
      name: effectiveName || stripCollegePrefix(collegeNameForFallback),
      isCollegeLevelProgram: !effectiveName,
      sessions: new Set(),
      cutoffs: [],
      eveningMinGrade: null,
      directBranches: new Set(),
    });
  }
  return college.departmentsMap.get(key);
}

let unmatchedUni = new Set();

for (const row of cutoffs) {
  const uni = byName.get(normKey(row.university));
  if (!uni) { unmatchedUni.add(row.university); continue; }
  const college = getCollege(uni, row.college);
  const dept = getDept(college, row.department, row.college);
  dept.sessions.add("صباحي");
  dept.cutoffs.push({ branch: row.branch, gender: row.gender, averagePercent: row.averagePercent, isQuota: row.isQuota });
}

for (const row of evening) {
  const uni = byName.get(normKey(row.university));
  if (!uni) { unmatchedUni.add(row.university); continue; }
  const college = getCollege(uni, row.college);
  const dept = getDept(college, row.department, row.college);
  dept.sessions.add("مسائي");
  const grade = eveningMinGradeFor(row.college);
  if (dept.eveningMinGrade === null || grade < dept.eveningMinGrade) dept.eveningMinGrade = grade;
}

// Chapter 3 (college/department/branch-eligibility table) additions:
// colleges/departments verified present in the official guide but absent
// from both the competitive cutoffs and evening-study data (i.e. they
// never filled via competition and aren't offered evening either --
// genuinely direct-admission-only programs). See data/admission_rules.md
// for how these were found and cross-checked against the existing dataset
// before being added, to avoid duplicating anything already covered.
for (const row of chapter3Additions) {
  const uni = byName.get(normKey(row.university));
  if (!uni) { unmatchedUni.add(row.university); continue; }
  const college = getCollege(uni, row.college);
  const dept = getDept(college, row.department, row.college);
  dept.sessions.add("صباحي");
  (row.branch || []).forEach((b) => dept.directBranches.add(b));
}

if (unmatchedUni.size) {
  console.error("Unmatched university names (should be empty):", [...unmatchedUni]);
  process.exit(1);
}

const finalUniversities = universities.map((u) => {
  const colleges = [...u._collegesMap.values()].map((c, cIdx) => {
    const departments = [...c.departmentsMap.values()].map((d) => {
      const nonQuotaCutoffs = d.cutoffs.filter((x) => !x.isQuota);
      const bestMorning = nonQuotaCutoffs.length ? Math.min(...nonQuotaCutoffs.map((x) => x.averagePercent)) : null;
      const branches = [...new Set([...d.cutoffs.map((x) => x.branch), ...d.directBranches])];
      return {
        name: d.name,
        branch: branches,
        sessions: [...d.sessions],
        cutoffs: d.cutoffs,
        averageGrades: { "صباحي": bestMorning, "مسائي": d.eveningMinGrade },
        isDirectAdmission: d.cutoffs.length === 0,
      };
    });
    return { id: `${u.id}_col_${cIdx + 1}`, name: c.name, nameEn: null, departments };
  });
  const { _collegesMap, ...rest } = u;
  return { ...rest, colleges };
});

const privateFinal = privateUnis.map((p) => ({
  id: p.id,
  name: p.name,
  nameEn: null,
  type: "أهلية",
  province: p.province || null,
  founded: p.founded || null,
  website: p.website || null,
  ranking: null,
  colleges: [{
    id: `${p.id}_col_1`,
    name: "برامج القبول المباشر",
    nameEn: null,
    departments: (p.majors || []).map((m) => ({
      name: m, branch: [], sessions: ["صباحي"], cutoffs: [],
      averageGrades: { "صباحي": null, "مسائي": null }, isDirectAdmission: true,
    })),
  }],
}));

const out = {
  meta: {
    lastUpdated: new Date().toISOString().slice(0, 10),
    source: "دليل الطالب للسنة الدراسية 2025-2026 + الحدود الدنيا للقبول المركزي (القناة العامة) - وزارة التعليم العالي والبحث العلمي العراقية",
    sourceFiles: ["dalel_2025_22026.pdf", "الحدودالدنياالقبول-المركزي-القناةالعامة__للسنة_الدراسية_2025-2026.pdf"],
    academicYear: "2025-2026",
    version: "3.0.0",
    notes: "يغطي الجامعات الحكومية والتقنية المشمولة بالقبول المركزي (36 جامعة، مع أقسام إضافية من الفصل 3 لبرامج القبول المباشر غير التنافسي) + 76 جامعة وكلية أهلية معتمدة رسمياً (قوائم تخصصات مفصّلة متاحة لـ6 منها فقط حتى الآن). لا يشمل: (أ) جامعات إقليم كردستان (نظام قبول إقليمي منفصل تماماً، الفصل الخامس من الدليل تالف النص بشدة)، (ب) معاهد خريجي الفروع المهنية (الفصل 3، القسم ج-2 -- يشترط شهادات مهنية سابقة، فئة طلاب مختلفة عن نطاق هذه المنصة). التفاصيل الكاملة والمصادر في data/admission_rules.md.",
  },
  universities: [...finalUniversities, ...privateFinal],
};

const OUT = path.join(ROOT, "data/universities.json");
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

// Small derived file (province names only) so client components that just
// need a province dropdown (e.g. app/quiz/page.tsx) don't have to import
// the entire multi-megabyte universities.json into their JS bundle.
const provinces = Array.from(new Set(out.universities.map((u) => u.province))).sort((a, b) => a.localeCompare(b, "ar"));
fs.writeFileSync(path.join(ROOT, "data/provinces.json"), JSON.stringify(provinces, null, 2) + "\n", "utf8");

const totalColleges = finalUniversities.reduce((s, u) => s + u.colleges.length, 0);
const totalDepts = finalUniversities.reduce((s, u) => s + u.colleges.reduce((s2, c) => s2 + c.departments.length, 0), 0);
console.log("Wrote", OUT);
console.log("Government/technical universities:", finalUniversities.length, "| colleges:", totalColleges, "| departments:", totalDepts);
console.log("Private universities:", privateFinal.length);
