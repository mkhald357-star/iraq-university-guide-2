// تدقيق صارم: كل صف من «الحدود الدنيا للقبول المركزي» (1,222 صفاً في data/raw/hodod.full.txt)
// مقابل data/universities.json. للقراءة فقط.
//
// لكل صف: هل وصل الحد (فرع + جنس + معدل) إلى القسم/الأقسام الصحيحة؟ والاتجاه العكسي: هل لكل حد في
// المنصة صف رسمي؟ المخرجات: reports/admission-fix/audit/cutoffs-audit.json
//
// الاستخدام: node scripts/admission-fix/audit-cutoffs.js            (تقرير + ملخص)
//            node scripts/admission-fix/audit-cutoffs.js --strict   (exit 1 إن وُجد فرق حرج)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "reports", "admission-fix", "audit");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

const nk = (s) => (s || "").replace(/[أإآ]/g, "ا").replace(/ا/g, "").replace(/\s+/g, "").trim();
const stripDept = (s) => (s || "").replace(/^(قسم|فرع)\s+/, "");
const approx = (a, b) => Math.abs(a - b) < 0.006;
// نفس QUOTA_LABEL_RE في build-universities-data.js: حصص ("ابناء المحافظة") تُلحَق بالقسم الحقيقي الوحيد في الكلية
const QUOTA_RE = /ابناء|شهداء|متميز|اوائل/;

// مؤهلات الأحرم (نسخة من CAMPUS_QUALIFIERS في build-universities-data.js حتى توحيدها في م3)
const CAMPUS = new Set(
  [
    "بغداد",
    "البصرة",
    "الموصل",
    "بابل",
    "الكوفة",
    "نينوى",
    "هيت",
    "حديثة",
    "بلد",
    "القرنة",
    "الرصافة",
    "المسيب",
    "العزيزية",
    "الشرقاط",
    "الطارمية",
    "المقدادية",
    "سوق الشيوخ",
    "القائم",
    "طوزخورماتو",
    "الدواية",
    "بعقوبة",
    "جلولاء",
    "كربالء",
    "النجف",
    "كركوك",
    "الناصرية",
    "العمارة",
    "الحلة",
  ].map(nk)
);

const raw = read("data/raw/cutoffs_2025_2026.json");
const universities = read("data/universities.json").universities.filter((u) => u.type === "حكومية");
const platUni = new Map(universities.map((u) => [nk(u.name), u]));

// ── صفحة كل صف: نفس شروط قبول الصف في parse-cutoffs.js، وتأكيد أن الخام محدَّث مقابل النص ──
const pages = [];
{
  const lines = fs.readFileSync(path.join(ROOT, "data/raw/hodod.full.txt"), "utf8").split("\n");
  const B = new Set(["علمي", "ادبي", "أدبي", "فنون"]);
  const G = new Set(["مختلط", "ذكر", "انثى", "أنثى"]);
  let page = 0;
  for (const line of lines) {
    const m = line.match(/^-- (\d+) of \d+ --/);
    if (m) {
      page = +m[1];
      continue;
    }
    if (!line.includes("\t")) continue;
    const t = line
      .split("\t")
      .map((x) => x.trim())
      .filter(Boolean);
    if (t.length < 6) continue;
    const [g, b, k, a, tot] = [t[t.length - 1], t[t.length - 2], t[t.length - 3], t[t.length - 4], t[t.length - 5]];
    if (!G.has(g) || !B.has(b) || !/^\d+$/.test(k) || !/^\d+(\.\d+)?$/.test(a) || !/^\d+(\.\d+)?$/.test(tot)) continue;
    if (t.length - 5 === 0) continue;
    pages.push(page);
  }
}
const rawInSync = pages.length === raw.length;

const rows = raw.map((r, i) => ({ ...r, idx: i + 1, page: pages[i] ?? null }));
const result = [];
const stat = {
  rows: rows.length,
  ok: 0,
  okOverride: 0,
  okBranchNotAccepted: 0,
  okGenderSpecific: 0,
  deptNotFound: 0,
  mismatch: 0,
  notAssigned: 0,
  collegeNotFound: 0,
  universityNotFound: 0,
};

