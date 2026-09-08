// عميل محاكاة: الطالبة القلقة الكمالية (Anxious Perfectionist Female Student)
// تقدّر البنية والنظام والقابلية للتنبؤ والأمان على حساب المخاطرة أو العفوية.
import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";

const SEED = 110;

// أوزان الشخصية لكل بُعد RIASEC:
// C: إيجابي بقوة جداً (تحب التنظيم، الدقة، اتباع التعليمات، الاستقرار)
// S: إيجابي معتدل (تحب المساعدة لكن ضمن إطار منظم، لا فوضى اجتماعية)
// E: سلبي بقوة جداً، خصوصاً كل ما يخص المخاطرة/عدم اليقين/ريادة الأعمال
// A: سلبي (تكره الغموض والعمل الإبداعي المفتوح بلا معايير واضحة)
// R و I: مختلطة — لا ميل واضح، تُحسب شبه عشوائية لكل سؤال
function personaWeight(dim: string, rng: () => number): number {
  switch (dim) {
    case "C":
      return 1.0;
    case "S":
      return 0.6;
    case "E":
      return -1.0;
    case "A":
      return -0.65;
    case "R":
      return (rng() - 0.5) * 1.2; // مختلط: بين -0.6 و 0.6
    case "I":
      return (rng() - 0.5) * 1.2; // مختلط: بين -0.6 و 0.6
    default:
      return 0;
  }
}

function answerFn(q: { id: string; text: string; dimensions: Record<string, number> }, rng: () => number): -1 | 0 | 1 {
  // أسئلة فحص الصدق (validity) ليس لها dimensions فعلية — تُعامَل بمنطق خاص
  // يعكس شخصية "كمالية قلقة" تقرأ كل سؤال بعناية فائقة ولا تبالغ في وصف نفسها.
  if (q.id === "q_attention_check") return 0; // تتّبع التعليمات بدقة متناهية
  if (q.id === "q_help_others_reverse") return -1; // متسقة مع ميلها الإيجابي المعتدل لمساعدة الآخرين (q_help_others)
  if (q.id === "q_lie_scale") return -1; // كمالية قلقة تعي جيداً أنها ترددت وأخفقت أحياناً، لا تبالغ

  const dims = Object.keys(q.dimensions);
  if (dims.length === 0) return 0;

  let score = 0;
  for (const dim of dims) {
    const weight = q.dimensions[dim]; // عادة بين -8 و 8
    score += (weight / 8) * personaWeight(dim, rng);
  }

  if (score >= 0.35) return 1;
  if (score <= -0.35) return -1;
  return 0;
}

const rng = simpleRandom(SEED);
const results = [];
for (let i = 0; i < 30; i++) {
  const branchChoice = rng() < 0.5 ? "علمي" : "أدبي";
  const gradeValue = Math.round(75 + rng() * 20); // 75-95، طالبة متفوقة تدرس بجدّية
  const filters = randomFilters(rng, { branch: branchChoice, grade: gradeValue });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad\\report_10_anxious_perfectionist.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} simulations to ${outPath}`);
