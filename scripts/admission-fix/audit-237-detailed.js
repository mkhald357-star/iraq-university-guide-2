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
          collegeId: c.id,
          collegeName: c.name,
          allDeptsInCollege: c.departments.map((dept) => dept.name),
          departmentName: d.name,
          sessions: d.sessions || [],
          averageGrades: d.averageGrades || null,
          cutoffs: d.cutoffs || [],
        });
      }
    }
  }
}

// Check each department
const auditRows = [];

for (const d of direct237) {
  const uNorm = nk(d.universityName);
  const cNorm = nk(d.collegeName);
  const dClean = stripPrefix(d.departmentName);
  const dNorm = nk(dClean);

  // Check if college has another department that is an alias/duplicate:
  // e.g. "قسم هندسة المكامن النفطية" vs "قسم المكامن النفطية"
  // or "قسم هندسة التعدين" vs "قسم التعدين"
  const potentialDup = d.allDeptsInCollege.find((otherName) => {
    if (otherName === d.departmentName) return false;
    const oClean = stripPrefix(otherName);
    // if one without "هندسة" equals the other
    const dWithoutHandasa = dClean.replace(/هندسة\s+/, "");
    const oWithoutHandasa = oClean.replace(/هندسة\s+/, "");
    if (nk(dWithoutHandasa) === nk(oWithoutHandasa)) return true;
    return false;
  });

  // Check evening status
  const isEveningOnly = d.sessions.length === 1 && d.sessions[0] === "مسائي";
  const hasEveningGrade = d.averageGrades && d.averageGrades["مسائي"] != null;

  // Check cutoffsRaw
  const cutCollege = cutoffsRaw.filter((r) => nk(r.university) === uNorm && nk(r.college) === cNorm);

  // Exact match
  const cutExact = cutCollege.filter((r) => r.department && nk(stripPrefix(r.department)) === dNorm);

  // Match without "هندسة" or similar
  const cutFuzzy = cutCollege.filter((r) => {
    if (!r.department) return false;
    const rClean = stripPrefix(r.department);
    const dNoH = dClean.replace(/هندسة\s+/, "");
    const rNoH = rClean.replace(/هندسة\s+/, "");
    return nk(dNoH) === nk(rNoH);
  });

  // Check chapter3
  const ch3Entry = chapter3.find(
    (r) => nk(r.university) === uNorm && nk(r.college) === cNorm && nk(stripPrefix(r.department)) === dNorm
  );

  let classification = "";
  let source = "";
  let sourceLine = "";
  let notes = "";

  if (potentialDup) {
    classification = "ج: مكرَّر";
    source = "data/universities.json";
    notes = `مكرر مع قسم شقيق (${potentialDup}) في نفس الكلية`;
  } else if (cutExact.length > 0) {
    classification = "أ: يُربط";
    source = "data/raw/cutoffs_2025_2026.json";
    notes = `معدل صباحي: ${cutExact[0].averagePercent}`;
  } else if (cutFuzzy.length > 0 && !potentialDup) {
    classification = "أ: يُربط";
    source = "data/raw/cutoffs_2025_2026.json";
    notes = `مطابقة تقريبية مع: ${cutFuzzy[0].department} (معدل: ${cutFuzzy[0].averagePercent})`;
  } else if (isEveningOnly && hasEveningGrade) {
    classification = "ب: مسائي فقط";
    source = "dalel.full.txt:3505-3515 / evening_study_2025_2026.json";
    notes = `مسائي فقط بحد أدنى: ${d.averageGrades["مسائي"]}`;
  } else if (hasEveningGrade) {
    classification = "ب: لا حد صباحي منشور (له مسائي)";
    source = "evening_study_2025_2026.json";
    notes = `حد مسائي: ${d.averageGrades["مسائي"]} ولا حد صباحي منشور`;
  } else {
    classification = "ب: لا حدّ منشور";
    if (ch3Entry) {
      source = `chapter3_additions.json (سطر ${ch3Entry.sourceLine || "غير محدد"})`;
    } else {
      source = "دليل الطالب 2025-2026";
    }
    notes = "موجود بالدليل بلا رقم في ملف الحدود";
  }

  auditRows.push({
    university: d.universityName,
    college: d.collegeName,
    department: d.departmentName,
    sessions: d.sessions.join("+"),
    classification,
    source,
    notes,
    ch3SourceLine: ch3Entry ? ch3Entry.sourceLine || "" : "",
  });
}

console.log(`Classified ${auditRows.length} departments:`);
const counts = {};
for (const r of auditRows) {
  counts[r.classification] = (counts[r.classification] || 0) + 1;
}
console.log(counts);

// Write to CSV
const csvHeader = "الجامعة,الكلية,القسم,الجلسات,التصنيف,المصدر,ملاحظات\n";
const csvContent =
  csvHeader +
  auditRows
    .map(
      (r) =>
        `"${r.university}","${r.college}","${r.department}","${r.sessions}","${r.classification}","${r.source}","${r.notes}"`
    )
    .join("\n");

fs.writeFileSync(path.join(ROOT, "reports/admission-fix/audit-237.csv"), "\uFEFF" + csvContent, "utf8");
console.log("Wrote reports/admission-fix/audit-237.csv");
