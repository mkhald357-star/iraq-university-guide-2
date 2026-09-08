// شخصية: الطالبة الحائرة تماماً (Completely Undecided Female Student)
// لا تعرف ما تريد؛ كل شيء يبدو "لا بأس به" بنفس القدر. الإجابات يجب أن
// تكون غالباً "ربما" (0) بنسبة ~70-85%، والباقي عشوائي بحت بلا نمط بُعدي
// بين -1 و1 (لا صلة بأبعاد RIASEC للسؤال - هي حائرة فعلاً، ليست منحازة).
import { runOneSimulation, randomFilters, simpleRandom } from "./persona-simulation-harness.mts";
import fs from "fs";

const SEED = 102;
const rng = simpleRandom(SEED);

function answerFn(_q: { id: string; text: string; dimensions: Record<string, number> }, r: () => number): -1 | 0 | 1 {
  // نسبة "ربما" تتراوح بين 70% و85% حتى ضمن نفس المحاكاة الواحدة (تذبذب
  // طبيعي، ليست نسبة ثابتة صارمة) - نستخدم عتبة عشوائية بين 0.70 و0.85
  // لكل سؤال لمحاكاة عدم اليقين المتقلب قليلاً لدى الطالبة.
  const neutralThreshold = 0.70 + r() * 0.15; // [0.70, 0.85)
  const roll = r();
  if (roll < neutralThreshold) return 0;
  // الباقي (15%-30%) يُوزَّع عشوائياً بلا أي نمط بين نعم/لا
  return r() < 0.5 ? 1 : -1;
}

const results = [];
for (let i = 0; i < 30; i++) {
  // المعدل مقيَّد بمهمة هذه الشخصية بمجال 60-85 (طالبة متوسطة التحصيل غير
  // حاسمة، لا فرع/محافظة مقيَّدان - عشوائيان بالكامل عبر randomFilters).
  const grade = Math.round(60 + rng() * 25); // [60, 85]
  const filters = randomFilters(rng, { grade });
  const result = runOneSimulation(filters, answerFn, rng);
  results.push(result);
}

const outPath = "C:\\Users\\al-faris\\AppData\\Local\\Temp\\claude\\e------\\c9821d8e-90a2-4dc6-9f5b-4818fc044860\\scratchpad\\report_02_undecided.json";
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

// إحصاءات سريعة للتحقق الذاتي أثناء التطوير (لن تُستخدم كأرقام تقرير نهائية إلا بعد قراءة JSON فعلياً)
const neutralRatios = results.map((res) => {
  const vals = Object.values(res.answers);
  const zeros = vals.filter((v) => v === 0).length;
  return zeros / vals.length;
});
console.log("neutral ratio range:", Math.min(...neutralRatios).toFixed(3), "-", Math.max(...neutralRatios).toFixed(3));
console.log("avg neutral ratio:", (neutralRatios.reduce((a, b) => a + b, 0) / neutralRatios.length).toFixed(3));
console.log("wrote", results.length, "simulations to", outPath);
