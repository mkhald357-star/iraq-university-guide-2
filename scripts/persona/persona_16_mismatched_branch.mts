// شخصية 16: طالب فرع أدبي (بضغط عائلي) لكن ميوله الحقيقية علمية-تحليلية بقوة
// (I مسيطر، R ثانوي)، سلبي تجاه A وS، متذبذب تجاه E. الفرع مثبَّت "أدبي"
// دائماً - هذا هو جوهر اختبار الإجهاد: هل تلتزم المنصة ببوابة الفرع الرسمية
// (BRANCH_MAP) حتى عندما يتناقض ذلك تماماً مع شخصية الطالب الفعلية؟
import {
  runOneSimulation,
  randomFilters,
  simpleRandom,
  ALL_QUESTIONS,
  type SimulationResult,
} from "./persona-simulation-harness.mts";
import fs from "fs";

type Dims = Record<string, number>;

// أوزان الشخصية: I قوي جداً موجب، R معتدل موجب، A وS سلبيان بقوة، C معتدل موجب.
// E متذبذب عمداً (يُعاد توليده عشوائياً لكل سؤال ضمن مدى واسع).
function personaWeights(rng: () => number): Record<string, number> {
  return {
    R: 0.6,
    I: 1.3,
    A: -1.1,
    S: -1.1,
    E: (rng() - 0.5) * 1.6, // بين -0.8 و 0.8: ميل تجاري/قيادي متذبذب بلا اتجاه ثابت
    C: 0.55,
  };
}

function scoreDims(dims: Dims, weights: Record<string, number>): number {
  let s = 0;
  for (const [k, w] of Object.entries(dims)) {
    s += (weights[k] ?? 0) * w;
  }
  return s;
}

const QUESTION_LOOKUP = new Map(ALL_QUESTIONS.map((q: any) => [q.id, q]));

function answerFn(q: { id: string; text: string; dimensions: Dims }, rng: () => number): -1 | 0 | 1 {
  const full = QUESTION_LOOKUP.get(q.id) as any;
  const validity = full?.validity;

  if (validity) {
    if (validity.type === "instructed") return 0; // يتبع التعليمات بدقة (شخصية تحليلية منتبهة للتفاصيل)
    if (validity.type === "lie_scale") return -1; // صادق: لا يدّعي نجاحاً مطلقاً بلا فشل قط
    if (validity.type === "reverse_twin") {
      const pairedQ = QUESTION_LOOKUP.get(validity.pairsWith) as any;
      const pairedScore = scoreDims(pairedQ?.dimensions ?? {}, personaWeights(rng));
      const pairedAnswer: -1 | 0 | 1 = pairedScore > 2.5 ? 1 : pairedScore < -2.5 ? -1 : 0;
      // نعكس الإجابة لتبقى متسقة مع السؤال الأصلي المطابق (وليست تناقضاً عشوائياً)
      if (pairedAnswer === 1) return -1;
      if (pairedAnswer === -1) return 1;
      return 0;
    }
  }

  const weights = personaWeights(rng);
  const s = scoreDims(q.dimensions, weights);
  if (s > 2.5) return 1;
  if (s < -2.5) return -1;
  return 0;
}

const rng = simpleRandom(116);
const results: SimulationResult[] = [];
for (let i = 0; i < 30; i++) {
  const filters = randomFilters(rng, { branch: "أدبي" });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath =
  "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\c9821d8e-90a2-4dc6-9f5b-4818fc044860\\scratchpad\\report_16_mismatched_branch.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log("wrote", outPath, "with", results.length, "simulations");
