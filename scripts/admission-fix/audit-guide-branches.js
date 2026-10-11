// تدقيق: فروع كل قسم حكومي في المنصة مقابل جدول «الفروع المقبولة» في الفصل 3 من الدليل.
// للقراءة فقط. المخرجات: reports/admission-fix/audit/guide-branches-audit.json
// الاستخدام: node scripts/admission-fix/audit-guide-branches.js [--strict]
const fs = require("fs");
const path = require("path");
const { createGuideLookup } = require("../guideBranches");

const ROOT = path.join(__dirname, "..", "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const universities = read("data/universities.json").universities.filter((u) => u.type === "حكومية");
const lookup = createGuideLookup(read("data/raw/chapter3_branches.json"));

const stat = { departments: 0, unmatched: 0, equal: 0, platformMissingBranch: 0, platformExtraBranch: 0, different: 0 };
const mismatches = [];
const unmatched = [];
for (const u of universities) {
  for (const c of u.colleges) {
    for (const d of c.departments) {
      stat.departments++;
      const guide = lookup(u, c.name, d.name);
      if (!guide) {
        stat.unmatched++;
        unmatched.push({ university: u.name, college: c.name, department: d.name, branches: [...d.branch].sort() });
        continue;
      }
      const platform = new Set(d.branch);
      const missing = [...guide].filter((b) => !platform.has(b));
      const extra = [...platform].filter((b) => !guide.has(b));
      if (!missing.length && !extra.length) {
        stat.equal++;
        continue;
      }
      const kind = !extra.length ? "platformMissingBranch" : !missing.length ? "platformExtraBranch" : "different";
      stat[kind]++;
      mismatches.push({
        kind,
        university: u.name,
        college: c.name,
        department: d.name,
        platform: [...platform].sort(),
        guide: [...guide].sort(),
        missing,
        extra,
      });
    }
  }
}

const out = path.join(ROOT, "reports", "admission-fix", "audit");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, "guide-branches-audit.json"),
  JSON.stringify({ summary: stat, mismatches, unmatched }, null, 2) + "\n",
  "utf8"
);
console.log(JSON.stringify(stat, null, 1));
mismatches.forEach((m) =>
  console.log(
    `  [${m.kind}] ${m.university} / ${m.college} / ${m.department} | منصة ${m.platform.join("+")} | دليل ${m.guide.join("+")}`
  )
);
if (process.argv.includes("--strict") && mismatches.length) process.exit(1);