for (const r of rows) {
  const rec = {
    idx: r.idx,
    page: r.page,
    university: r.university,
    college: r.college,
    department: r.department,
    qualifiers: r.qualifiers,
    branch: r.branch,
    gender: r.gender,
    avg: r.averagePercent,
    status: "ok",
    detail: [],
  };
  const u = platUni.get(nk(r.university));
  if (!u) {
    rec.status = "universityNotFound";
    stat.universityNotFound++;
    result.push(rec);
    continue;
  }
  const cands = u.colleges.filter((c) => nk(c.name.split("/")[0]) === nk(r.college));
  if (!cands.length) {
    rec.status = "collegeNotFound";
    stat.collegeNotFound++;
    result.push(rec);
    continue;
  }
  // الحرم: يُفضَّل السجل بلاحقة الحرم نفسه، وإلا غير الملحَق بحرم
  const campus = (r.qualifiers || []).map(nk).find((q) => CAMPUS.has(q));
  let scoped = cands;
  if (campus) {
    const suffixed = cands.filter((c) => c.name.includes("/") && nk(c.name.split("/")[1]) === campus);
    scoped = suffixed.length
      ? suffixed
      : cands.filter((c) => !c.name.includes("/")).length
        ? cands.filter((c) => !c.name.includes("/"))
        : cands;
  }
  const isQuotaRow = !!(r.department && QUOTA_RE.test(r.department));
  if (isQuotaRow) {
    const b = r.branch === "ادبي" ? "أدبي" : r.branch;
    const g = r.gender === "انثى" ? "أنثى" : r.gender;
    const found = cands.some((c) =>
      c.departments.some((d) =>
        (d.cutoffs || []).some(
          (x) => x.isQuota && x.branch === b && x.gender === g && approx(x.averagePercent, r.averagePercent)
        )
      )
    );
    if (found) {
      stat.ok++;
      stat.okQuota = (stat.okQuota || 0) + 1;
    } else {
      rec.status = "deptNotFound";
      rec.detail.push("حصة بلا سجل isQuota");
      stat.deptNotFound++;
    }
    result.push(rec);
    continue;
  }
  const dKey = r.department ? nk(stripDept(r.department)) : null;
  const matched = [];
  for (const c of scoped)
    for (const d of c.departments) if (!dKey || nk(stripDept(d.name)) === dKey) matched.push({ c, d });
  if (!matched.length) {
    // قسم الصف قد يكون اسماً مدموجاً/مصحَّحاً (DEDUPLICATIONS) -- ابحث في كل سجلات الكلية
    const any = [];
    for (const c of cands)
      for (const d of c.departments) if (dKey && nk(stripDept(d.name)) === dKey) any.push({ c, d });
    if (any.length) matched.push(...any);
  }
  if (!matched.length) {
    rec.status = "deptNotFound";
    stat.deptNotFound++;
    result.push(rec);
    continue;
  }

  const branch = r.branch === "ادبي" ? "أدبي" : r.branch;
  const gender = r.gender === "انثى" ? "أنثى" : r.gender;
  const sameBG = (x) => x.branch === branch && x.gender === gender;
  const has = (d) => (d.cutoffs || []).some((x) => sameBG(x) && approx(x.averagePercent, r.averagePercent));

  if (r.department) {
    if (matched.some(({ d }) => has(d))) {
      stat.ok++;
      rec.status = "ok";
    } else {
      const vals = [
        ...new Set(matched.flatMap(({ d }) => (d.cutoffs || []).filter(sameBG).map((x) => x.averagePercent))),
      ];
      rec.status = "mismatch";
      rec.detail.push({ platformValues: vals });
      stat.mismatch++;
    }
    result.push(rec);
    continue;
  }
  // حد على مستوى الكلية: يجب أن يصل إلى كل قسم لا يملك حداً خاصاً بنفس الفرع/الجنس ويقبل الفرع
  const bad = [];
  let override = 0,
    notAccepted = 0,
    genderSpecific = 0,
    holders = 0;
  for (const { c, d } of matched) {
    if (has(d)) {
      holders++;
      continue;
    }
    if ((d.cutoffs || []).some(sameBG)) {
      override++;
      continue;
    }
    if (d.branch && d.branch.length && !d.branch.includes(branch)) {
      notAccepted++;
      continue;
    }
    const gs = new Set((d.cutoffs || []).map((x) => x.gender));
    if (gs.size && !gs.has("مختلط") && gender === "مختلط") {
      genderSpecific++;
      continue;
    }
    bad.push(`${c.name} » ${d.name}`);
  }
  if (bad.length) {
    rec.status = "notAssigned";
    rec.detail.push({ departments: bad });
    stat.notAssigned++;
  } else {
    rec.status = "ok";
    stat.ok++;
    if (override) stat.okOverride++;
    if (notAccepted) stat.okBranchNotAccepted++;
    if (genderSpecific) stat.okGenderSpecific++;
  }
  result.push(rec);
}

