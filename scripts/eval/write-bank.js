// يكتب البنك المعتمد إلى ملفات المنتج من نتيجة الاختيار (select-short-form.mts):
//   data/questions.json          ← البنود الأساسية (مرتّبة بتناوب الأبعاد)
//   data/reserve_questions.json  ← بقية البنك المرشَّح (بنك الاحتياط، بلا حد للعدد)
//   data/contradiction_pairs.json ← الأزواج المقترحة التي يوجد طرفاها في البنكين
// data/tiebreaker_questions.json لا يُمَس (تستخدمه /decider كما هو)؛ أي بند
// مُعاد صياغته يحمل معرّفاً موجوداً هناك يُعاد تسميته r_<id> لمنع التصادم.
//
// الاستخدام: node scripts/eval/write-bank.js <selection.json> <candidate-pool.json> <pairs.json>
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const [selPath, poolPath, pairsPath] = process.argv.slice(2);
if (!selPath || !poolPath || !pairsPath) {
  console.error("الاستخدام: node scripts/eval/write-bank.js <selection.json> <candidate-pool.json> <pairs.json>");
  process.exit(1);
}
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(ROOT, p), "utf8"));
const selection = read(selPath);
const pool = read(poolPath);
const proposal = read(pairsPath);
const tiebreakerIds = new Set(read("data/tiebreaker_questions.json").map((q) => q.id));

const renamed = {};
const finalId = (id) => {
  if (!tiebreakerIds.has(id)) return id;
  renamed[id] = `r_${id}`;
  return renamed[id];
};
const clean = (q) => {
  const out = { id: finalId(q.id), text: q.text, dimensions: q.dimensions };
  if (q.answerLabels) out.answerLabels = q.answerLabels;
  return out;
};

const byId = new Map(pool.map((q) => [q.id, q]));
const primary = (q) =>
  Object.entries(q.dimensions).reduce((best, [d, w]) => (Math.abs(w) > Math.abs(best[1]) ? [d, w] : best), ["", 0])[0];

// تناوب الأبعاد: لا يتتالى بندان من نفس البُعد الأساسي قدر الإمكان -- يقلّل
// تثبيت نمط الإجابة وإدراك الطالب "المكافئ الاجتماعي" لكتلة أسئلة متشابهة.
const buckets = {};
selection.selected.forEach((id) => {
  const q = byId.get(id);
  (buckets[primary(q)] = buckets[primary(q)] || []).push(q);
});
const order = [];
const dims = ["R", "I", "A", "S", "E", "C"];
while (order.length < selection.selected.length) {
  for (const d of dims) if (buckets[d] && buckets[d].length) order.push(buckets[d].shift());
}

const core = order.map(clean);
const coreIds = new Set(selection.selected);
const reserve = pool.filter((q) => !coreIds.has(q.id)).map(clean);
const known = new Set([...core, ...reserve].map((q) => q.id));
const pairs = proposal.pairs
  .map((p) => ({ a: renamed[p.a] ?? p.a, b: renamed[p.b] ?? p.b, message: p.message }))
  .filter((p) => known.has(p.a) && known.has(p.b));

fs.writeFileSync(path.join(ROOT, "data/questions.json"), JSON.stringify(core, null, 2) + "\n");
fs.writeFileSync(path.join(ROOT, "data/reserve_questions.json"), JSON.stringify(reserve, null, 2) + "\n");
fs.writeFileSync(path.join(ROOT, "data/contradiction_pairs.json"), JSON.stringify(pairs, null, 2) + "\n");
console.log(
  `أساسية ${core.length} | احتياط ${reserve.length} | أزواج تناقض ${pairs.length} | إعادة تسمية: ${JSON.stringify(renamed)}`
);
console.log(
  `أزواج داخل الأساسية: ${pairs.filter((p) => core.some((q) => q.id === p.a) && core.some((q) => q.id === p.b)).length}`
);
