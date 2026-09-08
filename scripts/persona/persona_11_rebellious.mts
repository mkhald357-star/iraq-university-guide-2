// عميل محاكاة #11: "الطالب المتمرد المستقل" (Rebellious, Autonomy-Seeking Male
// Student). يكره القواعد والروتين والهيكلية، ويتوق للحرية الإبداعية
// والاستقلالية. منطق الإجابة:
//  - أي سؤال فيه بُعد C (تقليدي/إجرائي): يُجاب بأقصى معاداة للإجراء دائماً —
//    إن كان وزن C موجباً يُجاب "لا" (-1)، وإن كان وزن C سالباً (أي السؤال
//    نفسه معادٍ للروتين/الإجراء) يُجاب "نعم" (1) — كلا الحالتين تدفع درجة C
//    الفعلية نحو الأدنى الممكن (انظر lib/riasec.ts: raw[d] += w*ans).
//  - أي سؤال فيه بُعد A (فني/إبداعي) ولا C فيه: "نعم" (1) بقوة.
//  - أي سؤال فيه بُعد E (مقاولاتي/قيادي) ولا C ولا A فيه: ميل إيجابي معتدل
//    (لا أقصى) — يريد إدارة شؤونه بنفسه لكن ليس "قيادياً" بامتياز.
//  - بقية الأسئلة (R/I/S فقط، أو أسئلة تحقق بلا أبعاد): مزاج مختلط عشوائي.
//  - سؤال تحقق الانتباه (q_attention_check) يطلب صراحة اختيار "ربما" بغض
//    النظر عن رأيه الحقيقي — طالب متمرد يرفض الانصياع لهذا الأمر بالتحديد
//    كجزء أصيل من شخصيته، فيجيب "نعم" (1) عمداً متجاهلاً التعليمة.
//  - سؤال مقياس الكذب (q_lie_scale) لا يهمه تقديم صورة مثالية عن نفسه، فيجيب
//    "لا" (-1) بصدق (لم ينجح دائماً في كل شيء).

import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";

function answerFn(q: { id: string; text: string; dimensions: Record<string, number> }, rng: () => number): -1 | 0 | 1 {
  if (q.id === "q_attention_check") return 1;
  if (q.id === "q_lie_scale") return -1;

  const c = q.dimensions.C ?? 0;
  if (c !== 0) {
    return c > 0 ? -1 : 1;
  }

  const a = q.dimensions.A ?? 0;
  if (a !== 0) return 1;

  const e = q.dimensions.E ?? 0;
  if (e !== 0) {
    return rng() < 0.65 ? 1 : 0;
  }

  // مزاج مختلط: R/I/S فقط، أو أسئلة تحقق بلا أبعاد (مثل q_help_others_reverse)
  const r = rng();
  if (r < 1 / 3) return -1;
  if (r < 2 / 3) return 0;
  return 1;
}

const rng = simpleRandom(111);
const results = [];
for (let i = 0; i < 30; i++) {
  const grade = Math.round(55 + rng() * 30); // 55-85 كما هو مطلوب لهذه الشخصية
  const filters = randomFilters(rng, { grade });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\c9821d8e-90a2-4dc6-9f5b-4818fc044860\\scratchpad\\report_11_rebellious.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} simulations to ${outPath}`);
