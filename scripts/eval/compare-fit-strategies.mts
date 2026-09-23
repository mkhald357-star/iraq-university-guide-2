// مقارنة صيغ المطابقة (level/shape/correlation/blend) تحت 3 نماذج استجابة
// وتعريفَين للحقيقة (level/shape) ومزيج أنماط استجابة. لا يغيّر المنتج.
//   node "$(node -e "console.log(require.resolve('tsx/cli'))")" scripts/eval/compare-fit-strategies.mts [size]
import { buildSessionData } from "../../lib/eval/engineData.ts";
import { runEvaluation } from "../../lib/eval/runEvaluation.ts";
import { RESPONSE_MODELS } from "../../lib/eval/responseModels.ts";
import type { FitStrategy } from "../../lib/riasec.ts";

const size = Number(process.argv[2] ?? 1500);
const strategies: FitStrategy[] = ["level", "shape", "correlation", "blend"];
const pct = (x: number) => (x * 100).toFixed(1);
const mixedStyles = { normal: 6, acquiescent: 1, extreme: 1, midpoint: 1, social_desirability: 1 };

for (const truthStrategy of ["level", "shape"] as FitStrategy[]) {
  console.log(`\n===== الحقيقة = ${truthStrategy} =====`);
  for (const branch of ["علمي", "أدبي"]) {
    for (const model of RESPONSE_MODELS) {
      const cells = strategies.map((fitStrategy) => {
        const s = runEvaluation({ branch, model, size, seed: 5150, styleMix: mixedStyles }, buildSessionData({ fitStrategy, truthStrategy }));
        return `${fitStrategy}: top1 ${pct(s.top1Accuracy)} top3 ${pct(s.top3Overlap)} cal ${s.meanAbsLogCalibration.toFixed(2)} out ${s.calibrationOutOfRange.length} acq ${pct(s.top1AccuracyByStyle.acquiescent ?? 0)}`;
      });
      console.log(`${branch} / ${model}\n   ` + cells.join("\n   "));
    }
  }
}
