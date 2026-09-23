/**
 * قوة قياس كل بُعد RIASEC من إجابات الطالب الفعلية -- أساس شرط "ضعف القياس"
 * في جولة الاحتياط، وشارة "ثقة النتيجة" في الواجهة.
 *
 * - coverage: مجموع |الوزن| للبنود المُجابة على هذا البُعد (كم سُئل عنه).
 * - evidence: مجموع |الوزن × الإجابة| -- كم أعطت الإجابات إشارة غير محايدة.
 * - consistency: نسبة البنود غير المحايدة التي تتفق إشارتها مع اتجاه البُعد
 *   الإجمالي (1 = متّسق تماماً، 0.5 = متضارب كتصويت عشوائي).
 */
import { RIASEC_DIMENSIONS, type RiasecDimension, type RiasecQuestion } from "./riasec";

export interface DimensionMeasurement {
  dimension: RiasecDimension;
  coverage: number;
  evidence: number;
  /** evidence ÷ coverage -- 0 = كل الإجابات محايدة، 1 = كلها حاسمة. */
  evidenceRatio: number;
  consistency: number;
  nonNeutralItems: number;
}

export function measureDimensions(
  answers: Record<string, number>,
  pool: RiasecQuestion[]
): Record<RiasecDimension, DimensionMeasurement> {
  const out = {} as Record<RiasecDimension, DimensionMeasurement>;
  RIASEC_DIMENSIONS.forEach((d) => {
    let coverage = 0;
    let evidence = 0;
    let net = 0;
    const signed: number[] = [];
    pool.forEach((q) => {
      const w = q.dimensions[d] ?? 0;
      if (w === 0 || !(q.id in answers)) return;
      const a = answers[q.id];
      coverage += Math.abs(w);
      evidence += Math.abs(w * a);
      net += w * a;
      if (a !== 0) signed.push(Math.sign(w * a));
    });
    const direction = Math.sign(net);
    const agreeing = direction === 0 ? signed.length / 2 : signed.filter((s) => s === direction).length;
    out[d] = {
      dimension: d,
      coverage,
      evidence,
      evidenceRatio: coverage > 0 ? evidence / coverage : 0,
      consistency: signed.length > 0 ? agreeing / signed.length : 0,
      nonNeutralItems: signed.length,
    };
  });
  return out;
}
