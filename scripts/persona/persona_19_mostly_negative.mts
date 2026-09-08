// شخصية 19: "الطالبة الرافضة غالباً" — تجيب "لا" (-1) على أغلب الأسئلة
// (~75-85% من كل الأسئلة) باستثناء الأسئلة التي بُعدها المسيطر هو C
// تحديداً (عمل منظم/دقيق/إجرائي)، والتي تجيب عليها بقوة "نعم" (1).
// اهتمام ضيق وحقيقي واحد + انعزال/سلبية عن كل شيء آخر — نمط تحيّز استجابة
// متطرف معاكس لتحيّز "الموافقة الدائمة" (acquiescence).
import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";

function dominantDimension(dims: Record<string, number>): string | null {
  const entries = Object.entries(dims ?? {});
  if (entries.length === 0) return null;
  let best: string | null = null;
  let bestVal = -Infinity;
  for (const [k, v] of entries) {
    if (v > bestVal) {
      bestVal = v;
      best = k;
    }
  }
  return best;
}

function answerFn(q: { id: string; text: string; dimensions: Record<string, number> }, rng: () => number): -1 | 0 | 1 {
  const dom = dominantDimension(q.dimensions);
  if (dom === "C") {
    // اهتمامها الضيق الحقيقي الوحيد: عمل منظم/دقيق/إجرائي
    return 1;
  }
  // رافضة غالباً لكل ما عدا ذلك، مع القليل من التذبذب الواقعي حتى لا تكون
  // إجاباتها آلية بشكل مثالي 100%
  const r = rng();
  if (r < 0.9) return -1;
  if (r < 0.97) return 0;
  return 1;
}

const rng = simpleRandom(119);
const results = [];
for (let i = 0; i < 30; i++) {
  const filters = randomFilters(rng, { branch: rng() < 0.5 ? "علمي" : "أدبي", grade: Math.round(60 + rng() * 30) });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad\\report_19_mostly_negative.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log("wrote", results.length, "simulations to", outPath);
