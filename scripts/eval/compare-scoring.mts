// تلوّث الأبعاد (minLoadingShare) × ترجيح السياق (تشغيل/إيقاف) على البنك
// الحالي، وضع legacy، الحقيقة level مجمّدة، 3 نماذج × 2 فرع + نمط الموافقة.
import { buildSessionData } from "../../lib/eval/engineData.ts";
import { runEvaluation } from "../../lib/eval/runEvaluation.ts";
import { RESPONSE_MODELS } from "../../lib/eval/responseModels.ts";
const size = Number(process.argv[2] ?? 1500);
const pct = (x: number) => (x * 100).toFixed(1);
for (const minLoadingShare of [0, 0.5, 1]) {
  for (const context of [true, false]) {
    const cells: string[] = [];
    let a1 = 0, a3 = 0, anc = 0, out = 0, acq = 0, n = 0;
    for (const branch of ["علمي", "أدبي"]) {
      for (const model of RESPONSE_MODELS) {
        const data = buildSessionData({ minLoadingShare, ...(context ? {} : { contextIndex: {} }) });
        const s = runEvaluation({ branch, model, size, seed: 20260922 }, data);
        const st = runEvaluation({ branch, model, size: Math.round(size / 3), seed: 777, styleMix: { acquiescent: 1 } }, data);
        a1 += s.top1Accuracy; a3 += s.top3Overlap; anc += s.anchorTop1; out += s.calibrationOutOfRange.length; acq += st.top1Accuracy; n++;
        cells.push(`${branch[0]}/${model[0]}:${pct(s.top1Accuracy)}`);
      }
    }
    console.log(`share=${minLoadingShare} context=${context ? "on " : "off"} | top1 ${pct(a1 / n)} top3 ${pct(a3 / n)} anchor ${pct(anc / n)} outOfRange(sum6) ${out} acquiescent-top1 ${pct(acq / n)} | ${cells.join(" ")}`);
  }
}
