const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const uni = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities;
const cutoffsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/cutoffs_2025_2026.json"), "utf8"));
const eveningRaw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/evening_study_2025_2026.json"), "utf8"));
const chapter3 = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/chapter3_additions.json"), "utf8"));

const nk = (s) => (s || "").replace(/[أإآ]/g, "ا").replace(/ا/g, "").replace(/\s+/g, "").trim();
const stripPrefix = (s) => (s || "").replace(/^(قسم|فرع)\s+/, "");

// Find all 237 government departments with isDirectAdmission = true
const direct237 = [];
for (const u of uni) {
  if (/أهلي/.test(u.type)) continue;
  for (const c of u.colleges) {
    for (const d of c.departments) {
      if (d.isDirectAdmission) {
        direct237.push({
          universityId: u.id,
          universityName: u.name,
          collegeName: c.name,
          departmentName: d.name,
          sessions: d.sessions || [],
          averageGrades: d.averageGrades || null,
          cutoffs: d.cutoffs || [],
        });
      }
    }
  }
}

console.log(`Found ${direct237.length} government direct admission departments.`);

// Analyze each
const results = [];
for (const item of direct237) {
  const uNorm = nk(item.universityName);
  const cNorm = nk(item.collegeName);
  const dNorm = nk(stripPrefix(item.departmentName));

  // Search in cutoffs
  // Check exact university + college matches
  const cutSameCollege = cutoffsRaw.filter((r) => nk(r.university) === uNorm && nk(r.college) === cNorm);

  // Check if any cutoffs match department or alt name
  const cutExactDept = cutSameCollege.filter((r) => r.department && nk(stripPrefix(r.department)) === dNorm);

  // Check in evening study
  const eveSameCollege = eveningRaw.filter((r) => nk(r.university) === uNorm && nk(r.college) === cNorm);
  const eveExactDept = eveSameCollege.filter((r) => r.department && nk(stripPrefix(r.department)) === dNorm);

  // Check in chapter 3
  const ch3Match = chapter3.filter(
    (r) => nk(r.university) === uNorm && nk(r.college) === cNorm && nk(stripPrefix(r.department)) === dNorm
  );

  results.push({
    item,
    cutSameCollege,
    cutExactDept,
    eveSameCollege,
    eveExactDept,
    ch3Match,
  });
}

// Print breakdown
let hasEveningOnly = 0;
let hasEveningCutoff = 0;
let missingAll = 0;
for (const r of results) {
  const evGrade = r.item.averageGrades ? r.item.averageGrades["مسائي"] : null;
  const sessions = r.item.sessions;
  if (evGrade != null) hasEveningCutoff++;
  if (sessions.length === 1 && sessions[0] === "مسائي") hasEveningOnly++;
  if (!r.item.averageGrades || Object.keys(r.item.averageGrades).length === 0) missingAll++;
}
console.log(`hasEveningCutoff: ${hasEveningCutoff}, hasEveningOnly: ${hasEveningOnly}, missingAll: ${missingAll}`);

// Check specific cases mentioned in plan:
// "هندسة المكامن النفطية" vs "المكامن النفطية"
for (const r of results) {
  if (r.item.departmentName.includes("المكامن")) {
    console.log("FOUND المكامن:", r.item, "cutSameCollege:", r.cutSameCollege);
  }
}
