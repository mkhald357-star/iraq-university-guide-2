// عميل محاكاة #06 — "الطالبة الفنانة الحساسة" (Sensitive, Creative Female Art Student)
//
// منطق الإجابة: إيجابي قوي جداً على أسئلة A (فني/إبداعي)، إيجابي متوسط على
// أسئلة S (اجتماعي/تعاطفي/تعبيري)، سلبي على أسئلة C (تكره الجمود والإجراءات
// الصارمة)، ومختلط/محايد عشوائياً على R وI وE (لا ميل واضح مبرمَج لهذه
// الأبعاد الثلاثة — نتركها تتفاوت من سؤال لآخر كما قد تفعل شخصية حقيقية غير
// حاسمة في هذه المجالات تحديداً).
//
// الفلاتر: الفرع مثبَّت دائماً على "فنون"، المعدل عشوائي بين 55-90 (فرع
// الفنون في العراق سقف قبول مختلف/أدنى من العلمي)، المحافظة عشوائية بالكامل.

import {
  runOneSimulation,
  randomFilters,
  simpleRandom,
  type SimulationResult,
} from "./persona-simulation-harness.mts";
import fs from "fs";
import path from "path";

const SEED = 106;
const rng = simpleRandom(SEED);

// حالة مؤقتة لتتبّع إجابة q_help_others كي نُجيب على توأمها العكسي
// q_help_others_reverse بشكل متّسق منطقياً (شخصيتنا صادقة ومتّسقة، وليست
// شخصية متناقضة عمداً) — الأسئلة تُعالَج بالترتيب: 36 سؤال تسجيل أولاً ثم
// أسئلة التحقق الثلاثة، لذا q_help_others يُجاب قبل توأمه العكسي دائماً.
let lastHelpOthersAnswer: -1 | 0 | 1 = 1;

function answerFn(
  q: { id: string; text: string; dimensions: Record<string, number> },
  r: () => number
): -1 | 0 | 1 {
  // --- أسئلة التحقق من الجدّية (validity items) ---
  if (q.id === "q_attention_check") {
    // شخصية صادقة ومنتبهة: تجيب كما يُطلب منها بالضبط (0 = "ربما/أحياناً").
    return 0;
  }
  if (q.id === "q_help_others_reverse") {
    // متّسقة منطقياً: عكس إجابتها الحقيقية على q_help_others تماماً.
    if (lastHelpOthersAnswer > 0) return -1;
    if (lastHelpOthersAnswer < 0) return 1;
    return 0;
  }
  if (q.id === "q_lie_scale") {
    // فنانة حساسة وواعية بذاتها: لا تدّعي الكمال المطلق أبداً.
    return -1;
  }

  const dims = q.dimensions ?? {};
  // نحسب "درجة ميل" الإجابة عبر مجموع (وزن البُعد × ميل شخصيتنا نحو هذا
  // البُعد) لكل الأبعاد التي يحمّلها السؤال، ثم نحوّل المجموع إلى قرار.
  const affinity: Record<string, number> = {
    A: 1, // إيجابي قوي جداً
    S: 0.55, // إيجابي متوسط
    C: -1, // سلبي (تكره الجمود/الإجراءات الصارمة)
    R: 0, // مختلط/محايد
    I: 0, // مختلط/محايد
    E: 0, // مختلط/محايد
  };

  let weighted = 0;
  let hasNeutralDim = false;
  Object.entries(dims).forEach(([d, w]) => {
    const a = affinity[d] ?? 0;
    weighted += (w as number) * a;
    if (a === 0) hasNeutralDim = true;
  });

  // سؤال مرتبط فقط بأبعاد "محايدة" لدى هذه الشخصية (R/I/E بلا A/S/C مصاحب):
  // عشوائية حقيقية موزّعة تقريباً بالتساوي بين نعم/ربما/لا (شخصية غير حاسمة
  // في هذه المجالات تحديداً، بعكس حسمها الواضح تجاه A وC).
  if (weighted === 0) {
    const roll = r();
    if (roll < 0.34) return -1;
    if (roll < 0.67) return 0;
    return 1;
  }

  let answer: -1 | 0 | 1;
  if (weighted >= 5) answer = 1;
  else if (weighted <= -5) answer = -1;
  else if (weighted > 0) answer = r() < 0.75 ? 1 : 0; // إيجابي متوسط: غالباً نعم، أحياناً ربما
  else answer = r() < 0.75 ? -1 : 0; // سلبي متوسط: غالباً لا، أحياناً ربما

  // إن كان السؤال مختلطاً (يحمل بُعداً محايداً أيضاً)، نُضيف قليلاً من
  // التذبذب العشوائي بدل قرار حتمي صرف، طالما لم يكن الوزن الفني/الاجتماعي/
  // التقليدي حاسماً بوضوح (|weighted| < 5).
  if (hasNeutralDim && Math.abs(weighted) < 5) {
    const roll = r();
    if (roll < 0.15) {
      answer = answer === 1 ? 0 : answer === -1 ? 0 : answer;
    }
  }

  if (q.id === "q_help_others") {
    lastHelpOthersAnswer = answer;
  }

  return answer;
}

const results: SimulationResult[] = [];
for (let i = 0; i < 30; i++) {
  const filters = randomFilters(rng, {
    branch: "فنون",
    grade: Math.round(55 + rng() * 35), // 55-90
  });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = path.join(
  "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad",
  "report_06_artist.json"
);
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} simulations to ${outPath}`);
