// يفكّك جدول «الفروع المقبولة» في الفصل الثالث من دليل الطالب 2025-2026
// (data/raw/dalel.full.txt) إلى data/raw/chapter3_branches.json: لكل جامعة
// حكومية، مجموعات (كلية، أقسام، فروع الدراسة الإعدادية المقبولة، سطر المصدر).
//
// شكل الجدول في النص المستخرَج: صف مرقَّم "ت | الكلية | الأقسام (مفصولة بـ/) |
// علمي / ادبي / الفنو"، وقد تتوزع أقسام الكلية الواحدة على أكثر من مجموعة لكلٍّ
// منها فروعها (مثال: آداب المستنصرية: "الانكليزية/المعلومات/.../الترجمة: علمي/ادبي"
// ثم "الاعلام/الفرنسية: علمي/ادبي/الفنون"). كل تتابع فروع يُغلق المجموعة السابقة.
//
// الجامعة تُحدَّد بنطاق موقعها (<domain>.edu.iq) في سطر عنوانها لأن اسمها في النص
// مشوَّه أحياناً ("بغداد جامع"، "الكوف جامع"). الاستخدام في
// scripts/build-universities-data.js متحفّظ: يُعتمد فقط عند مطابقة وحيدة داخل نفس
// الكلية (انظر guideBranchesFor هناك).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const lines = fs.readFileSync(path.join(ROOT, "data/raw/dalel.full.txt"), "utf8").split("\n");
// نطاق الفصل الثالث: من أول عنوان جامعة فيه حتى قسم "المعاهد التي يقدم إليها خريجو الفروع المهنية"
const CH3_FROM = lines.findIndex((l, i) => i > 300 && /أسست عام/.test(l) && !/\.{6}/.test(l));
// "إليلا" في النص الفعلي: تبديل ه/ل الموثَّق في طبقة نص PDF (scripts/extract-pdf-text.js)
const CH3_TO = lines.findIndex((l, i) => i > CH3_FROM && /المعاهد التي يقدم إلي[هل]ا/.test(l) && !/\.{6}/.test(l));
if (CH3_FROM < 0 || CH3_TO < 0) throw new Error("تعذّر تحديد نطاق الفصل الثالث في dalel.full.txt");

// بداية كل جامعة: سطر عنوانها الحامل لنطاق موقعها (لا يعتمد على universities.json -- لا دوران في خط البناء)
const starts = [];
for (let i = CH3_FROM; i < CH3_TO; i++) {
  const m = lines[i].match(/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.edu\.iq)/i);
  if (m && !/\.{6}/.test(lines[i])) starts.push({ website: m[1].toLowerCase().replace(/^www\./, ""), line: i });
}
starts.forEach((s, i) => (s.end = i + 1 < starts.length ? starts[i + 1].line : CH3_TO));

const BR = { علمي: "علمي", ادبي: "أدبي", الفنو: "فنون", الفنون: "فنون" };
const IGNORE =
  /^(ت|اسم الكلية|اقسام الكلية|فرع الدراسة|اإلعدادية|االعدادية|الدراسة|\(|\)|التقديم|التقديم للقسم|التقديم للكلية|مباشر|-+)$/;

const out = [];
for (const { website, line, end } of starts) {
  const raw = []; // {t, line}
  for (let i = line + 1; i < end; i++) {
    if (/^-- \d+ of \d+ --/.test(lines[i])) continue;
    // رقم صفحة منفرد يسبق ترويسة الجدول ("59" ثم "ت | اسم الكلية ...") ليس رقم صف
    if (/^\s*\d+\s*$/.test(lines[i]) && /^ت\t/.test(lines[i + 1] || "")) continue;
    for (const part of lines[i].split("\t")) {
      const pieces = part.split("/");
      pieces.forEach((p, j) => {
        const t = p.trim();
        if (t) raw.push({ t, line: i + 1 });
        if (j < pieces.length - 1) raw.push({ t: "/", line: i + 1 });
      });
    }
  }
  // إسقاط "(مدة الدراسة 2 سنة الى 4 سنوات)" في جداول البوليتكنك: أرقامها ليست أرقام صفوف
  const toks = [];
  for (let k = 0; k < raw.length; k++) {
    if (/مدة/.test(raw[k].t)) {
      let j = k;
      while (j < raw.length && j - k < 8 && !/سنوات/.test(raw[j].t)) j++;
      if (j < raw.length && /سنوات/.test(raw[j].t)) {
        k = j;
        continue;
      }
    }
    toks.push(raw[k]);
  }
  let pending = [];
  let pendingLine = null;
  let college = "";
  let entry = []; // كل نص الصف منذ رقمه: الكلية + الحرم/المسار + الأقسام (لمطابقة الكلية حين تتوزع على أكثر من خلية)
  for (let k = 0; k < toks.length; k++) {
    const { t, line: ln } = toks[k];
    if (BR[t]) {
      const set = new Set();
      while (k < toks.length && (BR[toks[k].t] || toks[k].t === "/")) {
        if (BR[toks[k].t]) set.add(BR[toks[k].t]);
        k++;
      }
      k--;
      if (pending.length) {
        out.push({
          website,
          college,
          entry: entry.slice(),
          items: pending,
          branches: [...set],
          sourceLine: pendingLine,
        });
      }
      pending = [];
      pendingLine = null;
      continue;
    }
    if (/^\d+$/.test(t)) {
      const next = toks[k + 1];
      if (next && !BR[next.t] && next.t !== "/" && !/^\d+$/.test(next.t)) {
        college = next.t;
        entry = [];
      }
      continue;
    }
    if (t === "/" || IGNORE.test(t)) continue;
    if (pendingLine === null) pendingLine = ln;
    pending.push(t);
    entry.push(t);
  }
}

fs.writeFileSync(path.join(ROOT, "data/raw/chapter3_branches.json"), JSON.stringify(out, null, 1) + "\n", "utf8");
console.log(
  `chapter3_branches.json: ${out.length} مجموعة من ${starts.length} جامعة (الأسطر ${CH3_FROM + 1}-${CH3_TO})`
);
