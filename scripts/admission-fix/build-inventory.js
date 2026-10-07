// يولّد جرداً للقراءة فقط بكل أقسام data/universities.json (حكومي + أهلي) مع حالة كل رقم
// ودليله في الملفات الخام. لا يعدّل أي بيانات.
// الاستخدام: node scripts/admission-fix/build-inventory.js
// المخرجات: reports/admission-fix/inventory.csv  و  inventory-summary.json
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "reports", "admission-fix");
fs.mkdirSync(OUT, { recursive: true });

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const universities = read("data/universities.json").universities;
const cutoffsRaw = read("data/raw/cutoffs_2025_2026.json");
const eveningRaw = read("data/raw/evening_study_2025_2026.json");
const chapter3 = read("data/raw/chapter3_additions.json");

// نفس تطبيع build-universities-data.js:normKey (حذف الألف المجردة) ليكون التدقيق مستقلاً عن اختلاف الهمزات.
const nk = (s) => (s || "").replace(/[أإآ]/g, "ا").replace(/ا/g, "").replace(/\s+/g, "").trim();
const stripPrefix = (s) => (s || "").replace(/^(قسم|فرع)\s+/, "");

// فهارس الملفات الخام
const cutByUC = new Map(); // جامعة|كلية -> صفوف
const cutByUCD = new Map(); // جامعة|كلية|قسم -> صفوف
for (const r of cutoffsRaw) {
  const kc = nk(r.university) + "|" + nk(r.college);
  (cutByUC.get(kc) || cutByUC.set(kc, []).get(kc)).push(r);
  if (r.department) {
    const kd = kc + "|" + nk(stripPrefix(r.department));
    (cutByUCD.get(kd) || cutByUCD.set(kd, []).get(kd)).push(r);
  }
}
const eveSet = new Set(
  eveningRaw.map((r) => nk(r.university) + "|" + nk(r.college) + "|" + nk(stripPrefix(r.department)))
);
const eveSetUC = new Set(eveningRaw.map((r) => nk(r.university) + "|" + nk(r.college)));
const ch3Set = new Set(
  chapter3.map((r) => nk(r.university) + "|" + nk(r.college) + "|" + nk(stripPrefix(r.department)))
);

// تغطية التخصصات (من الملفات المولَّدة)
const coverDir = path.join(ROOT, "public", "data", "major-offerings");
const covered = new Map();
if (fs.existsSync(coverDir)) {
  for (const f of fs.readdirSync(coverDir)) {
    const majorId = f.replace(/\.json$/, "");
    for (const o of JSON.parse(fs.readFileSync(path.join(coverDir, f), "utf8"))) {
      const k = o.universityId + "|" + o.collegeName + "|" + o.departmentName;
      (covered.get(k) || covered.set(k, []).get(k)).push(majorId);
    }
  }
}

const rows = [];
const summary = {
  total: 0,
  gov: {
    total: 0,
    morningVerified: 0,
    morningUnverified: 0,
    morningMissing: 0,
    eveningGuideRule: 0,
    eveningMissing: 0,
    flaggedDirectNow: 0,
  },
  private: { total: 0, statedMin: 0, noStatedMin: 0 },
  covered: { yes: 0, no: 0 },
};

