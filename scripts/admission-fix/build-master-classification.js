// يولّد التصنيف الشامل لكل بيانات الموقع (قراءة فقط من data/universities.json):
// محافظة ← جامعة ← كلية ← قسم، حكومي/أهلي، صباحي/مسائي، مع المعدلات وأساسها.
// المخرجات (reports/admission-fix/master/):
//   master-classification.csv   -- صف لكل قسم (UTF-8 مع BOM ليفتح في Excel)
//   master-classification.json  -- نفس البيانات هرمياً: محافظة > جامعة > كلية > قسم
//   summary-by-province.csv     -- عدّادات لكل محافظة ونوع
//   summary-by-university.csv   -- عدّادات واكتمال لكل جامعة
//   quality.json                -- مؤشرات اكتمال البيانات (للتدقيق، لا للعرض)
// الاستخدام: node scripts/admission-fix/build-master-classification.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "reports", "admission-fix", "master");
fs.mkdirSync(OUT, { recursive: true });

const universities = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities;
const YEAR = "2025-2026";

const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
const csv = (head, rows) => "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
const num = (v) => (v == null ? "" : v);

// تفصيل الصباحي: أدنى معدل لكل (فرع، جنس) من cutoffs غير القناة الخاصة، والقنوات تُوسَم.
function morningBreakdown(cutoffs) {
  const best = new Map();
  for (const c of cutoffs || []) {
    const k = `${c.branch}${c.gender && c.gender !== "مختلط" ? " (" + c.gender + ")" : ""}${c.isQuota ? " [قناة خاصة]" : ""}`;
    if (!best.has(k) || c.averagePercent < best.get(k)) best.set(k, c.averagePercent);
  }
  return [...best.entries()].map(([k, v]) => `${k}: ${v}`).join(" | ");
}

const rows = [];
const tree = {};
const byProvince = {};
const byUni = {};
const quality = {
  departments: 0,
  gov: 0,
  private: 0,
  govMorningWithNumber: 0,
  govEveningWithNumber: 0,
  govNoPublishedCutoff: 0,
  privateStatedMin: 0,
  privateNoStatedMin: 0,
  privateWithFees: 0,
  branchUnknown: 0,
  suspended: 0,
};

for (const u of universities) {
  const isPriv = u.type === "أهلية";
  const typeLabel = isPriv ? "أهلية" : "حكومية";
  const pKey = `${u.province}|${typeLabel}`;
  byProvince[pKey] = byProvince[pKey] || {
    province: u.province,
    type: typeLabel,
    universities: new Set(),
    colleges: 0,
    departments: 0,
  };
  byProvince[pKey].universities.add(u.name);
  byUni[u.id] = byUni[u.id] || {
    province: u.province,
    university: u.name,
    type: typeLabel,
    colleges: 0,
    departments: 0,
    morningNumber: 0,
    eveningNumber: 0,
    noPublished: 0,
    statedMin: 0,
  };

  const pNode = ((tree[u.province] = tree[u.province] || {})[typeLabel] = tree[u.province][typeLabel] || {});
  const uNode = (pNode[u.name] = pNode[u.name] || {
    id: u.id,
    website: u.website ?? null,
    founded: u.founded ?? null,
    colleges: {},
  });

  for (const c of u.colleges) {
    byProvince[pKey].colleges++;
    byUni[u.id].colleges++;
    const cName = c.displayName || c.name;
    const cNode = (uNode.colleges[cName] = uNode.colleges[cName] || []);
    for (const d of c.departments) {
      const sessions = d.sessions || [];
      const hasM = sessions.includes("صباحي"),
        hasE = sessions.includes("مسائي");
      const mVal = d.averageGrades ? d.averageGrades["صباحي"] : null;
      const eVal = d.averageGrades ? d.averageGrades["مسائي"] : null;
      const stated = d.statedMinimumGrade && d.statedMinimumGrade.value != null ? d.statedMinimumGrade : null;

      // الحالة المعروضة (مطابقة لمنطق lib/admissionLabel.ts)
      let status;
      if (isPriv) status = stated ? `شرط معلَن ${stated.value}%` : "الحدّ الأدنى غير منشور";
      else if (mVal != null || eVal != null)
        status = hasM && mVal != null ? "معدل تنافسي منشور" : "مسائي فقط (حدّ أدنى)";
      else status = "لا حدّ منشور في دليل " + YEAR;

      const row = [
        u.province,
        u.name,
        typeLabel,
        c.displayName || c.name,
        d.displayName || d.name,
        (d.branch || []).join(" + "),
        sessions.join(" + "),
        num(mVal),
        hasM && !isPriv ? morningBreakdown(d.cutoffs) : "",
        num(eVal),
        !isPriv && hasE && eVal != null ? "حدّ أدنى ثابت حسب نوع الكلية (نص الدليل)، وليس معدلاً تنافسياً" : "",
        status,
        stated ? stated.value : "",
        stated ? `${stated.source || ""} ${stated.sourceYear || ""}`.trim() : "",
        d.tuitionFees ? num(d.tuitionFees["صباحي"]) : "",
        d.tuitionFees ? num(d.tuitionFees["مسائي"]) : "",
        d.admissionSuspended ? "نعم" : "",
        d.branchSource || "",
        d.note || "",
        d.name,
        c.name,
        u.id,
      ];
      rows.push(row);
      cNode.push({
        القسم: d.displayName || d.name,
        الفروع: d.branch || [],
        الجلسات: sessions,
        صباحي: { المعدل: mVal ?? null, التفصيل: hasM && !isPriv ? morningBreakdown(d.cutoffs) : null },
        مسائي: { المعدل: eVal ?? null },
        الحالة: status,
        شرط_الأهلي: stated ? stated.value : null,
        الأجور: d.tuitionFees || null,
        معلّق: !!d.admissionSuspended,
      });

      byProvince[pKey].departments++;
      byUni[u.id].departments++;
      quality.departments++;
      if (isPriv) {
        quality.private++;
        if (stated) {
          quality.privateStatedMin++;
          byUni[u.id].statedMin++;
        } else quality.privateNoStatedMin++;
        if (d.tuitionFees && (d.tuitionFees["صباحي"] != null || d.tuitionFees["مسائي"] != null))
          quality.privateWithFees++;
      } else {
        quality.gov++;
        if (mVal != null) {
          quality.govMorningWithNumber++;
          byUni[u.id].morningNumber++;
        }
        if (eVal != null) {
          quality.govEveningWithNumber++;
          byUni[u.id].eveningNumber++;
        }
        if (mVal == null && eVal == null) {
          quality.govNoPublishedCutoff++;
          byUni[u.id].noPublished++;
        }
      }
      if (d.branchSource && d.branchSource !== "extracted")
        quality.branchUnknown += d.branchSource === "unknown" ? 1 : 0;
      if (d.admissionSuspended) quality.suspended++;
    }
  }
}

