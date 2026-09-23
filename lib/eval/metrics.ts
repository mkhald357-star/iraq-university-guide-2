/**
 * مقاييس أداة التقييم: الدقة مقابل الحقيقة (θ)، ومعايرة الظهور لكل تخصص
 * (يُعرض أولاً ÷ الأنسب فعلاً)، وتركّز الظهور (Gini)، وطول الاختبار،
 * والاستسلام الصامت، وكشف أنماط الاستجابة.
 */
import type { ResponseStyle, SimStudent } from "./population";
import type { SessionResult } from "./session";

export interface MajorExposure {
  id: string;
  shownFirst: number;
  trulyBest: number;
  shownTop3: number;
  /** shownFirst ÷ trulyBest -- null إن لم يكن التخصص الأنسب فعلاً لأي طالب. */
  calibration: number | null;
}

export interface EvaluationSummary {
  sessions: number;
  top1Accuracy: number;
  top3Overlap: number;
  truthTop1InShownTop3: number;
  /** نسبة طلاب "المرساة" الذين يظهر تخصص مرساتهم أولاً -- لا يعتمد على أي تعريف للحقيقة. */
  anchorTop1: number;
  meanScreens: number;
  extraRoundRate: number;
  silentFailureRate: number;
  exposureGini: number;
  meanAbsLogCalibration: number;
  calibrationOutOfRange: MajorExposure[];
  exposures: MajorExposure[];
  flaggedRateByStyle: Partial<Record<ResponseStyle, number>>;
  top1AccuracyByStyle: Partial<Record<ResponseStyle, number>>;
}

export const CALIBRATION_MIN_CASES = 30;
export const CALIBRATION_RANGE: [number, number] = [0.6, 1.6];

export function gini(values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return 0;
  const mean = v.reduce((s, x) => s + x, 0) / n;
  if (mean === 0) return 0;
  let acc = 0;
  v.forEach((x, i) => (acc += (2 * (i + 1) - n - 1) * x));
  return acc / (n * n * mean);
}

export function summarize(
  pairs: { student: SimStudent; result: SessionResult }[],
  eligibleMajorIds: string[]
): EvaluationSummary {
  const exposure = new Map<string, MajorExposure>(
    eligibleMajorIds.map((id) => [id, { id, shownFirst: 0, trulyBest: 0, shownTop3: 0, calibration: null }])
  );
  let top1 = 0;
  let top3 = 0;
  let recall3 = 0;
  let anchored = 0;
  let anchorHits = 0;
  let screens = 0;
  let extra = 0;
  let silent = 0;
  const styleCount: Partial<Record<ResponseStyle, number>> = {};
  const styleFlagged: Partial<Record<ResponseStyle, number>> = {};
  const styleTop1: Partial<Record<ResponseStyle, number>> = {};

  for (const { student, result } of pairs) {
    const [shown1] = result.shown;
    const [truth1] = result.truth;
    const correct = shown1 === truth1;
    if (correct) top1++;
    const truthSet = new Set(result.truth);
    if (result.shown.filter((id) => truthSet.has(id)).length >= 2) top3++;
    if (result.shown.includes(truth1)) recall3++;
    if (student.anchorMajorId) {
      anchored++;
      if (shown1 === student.anchorMajorId) anchorHits++;
    }
    screens += result.screens;
    if (result.extraQuestions > 0) extra++;
    if (result.silentFailure) silent++;

    if (shown1 && exposure.has(shown1)) exposure.get(shown1)!.shownFirst++;
    if (truth1 && exposure.has(truth1)) exposure.get(truth1)!.trulyBest++;
    result.shown.forEach((id) => exposure.get(id) && exposure.get(id)!.shownTop3++);

    styleCount[student.style] = (styleCount[student.style] ?? 0) + 1;
    if (result.vrsBand !== "low") styleFlagged[student.style] = (styleFlagged[student.style] ?? 0) + 1;
    if (correct) styleTop1[student.style] = (styleTop1[student.style] ?? 0) + 1;
  }

  const n = pairs.length || 1;
  const exposures = [...exposure.values()].map((e) => ({
    ...e,
    calibration: e.trulyBest > 0 ? e.shownFirst / e.trulyBest : null,
  }));
  const calibrated = exposures.filter((e) => e.trulyBest >= CALIBRATION_MIN_CASES && e.calibration !== null);

  const ratio = (num: Partial<Record<ResponseStyle, number>>) =>
    Object.fromEntries(
      (Object.keys(styleCount) as ResponseStyle[]).map((s) => [s, (num[s] ?? 0) / (styleCount[s] ?? 1)])
    ) as Partial<Record<ResponseStyle, number>>;

  return {
    sessions: pairs.length,
    top1Accuracy: top1 / n,
    top3Overlap: top3 / n,
    truthTop1InShownTop3: recall3 / n,
    anchorTop1: anchored ? anchorHits / anchored : 0,
    meanScreens: screens / n,
    extraRoundRate: extra / n,
    silentFailureRate: silent / n,
    exposureGini: gini(exposures.map((e) => e.shownTop3)),
    // |log| لا الفرق الخام -- نسبة 0.5 ونسبة 2 انحرافان متساويان في الحجم
    meanAbsLogCalibration:
      calibrated.reduce((s, e) => s + Math.abs(Math.log(Math.max(e.calibration as number, 1e-3))), 0) /
      (calibrated.length || 1),
    calibrationOutOfRange: calibrated
      .filter((e) => (e.calibration as number) < CALIBRATION_RANGE[0] || (e.calibration as number) > CALIBRATION_RANGE[1])
      .sort((a, b) => (a.calibration as number) - (b.calibration as number)),
    exposures,
    flaggedRateByStyle: ratio(styleFlagged),
    top1AccuracyByStyle: ratio(styleTop1),
  };
}
