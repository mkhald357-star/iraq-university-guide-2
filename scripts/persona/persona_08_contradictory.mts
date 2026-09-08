// شخصية 08: الطالبة المتناقضة عمداً — اختبار إجهاد لأنظمة كشف التناقض
// ومؤشر مخاطر الجدّية (VRS). تُجيب "نعم" (1) على كل سؤال يظهر في أي من
// طرفي أي زوج تناقض في data/contradiction_pairs.json، لضمان إطلاق كل
// الأزواج الخمسة معاً في كل تشغيلة. باقي الأسئلة تُجاب عشوائياً.
import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import contradictionPairsData from "../data/contradiction_pairs.json" with { type: "json" };
import fs from "fs";

const CONTRADICTION_IDS = new Set<string>();
(contradictionPairsData as { a: string; b: string }[]).forEach((p) => {
  CONTRADICTION_IDS.add(p.a);
  CONTRADICTION_IDS.add(p.b);
});

function answerFn(q: { id: string; text: string; dimensions: Record<string, number> }, rng: () => number): -1 | 0 | 1 {
  if (CONTRADICTION_IDS.has(q.id)) return 1;
  const r = rng();
  if (r < 1 / 3) return -1;
  if (r < 2 / 3) return 0;
  return 1;
}

const SEED = 108;
const rng = simpleRandom(SEED);
const results = [];
for (let i = 0; i < 30; i++) {
  const filters = randomFilters(rng);
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad\\report_08_contradictory.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log("Wrote", results.length, "simulations to", outPath);

// تحقق سريع: هل كل الأزواج الخمسة أُطلقت في كل تشغيلة؟
const numPairs = (contradictionPairsData as unknown[]).length;
results.forEach((r, idx) => {
  const triggeredCount = r.vrs.triggeredContradictions.length;
  const warningsCount = r.warnings.length;
  console.log(
    `#${idx + 1}: triggered=${triggeredCount}/${numPairs} warnings=${warningsCount}/${numPairs} score=${r.vrs.score} band=${r.vrs.band}`
  );
});
