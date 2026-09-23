// تشغيل خط الأساس لأداة التقييم على البنك الحالي. الاستخدام:
//   node "$(node -e "console.log(require.resolve('tsx/cli'))")" scripts/eval/baseline.mts [size]
import { buildSessionData } from "../../lib/eval/engineData.ts";
import { runEvaluation } from "../../lib/eval/runEvaluation.ts";
import { RESPONSE_MODELS } from "../../lib/eval/responseModels.ts";

const size = Number(process.argv[2] ?? 2000);
const data = buildSessionData();
const pct = (x: number) => (x * 100).toFixed(1) + "%";

for (const branch of ["علمي", "أدبي", "فنون"]) {
  for (const model of RESPONSE_MODELS) {
    const s = runEvaluation({ branch, model, size, seed: 20260922 }, data);
    console.log(
      `${branch} ${model}: top1=${pct(s.top1Accuracy)} top3=${pct(s.top3Overlap)} recall3=${pct(s.truthTop1InShownTop3)} ` +
        `screens=${s.meanScreens.toFixed(1)} extra=${pct(s.extraRoundRate)} silent=${pct(s.silentFailureRate)} ` +
        `expGini=${s.exposureGini.toFixed(3)} |log cal|=${s.meanAbsLogCalibration.toFixed(3)} outOfRange=${s.calibrationOutOfRange.length}`
    );
    if (model === "linear") {
      console.log(
        "   out of [0.6,1.6]:",
        s.calibrationOutOfRange.map((e) => `${e.id}=${(e.calibration as number).toFixed(2)}`).join(", ")
      );
    }
  }
}

const styles = runEvaluation(
  {
    branch: "علمي",
    model: "linear",
    size,
    seed: 777,
    styleMix: { normal: 1, acquiescent: 1, extreme: 1, midpoint: 1, random: 1, social_desirability: 1 },
  },
  data
);
console.log("flagged by style:", JSON.stringify(styles.flaggedRateByStyle));
console.log("top1 by style:", JSON.stringify(styles.top1AccuracyByStyle));
