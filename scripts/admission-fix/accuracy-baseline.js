// يُولِّد reports/admission-fix/accuracy-baseline.json: أرقام الدقة المقيسة للبيانات الحالية.
// هو «معيار القبول» لمراحل PLAN-ADMISSION-ACCURACY.md: تُقارَن به أرقام كل مرحلة قبل/بعد.
// الاستخدام: node scripts/admission-fix/accuracy-baseline.js
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const AUDIT = path.join(ROOT, "reports", "admission-fix", "audit");
const run = (script) => execFileSync(process.execPath, [path.join(__dirname, script)], { cwd: ROOT, stdio: "pipe" });
const read = (f) => JSON.parse(fs.readFileSync(path.join(AUDIT, f), "utf8"));

run("audit-cutoffs.js");
run("audit-guide-branches.js");
run("audit-evening.js");

const cut = read("cutoffs-audit.json").summary;
const br = read("guide-branches-audit.json").summary;
const ev = read("evening-audit.json").summary;
const uni = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities.filter(
  (u) => u.type === "حكومية"
);

// تركيبات (قسم، فرع) حدّها للإناث/للذكور فقط، وتركيبات يختلف فيها حدّا الجنسين
let singleGenderCombos = 0;
let genderDiffCombos = 0;
for (const u of uni) {
  for (const c of u.colleges) {
    for (const d of c.departments) {
      const by = {};
      for (const x of d.cutoffs || []) {
        if (x.isQuota) continue;
        const g = (by[x.branch] = by[x.branch] || {});
        g[x.gender] = Math.min(g[x.gender] ?? Infinity, x.averagePercent);
      }
      for (const g of Object.values(by)) {
        const ks = Object.keys(g);
        if (ks.length === 1 && ks[0] !== "مختلط") singleGenderCombos++;
        if (g["ذكر"] != null && g["أنثى"] != null && g["ذكر"] !== g["أنثى"]) genderDiffCombos++;
      }
    }
  }
}

const baseline = {
  generatedFrom: "data/universities.json",
  cutoffs: {
    officialRows: cut.rows,
    ok: cut.ok,
    notAssignedToDepartment: cut.notAssigned,
    deptNotFound: cut.deptNotFound,
    mismatch: cut.mismatch,
    platformCutoffsWithoutOfficialRow: cut.platformCutoffsWithoutOfficialRow,
    departmentsWithMergedCampusValues: cut.departmentsWithMergedCampusValues,
    rawInSyncWithText: cut.rawInSyncWithText,
  },
  guideBranches: {
    governmentDepartments: br.departments,
    matchedWithGuide: br.departments - br.unmatched,
    unmatched: br.unmatched,
    platformExtraBranch: br.platformExtraBranch,
    platformMissingBranch: br.platformMissingBranch,
  },
  evening: {
    departmentsWithEvening: ev.withEvening,
    correctVsOfficialCategory: ev.correct,
    wrongVsOfficialCategory: ev.wrong,
    ambiguousCategory: ev.ambiguous,
    fabricatedPhysicalEducation56: ev.fabricatedPhysicalEducation56,
  },
  gender: { singleGenderBranchCombos: singleGenderCombos, maleFemaleDifferCombos: genderDiffCombos },
};

fs.writeFileSync(
  path.join(ROOT, "reports", "admission-fix", "accuracy-baseline.json"),
  JSON.stringify(baseline, null, 2) + "\n",
  "utf8"
);
console.log(JSON.stringify(baseline, null, 2));
