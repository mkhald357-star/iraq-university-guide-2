// مقارنة وضع الجولات: legacy (حتى 3 جولات ترجيح) مقابل reserve (جولة واحدة ≤5)
// على البنك الحالي، تحت النماذج الثلاثة. لا يغيّر المنتج.
import { buildSessionData } from "../../lib/eval/engineData.ts";
import { runEvaluation } from "../../lib/eval/runEvaluation.ts";
import { RESPONSE_MODELS } from "../../lib/eval/responseModels.ts";
import { DEFAULT_RESERVE_ROUND_CONFIG } from "../../lib/adaptiveRound.ts";

const size = Number(process.argv[2] ?? 1500);
const pct = (x: number) => (x * 100).toFixed(1);
const eps = Number(process.argv[3] ?? DEFAULT_RESERVE_ROUND_CONFIG.epsilon);
for (const branch of ["علمي", "أدبي"]) {
  for (const model of RESPONSE_MODELS) {
    for (const roundMode of ["legacy", "reserve"] as const) {
      const s = runEvaluation(
        { branch, model, size, seed: 20260922 },
        buildSessionData({ roundMode, reserveConfig: { ...DEFAULT_RESERVE_ROUND_CONFIG, epsilon: eps } })
      );
      console.log(
        `${branch} ${model} ${roundMode.padEnd(7)} top1 ${pct(s.top1Accuracy)} top3 ${pct(s.top3Overlap)} recall3 ${pct(s.truthTop1InShownTop3)} ` +
          `screens ${s.meanScreens.toFixed(1)} extra ${pct(s.extraRoundRate)} silent ${pct(s.silentFailureRate)} |logcal| ${s.meanAbsLogCalibration.toFixed(2)}`
      );
    }
  }
}
