const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const unis = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities;

const unresolved = [];
for (const u of unis) {
  if (u.type !== "حكومية") continue;
  for (const c of u.colleges) {
    for (const d of c.departments) {
      if (
        d.admissionStatus === "noPublishedCutoff" ||
        (d.sessions.includes("صباحي") && d.averageGrades["صباحي"] == null)
      ) {
        unresolved.push({
          university: u.name,
          college: c.name,
          department: d.name,
          sessions: d.sessions.join(";"),
          admissionStatus: d.admissionStatus,
          morningGrade: d.averageGrades["صباحي"] ?? "غير منشور",
          eveningGrade: d.averageGrades["مسائي"] ?? "غير منشور",
          reason:
            d.admissionStatus === "noPublishedCutoff"
              ? "لم يرد له حد منشور في ملف الحدود الدنيا 2025-2026 (مستحدث/استثناء مركزي)"
              : "جلسة صباحية مستحدثة من الفصل الثالث بلا حد في ملف الحدود 2025-2026",
        });
      }
    }
  }
}

let unresolvedCsv = "الجامعة,الكلية,القسم,الجلسات,الحالة,معدل_صباحي,معدل_مسائي,السبب\n";
for (const r of unresolved) {
  unresolvedCsv += `"${r.university}","${r.college}","${r.department}","${r.sessions}","${r.admissionStatus}","${r.morningGrade}","${r.eveningGrade}","${r.reason}"\n`;
}
fs.writeFileSync(path.join(ROOT, "reports/admission-fix/unresolved.csv"), unresolvedCsv, "utf8");
console.log("Unresolved count written:", unresolved.length);

const filled = [
  {
    uni: "جامعة الموصل",
    col: "كلية هندسة النفط والتعدين",
    dept: "قسم المكامن النفطية",
    action: "دمج مع قسم هندسة المكامن وحذف التكرار",
    grade: "90",
  },
  {
    uni: "جامعة الموصل",
    col: "كلية هندسة النفط والتعدين",
    dept: "قسم التعدين",
    action: "دمج مع قسم هندسة التعدين وحذف التكرار",
    grade: "86.86",
  },
  {
    uni: "الجامعة التكنولوجية",
    col: "كلية هندسة الإنتاج والمعادن",
    dept: "قسم هندسة المعادن",
    action: "تصحيح اسم الكلية وربط الحد الرسمي",
    grade: "81",
  },
  {
    uni: "الجامعة التكنولوجية",
    col: "كلية هندسة الإنتاج والمعادن",
    dept: "قسم هندسة الإنتاج",
    action: "تصحيح اسم الكلية وربط الحد الرسمي",
    grade: "80.57",
  },
  {
    uni: "الجامعة التكنولوجية",
    col: "كلية هندسة الإنتاج والمعادن",
    dept: "قسم هندسة التصميم والتصنيع المعان بالحاسوب",
    action: "تصحيح اسم الكلية وربط الحد الرسمي",
    grade: "80",
  },
  {
    uni: "الجامعة التكنولوجية",
    col: "كلية هندسة الإنتاج والمعادن",
    dept: "قسم هندسة التعدين واستخلاص المعادن",
    action: "تصحيح اسم الكلية وربط الحد الرسمي",
    grade: "79.57",
  },
  {
    uni: "الجامعة التكنولوجية",
    col: "كلية هندسة الإنتاج والمعادن",
    dept: "قسم الهندسة الصناعية",
    action: "تصحيح اسم الكلية وربط الحد الرسمي",
    grade: "80.14",
  },
  {
    uni: "جامعة الفلوجة",
    col: "كلية التربية",
    dept: "قسم اللغة االنكليزية",
    action: "دمج السجلين وتوحيد الحد الرسمي",
    grade: "70.14",
  },
  {
    uni: "جامعة المثنى",
    col: "كلية التربية للعلوم االنسانية",
    dept: "قسم اللغة االنكليزية",
    action: "تصحيح الكلية ودمج السجلين وربط الحد الرسمي",
    grade: "70.57 / 88.57",
  },
  {
    uni: "الجامعة التقنية الشمالية",
    col: "الكلية التقنية الهندسية",
    dept: "قسم هندسة تقنيات االجهزة الطبية",
    action: "دمج سجل الـOCR وحذف التكرار",
    grade: "91.86",
  },
  {
    uni: "الجامعة التقنية الشمالية",
    col: "الكلية التقنية الهندسية",
    dept: "قسم هندسة تقنيات الحاسبات",
    action: "دمج سجل الـOCR وحذف التكرار",
    grade: "75",
  },
  {
    uni: "جامعة الكرخ للعلوم",
    col: "كلية التحسس النائي والجيوفيزياء",
    dept: "قسم التحسس النائي والجيوفيزياء",
    action: "دمج الأقسام المبتورة وحذف التكرار",
    grade: "60.57",
  },
  {
    uni: "جامعة الفلوجة",
    col: "كلية الإدارة والاقتصاد",
    dept: "قسم الإدارة العامة",
    action: "دمج سجل الـOCR وحذف التكرار",
    grade: "61.71",
  },
  {
    uni: "جامعة سامراء",
    col: "كلية العلوم التطبيقية",
    dept: "قسم التحليالت المرضية",
    action: "دمج سجل الـOCR وحذف التكرار",
    grade: "80.57",
  },
  {
    uni: "جامعة سامراء",
    col: "كلية العلوم التطبيقية",
    dept: "قسم الكيمياء التطبيقة",
    action: "دمج سجل الـOCR وحذف التكرار",
    grade: "63.86",
  },
  {
    uni: "جامعة نينوى",
    col: "كلية هندسة الإلكترونيات",
    dept: "قسم هندسة الالكترونيك",
    action: "دمج سجل النظم والسيطرة وحذف التكرار",
    grade: "74.29",
  },
];

let filledCsv = "الجامعة,الكلية,القسم,الإجراء_المتخذ,المعدل_الرسمي_المربوط\n";
for (const r of filled) {
  filledCsv += `"${r.uni}","${r.col}","${r.dept}","${r.action}","${r.grade}"\n`;
}
fs.writeFileSync(path.join(ROOT, "reports/admission-fix/filled.csv"), filledCsv, "utf8");
console.log("Filled count written:", filled.length);
