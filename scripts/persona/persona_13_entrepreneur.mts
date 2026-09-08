// شخصية 13: الطالب رائد الأعمال الطموح (Ambitious Entrepreneurial Male Student)
// يريد بناء وامتلاك مشروعه الخاص، يحب المخاطرة والقيادة، يكره البيروقراطية
// والروتين الإداري الجامد. إيجابي بقوة على E، إيجابي معتدل على A (حل مشاكل
// إبداعي)، سلبي بقوة على C (يكره الإجراءات الجامدة)، سلبي على S، ومتذبذب
// على R وI.
import {
  runOneSimulation,
  randomFilters,
  simpleRandom,
  AVAILABLE_PROVINCES,
  type FilterSettings,
} from "./persona-simulation-harness.mts";
import fs from "fs";

// معاملات تفضيل الشخصية لكل بُعد (تُضرب بوزن السؤال في ذلك البُعد لتحديد
// "الرغبة" الصافية بالإجابة بنعم -- تعكس محتوى السؤال الفعلي وليس فقط
// وجود حرف البُعد، لأن بعض الأسئلة أوزانها بالسالب لبعد ما (مثال:
// q_comfort_vs_salary فيه E:-3 لأنه يسأل عن الرغبة بوظيفة مريحة روتينية،
// ورائد الأعمال يرفض ذلك بقوة -- ما يعني إجابة "لا" فعلياً تزيد بُعد E).
const BASE_COEFF: Record<string, number> = {
  E: 1.3,   // إيجابي بقوة جداً -- كل الأسئلة المحمّلة بـE
  C: -1.3,  // سلبي بقوة جداً -- كل الأسئلة المحمّلة بـC (كره البيروقراطية)
  A: 0.8,   // إيجابي معتدل -- حل المشاكل الإبداعي
  S: -1.0,  // سلبي -- لا يهتم بالعمل الخدمي/الاجتماعي المباشر
};

function decide(desirability: number): -1 | 0 | 1 {
  if (desirability >= 3) return 1;
  if (desirability <= -3) return -1;
  return 0;
}

function answerFn(
  q: { id: string; text: string; dimensions: Record<string, number> },
  rng: () => number
): -1 | 0 | 1 {
  // أسئلة التحقق الثلاثة: نتعامل معها صراحة لضمان اتساق منطقي حقيقي
  // (شخصية حاسمة وواثقة، وليست شخصية عشوائية أو كاذبة).
  if (q.id === "q_attention_check") return 0; // يتبع التعليمات فعلياً
  if (q.id === "q_help_others_reverse") return 1; // متسق مع رفضه مساعدة الآخرين (S سلبي)
  if (q.id === "q_lie_scale") return -1; // صادق، لا يدّعي الكمال

  let desirability = 0;
  for (const [dim, weight] of Object.entries(q.dimensions)) {
    if (dim === "R" || dim === "I") {
      // متذبذب/مختلط: معامل عشوائي لكل سؤال ولكل محاكاة (لا اتجاه ثابت)
      const coeff = (rng() * 2 - 1) * 1.3;
      desirability += weight * coeff;
    } else {
      const coeff = BASE_COEFF[dim] ?? 0;
      desirability += weight * coeff;
    }
  }
  return decide(desirability);
}

const rng = simpleRandom(113);
const results = [];
for (let i = 0; i < 30; i++) {
  const branch = rng() < 0.5 ? "علمي" : "أدبي";
  const grade = Math.round(50 + rng() * 45); // نطاق واسع عمداً: 50-95
  const filters: Partial<FilterSettings> = { branch, grade };
  const finalFilters = randomFilters(rng, filters);
  const result = runOneSimulation(finalFilters, answerFn, rng);
  results.push(result);
}

const outPath =
  "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\c9821d8e-90a2-4dc6-9f5b-4818fc044860\\scratchpad\\report_13_entrepreneur.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} simulations to ${outPath}`);
console.log("Sample provinces used:", AVAILABLE_PROVINCES.slice(0, 3));
