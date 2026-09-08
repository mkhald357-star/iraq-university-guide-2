// شخصية 15: الطالبة من محافظة نائية (أقل تعداداً بالجامعات) — تختبر تحديداً
// دقة فلترة المحافظة والمساواة الجغرافية في التوصيات. المزاج العام "واقعي
// معتدل" (لا ميل حاد بأي بُعد)، مع ميل عشوائي خفيف فقط، لأن التركيز هنا على
// المحافظة الثابتة يدوياً وليس على شخصية الإجابات نفسها.
import { runOneSimulation, simpleRandom, BRANCH_MAP } from "./persona-simulation-harness.mts";
import type { FilterSettings } from "./persona-simulation-harness.mts";
import fs from "fs";

const BRANCHES_FOR_PERSONA = ["علمي", "أدبي"];

// دالة إجابة "واقعية معتدلة": تميل بشكل خفيف عشوائي نحو بُعد أو بُعدين مفضّلين
// تم اختيارهما مرة واحدة عشوائياً في بداية كل محاكاة (يمثلان ميول الطالبة
// الشخصية)، مع إجابات معتدلة (تكرار "ربما"=0) على بقية الأسئلة، ودون أي
// تطرف كامل (لا نعم/لا مطلقة على كل شيء). أسئلة التحقق (validity) تُجاب
// بصدق معقول لأن هذه شخصية غير متناقضة عمداً.
function makeAnswerFn(preferredDims: string[]) {
  // حالة مساعدة لضمان إجابة متسقة (غير متناقضة عمداً) بين سؤال "مساعدة
  // الآخرين" الأصلي وتوأمه المعكوس (q_help_others_reverse) — طالبة واقعية
  // غير متناقضة تجيب على السؤالين بانسجام منطقي، لا عشوائياً بمعزل عن بعضها.
  let lastHelpOthersAnswer: -1 | 0 | 1 | null = null;

  return function answerFn(q: { id: string; text: string; dimensions: Record<string, number> }, rng: () => number): -1 | 0 | 1 {
    // معالجة خاصة لأسئلة التحقق الثلاثة الصريحة (ثابتة الهوية عبر البنك):
    // طالبة واقعية معتدلة (غير مهملة وغير متناقضة عمداً) تلتزم بتعليمات
    // القراءة بدقة عالية (وليس عشوائياً).
    if (q.id === "q_attention_check") {
      // مطلوب صراحة اختيار "ربما" (0) بغض النظر عن الرأي — التزام عالٍ
      // الاحتمال (90%) مع هامش صغير لزلة انتباه واقعية بشرية.
      return rng() < 0.9 ? 0 : (rng() < 0.5 ? -1 : 1);
    }
    if (q.id === "q_lie_scale") {
      // ادّعاء نجاح مطلق بلا أي فشل أو تردد إطلاقاً — مبالغة واضحة، طالبة
      // واقعية غير ساعية لصورة مثالية تنفيه بشكل شبه مؤكد.
      return rng() < 0.92 ? -1 : 0;
    }
    if (q.id === "q_help_others_reverse") {
      // توأم معكوس لسؤال "ساعدت زميلاً فعلاً رغم استهلاك وقتك": إن كانت
      // إجابتها الأصلية إيجابية (تساعد فعلاً)، فمن المنطقي أن تُنكر تفضيلها
      // "عدم التدخل إطلاقاً" (إجابة سالبة)، والعكس صحيح تقريباً.
      if (lastHelpOthersAnswer !== null) {
        if (lastHelpOthersAnswer > 0) return rng() < 0.85 ? -1 : 0;
        if (lastHelpOthersAnswer < 0) return rng() < 0.85 ? 1 : 0;
        return 0;
      }
      return 0;
    }

    const dims = q.dimensions || {};
    const dimKeys = Object.keys(dims);
    if (dimKeys.length === 0) {
      // سؤال تحقق عام آخر بلا أبعاد RIASEC — إجابة معتدلة الصدق
      const r = rng();
      let ans: -1 | 0 | 1;
      if (r < 0.15) ans = -1;
      else if (r < 0.35) ans = 0;
      else ans = 1;
      return ans;
    }

    // هل السؤال يرتبط بأحد الأبعاد المفضلة لدى هذه الطالبة؟
    const matchesPreferred = dimKeys.some((k) => preferredDims.includes(k) && Math.abs(dims[k]) > 0);

    const r = rng();
    let ans: -1 | 0 | 1;
    if (matchesPreferred) {
      // ميل إيجابي معتدل (وليس شبه مؤكد) نحو أبعادها المفضلة
      if (r < 0.62) ans = 1;
      else if (r < 0.85) ans = 0;
      else ans = -1;
    } else {
      // بقية الأبعاد: توزيع معتدل واقعي، مع ميل خفيف نحو "ربما"
      if (r < 0.28) ans = 1;
      else if (r < 0.66) ans = 0;
      else ans = -1;
    }
    if (q.id === "q_help_others") lastHelpOthersAnswer = ans;
    return ans;
  };
}

// دورة المحافظات النائية الست بالترتيب الثابت المطلوب، 5 محاكاة لكل محافظة
const PROVINCE_CYCLE = ["المثنى", "ميسان", "واسط", "ذي قار", "صلاح الدين", "كركوك"];
const RUNS_PER_PROVINCE = 5;

const rng = simpleRandom(115);
const RIASEC_DIMS = ["R", "I", "A", "S", "E", "C"];

const results = [];
for (let p = 0; p < PROVINCE_CYCLE.length; p++) {
  const province = PROVINCE_CYCLE[p];
  for (let run = 0; run < RUNS_PER_PROVINCE; run++) {
    // اختيار بُعدين مفضّلين عشوائياً لكل محاكاة (ميول واقعية معتدلة، مختلفة
    // من طالبة لأخرى ضمن نفس الشخصية العامة)
    const shuffled = [...RIASEC_DIMS].sort(() => rng() - 0.5);
    const preferredDims = shuffled.slice(0, 2);

    const branch = BRANCHES_FOR_PERSONA[Math.floor(rng() * BRANCHES_FOR_PERSONA.length)];
    const gradeType: FilterSettings["gradeType"] = rng() < 0.5 ? "expected" : "actual";
    const grade = Math.round(60 + rng() * 30); // 60-90 كما هو مطلوب

    const filters: FilterSettings = { province, branch, gradeType, grade };
    const answerFn = makeAnswerFn(preferredDims);
    const result = runOneSimulation(filters, answerFn, rng);
    results.push(result);
  }
}

if (results.length !== 30) {
  throw new Error(`Expected 30 simulations, got ${results.length}`);
}

const outPath = "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\b89db03c-c0b5-4871-a660-6699520ca7b3\\scratchpad\\report_15_remote_province.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} simulations to ${outPath}`);
