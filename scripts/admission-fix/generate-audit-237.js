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

// Known duplicates identified by manual verification and plan:
const KNOWN_DUPLICATES = new Map([
  ["جامعة الموصل|كلية هندسة النفط والتعدين|قسم هندسة المكامن النفطية", "قسم المكامن النفطية (معدل: 90)"],
  ["جامعة الموصل|كلية هندسة النفط والتعدين|قسم هندسة التعدين", "قسم التعدين (معدل: 89.14)"],
  [
    "الجامعة التقنية الشمالية|الكلية التقنية الهندسية|قسم هندسة تقنيات األجهزة الطبية",
    "قسم هندسة تقنيات االجهزة الطبية (تكرار OCR)",
  ],
  [
    "الجامعة التقنية الشمالية|المعهد التقني الحويجة|قسم تقنيات األدلة الجنائية",
    "قسم تقنيات االدلة الجنائية (تكرار OCR)",
  ],
  ["الجامعة التكنولوجية|كلية هندسة الحاسوب|واالمن السيبراني", "قسم الشبكات واالمن السيبراني (معدل: 94.29)"],
  ["جامعة الأنبار|كلية الهندسة|قسم الهندسة الكيمياوية", "قسم الكيميائية والبتروكيميائية (معدل: 89.43)"],
  ["جامعة بابل|كلية الهندسة|قسم الكهربائية", "قسم الكهرباء (معدل: 89.33)"],
  ["جامعة ذي قار|كلية الهندسة|قسم الكهرباء والإلكترونيك", "قسم الكهربائية وااللكترونية (معدل: 88.57)"],
  ["جامعة ميسان|كلية الهندسة|قسم الميكانيك (ميكانيك عام والتصميم والتصنيع)", "قسم الميكانيكية (معدل: 91)"],
]);

// Known links to official numbers:
const KNOWN_LINKS = new Map([
  [
    "الجامعة التكنولوجية|كلية هندسة الإنتاج والمعادن|قسم المعادن",
    {
      cutoff: 81,
      file: "cutoffs_2025_2026.json",
      line: 238,
      note: "معدل 81 في cutoffs تحت كلية هندسة االنتاج والمعادن",
    },
  ],
  [
    "جامعة المثنى|كلية التربية|قسم اللغة الإنكليزية",
    {
      cutoff: 70.57,
      file: "cutoffs_2025_2026.json",
      line: 72,
      note: "معدل 70.57 أدبي / 88.57 علمي في cutoffs تحت قسم اللغة االنكليزية",
    },
  ],
]);

const rows = [];
for (const d of direct237) {
  const fullKey = `${d.universityName}|${d.collegeName}|${d.departmentName}`;
  const uNorm = nk(d.universityName);
  const cNorm = nk(d.collegeName);
  const dClean = stripPrefix(d.departmentName);
  const dNorm = nk(dClean);

  const isEveOnly = d.sessions.length === 1 && d.sessions[0] === "مسائي";
  const eveGrade = d.averageGrades ? d.averageGrades["مسائي"] : null;

  let classification = "";
  let source = "";
  let line = "";
  let notes = "";

  if (KNOWN_DUPLICATES.has(fullKey)) {
    classification = "ج: مكرَّر";
    source = "data/universities.json";
    line = "-";
    notes = `مكرر مع: ${KNOWN_DUPLICATES.get(fullKey)}`;
  } else if (KNOWN_LINKS.has(fullKey)) {
    const lk = KNOWN_LINKS.get(fullKey);
    classification = "أ: يُربط";
    source = lk.file;
    line = String(lk.line);
    notes = lk.note;
  } else if (isEveOnly && eveGrade != null) {
    classification = "ب: مسائي فقط";
    source = "data/raw/dalel.full.txt / evening_study_2025_2026.json";
    line = "3505-3515";
    notes = `حد أدنى مسائي رسمي حسب نوع الكلية: ${eveGrade}`;
  } else if (eveGrade != null) {
    classification = "ب: لا حد صباحي منشور (له مسائي)";
    source = "data/raw/dalel.full.txt / evening_study_2025_2026.json";
    line = "3505-3515";
    notes = `حد أدنى مسائي رسمي: ${eveGrade}، لا حد صباحي منشور في دليل 2025-2026`;
  } else {
    classification = "ب: لا حدّ منشور";
    const ch3 = chapter3.find(
      (r) => nk(r.university) === uNorm && nk(r.college) === cNorm && nk(stripPrefix(r.department)) === dNorm
    );
    if (ch3) {
      source = "data/raw/chapter3_additions.json / dalel.full.txt";
      line = String(ch3.sourceLine || "-");
      notes = `مضاف من الفصل 3 (سطر ${ch3.sourceLine || "-"}). لا حد منشور في دليل 2025-2026`;
    } else {
      source = "دليل الطالب 2025-2026";
      line = "-";
      notes = "لا حد منشور في دليل 2025-2026";
    }
  }

  rows.push({
    university: d.universityName,
    college: d.collegeName,
    department: d.departmentName,
    sessions: d.sessions.join("+"),
    classification,
    source,
    line,
    notes,
  });
}

const csvHeader = "الجامعة,الكلية,القسم,الجلسات,التصنيف,المصدر,السطر,ملاحظات\n";
const csvContent =
  csvHeader +
  rows
    .map(
      (r) =>
        `"${r.university}","${r.college}","${r.department}","${r.sessions}","${r.classification}","${r.source}","${r.line}","${r.notes}"`
    )
    .join("\n");

fs.writeFileSync(path.join(ROOT, "reports/admission-fix/audit-237.csv"), "\uFEFF" + csvContent, "utf8");

// Print counts
const counts = {};
for (const r of rows) {
  counts[r.classification] = (counts[r.classification] || 0) + 1;
}
console.log("Summary of audit-237:", counts);
