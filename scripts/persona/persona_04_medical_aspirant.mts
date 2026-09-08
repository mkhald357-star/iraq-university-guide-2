// عميل محاكاة رقم 04: الطالبة الدقيقة العلمية الطموحة للطب
// شخصية: دقيقة جداً، علمية، طموحة، تريد مساعدة الناس عبر الطب تحديداً.
// إجابات: إيجابي قوي جداً على I وS، إيجابي معتدل على C (الدقة والتنظيم)،
// سلبي على E وA، ومختلط/سلبي قليلاً على R.
// الفرع مثبَّت دائماً "علمي" (شرط الطب)، المعدل عشوائي مقيّد بين 88-100
// (طالبة متفوقة فعلاً — هذا جوهر الشخصية)، المحافظة عشوائية بالكامل.
import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";

type Dim = "R" | "I" | "A" | "S" | "E" | "C";

// ميول الشخصية تجاه كل بُعد RIASEC (بين -1 و 1، تُستخدم كوزن انسجام)
const AFFINITY: Record<Dim, number> = {
  I: 1.0,   // إيجابي قوي جداً — علمية دقيقة
  S: 1.0,   // إيجابي قوي جداً — تريد مساعدة الناس عبر الطب
  C: 0.6,   // إيجابي معتدل — الدقة والتنظيم
  E: -1.0,  // سلبي — لا تحب القيادة/التفاوض/الظهور
  A: -1.0,  // سلبي — لا ميل فني/إبداعي حر
  R: -0.3,  // مختلط/سلبي قليلاً — لا ميل قوي للعمل اليدوي الميداني
};

function answerFn(
  q: { id: string; text: string; dimensions: Record<string, number> },
  rng: () => number
): -1 | 0 | 1 {
  // أسئلة التحقق (validity) — طالبة دقيقة جداً تقرأ كل كلمة بعناية وتتبع
  // التعليمات حرفياً، وصادقة تماماً بشأن نفسها (لا تدّعي الكمال المطلق).
  if (q.id === "q_attention_check") return 0; // تتبع التعليمة حرفياً كما طُلب
  if (q.id === "q_help_others_reverse") return -1; // متسقة مع ميلها القوي لمساعدة الآخرين (S)
  if (q.id === "q_lie_scale") return -1; // صادقة وواقعية بشأن نفسها، لا تدّعي نجاحاً مطلقاً
  // سؤال "وظيفة مريحة بلا ضغوطات حتى لو راتبها منخفض" يمس صميم الطموح
  // الشخصي مباشرة (لا مجرد توليفة R/I/A/S/E/C) — طالبة طموحة تريد الطب
  // تحديداً ترفض منطق "الراحة بلا ضغط" بوضوح، فهذا يُبنى يدوياً بدل
  // الاعتماد على الصيغة الموزونة العامة كي لا يتناقض مع طموحها المعلَن.
  if (q.id === "q_comfort_vs_salary") return -1;

  const entries = Object.entries(q.dimensions);
  if (entries.length === 0) return 0;

  // البُعد المهيمن في هذا السؤال (أكبر وزن مطلق)
  let dominant = entries[0][0] as Dim;
  let domW = Math.abs(entries[0][1]);
  for (const [d, w] of entries) {
    if (Math.abs(w) > domW) {
      dominant = d as Dim;
      domW = Math.abs(w);
    }
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [d, w] of entries) {
    weightedSum += w * AFFINITY[d as Dim];
    totalWeight += Math.abs(w);
  }
  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // أسئلة R المهيمنة: مختلطة/سلبية قليلاً — عشوائية موزونة نحو السلبية بدل
  // حسم صارم، لأن الشخصية ليست معادية للعمل اليدوي تماماً، فقط غير متحمسة له.
  if (dominant === "R") {
    if (score >= 0.5) return 1; // إن كان سؤالاً مختلطاً يميل بقوة لبُعد آخر إيجابي (كـ I) رغم هيمنة R شكلياً
    if (score <= -0.15) return rng() < 0.65 ? -1 : 0;
    return 0;
  }

  if (score >= 0.5) return 1;
  if (score <= -0.5) return -1;
  return 0;
}

const rng = simpleRandom(104);
const results = [];
for (let i = 0; i < 30; i++) {
  const filters = randomFilters(rng, {
    branch: "علمي",
    grade: Math.round(88 + rng() * 12), // 88-100: طالبة متفوقة فعلاً
  });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath =
  "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad\\report_04_medical_aspirant.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log("Wrote", results.length, "simulations to", outPath);
