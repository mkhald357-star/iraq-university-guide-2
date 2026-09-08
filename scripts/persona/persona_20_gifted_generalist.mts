// شخصية: الطالبة المتفوقة متعددة الاهتمامات (High-Achieving Female Student
// with Genuinely Broad, Balanced Interests). بعكس شخصية "الحائرة" (لا تعرف
// ما تريد، إجاباتها عشوائية بلا انحياز بُعدي)، هذه الطالبة ممتازة في كل شيء
// تقريباً وتستمتع فعلاً بعدة مجالات مختلفة - حالة واقعية ومهمة: طلاب
// متفوقون كثيرون لديهم عدة خيارات "ملائمة فعلاً" وليس خياراً واحداً واضحاً.
//
// في كل محاكاة من الـ30 نختار عشوائياً زوجاً مختلفاً من أبعاد RIASEC الستة
// (مثال: I+S في محاكاة، A+E في أخرى) وتُجيب بإيجابية قوية ونادراً ما سلبية
// على أي سؤال يخص أحد هذين البُعدين المهيمنين لتلك الجولة، وبإيجابية معتدلة
// (مع تفاوت طبيعي، ليست كلها نعم) على بقية الأبعاد - لأنها فعلاً موهوبة
// وواسعة الاهتمام لا فقط "توافق على كل شيء بلا تمايز".
import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";

const SEED = 120;
const rng = simpleRandom(SEED);

const DIMS = ["R", "I", "A", "S", "E", "C"] as const;
type Dim = (typeof DIMS)[number];

function pickPair(r: () => number): [Dim, Dim] {
  const chosen = new Set<number>();
  while (chosen.size < 2) chosen.add(Math.floor(r() * DIMS.length));
  const [i, j] = [...chosen];
  return [DIMS[i], DIMS[j]];
}

// يُحدَّث قبل كل محاكاة من الـ30 - هذا هو "زوج التميّز" العشوائي لتلك الجولة
let currentPair: [Dim, Dim] = ["R", "I"];

function primaryDim(dimensions: Record<string, number>): Dim | null {
  let best: Dim | null = null;
  let bestAbs = -1;
  for (const [k, v] of Object.entries(dimensions)) {
    const av = Math.abs(v);
    if (av > bestAbs) {
      bestAbs = av;
      best = k as Dim;
    }
  }
  return best;
}

function scoredAnswer(dimensions: Record<string, number>, r: () => number): -1 | 0 | 1 {
  const pd = primaryDim(dimensions);
  if (!pd) return 0;
  const weight = dimensions[pd];
  const sign: 1 | -1 = weight >= 0 ? 1 : -1;
  const inPair = currentPair.includes(pd);
  const roll = r();
  if (inPair) {
    // إيجابية قوية تجاه بُعديها المهيمنين هذه الجولة، ونادراً جداً سلبية
    if (roll < 0.88) return sign;
    if (roll < 0.99) return 0;
    return (-sign) as -1 | 1; // ~1% فقط
  }
  // إيجابية معتدلة تجاه بقية الأبعاد (متعددة الاهتمامات فعلاً، لا محايدة/حائرة)
  if (roll < 0.58) return sign;
  if (roll < 0.92) return 0;
  return (-sign) as -1 | 1; // ~8% فقط، نادرة كما هو مطلوب لهذه الشخصية
}

function answerFn(qRaw: { id: string; text: string; dimensions: Record<string, number> }, r: () => number): -1 | 0 | 1 {
  const q = qRaw as any;
  if (q.validity) {
    const vtype = q.validity.type;
    if (vtype === "instructed") {
      // طالبة مجتهدة ودقيقة تقرأ التعليمات وتلتزم بها حرفياً
      return q.validity.expected as -1 | 0 | 1;
    }
    if (vtype === "reverse_twin") {
      // متسقة فعلاً: إيجابية على الأقل معتدلة تجاه مساعدة الآخرين دائماً
      // (سواء كان S بُعدها المهيمن هذه الجولة أم لا)، لذا ترفض دوماً
      // الصياغة المعكوسة "أفضّل عدم التدخل" - لا تناقض منطقي متعمّد.
      return -1;
    }
    if (vtype === "lie_scale") {
      // صادقة رغم تفوقها الحقيقي: تنفي العبارة المبالغ فيها ("لم أفشل قط")
      return r() < 0.9 ? -1 : 0;
    }
  }
  return scoredAnswer(q.dimensions ?? {}, r);
}

const results: any[] = [];
for (let i = 0; i < 30; i++) {
  currentPair = pickPair(rng);
  const grade = Math.round(90 + rng() * 10); // [90, 100]
  const filters = randomFilters(rng, { branch: "علمي", grade });
  const result: any = runOneSimulation(filters, answerFn, rng);
  result.dominantPair = [...currentPair];
  results.push(result);
}

const outPath =
  "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\c9821d8e-90a2-4dc6-9f5b-4818fc044860\\scratchpad\\report_20_gifted_generalist.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

// إحصاءات سريعة للتحقق الذاتي أثناء التطوير
const pYesList = results.map((res) => {
  const vals = Object.values(res.answers) as number[];
  return vals.filter((v) => v > 0).length / vals.length;
});
console.log("pYes range:", Math.min(...pYesList).toFixed(3), "-", Math.max(...pYesList).toFixed(3));
console.log(
  "avg pYes:",
  (pYesList.reduce((a: number, b: number) => a + b, 0) / pYesList.length).toFixed(3)
);
console.log("VRS bands:", results.map((r) => r.vrs.band).join(","));
console.log("grades:", results.map((r) => r.filters.grade).join(","));
console.log("pairs:", results.map((r: any) => r.dominantPair.join("")).join(","));
console.log("wrote", results.length, "simulations to", outPath);
