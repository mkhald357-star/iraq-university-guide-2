// م7: بنود جدول «الفروع المقبولة» (الفصل 3، data/raw/chapter3_branches.json) التي لا قسم لها في المنصة،
// مصنَّفةً: «معقول» (plausible: مرشَّح للمراجعة اليدوية) أو «للمراجعة» مع السبب. تشخيص فقط، لا يعدّل شيئاً.
//
// ⚠️ «معقول» ليس «نظيفاً» ولا يُضاف آلياً: جرّب التصنيف الآلي وحده فبقيت فيه أجزاء أسماء مبتورة وأسماء
// بديلة لأقسام قائمة (التنقيح اليدوي سطراً سطراً على النص الخام هو الذي أنتج إضافات م7 في
// data/raw/chapter3_additions.json بحقل addedBy). كل بند يُضاف يُقرأ أولاً بسياقه من dalel.full.txt.
//
// الرابط بين البند والجامعة هو موقع الجامعة (website) المستخرَج مع الجدول، لا موضع النص (درس §16-§22 في
// data/admission_rules.md: التجاور في النص الخام أسند كليات لجامعة جارة). والخيار المحافظ دائماً: ما لا
// يمرّ كل الفحوص أدناه لا يُضاف بل يُعرض للمراجعة.
//
// البند النظيف يحقّق كله:
//  1) كلية البند تطابق كلية واحدة في المنصة بدرجة 3 (نفس الكلمات) أو 2 (احتواء)، وبأعلى درجة وحيدة.
//  2) اسم البند كلماته كلها من مفردات أسماء المنصة المعروفة (لا كلمة معطوبة ولا مبتورة)، وله كلمتان فأكثر.
//  3) ليس ترويسة كلية/معهد ولا اسم الكلية نفسها ولا عبارة تنظيمية (فرع الدراسة، شرط، قبول…).
//  4) لا يقارب قسماً قائماً في أي كلية من الجامعة نفسها (تطابق الاسم الكامل أو تشابه الكلمات ≥ 0.6).
//  5) لا يتجاور مع بند آخر مبتور في السطر نفسه (الأسماء الطويلة تنكسر على سطرين في الجدول): البند يُعدّ
//     مكتملاً حين لا يكون مفرداً قصيراً (< 2 كلمة) ولا يبدأ بحرف عطف ولا ينتهي بحرف جرّ/عطف.
//  6) له فرع مقبول واحد على الأقل في الدليل.
//
// المخرجات: reports/admission-fix/audit/guide-missing-m7.json ، reports/admission-fix/m7-review-list.csv
// الاستخدام: node scripts/admission-fix/audit-guide-missing.js [--print]
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const { toDisplayName } = require("../displayName");
const { _internals } = require("../guideBranches");
const { guideKey, words, collegeWords, collegeLevel, deptMatches } = _internals;

const guide = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/chapter3_branches.json"), "utf8"));
const platform = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")).universities;

const siteOf = (u) => (u.website || "").replace(/^www\./, "");
const uniByWebsite = new Map();
for (const u of platform) if (u.type === "حكومية" && siteOf(u)) uniByWebsite.set(siteOf(u), u);

// مفردات المنصة المعروفة (كلمات displayName لكل أسماء الجامعات والكليات والأقسام الحالية)
const VOCAB = new Set();
const tok = (s) =>
  toDisplayName(s || "")
    .split(/[\s/\-()،]+/)
    .filter(Boolean);
for (const u of platform)
  for (const c of u.colleges) {
    tok(c.displayName ?? c.name).forEach((w) => VOCAB.add(w));
    for (const d of c.departments) tok(d.displayName ?? d.name).forEach((w) => VOCAB.add(w));
  }
const vocabKey = (w) => w.replace(/^[وبكلف](?=ال)/, "");
const knownWord = (w) => VOCAB.has(w) || VOCAB.has(vocabKey(w)) || VOCAB.has("و" + w);

const HEADER_RE = /^(كلية|الكلية|معهد|المعهد|المعلد|جامعة|الجامعة|قسم|فرع|شرط|شروط|قبول|ملاحظة|الدراسة|الدراسات)\b/;
const REGULATORY_RE = /فرع الدراسة|الدراسة الاعدادية|الدراسة اإلعدادية|اعداديات|شرط|ملاحظ|قبول|الجنس|ذكور|إناث|اناث/;
const DANGLING_END = /(^|\s)(و|في|من|على|الى|إلى|او|أو|لل|ذات|ال)$/;

const jaccard = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  let i = 0;
  for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i || 1);
};
const itemWordsOf = (s) =>
  words(s)
    .map((w) => w)
    .filter((w) => w.length >= 2);

function itemMatchesDept(item, deptName) {
  const g = { cands: [guideKey(item)], windows: [words(item)] };
  return deptMatches(deptName, g);
}

