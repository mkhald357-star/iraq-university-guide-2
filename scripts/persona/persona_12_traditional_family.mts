// عميل محاكاة 12: الطالبة الملتزمة تقليدياً بالعائلة (Traditionally
// Family-Oriented Female Student)
// - تُقدّم الأمان الوظيفي وتوقعات العائلة على الطموح أو المخاطرة.
// - إيجابي بقوة (1) على كل أسئلة C (الوظيفة المنظمة، الدقة، الالتزام
//   بالتعليمات، الاستقرار).
// - إجابتان مفروضتان عمداً (ثابتتان دائماً، تُفحصان أولاً بمعرّف السؤال):
//     q_comfort_vs_salary => 1  (نعم، تريد وظيفة مريحة مستقرة حتى لو راتبها أقل)
//     q_risk_reward        => -1 (لا، لن تترك وظيفة حكومية مضمونة مقابل مخاطرة)
//   هاتان الإجابتان متسقتان منطقياً مع بعضهما (ليستا "نعم/نعم")، لذا يجب ألا
//   تُفعِّلا تحذير التناقض الخاص بزوج data/contradiction_pairs.json الأول
//   (q_risk_reward × q_comfort_vs_salary) الذي يشترط أن يكون كلا الجوابين
//   موجبَين (>0) معاً — هنا أحدهما سالب دائماً.
// - إيجابي معتدل على S (العائلة/المجتمع مهمّان لها لكن ليست بحماس اجتماعي مطلق).
// - سلبي (-1) على E عموماً (لا تحب المخاطرة/التفاوض/الظهور)، باستثناء السؤالين
//   المفروضين أعلاه واللذين هما فعلياً C/E-adjacent بالتصميم.
// - سلبي (-1) على A (لا ميل فني/إبداعي حر، تفضّل التقليدي المضمون).
// - مختلط (عشوائي موزّع) على R و I.
// - أسئلة التحقق (validity): صادقة ومنضبطة، تتبع التعليمات بدقة.
// - الفرع عشوائي بين "علمي" و"أدبي" فقط، المعدل عشوائي 65-90، المحافظة عشوائية بالكامل.

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
  // الإجابتان المفروضتان عمداً — تُفحصان أولاً قبل أي منطق آخر، بمعرّف
  // السؤال مباشرة (وليس بالبعد المهيمن) لضمان ثباتهما دائماً.
  if (q.id === "q_comfort_vs_salary") return 1; // نعم، تريد وظيفة مريحة مستقرة
  if (q.id === "q_risk_reward") return -1; // لا، لن تترك وظيفة حكومية مضمونة

  // أسئلة التحقق (validity) الثلاثة: طالبة صادقة ومنضبطة، وليست عشوائية.
  if (q.id === "q_attention_check") return 0; // تتبع التعليمات بدقة تامة
  if (q.id === "q_help_others_reverse") return -1; // تنكر عبارة معاكسة لميلها الاجتماعي المعتدل الحقيقي
  if (q.id === "q_lie_scale") return -1; // صادقة، لا تدّعي نجاحاً مطلقاً بلا تردد

  const dom = dominantDim(q.dimensions);

  if (dom === "C") return 1; // إيجابي بقوة دائماً على أسئلة C (الاستقرار والتنظيم)

  if (dom === "S") {
    // إيجابي معتدل: غالباً نعم، أحياناً محايدة
    return rng() < 0.65 ? 1 : 0;
  }

  if (dom === "E") return -1; // سلبي عموماً على E (لا مخاطرة، لا تفاوض، لا ظهور)

  if (dom === "A") return -1; // سلبي على A (لا ميل فني/إبداعي حر)

  if (dom === "R" || dom === "I") {
    // مختلط: توزيع عشوائي متساوٍ تقريباً بين الخيارات الثلاثة
    const r = rng();
    if (r < 1 / 3) return -1;
    if (r < 2 / 3) return 0;
    return 1;
  }

  return 0;
}

const rng = simpleRandom(112);
const results = [];
for (let i = 0; i < 30; i++) {
  const branch = rng() < 0.5 ? "علمي" : "أدبي";
  const grade = Math.round(65 + rng() * 25); // 65..90
  const filters = randomFilters(rng, { branch, grade });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath =
  "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad\\report_12_traditional_family.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} simulations to ${outPath}`);