// ── الاتجاه العكسي: كل حد في المنصة له صف رسمي ──
const officialKeys = new Set();
for (const r of rows) {
  const b = r.branch === "ادبي" ? "أدبي" : r.branch;
  const g = r.gender === "انثى" ? "أنثى" : r.gender;
  const dept = r.department && QUOTA_RE.test(r.department) ? "" : nk(stripDept(r.department || ""));
  officialKeys.add([nk(r.university), nk(r.college), dept, b, g, r.averagePercent].join("|"));
}
const unsourced = [];
let platformCutoffs = 0;
for (const u of universities)
  for (const c of u.colleges)
    for (const d of c.departments)
      for (const x of d.cutoffs || []) {
        platformCutoffs++;
        const base = nk(c.name.split("/")[0]);
        const kDept = [nk(u.name), base, nk(stripDept(d.name)), x.branch, x.gender, x.averagePercent].join("|");
        const kColl = [nk(u.name), base, "", x.branch, x.gender, x.averagePercent].join("|");
        if (!officialKeys.has(kDept) && !officialKeys.has(kColl)) {
          unsourced.push({
            university: u.name,
            college: c.name,
            department: d.name,
            branch: x.branch,
            gender: x.gender,
            averagePercent: x.averagePercent,
          });
        }
      }

// ── دمج الأحرم: قسم يحمل قيمتين مختلفتين لنفس (فرع، جنس) غير حصة ──
// (في بيانات صحيحة لا يحدث إلا إن كان للدليل حدّان لقسم واحد بحسب الحرم وهما مدموجان في سجل واحد)
const multiValue = [];
for (const u of universities)
  for (const c of u.colleges)
    for (const d of c.departments) {
      const m = new Map();
      for (const x of d.cutoffs || []) {
        if (x.isQuota) continue;
        const k = `${x.branch}|${x.gender}`;
        (m.get(k) || m.set(k, new Set()).get(k)).add(x.averagePercent);
      }
      const multi = [...m.entries()]
        .filter(([, v]) => v.size > 1)
        .map(([k, v]) => ({ key: k, values: [...v].sort((a, b) => b - a) }));
      if (multi.length) multiValue.push({ university: u.name, college: c.name, department: d.name, multi });
    }

const summary = {
  ...stat,
  rawInSyncWithText: rawInSync,
  platformCutoffs,
  platformCutoffsWithoutOfficialRow: unsourced.length,
  departmentsWithMergedCampusValues: multiValue.length,
};
const failures = result.filter((r) => r.status !== "ok");
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, "cutoffs-audit.json"),
  JSON.stringify({ summary, failures, unsourced, multiValue }, null, 2) + "\n",
  "utf8"
);
console.log(JSON.stringify(summary, null, 1));
if (failures.length) {
  console.log(`\nصفوف بفرق (${failures.length}):`);
  failures
    .slice(0, 25)
    .forEach((f) =>
      console.log(
        `  #${f.idx} ص${f.page} [${f.status}] ${f.university} / ${f.college} / ${f.department || "(كلية)"} | ${f.branch} ${f.gender} ${f.avg}`
      )
    );
}
if (multiValue.length) {
  console.log(`
أقسام بقيمتين لنفس الفرع/الجنس (أحرم مدموجة) (${multiValue.length}):`);
  multiValue
    .slice(0, 15)
    .forEach((m) =>
      console.log(
        `  ${m.university} / ${m.college} / ${m.department}: ${m.multi.map((x) => x.key + " → " + x.values.join(" / ")).join(" ; ")}`
      )
    );
}
if (process.argv.includes("--strict") && (failures.length || unsourced.length || multiValue.length || !rawInSync))
  process.exit(1);