const rows = [];
const seen = new Set();
for (const g of guide) {
  const u = uniByWebsite.get((g.website || "").replace(/^www\./, ""));
  if (!u) continue;
  // كلية المنصة الأنسب لهذا الصف (أعلى درجة ≥ 2 وحيدة)
  const scored = u.colleges
    .map((c) => ({ c, level: collegeLevel(c.name, { ...g, entryWords: (g.entry || g.items).flatMap((t) => words(t)) }) }))
    .filter((x) => x.level >= 2);
  const best = scored.length ? Math.max(...scored.map((x) => x.level)) : 0;
  const top = scored.filter((x) => x.level === best);
  for (const item of g.items) {
    const key = `${u.id}|${guideKey(item)}|${g.sourceLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const allDepts = u.colleges.flatMap((c) => c.departments.map((d) => ({ c, d })));
    // مطابق لقسم قائم في أي كلية من الجامعة؟ فليس مفقوداً
    if (allDepts.some(({ d }) => itemMatchesDept(item, d.displayName ?? d.name) || itemMatchesDept(item, d.name))) continue;
    const display = toDisplayName(item).trim();
    const reasons = [];
    if (top.length !== 1) reasons.push(top.length ? "كلية البند تطابق أكثر من كلية" : "كلية البند غير موجودة في المنصة");
    const toks = display.split(/\s+/).filter(Boolean);
    if (toks.length < 2) reasons.push("بند من كلمة واحدة");
    if (HEADER_RE.test(display)) reasons.push("ترويسة/عبارة تنظيمية");
    if (REGULATORY_RE.test(display)) reasons.push("عبارة شرط/تنظيم");
    if (DANGLING_END.test(display) || /^و/.test(display)) reasons.push("بند مبتور (حرف عطف/جرّ طرفي)");
    if (/[0-9٠-٩()]/.test(display)) reasons.push("رقم أو أقواس");
    // أجزاء أسماء مبتورة: يبدأ بحرف جرّ لاصق أو ينتهي بكلمة ناقصة (قصيرة جداً) أو بصفة بلا موصوف
    if (/^(للعلوم|لل|ل[ا-ي]{2,}s)/.test(display) && !/^للبنات|^للعلوم (الصرفة|الانسانية|الإنسانية)/.test(display)) reasons.push("بند يبدأ بحرف جرّ لاصق");
    if (toks.some((w) => w.length <= 2 && !/^(في|من|مع|علم)$/.test(w))) reasons.push("كلمة قصيرة مبتورة");
    if (/(التربوي|التربي|الإسلامية|والنفسية)$/.test(display) && toks.length <= 3) reasons.push("جزء اسم محتمل");
    const unknown = toks.filter((w) => !knownWord(w));
    if (unknown.length) reasons.push(`كلمات غير معروفة: ${unknown.join(" ")}`);
    if (best && top.length === 1) {
      const colName = top[0].c.displayName ?? top[0].c.name;
      const colKeys = new Set(tok(colName).map((w) => guideKey(w)));
      const itemKeys = toks.map((w) => guideKey(w)).filter((k) => k.length >= 2);
      // كل كلمات البند من كلمات اسم الكلية (ترويسة الكلية تتكرر في الجدول): ليست قسماً مستقلاً
      if (itemKeys.length && itemKeys.every((k) => colKeys.has(k))) reasons.push("اسم الكلية نفسها");
      else if (jaccard(toks, tok(colName)) >= 0.8 || itemMatchesDept(item, colName)) reasons.push("اسم الكلية نفسها");
    }
    // تشابه كلمات مع قسم قائم في الجامعة نفسها (تسمية بديلة لقسم موجود)
    const iw = toks.map((w) => guideKey(w));
    const near = allDepts.find(({ d }) => jaccard(iw, tok(d.displayName ?? d.name).map((w) => guideKey(w))) >= 0.6);
    if (near) reasons.push(`يشبه قسماً قائماً: ${near.c.displayName ?? near.c.name} / ${near.d.displayName ?? near.d.name}`);
    if (!g.branches || !g.branches.length) reasons.push("بلا فرع مقبول");
    rows.push({
      university: u.name,
      universityId: u.id,
      college: top.length === 1 ? top[0].c.name : null,
      item,
      display,
      department: "قسم " + display.replace(/^قسم\s+/, ""),
      branches: g.branches,
      sourceLine: g.sourceLine,
      plausible: reasons.length === 0,
      reasons,
    });
  }
}

const plausible = rows.filter((r) => r.plausible);
const review = rows.filter((r) => !r.plausible);
const summary = {
  candidates: rows.length,
  plausible: plausible.length,
  review: review.length,
  byReason: review.reduce((m, r) => {
    for (const x of r.reasons) {
      const k = x.replace(/: .*$/, "");
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, {}),
  plausibleByUniversity: plausible.reduce((m, r) => ((m[r.university] = (m[r.university] || 0) + 1), m), {}),
};
fs.mkdirSync(path.join(ROOT, "reports/admission-fix/audit"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "reports/admission-fix/audit/guide-missing-m7.json"),
  JSON.stringify({ summary, plausible, review }, null, 2) + "\n",
  "utf8"
);
const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(
  path.join(ROOT, "reports/admission-fix/m7-review-list.csv"),
  "﻿" +
    ["الجامعة,الكلية,البند,الفروع,سطر المصدر,السبب"]
      .concat(review.map((r) => [r.university, r.college, r.display, r.branches.join(" + "), r.sourceLine, r.reasons.join(" ؛ ")].map(q).join(",")))
      .join("\n") +
    "\n",
  "utf8"
);
console.log(JSON.stringify(summary, null, 1));
if (process.argv.includes("--print")) plausible.forEach((r) => console.log(`  ${r.university} | ${r.college} | ${r.department} | ${r.branches.join("+")} | ${r.sourceLine}`));
