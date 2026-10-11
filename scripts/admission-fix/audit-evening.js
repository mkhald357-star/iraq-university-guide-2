// تدقيق: بيانات المسائي الحكومي في data/universities.json مقابل data/evening-rules.json.
// للقراءة فقط. المخرجات: reports/admission-fix/audit/evening-audit.json
// الاستخدام: node scripts/admission-fix/audit-evening.js [--strict]
//
// فحوص:
//  1. كل قسم بجلسة مسائية يحمل eveningByBranch وevening (سنة، صف قاعدة، basis، سقف أجور).
//  2. كل قيمة حد ضمن قيم جدول القواعد، وتُسند فقط لفروع يقبلها القسم، ولا 56 مختلَقة.
//  3. averageGrades.مسائي = أدنى قيمة غير فارغة في eveningByBranch.
//  4. لا حقول مسائي في قسم بلا جلسة مسائية.
//  5. توزيع الأساس (basis) ومراجعة غير المباشر: احتياط دليل 2025-2026 والاستدلالات.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, "data/evening-rules.json"), "utf8"));
const universities = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities.filter(
  (u) => u.type === "حكومية"
);

const allowed = new Set();
for (const y of Object.values(rules.years)) {
  for (const r of y.floors) {
    for (const v of [...Object.values(r.floors || {}), r.floor, r.floorMale, r.floorFemale]) {
      if (typeof v === "number") allowed.add(v);
    }
  }
}
const ruleIds = new Set(Object.values(rules.years).flatMap((y) => y.floors.map((r) => r.id)));

const stat = {
  departments: 0,
  withEvening: 0,
  missingEveningData: 0,
  valueOutsideRules: 0,
  valueOnUnacceptedBranch: 0,
  minMismatch: 0,
  unknownRule: 0,
  fabricated56: 0,
  eveningFieldsWithoutSession: 0,
  noFeeCap: 0,
};
const byBasis = {};
const byYear = {};
const violations = [];
const review = [];
const bad = (kind, u, c, d, extra) =>
  violations.push({ kind, university: u.name, college: c.name, department: d.name, ...extra });

for (const u of universities) {
  for (const c of u.colleges) {
    for (const d of c.departments) {
      stat.departments++;
      const hasSession = d.sessions.includes("مسائي");
      if (!hasSession) {
        if (d.eveningByBranch || d.evening) {
          stat.eveningFieldsWithoutSession++;
          bad("eveningFieldsWithoutSession", u, c, d);
        }
        continue;
      }
      stat.withEvening++;
      if (!d.eveningByBranch || !d.evening) {
        stat.missingEveningData++;
        bad("missingEveningData", u, c, d);
        continue;
      }
      const e = d.evening;
      byBasis[e.basis] = (byBasis[e.basis] || 0) + 1;
      byYear[e.year] = (byYear[e.year] || 0) + 1;
      if (!ruleIds.has(e.ruleId)) {
        stat.unknownRule++;
        bad("unknownRule", u, c, d, { ruleId: e.ruleId });
      }
      if (!(e.feeCap > 0)) {
        stat.noFeeCap++;
        bad("noFeeCap", u, c, d);
      }
      const vals = [];
      for (const [b, v] of Object.entries(d.eveningByBranch)) {
        if (v == null) continue;
        vals.push(v);
        if (v === 56) {
          stat.fabricated56++;
          bad("fabricated56", u, c, d);
        }
        if (!allowed.has(v)) {
          stat.valueOutsideRules++;
          bad("valueOutsideRules", u, c, d, { branch: b, value: v });
        }
        if (d.branch.length && !d.branch.includes(b)) {
          stat.valueOnUnacceptedBranch++;
          bad("valueOnUnacceptedBranch", u, c, d, { branch: b });
        }
      }
      const min = vals.length ? Math.min(...vals) : null;
      if (min !== d.averageGrades["مسائي"]) {
        stat.minMismatch++;
        bad("minMismatch", u, c, d, { expected: min, actual: d.averageGrades["مسائي"] });
      }
      if (e.basis !== "table")
        review.push({
          university: u.name,
          college: c.name,
          department: d.name,
          basis: e.basis,
          year: e.year,
          ruleId: e.ruleId,
          values: d.eveningByBranch,
        });
    }
  }
}

const outDir = path.join(ROOT, "reports", "admission-fix", "audit");
fs.mkdirSync(outDir, { recursive: true });
const summary = { ...stat, byBasis, byYear, currentYear: rules._meta.currentYear };
fs.writeFileSync(
  path.join(outDir, "evening-audit.json"),
  JSON.stringify({ summary, violations, review }, null, 2) + "\n",
  "utf8"
);
console.log(JSON.stringify(summary, null, 1));
const grp = {};
review.forEach((r) => {
  const k = `${r.basis} | ${r.year} | ${r.ruleId} | ${r.college.split("/")[0]}`;
  grp[k] = (grp[k] || 0) + 1;
});
console.log("\nأقسام لا تعتمد على صف مباشر من جدول السنة الحالية:");
Object.entries(grp)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([k, n]) => console.log(String(n).padStart(4), k));
if (violations.length) {
  console.log(`\nمخالفات (${violations.length}):`);
  violations.slice(0, 15).forEach((v) => console.log("  ", JSON.stringify(v)));
}
if (process.argv.includes("--strict") && violations.length) process.exit(1);
