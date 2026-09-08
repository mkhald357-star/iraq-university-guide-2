// عميل محاكاة 03/20 — "الطالب الطموح مادياً" (Money/Status-Driven Ambitious Male Student)
// يهتم أساساً بالعائد المادي والطلب في سوق العمل، لا بالتوافق الشخصي الحقيقي.
// منطق الإجابة: نحدد البُعد المهيمن (أعلى وزن مطلق) لكل سؤال، ثم نطبّق قاعدة
// شخصية واحدة لكل بُعد مهيمن:
//   E مهيمن (بما فيه صفقات/منافسة/قيادة/مخاطرة)  -> إجابة قوية بنعم (1)
//   E مهيمن لكن بوزن سالب (مثال: الراحة مقابل راتب أعلى) -> نعم أيضاً لأن
//     "لا" هنا تعني قبول الراحة/انخفاض الطموح -> نرفضها -> لكن بما أن العلامة
//     سالبة والبُعد المهيمن يبقى C وليس E عملياً (|C|>|E|) هذه الحالة تقع فعلياً
//     ضمن قاعدة C المختلطة أدناه، لا حاجة لمعالجة خاصة.
//   I مهيمن (مجالات "ذكية المظهر" كالعلوم/الرياضيات) -> إيجابي معتدل (١ بمعظم
//     الأحيان، أحياناً ٠، أبداً لا)
//   S أو A مهيمن -> سلبي (-1) دائماً (لا يهتم بمساعدة الناس ولا بالفن)
//   R أو C مهيمن -> مختلط (توزيع عشوائي متوازن بين -1/0/1)
import { runOneSimulation, randomFilters, simpleRandom, AVAILABLE_PROVINCES, BRANCH_MAP } from "./persona-simulation-harness.mts";
import fs from "fs";

const SEED = 103;

function dominantDimension(dims: Record<string, number>): { dim: string; val: number } | null {
  const entries = Object.entries(dims);
  if (entries.length === 0) return null;
  let best = entries[0];
  for (const e of entries) {
    if (Math.abs(e[1]) > Math.abs(best[1])) best = e;
  }
  return { dim: best[0], val: best[1] };
}

function answerFn(q: { id: string; text: string; dimensions: Record<string, number> }, rng: () => number): -1 | 0 | 1 {
  // أسئلة التحقق الثلاثة (dimensions فارغة) -- معالجة خاصة صريحة
  if (q.id === "q_attention_check") return 0; // يجب الالتزام بالتعليمة الصريحة دوماً (طالب حاسم لا يهمل التعليمات الواضحة)
  if (q.id === "q_lie_scale") return -1; // صادق وواقعي: لا يدّعي نجاحاً مطلقاً بلا فشل قط
  if (q.id === "q_help_others_reverse") return 1; // متسق مع رفضه مساعدة الآخرين على حساب وقته (q_help_others = -1)

  const dom = dominantDimension(q.dimensions);
  if (!dom) return 0;

  switch (dom.dim) {
    case "E":
      // منافسة/مكانة/أعمال/مخاطرة مقابل عائد أعلى -> نعم بقوة دائماً
      return 1;
    case "I": {
      // مجالات "ذكية المظهر" (رياضيات/علوم/بيانات) -> إيجابي معتدل، ليس مطلقاً
      const r = rng();
      return r < 0.72 ? 1 : 0;
    }
    case "S":
    case "A":
      // لا يهتم بمساعدة الناس ولا بالفن/التعبير الذاتي
      return -1;
    case "R":
    case "C": {
      // مختلط فعلاً: لا ميل واضح لعمل يدوي واقعي ولا لعمل مكتبي/إجرائي دقيق
      const r = rng();
      if (r < 1 / 3) return -1;
      if (r < 2 / 3) return 0;
      return 1;
    }
    default:
      return 0;
  }
}

const rng = simpleRandom(SEED);
const results = [];
for (let i = 0; i < 30; i++) {
  const branch = rng() < 0.5 ? "علمي" : "أدبي"; // أبداً "فنون" لهذه الشخصية
  const grade = Math.round(65 + rng() * 30); // 65..95
  const filters = randomFilters(rng, { branch, grade });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\c9821d8e-90a2-4dc6-9f5b-4818fc044860\\scratchpad\\report_03_money_driven.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} simulations to ${outPath}`);
