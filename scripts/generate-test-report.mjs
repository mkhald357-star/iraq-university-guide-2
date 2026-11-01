// يولّد reports/test-report.md من تشغيل حقيقي لمجموعة الاختبارات (vitest --reporter=json):
//   node scripts/generate-test-report.mjs            ← يشغّل الاختبارات ويكتب التقرير
//   node scripts/generate-test-report.mjs run.json   ← يبني التقرير من ملف نتائج جاهز
// لا أرقام مكتوبة يدوياً: كل عدّاد وكل وصف مأخوذ من نتائج التشغيل (أسماء describe/it).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports", "test-report.md");

let jsonPath = process.argv[2];
if (!jsonPath) {
  jsonPath = path.join(os.tmpdir(), `vitest-report-${Date.now()}.json`);
  const r = spawnSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${jsonPath}`], {
    cwd: ROOT,
    shell: true,
    stdio: "ignore",
  });
  if (!fs.existsSync(jsonPath)) {
    console.error("تعذّر تشغيل الاختبارات، رمز الخروج:", r.status);
    process.exit(1);
  }
}
const run = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

// تصنيف الملفات بحسب المجال الذي تحرسه
const AREAS = [
  [
    "المحرك والتوصية",
    [
      "riasec",
      "recommendationEngine.characterization",
      "recommendationEngine.contextTieBreak",
      "quizEngine",
      "subjectAffinity",
      "contextAxisMap",
      "familyRecommendation",
      "adaptiveRound",
      "itemFormats",
      "eval/shortForm",
      "triState",
      "singleSourceOfTruth",
      "reportQuizParity",
      "decider",
      "compareMajors",
    ],
  ],
  ["كشف الجدّية", ["validity"]],
  [
    "القبول والأهلية والرغبات",
    [
      "eligibility",
      "admissionFeasibility",
      "admissionLabel",
      "emptyDiagnosis",
      "wishlistPlanner",
      "wishlistMigration",
      "costCompare",
    ],
  ],
  [
    "بيانات القبول ودقتها",
    [
      "admissionTruth",
      "accuracyGoldenCases",
      "branchPlacement",
      "branchCoverage",
      "guideBranches",
      "hierarchyData",
      "cutoffsYearCoverage",
      "channelNoticeCoverage",
      "genderNote",
    ],
  ],
  [
    "مطابقة الأقسام والأسماء",
    [
      "majorMatcher",
      "prefixGuard",
      "crossMajorContamination",
      "departmentNames",
      "departmentNormalizer",
      "displayNameResidual",
      "scripts/displayName",
      "matchPrecision",
    ],
  ],
  ["المدخلات والواجهة", ["gradeInput", "quizNoAutoAdvance", "emptyStateTone"]],
  ["الأمن والخصوصية", ["securityScripts", "safeStorage", "jsonLd", "siteMeta", "reportIssue", "pilotCode"]],
  ["المساعد الذكي", ["assistant"]],
];

const files = run.testResults.map((f) => {
  const rel = f.name.replace(/\\/g, "/").replace(/^.*\/(lib|scripts)\//, (_, d) => (d === "scripts" ? "scripts/" : ""));
  const key = rel.replace(/\.test\.(ts|tsx|js)$/, "");
  const tests = f.assertionResults;
  const groups = [...new Set(tests.map((t) => t.ancestorTitles[0]).filter(Boolean))];
  return {
    path: (f.name.replace(/\\/g, "/").includes("/scripts/") ? "scripts/" : "lib/") + rel.replace(/^scripts\//, ""),
    key,
    n: tests.length,
    passed: tests.filter((t) => t.status === "passed").length,
    groups,
    titles: tests.map((t) => t.title),
  };
});
const areaOf = (f) => AREAS.find(([, keys]) => keys.includes(f.key))?.[0] ?? "أخرى";

const total = run.numTotalTests;
const passed = run.numPassedTests;
const failed = run.numFailedTests;
const today = new Date().toISOString().slice(0, 10);

const L = [];
L.push("# تقرير الاختبارات الآلية");
L.push("");
L.push(
  `> مُولَّد آلياً من تشغيل حقيقي لـ\`vitest\` بتاريخ ${today}: \`node scripts/generate-test-report.mjs\`. لا رقم هنا مكتوب يدوياً.`
);
L.push("");
L.push("## الخلاصة");
L.push("");
L.push("| | |");
L.push("|---|---|");
L.push(`| ملفات الاختبار | ${files.length} |`);
L.push(`| مجموعات الاختبار (describe) | ${run.numTotalTestSuites} |`);
L.push(`| الاختبارات | ${total} |`);
L.push(`| الناجحة | ${passed} |`);
L.push(`| الفاشلة | ${failed} |`);
L.push("");
L.push("## التغطية بحسب المجال");
L.push("");
L.push("| المجال | الملفات | الاختبارات |");
L.push("|---|---|---|");
for (const [name] of AREAS.concat([["أخرى", []]])) {
  const fs_ = files.filter((f) => areaOf(f) === name);
  if (!fs_.length) continue;
  L.push(`| ${name} | ${fs_.length} | ${fs_.reduce((s, f) => s + f.n, 0)} |`);
}
L.push("");
L.push("## التفصيل بحسب الملف");
L.push("");
L.push("لكل ملف: ما يحرسه (عناوين مجموعاته كما كتبها الاختبار نفسه).");
for (const [name] of AREAS.concat([["أخرى", []]])) {
  const fs_ = files.filter((f) => areaOf(f) === name).sort((a, b) => b.n - a.n);
  if (!fs_.length) continue;
  L.push("");
  L.push(`### ${name}`);
  L.push("");
  L.push("| الملف | اختبارات | ما يحرسه |");
  L.push("|---|---|---|");
  for (const f of fs_) {
    const what = (f.groups.length ? f.groups : f.titles.slice(0, 2)).slice(0, 3).join(" ؛ ").replace(/\|/g, "/");
    L.push(`| \`${f.path}\` | ${f.passed}/${f.n} | ${what} |`);
  }
}
L.push("");
L.push("## ما لا يغطيه هذا التقرير");
L.push("");
L.push(
  "- **فحوص المتصفح الحقيقي** (Playwright) والوصول (axe) والمراجعة المستقلة قبل النشر: تُجرى بأدواتها قبل كل إصدار."
);
L.push(
  "- **تدقيق بيانات القبول** صفاً بصف: سكربتات `scripts/admission-fix/audit-*.js` ونتائجها في `reports/admission-fix/audit/`، وليست ضمن `vitest`."
);
L.push("- **المحاكاة الإحصائية** للتوصية: أدوات `scripts/eval/` (للمعايرة الداخلية، لا حكم صحّة).");
L.push("");
fs.writeFileSync(OUT, L.join("\n"), "utf8");
console.log(
  `كُتب ${path.relative(ROOT, OUT)}: ${files.length} ملفاً، ${total} اختباراً (${passed} ناجحاً، ${failed} فاشلاً)`
);
