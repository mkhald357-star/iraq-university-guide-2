// عميل محاكاة 05 — "الطالب اليدوي العملي" (Strongly Hands-On, Trade-Minded Male Student)
// شخصية أكثر حدّة من "الواقعي العام": يحب العمل اليدوي/الميداني (R) بقوة،
// يكره العمل النظري/البحثي (I) والعمل المكتبي الدقيق المقيّد بإجراءات (C)،
// سلبي تجاه الفن/التعبير الحر (A)، محايد/متذبذب تجاه الاجتماعي (S) والريادي (E).
// الفرع مثبَّت "علمي"، المعدل عشوائي في المدى المتوسط-المنخفض [50,70]،
// المحافظة عشوائية بالكامل.

import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";

type Dims = Record<string, number>;

function dominantDimension(dimensions: Dims): string | null {
  let bestKey: string | null = null;
  let bestAbs = -1;
  for (const [k, v] of Object.entries(dimensions)) {
    const a = Math.abs(v);
    if (a > bestAbs) {
      bestAbs = a;
      bestKey = k;
    }
  }
  return bestKey;
}

// نحتفظ بآخر إجابة على q_help_others لضمان اتساق منطقي مع نسخته المعكوسة
// (q_help_others_reverse) في أسئلة التحقق — شخصية حاسمة يجب ألا تتناقض
// مع نفسها بلا داعٍ.
let lastHelpOthersAnswer: -1 | 0 | 1 = 0;

function answerFn(
  q: { id: string; text: string; dimensions: Dims },
  rng: () => number
): -1 | 0 | 1 {
  // أسئلة التحقق (validity items) ليس لها dimensions حقيقية — تُعامَل يدوياً
  if (q.id === "q_attention_check") {
    // شخصية منتبهة وصادقة رغم عدم حبها للأسئلة النظرية — تتبع التعليمة كما هي
    return 0;
  }
  if (q.id === "q_help_others_reverse") {
    // عكس منطقي لما أجاب به فعلاً على q_help_others لتجنّب تناقض مفتعل
    if (lastHelpOthersAnswer === 1) return -1;
    if (lastHelpOthersAnswer === -1) return 1;
    return 0;
  }
  if (q.id === "q_lie_scale") {
    // شخصية واقعية عن نفسها — لا يدّعي نجاحاً مطلقاً بلا فشل قط
    return -1;
  }

  const dim = dominantDimension(q.dimensions);
  let answer: -1 | 0 | 1;

  switch (dim) {
    case "R":
      // يدوي وعملي بقوة — نعم قوية دائماً
      answer = 1;
      break;
    case "I":
      // يكره العمل النظري/التحليلي البحت
      answer = -1;
      break;
    case "C":
      // يكره الدقة المكتبية والانضباط الإجرائي البحت
      answer = -1;
      break;
    case "A":
      // سلبي تجاه الفن/التعبير الحر
      answer = -1;
      break;
    case "S": {
      // محايد/متذبذب: توزيع تقريبي بالثلث بين لا/ربما/نعم
      const r = rng();
      answer = r < 0.34 ? -1 : r < 0.67 ? 0 : 1;
      break;
    }
    case "E": {
      const r = rng();
      answer = r < 0.34 ? -1 : r < 0.67 ? 0 : 1;
      break;
    }
    default:
      answer = 0;
  }

  if (q.id === "q_help_others") {
    lastHelpOthersAnswer = answer;
  }

  return answer;
}

const rng = simpleRandom(105);
const results = [];
for (let i = 0; i < 30; i++) {
  const filters = randomFilters(rng, {
    branch: "علمي",
    grade: Math.round(50 + rng() * 20), // [50, 70]
  });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath =
  "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad\\report_05_hands_on.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} simulations to ${outPath}`);
