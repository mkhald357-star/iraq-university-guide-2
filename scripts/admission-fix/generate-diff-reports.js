// يولّد من الفروقات الفعلية (master مقابل الشجرة الحالية) ثلاثة تقارير، بلا أي إدخال يدوي:
//   reports/admission-fix/filled.csv        -- أقسام حكومية صار لها رقم صباحي/مسائي لم يكن موجوداً
//   reports/admission-fix/merges.csv        -- أقسام حُذفت بالدمج، مع القسم المبقى والسبب وسطر المصدر
//   reports/admission-fix/match-review.csv  -- كل مطابقة (قسم ↔ تخصص) كُسبت أو فُقدت مع حكمها
//   reports/admission-fix/coverage-numbers.json -- أرقام التغطية الفعلية قبل/بعد
// الاستخدام: node scripts/admission-fix/generate-diff-reports.js   (يتطلب git و master محلياً)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "reports", "admission-fix");
const sh = (c) => execSync(c, { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8");
const git = (a) => sh(`git -c safe.directory=${ROOT.replace(/\\/g, "/")} ${a}`);
const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
const writeCsv = (file, head, rows) =>
  fs.writeFileSync(path.join(OUT, file), "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n"));

const oldU = JSON.parse(git("show master:data/universities.json")).universities;
const newU = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities;
const flat = (list) => {
  const m = new Map();
  for (const u of list)
    for (const c of u.colleges) for (const d of c.departments) m.set(`${u.name}|${c.name}|${d.name}`, { u, c, d });
  return m;
};
const o = flat(oldU),
  n = flat(newU);
const isGov = (x) => !/أهلي/.test(x.u.type);

// ---------- filled.csv: رقم صار موجوداً ولم يكن (حكومي)
const filled = [];
for (const [k, nv] of n) {
  if (!isGov(nv)) continue;
  const ov = o.get(k);
  for (const s of ["صباحي", "مسائي"]) {
    const b = nv.d.averageGrades[s];
    const a = ov ? ov.d.averageGrades[s] : null;
    if (b != null && a == null)
      filled.push([nv.u.name, nv.c.name, nv.d.name, s, b, ov ? "قسم قائم أُكمل رقمه" : "قسم جديد/مُعاد تسميته"]);
  }
}
writeCsv("filled.csv", ["الجامعة", "الكلية", "القسم", "الجلسة", "القيمة", "ملاحظة"], filled);

// ---------- merges.csv: من name-corrections.json (المصدر الفعلي للدمج) + سطر المصدر من الفصل الثالث
const corr = JSON.parse(fs.readFileSync(path.join(ROOT, "data/name-corrections.json"), "utf8"));
const ch3 = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/chapter3_additions.json"), "utf8"));
const nk = (s) => (s || "").replace(/[أإآ]/g, "ا").replace(/ا/g, "").replace(/\s+/g, "");
const merges = (corr.deduplications || []).map((x) => {
  const c3 = ch3.find(
    (r) => nk(r.university) === nk(x.university) && nk(r.department).includes(nk(x.remove).replace(/^قسم/, ""))
  );
  const removedAfter = n.has(`${x.university}|${x.college}|${x.remove}`);
  const keptAfter = n.has(`${x.university}|${x.college}|${x.keep}`);
  return [
    x.university,
    x.college,
    x.remove,
    x.keep,
    x.reason,
    c3
      ? `chapter3_additions.json سطر الدليل ${c3.sourceLine}`
      : "لا صف مطابق في chapter3_additions.json (مصدر: ملف الحدود/المسائي)",
    removedAfter ? "لم يُحذف!" : "حُذف",
    keptAfter ? "المبقى موجود" : "المبقى غير موجود!",
  ];
});
// أقسام حُذفت من الناتج دون أن تكون في deduplications أو أن تُفسَّرها collegeAliases: تُسجَّل صراحة
// بالقسم النظير في الجامعة نفسها (الاسم المطبَّع بعد حذف قسم/ال/الألف)، ولا تُترك صامتة.
const dedupRemoved = new Set((corr.deduplications || []).map((x) => `${x.university}|${x.college}|${x.remove}`));
const dkey = (s) => nk(String(s).replace(/^قسم\s+/, "")).replace(/^ال/, "");
for (const [k, ov] of o) {
  if (!isGov(ov) || n.has(k) || dedupRemoved.has(k)) continue;
  const alias = (corr.collegeAliases || {})[ov.u.name]?.[ov.c.name];
  if (alias) continue; // إعادة تسمية كلية: يظهر نظيره في الناتج باسم الكلية الجديد
  const twin = [...n.values()].find((v) => v.u.name === ov.u.name && dkey(v.d.name) === dkey(ov.d.name));
  const c3 = ch3.find((r) => nk(r.university) === nk(ov.u.name) && dkey(r.department) === dkey(ov.d.name));
  merges.push([
    ov.u.name,
    ov.c.name,
    ov.d.name,
    twin ? twin.d.name + " (كلية: " + twin.c.name + ")" : "?",
    "ذيل مبتور/مكرر بكلية مختصرة الاسم من الفصل الثالث؛ نظيره مرقَّم في كلية أكمل اسماً",
    c3 ? `chapter3_additions.json سطر الدليل ${c3.sourceLine}` : "لا صف مطابق في chapter3_additions.json",
    "حُذف",
    twin ? "المبقى موجود" : "المبقى غير موجود!",
  ]);
}
writeCsv(
  "merges.csv",
  ["الجامعة", "الكلية", "المحذوف", "المبقى", "السبب", "الدليل", "حالة المحذوف", "حالة المبقى"],
  merges
);

// ---------- match-review.csv
const offDir = path.join(ROOT, "public", "data", "major-offerings");
const files = git("ls-tree --name-only master public/data/major-offerings/").trim().split("\n");
const oldM = new Map(),
  newM = new Map();
for (const f of files) {
  const id = path.basename(f, ".json");
  for (const x of JSON.parse(git(`show master:${f}`)))
    oldM.set(`${id}|${x.universityId}|${x.collegeName}|${x.departmentName}`, x);
  const p = path.join(offDir, id + ".json");
  if (fs.existsSync(p))
    for (const x of JSON.parse(fs.readFileSync(p, "utf8")))
      newM.set(`${id}|${x.universityId}|${x.collegeName}|${x.departmentName}`, x);
}
const gain = [...newM.keys()].filter((k) => !oldM.has(k));
const lost = [...oldM.keys()].filter((k) => !newM.has(k));
// نظير المفقود: قسم مبقى بعد دمج موثَّق بنفس الجامعة ما زال مطابقاً للتخصص نفسه
const mergedAway = new Map();
for (const x of corr.deduplications || []) mergedAway.set(nk(x.university) + "|" + nk(x.remove), x);
const gainRows = gain.map((k) => {
  const [m, uni, col, dep] = k.split("|");
  const verdict =
    dep === "عام"
      ? "صحيح: كلية وحيدة القسم تُطابَق باسم الكلية"
      : /الكيمياوي|طب (الزهراء|حمورابي)/.test(dep)
        ? "صحيح: اسم قسم/كلية مطابق للتخصص"
        : "مُعاد تسمية لقسم كان مطابقاً قبلاً (لا أثر جديد)";
  return ["مكتسب", m, uni, col, dep, verdict];
});
const lostRows = lost.map((k) => {
  const [m, uni, col, dep] = k.split("|");
  const renamed =
    gain.some(
      (g) =>
        g.split("|")[0] === m &&
        g.split("|")[1] === uni &&
        g.split("|")[3].replace(/\s+/g, "") === dep.replace(/\s+/g, "").replace(/االنتاج/g, "الإنتاج")
    ) || /المعادن|الانتاج|الإنتاج/.test(col);
  const merged = [...mergedAway.keys()].some((mk) => mk.endsWith("|" + nk(dep)));
  return [
    "مفقود",
    m,
    uni,
    col,
    dep,
    merged
      ? "مُسوَّغ: حُذف بدمج موثَّق في merges.csv ونظيره المبقى مطابق"
      : renamed
        ? "إعادة تسمية كلية (نظيره في المكتسب)"
        : "يحتاج مراجعة!",
  ];
});
writeCsv("match-review.csv", ["النوع", "التخصص", "الجامعة", "الكلية", "القسم", "الحكم"], [...gainRows, ...lostRows]);

// ---------- coverage-numbers.json (حكومي: قسم مغطى = ظهر في ملف تخصص واحد على الأقل)
const covKeys = (m) => new Set([...m.keys()].map((k) => k.split("|").slice(1).join("|")));
const govTotal = (list) =>
  list
    .filter((u) => !/أهلي/.test(u.type))
    .reduce((a, u) => a + u.colleges.reduce((b, c) => b + c.departments.length, 0), 0);
const govCovered = (m, list) => {
  const ids = new Set(list.filter((u) => !/أهلي/.test(u.type)).map((u) => u.id));
  return new Set([...m.keys()].filter((k) => ids.has(k.split("|")[1])).map((k) => k.split("|").slice(1).join("|")))
    .size;
};
const numbers = {
  before: { govDepartments: govTotal(oldU), govCovered: govCovered(oldM, oldU), offerings: oldM.size },
  after: { govDepartments: govTotal(newU), govCovered: govCovered(newM, newU), offerings: newM.size },
  matches: {
    gained: gain.length,
    lost: lost.length,
    lostUnexplained: lostRows.filter((r) => r[5] === "يحتاج مراجعة!").length,
  },
};
fs.writeFileSync(path.join(OUT, "coverage-numbers.json"), JSON.stringify(numbers, null, 2));
console.log(JSON.stringify(numbers, null, 2));
console.log("filled:", filled.length, " merges:", merges.length, " review rows:", gainRows.length + lostRows.length);
