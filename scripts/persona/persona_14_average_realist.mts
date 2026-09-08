// شخصية 14: الطالب متوسط التحصيل الباحث عن بديل واقعي
// (Average-Achieving Male Student Seeking a Realistic Alternative)
//
// يمثل هذا العميل الحالة الأكثر شيوعاً فعلياً بين المستخدمين: طالب لا
// يملك تفوقاً أكاديمياً استثنائياً، ولا شخصية ذات ميل حاد نحو بُعد معين
// من أبعاد RIASEC. إجاباته يجب أن تنتج ملفاً "غير مميز" بشكل واقعي —
// لذلك نبني له "ميلاً أساسياً" (baseline lean) ثابتاً لكل بُعد من أبعاد
// R,I,A,S,E,C بين -0.3 و+0.3 يتوَلَّد مرة واحدة في بداية كل محاكاة
// (وليس عشوائياً بالكامل لكل سؤال)، ثم تتبع كل إجابة هذا الميل مع ضجيج
// عشوائي إضافي بحيث لا يُدفع أي بُعد نحو التطرف.
//
// القيود: الفرع عشوائي بين "علمي" و"أدبي" فقط (لا فنون)، المعدل عشوائي
// لكنه محصور بين 58 و73 (أقل من عتبة الطب 85، وأقل من كثير من عتبات
// التنافس)، والمحافظة عشوائية بالكامل.

import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";
import path from "path";

const DIMS = ["R", "I", "A", "S", "E", "C"] as const;
type Dim = (typeof DIMS)[number];

let baseline: Record<Dim, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

function makeBaseline(rng: () => number): Record<Dim, number> {
  const b = {} as Record<Dim, number>;
  DIMS.forEach((d) => {
    b[d] = rng() * 0.6 - 0.3; // ميل شخصي ثابت لهذه المحاكاة: بين -0.3 و+0.3
  });
  return b;
}

function scoreToAnswer(total: number): -1 | 0 | 1 {
  if (total >= 1.2) return 1;
  if (total <= -1.2) return -1;
  return 0;
}

function answerFn(
  q: { id: string; text: string; dimensions: Record<string, number> },
  rng: () => number
): -1 | 0 | 1 {
  // سؤال التحقق من الانتباه: طالب متوسط عادةً منتبه بما يكفي لتعليمة
  // مباشرة وواضحة، لكن ليس معصوماً من التشتت أحياناً (10% فرصة إهمال).
  if (q.id === "q_attention_check") {
    if (rng() < 0.1) return rng() < 0.5 ? 1 : -1;
    return 0;
  }

  // سؤال "مقياس الصدق" (الادعاء بعدم الفشل إطلاقاً): طالب واقعي وصادق
  // مع نفسه يرفض هذا الادعاء غالباً.
  if (q.id === "q_lie_scale") {
    return rng() < 0.85 ? -1 : 0;
  }

  // السؤال المعكوس المرتبط بـ q_help_others: لا نية تناقض متعمدة عند هذه
  // الشخصية، فتُجاب بعكس ميله الأساسي في بُعد S تقريباً مع بعض الضجيج
  // الطبيعي (تناسق غير مثالي، لا تناقض متعمد).
  if (q.id === "q_help_others_reverse") {
    const noise = (rng() - 0.5) * 5;
    const total = -baseline.S * 8 + noise;
    return scoreToAnswer(total);
  }

  // الأسئلة العادية: ميل شخصي ثابت لهذه المحاكاة × وزن السؤال + ضجيج
  let score = 0;
  DIMS.forEach((d) => {
    const w = q.dimensions[d] ?? 0;
    score += w * baseline[d];
  });
  const noise = (rng() - 0.5) * 5;
  return scoreToAnswer(score + noise);
}

const rng = simpleRandom(114);
const results = [];

for (let i = 0; i < 30; i++) {
  const branchChoice = rng() < 0.5 ? "علمي" : "أدبي";
  const gradeChoice = 58 + Math.floor(rng() * 16); // 58..73 شاملة
  const filters = randomFilters(rng, { branch: branchChoice, grade: gradeChoice });

  baseline = makeBaseline(rng);

  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = path.resolve(
  "C:/Users/al-faris/AppData/Local/Temp/claude/e------/c9821d8e-90a2-4dc6-9f5b-4818fc044860/scratchpad/report_14_average_realist.json"
);
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log("wrote", outPath, "with", results.length, "simulations");
