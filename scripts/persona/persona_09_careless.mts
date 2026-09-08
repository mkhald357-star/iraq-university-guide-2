// شخصية 09: الطالب المهمل العشوائي — يجيب عشوائياً بحتاً بلا أي منطق
// بُعدي على الإطلاق (اختبار إجهاد لنظام VRS: هل يكتشف الضجيج العشوائي
// الخالص الذي لا يُصمِّم بخط مستقيم ولا يوافق دائماً بـ"نعم"؟).
import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";

function answerFn(_q: { id: string; dimensions: Record<string, number> }, rng: () => number): -1 | 0 | 1 {
  // ضجيج عشوائي بحت — لا علاقة بأبعاد السؤال إطلاقاً
  return (Math.floor(rng() * 3) - 1) as -1 | 0 | 1;
}

const rng = simpleRandom(109);
const results = [];
for (let i = 0; i < 30; i++) {
  const filters = randomFilters(rng); // فلاتر عشوائية بالكامل في كل تشغيلة
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\c9821d8e-90a2-4dc6-9f5b-4818fc044860\\scratchpad\\report_09_careless.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log("Done. Wrote", results.length, "simulations to", outPath);
