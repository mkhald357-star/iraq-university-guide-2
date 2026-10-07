const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const uni = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities;
const coverDir = path.join(ROOT, "public/data/major-offerings");
const covered = new Set();
if (fs.existsSync(coverDir)) {
  for (const f of fs.readdirSync(coverDir)) {
    for (const o of JSON.parse(fs.readFileSync(path.join(coverDir, f), "utf8"))) {
      covered.add(o.universityId + "|" + o.collegeName + "|" + o.departmentName);
    }
  }
}

let govDirect = 0;
let govDirectWithEvening = 0;
let govDirectNoGrades = 0;
let govUncovered = 0;
const uncoveredNames = new Set();

for (const u of uni) {
  if (/أهلي/.test(u.type)) continue;
  for (const c of u.colleges) {
    for (const d of c.departments) {
      const isDirect = !!d.isDirectAdmission;
      const morningVal = d.averageGrades ? d.averageGrades["صباحي"] : null;
      const eveningVal = d.averageGrades ? d.averageGrades["مسائي"] : null;
      if (isDirect) {
        govDirect++;
        if (eveningVal != null) govDirectWithEvening++;
        if (morningVal == null && eveningVal == null) govDirectNoGrades++;
      }
      const k = u.id + "|" + c.name + "|" + d.name;
      if (!covered.has(k)) {
        govUncovered++;
        uncoveredNames.add(d.name);
      }
    }
  }
}

const baseline = {
  timestamp: "2026-10-08T02:00:00Z",
  govDirect,
  govDirectWithEvening,
  govDirectNoGrades,
  govUncovered,
  distinctUncoveredDeptNames: uncoveredNames.size,
  inventorySummary: JSON.parse(
    fs.readFileSync(path.join(ROOT, "reports/admission-fix/inventory-summary.json"), "utf8")
  ),
};

fs.writeFileSync(path.join(ROOT, "reports/admission-fix/baseline.json"), JSON.stringify(baseline, null, 2), "utf8");
console.log(JSON.stringify(baseline, null, 2));
