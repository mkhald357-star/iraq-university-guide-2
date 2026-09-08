// عميل محاكاة رقم 17: "الطالبة الفنون بلا وجهة واضحة"
// شخصية طالبة في فرع الفنون، لكنها ليست بالضرورة شغوفة بالفن تحديداً —
// ربما وصلت لهذا الفرع بالاستبعاد لا بالاختيار. إجاباتها لا تُظهر أي
// تمايز واضح بين الأبعاد: ضجيج إيجابي خفيف (0 أو 1 بشكل شبه متساوٍ عبر
// كل الأسئلة بغض النظر عن أبعادها)، مع ندرة شديدة لإجابات "لا" (-1)
// لأنها شخصية متوافقة اجتماعياً (agreeable) لا رافضة، لكنها غير حاسمة.
import { runOneSimulation, randomFilters, simpleRandom, AVAILABLE_PROVINCES, BRANCH_MAP } from "./persona-simulation-harness.mts";
import fs from "fs";

function answerFn(q: { id: string; text: string; dimensions: Record<string, number> }, rng: () => number): -1 | 0 | 1 {
  const r = rng();
  if (r < 0.05) return -1; // نادراً جداً "لا"
  if (r < 0.525) return 0; // "ربما" - نصف الباقي تقريباً
  return 1; // "نعم" - النصف الآخر
}

const rng = simpleRandom(117);
const results = [];
for (let i = 0; i < 30; i++) {
  const filters = randomFilters(rng, {
    branch: "فنون",
    grade: Math.round(55 + rng() * 30), // 55-85
  });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad\\report_17_unclear_arts.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log("Wrote", results.length, "simulations to", outPath);