for (const u of universities) {
  const isPriv = /أهلي/.test(u.type);
  for (const c of u.colleges) {
    for (const d of c.departments) {
      const key = u.id + "|" + c.name + "|" + d.name;
      const majors = covered.get(key) || [];
      const sessions = d.sessions || [];
      const morningVal = d.averageGrades ? d.averageGrades["صباحي"] : null;
      const eveningVal = d.averageGrades ? d.averageGrades["مسائي"] : null;

      let morningStatus = "",
        morningProof = "",
        eveningStatus = "",
        eveningProof = "",
        action = "";

      if (!isPriv) {
        // ---- الصباحي: رقم تنافسي رسمي من cutoffs_2025_2026.json
        if (sessions.includes("صباحي") || morningVal != null) {
          const kd = nk(u.name) + "|" + nk(c.name) + "|" + nk(stripPrefix(d.name));
          const hit = cutByUCD.get(kd) || [];
          const collegeLevel = (cutByUC.get(nk(u.name) + "|" + nk(c.name)) || []).filter((r) => !r.department);
          const inCh3 = ch3Set.has(kd);
          if (morningVal != null) {
            const pool = hit.length ? hit : collegeLevel;
            const ok = pool.some((r) => !r.isQuota && Math.abs(r.averagePercent - morningVal) < 0.011);
            if (ok) {
              morningStatus = "موجود-مؤكَّد";
              morningProof = hit.length ? "cutoffs_2025_2026.json (قسم)" : "cutoffs_2025_2026.json (مستوى الكلية)";
              summary.gov.morningVerified++;
            } else {
              morningStatus = "موجود-غير مؤكَّد";
              morningProof = "الرقم لا يطابق أي صف خام بالاسم المطبَّع";
              summary.gov.morningUnverified++;
              action = "تحقق يدوي من الرقم";
            }
          } else {
            morningStatus = "ناقص";
            morningProof = inCh3
              ? "القسم من chapter3_additions.json (الدليل) بلا صف في الحدود"
              : hit.length
                ? "يوجد صف خام لم يُربط"
                : "لا صف مطابق في الحدود الدنيا";
            summary.gov.morningMissing++;
            action = hit.length ? "اربط الصف الخام" : "ابحث عن رقم رسمي، وإن لم يوجد فاتركه فارغاً (لا حدّ منشور)";
          }
        }
        // ---- المسائي: الدليل ينص على حد أدنى ثابت حسب نوع الكلية (dalel.full.txt:3505-3515)، وليس رقماً تنافسياً
        if (sessions.includes("مسائي")) {
          const inEve =
            eveSet.has(nk(u.name) + "|" + nk(c.name) + "|" + nk(stripPrefix(d.name))) ||
            eveSetUC.has(nk(u.name) + "|" + nk(c.name));
          if (eveningVal != null) {
            eveningStatus = "موجود-حد دليل حسب نوع الكلية";
            eveningProof = inEve
              ? "evening_study_2025_2026.json + قاعدة الدليل"
              : "قاعدة الدليل فقط (القسم غير في قائمة المسائي الخام)";
            summary.gov.eveningGuideRule++;
            if (!inEve) action = action || "تحقق: جلسة مسائية بلا سند في قائمة الدراسة المسائية";
          } else {
            eveningStatus = "ناقص";
            summary.gov.eveningMissing++;
          }
        }
        if (d.isDirectAdmission) {
          summary.gov.flaggedDirectNow++;
          action = ("مصنَّف الآن قبول مباشر -- يجب إلغاؤه. " + action).trim();
        }
        summary.gov.total++;
      } else {
        const stated = d.statedMinimumGrade && d.statedMinimumGrade.value != null ? d.statedMinimumGrade.value : null;
        morningStatus = stated != null ? "شرط معلَن" : "ناقص";
        morningProof =
          stated != null ? (d.statedMinimumGrade.source || "") + " " + (d.statedMinimumGrade.sourceYear || "") : "";
        eveningStatus = sessions.includes("مسائي") ? "لا حد رسمي منشور للأهلي" : "";
        if (stated != null) summary.private.statedMin++;
        else {
          summary.private.noStatedMin++;
          action = "ابحث عن شرط معدل رسمي منشور؛ وإن لم يوجد فاتركه فارغاً";
        }
        summary.private.total++;
      }

      if (majors.length) summary.covered.yes++;
      else summary.covered.no++;
      summary.total++;

      rows.push([
        isPriv ? "أهلي" : "حكومي",
        u.name,
        c.name,
        d.name,
        sessions.join("+"),
        (d.branch || []).join("+"),
        morningVal ?? (d.statedMinimumGrade && d.statedMinimumGrade.value) ?? "",
        morningStatus,
        morningProof,
        eveningVal ?? "",
        eveningStatus,
        eveningProof,
        d.isDirectAdmission ? "نعم" : "لا",
        majors.length ? majors.join("+") : "",
        majors.length ? "مغطى" : "غير مغطى",
        action,
      ]);
    }
  }
}

const head = [
  "النوع",
  "الجامعة",
  "الكلية",
  "القسم",
  "الجلسات",
  "الفروع",
  "الصباحي-القيمة",
  "الصباحي-الحالة",
  "الصباحي-الدليل",
  "المسائي-القيمة",
  "المسائي-الحالة",
  "المسائي-الدليل",
  "مصنَّف قبول مباشر الآن",
  "التخصصات المطابقة",
  "التغطية",
  "المطلوب",
];
const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
const csv = "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
fs.writeFileSync(path.join(OUT, "inventory.csv"), csv);
fs.writeFileSync(path.join(OUT, "inventory-summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
