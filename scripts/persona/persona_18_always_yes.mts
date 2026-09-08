// شخصية 18: الطالب الموافق دائماً (Chronic Yes-Man / Acquiescence-Biased Male Student)
// يجيب "نعم" (1) على كل شيء تقريباً بشكل انعكاسي، بما في ذلك سؤال التحقق من
// الانتباه (يجيب 1 بدل 0 المتوقع) وسؤال مقياس الكذب (يجيب 1 بادّعاء كمال
// غير واقعي). لا منطق مبني على أبعاد السؤال — فقط ميل شبه ثابت نحو "نعم"
// بغض النظر عن المحتوى، لأن هذا بالضبط ما يميّز هذه الشخصية (تحيّز الموافقة).
import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";

function answerFn(_q: { id: string; text: string; dimensions: Record<string, number> }, rng: () => number): -1 | 0 | 1 {
  const r = rng();
  if (r < 0.90) return 1; // ~90% نعم
  if (r < 0.98) return 0; // ~8% ربما
  return -1; // ~2% لا (نادر جداً)
}

const rng = simpleRandom(118);
const results = [];
for (let i = 0; i < 30; i++) {
  const filters = randomFilters(rng); // فروع/محافظات/معدلات عشوائية تماماً في كل تشغيلة
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad\\report_18_always_yes.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log("Wrote", results.length, "simulations to", outPath);
