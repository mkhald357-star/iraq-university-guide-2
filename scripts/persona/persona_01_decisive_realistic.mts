// شخصية 01: الطالب الحاسم الواقعي (Decisive Realistic Male Student)
// يعرف بالضبط ما يريد: عمل عملي، يدوي، ملموس. إجابات حاسمة ومتسقة
// (غالباً 1 أو -1، نادراً 0)، متحمس جداً لـ R، متحمس بشكل معقول لـ I
// (لأن الهندسة العملية تهمه)، يرفض A وS بوضوح، محايد/سلبي قليلاً تجاه E وC.
import {
  runOneSimulation,
  randomFilters,
  simpleRandom,
  type FilterSettings,
  type SimulationResult,
} from "./persona-simulation-harness.mts";
import fs from "fs";

const DIMS = ["R", "I", "A", "S", "E", "C"] as const;

function dominantDimension(dimensions: Record<string, number>): string | null {
  let best: string | null = null;
  let bestAbs = -1;
  for (const d of DIMS) {
    const v = dimensions[d];
    if (v === undefined) continue;
    const abs = Math.abs(v);
    if (abs > bestAbs) {
      bestAbs = abs;
      best = d;
    }
  }
  return best;
}

function answerFn(q: { id: string; text: string; dimensions: Record<string, number> }, rng: () => number): -1 | 0 | 1 {
  // أسئلة التحقق (validity) الثلاثة لها منطق خاص بغض النظر عن الأبعاد
  if (q.id === "q_attention_check") {
    // سؤال تعليمات صريح "اختر ربما" — طالب حاسم لكنه يقرأ بعناية يتبع التعليمة حرفياً
    return 0;
  }
  if (q.id === "q_lie_scale") {
    // "هل نجحت دائماً في كل شيء ولم تفشل قط؟" — طالب واقعي صادق يرفض هذا الادعاء المبالغ فيه
    return -1;
  }
  if (q.id === "q_help_others_reverse") {
    // عكس "مساعدة الآخرين" (S) — طالب عملي لا يميل لبعد S الاجتماعي، فيوافق على
    // تفضيل عدم التدخل في مشاكل الآخرين (اتساق مع رفضه لأسئلة S الأخرى)
    return 1;
  }

  const dom = dominantDimension(q.dimensions);

  if (dom === "R") return 1; // موافقة قوية وحاسمة
  if (dom === "I") return 1; // موافقة (الجانب العملي/الهندسي للفضول العلمي يعجبه)
  if (dom === "A") return -1; // رفض حاسم
  if (dom === "S") return -1; // رفض حاسم

  if (dom === "E" || dom === "C") {
    // محايد/سلبي قليلاً: أغلبها -1 خفيفة مع بعض الحياد (0) — هذا هو الاستثناء
    // الوحيد المتعمد من الحسم الكامل بحسب تعريف الشخصية
    return rng() < 0.65 ? -1 : 0;
  }

  // لا يوجد بُعد مهيمن (نظرياً لا يحدث لأسئلة غير أسئلة التحقق)
  return 0;
}

const rng = simpleRandom(101);
const results: SimulationResult[] = [];

for (let i = 0; i < 30; i++) {
  const filters: FilterSettings = randomFilters(rng, { branch: "علمي" });
  // معدل واقعي لطالب "جيد لكن ليس الأفضل": 55-90
  filters.grade = Math.round(55 + rng() * 35);

  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath =
  "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\c9821d8e-90a2-4dc6-9f5b-4818fc044860\\scratchpad\\report_01_decisive_realistic.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`تمت كتابة ${results.length} محاكاة إلى: ${outPath}`);

// طباعة ملخص سريع للتحقق اليدوي
results.forEach((r, i) => {
  console.log(
    `#${i + 1} | grade=${r.filters.grade} (${r.filters.gradeType}) province=${r.filters.province} | top1=${r.top3[0]?.name ?? "-"} (${r.top3[0]?.fitPercent ?? "-"}%) | vrs=${r.vrs.band} | warnings=${r.warnings.length}`
  );
});
