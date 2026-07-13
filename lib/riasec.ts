/**
 * محرك تسجيل قائم على نموذج Holland Code (RIASEC) — إطار مهني معتمد
 * عالمياً (مستخدم في O*NET وBigFuture وغيرها) يقيس ستة أبعاد شخصية/مهنية:
 * الواقعي (R)، الاستقصائي (I)، الفني (A)، الاجتماعي (S)، المقاولاتي (E)،
 * التقليدي (C). يحل محل نظام الأوزان اليدوية القديم (وزن مباشر لكل سؤال
 * تجاه كل تخصص)، الذي كان صعب الصيانة وغير قابل للتفسير للمستخدم.
 */

export type RiasecDimension = "R" | "I" | "A" | "S" | "E" | "C";

export const RIASEC_DIMENSIONS: RiasecDimension[] = ["R", "I", "A", "S", "E", "C"];

export const RIASEC_LABELS: Record<RiasecDimension, string> = {
  R: "الواقعي/العملي",
  I: "الاستقصائي/التحليلي",
  A: "الفني/الإبداعي",
  S: "الاجتماعي/الخدمي",
  E: "المقاولاتي/القيادي",
  C: "التقليدي/المنظّم",
};

export type RiasecVector = Partial<Record<RiasecDimension, number>>;

export interface RiasecQuestion {
  id: string;
  text: string;
  dimensions: RiasecVector;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * يحسب متجه سمات المستخدم (0-100 لكل بُعد) من إجاباته على أسئلة الاختبار.
 * كل سؤال يُساهم بوزنه (موجب أو سالب) مضروباً بقيمة الإجابة (1 لنعم،
 * 0.5 لربما، -1 للا). التطبيع (0-100) يعتمد على أقصى وأدنى قيمة ممكنة
 * فعلياً لكل بُعد بناءً على الأسئلة المُجابة، وليس على ثوابت تحكيمية.
 */
export function computeUserRiasecVector(
  answers: Record<string, number>,
  questions: RiasecQuestion[]
): Record<RiasecDimension, number> {
  const raw: Record<RiasecDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const maxPossible: Record<RiasecDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const minPossible: Record<RiasecDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

  questions.forEach((q) => {
    const ans = answers[q.id] ?? 0;
    RIASEC_DIMENSIONS.forEach((d) => {
      const w = q.dimensions[d] ?? 0;
      if (w === 0) return;
      raw[d] += w * ans;
      // بغض النظر عن إشارة الوزن، أقصى مساهمة ممكنة لسؤال واحد هي |w|
      // (عند الإجابة الأكثر توافقاً معه) وأدناها -|w| (عند الإجابة المعاكسة).
      maxPossible[d] += Math.abs(w);
      minPossible[d] += -Math.abs(w);
    });
  });

  const normalized: Record<RiasecDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  RIASEC_DIMENSIONS.forEach((d) => {
    const range = maxPossible[d] - minPossible[d];
    if (range <= 0) {
      normalized[d] = 50;
      return;
    }
    normalized[d] = clamp(((raw[d] - minPossible[d]) / range) * 100, 0, 100);
  });

  return normalized;
}

/**
 * يحسب نسبة توافق التخصص مع متجه المستخدم عبر مسافة الجذر التربيعي لمتوسط
 * مربعات الفروق (RMSE) بين البُعدين، محوّلة إلى نسبة مئوية (100 = تطابق
 * تام، 0 = تعاكس تام). مقياس بسيط وواضح للتفسير، ويتفادى مشكلة "المتجه
 * الصفري" التي تظهر مع مقاييس التشابه الجيبي (cosine) عند إجابات متطرفة.
 */
export function computeMajorFit(
  userVector: Record<RiasecDimension, number>,
  majorProfile: RiasecVector
): number {
  let sumSquares = 0;
  RIASEC_DIMENSIONS.forEach((d) => {
    const u = userVector[d] ?? 0;
    const m = (majorProfile[d] ?? 0) * 10; // ملفات التخصصات بمقياس 0-10
    sumSquares += (u - m) ** 2;
  });
  const rmse = Math.sqrt(sumSquares / RIASEC_DIMENSIONS.length);
  return clamp(100 - rmse, 0, 100);
}

/**
 * يدمج نسبة التوافق الشخصي مع معامل طلب السوق لأغراض الترتيب فقط (لا
 * يُعرض هذا الرقم مباشرة للمستخدم — نسبة التوافق الحقيقية تُعرض منفصلة).
 * السوق يُستخدم كمرجّح إضافي بسيط (±7.5 نقطة كحد أقصى ضمن مدى المضاعفات
 * الفعلي 0.5-1.5) وليس كضرب مباشر بالنسبة، تحديداً لمنع تخصص "رائج" لكنه
 * ضعيف التوافق (مثال: هندسة برمجيات لطالب واقعي/يدوي بامتياز) من التفوق
 * على تخصص أعلى توافقاً فعلياً بفارق كبير لمجرد ارتفاع الطلب عليه في
 * السوق. القيمة 15 معايرة يدوياً بحيث لا يقلب ترتيب فارق توافق حقيقي
 * يتجاوز ~15 نقطة مئوية، لكنها تبقى مؤثرة كفاصل عند تقارب درجات التوافق.
 */
export function computeCombinedRankingScore(fitPercent: number, marketMultiplier: number): number {
  const MARKET_INFLUENCE = 15;
  return fitPercent + (marketMultiplier - 1) * MARKET_INFLUENCE;
}

/** يُرجع أعلى n أبعاد لدى المستخدم مرتّبة تنازلياً، لعرضها كتفسير للنتيجة. */
export function topDimensions(
  userVector: Record<RiasecDimension, number>,
  n = 2
): { dimension: RiasecDimension; score: number }[] {
  return RIASEC_DIMENSIONS.map((d) => ({ dimension: d, score: userVector[d] ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
