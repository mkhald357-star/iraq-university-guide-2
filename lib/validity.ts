/**
 * محرك كشف "احتمال عدم الجدّية/التلاعب" (Validity Risk Score — VRS).
 *
 * يُنتج مؤشر مخاطر واحد من تحليل نمط إجابات الاختبار مجتمعة، بدل الاعتماد
 * على زوج تناقض واحد مبرمَج يدوياً. مبني على توليف ثلاث مراجعات مستقلة
 * (قياس نفسي، كشف تحيز/تلاعب، ملاءمة ثقافية) لبنك أسئلة RIASEC — انظر
 * data/questions.json وdata/validity_questions.json وdata/contradiction_pairs.json.
 *
 * تصميمياً: هذا اختبار إرشادي يُستخدم مرة واحدة، وليس أداة فرز عالية
 * المخاطر — لذلك الخوارزمية "تنبيهية" (تُخفّض الثقة المعروضة وتقترح
 * المراجعة) لا "حاجبة" (لا تُخفي التوصية أبداً).
 */

export interface ContradictionPair {
  a: string;
  b: string;
  message: string;
}

export type ValidityRiskBand = "low" | "medium" | "high";

export interface ValidityCheckResult {
  score: number;
  band: ValidityRiskBand;
  triggeredContradictions: ContradictionPair[];
  reasons: string[];
}

const ATTENTION_CHECK_ID = "q_attention_check";
const HELP_OTHERS_ID = "q_help_others";
const HELP_OTHERS_REVERSE_ID = "q_help_others_reverse";
const LIE_SCALE_ID = "q_lie_scale";

/**
 * @param scoredAnswers إجابات الأسئلة الأربعين والاثنين المُضافين (-1/0/1)، أي كل
 *   ما ليس سؤال تحقق (validity item).
 * @param validityAnswers إجابات أسئلة التحقق الثلاثة فقط (q_attention_check،
 *   q_help_others_reverse، q_lie_scale)، بنفس مقياس -1/0/1.
 * @param timingsMs زمن الإجابة بالمللي ثانية لكل سؤال (سجلّ فارغ إن لم يُقَس).
 * @param contradictionPairs جدول أزواج التناقض المنطقي القابل للتوسعة.
 */
export function computeValidityRiskScore(
  scoredAnswers: Record<string, number>,
  validityAnswers: Record<string, number>,
  timingsMs: Record<string, number>,
  contradictionPairs: ContradictionPair[]
): ValidityCheckResult {
  const reasons: string[] = [];
  let score = 0;

  const values = Object.values(scoredAnswers);
  const n = values.length;

  // 1) كشف الإجابة المتطابقة (Straight-Lining)
  if (n > 0) {
    const counts: Record<string, number> = {};
    values.forEach((v) => {
      counts[v] = (counts[v] ?? 0) + 1;
    });
    const modeCount = Math.max(...Object.values(counts));
    const modeRatio = modeCount / n;
    if (modeRatio >= 0.85) {
      score += 3;
      reasons.push("إجابات شبه متطابقة عبر كل الأسئلة");
    } else if (modeRatio >= 0.7) {
      score += 1.5;
      reasons.push("تكرار كبير لنفس الإجابة عبر الأسئلة");
    }
  }

  // 2) مؤشر التناقض المنطقي (يشمل مفهوم "الأشكال المتوازية" أيضاً — أزواج
  //    ذات محتوى متعاكس دلالياً، لا مجرد صياغة شبه مكرَّرة)
  let ci = 0;
  const triggered: ContradictionPair[] = [];
  contradictionPairs.forEach((pair) => {
    const va = scoredAnswers[pair.a] ?? 0;
    const vb = scoredAnswers[pair.b] ?? 0;
    if (va > 0 && vb > 0) {
      ci += va * vb;
      triggered.push(pair);
    }
  });
  if (ci >= 2.5) {
    score += 2;
    reasons.push("تناقضات منطقية متعددة بين إجاباتك");
  } else if (ci >= 1.5) {
    score += 1;
    reasons.push("تناقض منطقي واحد على الأقل بين إجاباتك");
  }

  // 3) أسئلة التحقق المباشرة
  let sdScore = 0;
  const attentionVal = validityAnswers[ATTENTION_CHECK_ID];
  if (attentionVal !== undefined && attentionVal !== 0) {
    score += 4;
    reasons.push("لم تُجب كما طُلب في سؤال التحقق من الانتباه");
  }
  const helpOthers = scoredAnswers[HELP_OTHERS_ID] ?? 0;
  const helpOthersReverse = validityAnswers[HELP_OTHERS_REVERSE_ID] ?? 0;
  if (helpOthers > 0 && helpOthersReverse > 0) {
    score += 4;
    sdScore += 1;
    reasons.push("إجابتان متناقضتان منطقياً حول مساعدة الآخرين");
  }
  if ((validityAnswers[LIE_SCALE_ID] ?? 0) === 1) {
    sdScore += 1;
    reasons.push("إجابة غير واقعية إحصائياً في سؤال الصدق");
  }

  // 4) نسب الموافقة/الحياد الكلية
  const pYes = n > 0 ? values.filter((v) => v > 0).length / n : 0;
  const pNeutral = n > 0 ? values.filter((v) => v === 0).length / n : 0;
  if (pYes > 0.85) {
    score += 2;
    reasons.push("موافقة على أغلب الأسئلة تقريباً بلا تمايز واضح");
  }
  if (pNeutral > 0.7) {
    score += 1.5;
    reasons.push("ميل مفرط لإجابة \"ربما\" الحيادية");
  }
  if (sdScore >= 1 && pYes > 0.6) {
    score += 2;
    reasons.push("نمط إجابات يوحي برغبة في تقديم صورة مثالية");
  }

  // 5) الزمن (يتطلب تسجيل وقت كل إجابة من الواجهة)
  const times = Object.values(timingsMs);
  if (times.length > 0) {
    const avgMs = times.reduce((s, t) => s + t, 0) / times.length;
    if (avgMs < 1500) {
      score += 2;
      reasons.push("إجابات سريعة جداً قد لا تعكس تفكيراً كافياً بكل سؤال");
    }
  }

  let band: ValidityRiskBand = "low";
  if (score >= 6) band = "high";
  else if (score >= 3) band = "medium";

  return { score, band, triggeredContradictions: triggered, reasons };
}