const head = [
  "المحافظة",
  "الجامعة",
  "النوع",
  "الكلية",
  "القسم",
  "الفروع المؤهلة",
  "الجلسات",
  "معدل الصباحي (الأدنى)",
  "تفصيل الصباحي حسب الفرع/الجنس",
  "معدل المسائي",
  "أساس المسائي",
  "الحالة المعروضة",
  "شرط الأهلي المعلَن %",
  "مصدر الشرط",
  "أجور الصباحي (دينار)",
  "أجور المسائي (دينار)",
  "القبول معلَّق",
  "مصدر الفرع",
  "ملاحظة",
  "اسم القسم الخام",
  "اسم الكلية الخام",
  "معرّف الجامعة",
];
// ترتيب: محافظة، نوع (حكومية قبل أهلية)، جامعة، كلية، قسم
rows.sort(
  (a, b) =>
    a[0].localeCompare(b[0], "ar") ||
    (a[2] === b[2] ? 0 : a[2] === "حكومية" ? -1 : 1) ||
    a[1].localeCompare(b[1], "ar") ||
    a[3].localeCompare(b[3], "ar") ||
    a[4].localeCompare(b[4], "ar")
);

fs.writeFileSync(path.join(OUT, "master-classification.csv"), csv(head, rows));
fs.writeFileSync(
  path.join(OUT, "master-classification.json"),
  JSON.stringify(
    { مصدر: "data/universities.json", سنة_الحدود: YEAR, عدد_الأقسام: rows.length, البيانات: tree },
    null,
    2
  )
);
fs.writeFileSync(
  path.join(OUT, "summary-by-province.csv"),
  csv(
    ["المحافظة", "النوع", "عدد الجامعات", "عدد الكليات", "عدد الأقسام"],
    Object.values(byProvince)
      .sort((a, b) => a.province.localeCompare(b.province, "ar") || a.type.localeCompare(b.type, "ar"))
      .map((p) => [p.province, p.type, p.universities.size, p.colleges, p.departments])
  )
);
fs.writeFileSync(
  path.join(OUT, "summary-by-university.csv"),
  csv(
    [
      "المحافظة",
      "الجامعة",
      "النوع",
      "الكليات",
      "الأقسام",
      "أقسام برقم صباحي",
      "أقسام برقم مسائي",
      "بلا حدّ منشور (حكومي)",
      "بشرط معلَن (أهلي)",
    ],
    Object.values(byUni)
      .sort(
        (a, b) =>
          a.province.localeCompare(b.province, "ar") ||
          a.type.localeCompare(b.type, "ar") ||
          a.university.localeCompare(b.university, "ar")
      )
      .map((x) => [
        x.province,
        x.university,
        x.type,
        x.colleges,
        x.departments,
        x.morningNumber,
        x.eveningNumber,
        x.noPublished,
        x.statedMin,
      ])
  )
);
fs.writeFileSync(
  path.join(OUT, "quality.json"),
  JSON.stringify(
    { ...quality, provinces: new Set(universities.map((u) => u.province)).size, universities: universities.length },
    null,
    2
  )
);
console.log(
  JSON.stringify(
    {
      rows: rows.length,
      ...quality,
      provinces: new Set(universities.map((u) => u.province)).size,
      universities: universities.length,
    },
    null,
    2
  )
);
