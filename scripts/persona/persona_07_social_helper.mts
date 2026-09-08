// عميل محاكاة 07: الطالب الخدوم الاجتماعي (Service/People-Oriented Male Student)
// - إيجابي بقوة (1) على كل أسئلة S
// - إيجابي معتدل على E (يستمتع بالعمل مع الناس/القيادة، لكن ليس بحماس أقصى)
// - سلبي (-1) على R (غير مهتم بالآلات/الأدوات)
// - مختلط (عشوائي) على I, A, C
// - الفرع مثبَّت دائماً "أدبي"، المعدل عشوائي بين 60-88، المحافظة عشوائية بالكامل

import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";

type Dims = Record<string, number>;

function dominantDim(dimensions: Dims): string | null {
  const entries = Object.entries(dimensions);
  if (entries.length === 0) return null;
  let best = entries[0];
  for (const e of entries) {
    if (Math.abs(e[1]) > Math.abs(best[1])) best = e;
  }
  return best[0];
}

function answerFn(q: { id: string; text: string; dimensions: Dims }, rng: () => number): -1 | 0 | 1 {
  // أسئلة التحقق (validity) الثلاثة تُعامَل بمنطق خاص: طالب صادق ومنتبه، وليس
  // بمنطق الأبعاد الخمسة (لأنها dimensions: {} أصلاً).
  if (q.id === "q_attention_check") return 0; // يتبع التعليمات بدقة
  if (q.id === "q_help_others_reverse") return -1; // ينكر عبارة معاكسة لميله الاجتماعي الحقيقي
  if (q.id === "q_lie_scale") return -1; // صادق، لا يدّعي نجاحاً مطلقاً

  const dom = dominantDim(q.dimensions);

  if (dom === "S") return 1; // إيجابي بقوة دائماً على الأبعاد الاجتماعية

  if (dom === "E") {
    // إيجابي معتدل: غالباً نعم لكن ليس بيقين مطلق
    return rng() < 0.7 ? 1 : 0;
  }

  if (dom === "R") return -1; // غير مهتم بالآلات/الأدوات

  if (dom === "I" || dom === "A" || dom === "C") {
    // مختلط: توزيع عشوائي متساوٍ تقريباً بين الخيارات الثلاثة
    const r = rng();
    if (r < 1 / 3) return -1;
    if (r < 2 / 3) return 0;
    return 1;
  }

  return 0;
}

const rng = simpleRandom(107);
const results = [];
for (let i = 0; i < 30; i++) {
  const grade = Math.round(60 + rng() * 28); // 60..88
  const filters = randomFilters(rng, { branch: "أدبي", grade });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath =
  "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad\\report_07_social_helper.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} simulations to ${outPath}`);
