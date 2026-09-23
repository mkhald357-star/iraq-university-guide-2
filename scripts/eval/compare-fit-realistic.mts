// صيغ المطابقة على مجتمع "واقعي اللامبالاة" تحت النماذج الثلاثة وتعريفَي الحقيقة.
import { buildSessionData } from "../../lib/eval/engineData.ts";
import { runEvaluation } from "../../lib/eval/runEvaluation.ts";
import { RESPONSE_MODELS } from "../../lib/eval/responseModels.ts";
import type { FitStrategy } from "../../lib/riasec.ts";
const strategies: FitStrategy[] = ["level", "correlation", "blend", "shape"];
const styleMix = { normal: 15, acquiescent: 2, extreme: 1, midpoint: 1, social_desirability: 1 };
for (const truthStrategy of ["level", "correlation"] as FitStrategy[]) {
  console.log(`== الحقيقة=${truthStrategy} (مجتمع لامبالاة واقعي)`);
  for (const fitStrategy of strategies) {
    let top1 = 0, top3 = 0, cal = 0;
    for (const [branch, w] of [["علمي", 0.6], ["أدبي", 0.3], ["فنون", 0.1]] as const)
      for (const model of RESPONSE_MODELS) {
        const s = runEvaluation({ branch, model, size: 700, seed: 1234, styleMix, indifferentLowDims: true }, buildSessionData({ fitStrategy, truthStrategy }));
        top1 += (w / 3) * s.top1Accuracy; top3 += (w / 3) * s.top3Overlap; cal += (w / 3) * s.meanAbsLogCalibration;
      }
    console.log(`  ${fitStrategy.padEnd(11)} top1 ${(top1 * 100).toFixed(1)} top3 ${(top3 * 100).toFixed(1)} |logcal| ${cal.toFixed(3)}`);
  }
}
