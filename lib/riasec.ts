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
  questions: RiasecQuestion[],
  /**
   * أدنى نسبة لوزن البُعد من أكبر وزن في البند كي يُحتسَب (0 = كل الأوزان،
   * السلوك الأصلي). الأوزان الثانوية الصغيرة (±2-3 بجانب 8) "تلوّث" بُعداً
   * ببنود يحرّكها بُعد آخر، فيتقلّص ذلك البُعد نحو 50 بدرجات غير متساوية بين
   * الأبعاد (تشخيص مدقّق المحاكاة C0-13) -- 0.5 مثلاً يُسقطها ويُبقي بنود
   * المقارنة المتوازنة (±7/±7) كاملة.
   */
  minLoadingShare = 0
): Record<RiasecDimension, number> {
  const raw: Record<RiasecDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const maxPossible: Record<RiasecDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const minPossible: Record<RiasecDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

  questions.forEach((q) => {
    const ans = answers[q.id] ?? 0;
    const maxLoading = Math.max(...RIASEC_DIMENSIONS.map((d) => Math.abs(q.dimensions[d] ?? 0)));
    RIASEC_DIMENSIONS.forEach((d) => {
      const w = q.dimensions[d] ?? 0;
      if (w === 0) return;
      if (Math.abs(w) < minLoadingShare * maxLoading) return;
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
export function computeMajorFit(userVector: Record<RiasecDimension, number>, majorProfile: RiasecVector): number {
  let sumSquares = 0;
  RIASEC_DIMENSIONS.forEach((d) => {
    const u = userVector[d] ?? 0;
    const m = (majorProfile[d] ?? 0) * 10; // ملفات التخصصات بمقياس 0-10
    sumSquares += (u - m) ** 2;
  });
  const rmse = Math.sqrt(sumSquares / RIASEC_DIMENSIONS.length);
  return clamp(100 - rmse, 0, 100);
}

export type FitStrategy = "level" | "shape" | "correlation" | "blend" | "asymmetric";

/**
 * وزن الفرق حين يفوق ميل الطالب ما يتطلّبه التخصص (قيمة بروفايل منخفضة =
 * "لا يحتاجه التخصص"، لا "يجب أن يكرهه الطالب"). طالب محايد (50) تجاه الفن
 * لا يُعاقَب كأنه نقيض تخصص هندسي قيمته الفنية 1.
 */
export const ASYMMETRIC_SURPLUS_WEIGHT = 0.35;

/** انحراف معياري (0-100) لمتجه الطالب يُعدّ دونه "مسطّحاً" بلا شكل تفضيلات. */
export const FLAT_PROFILE_STD = 4;

/**
 * بدائل قيد التقييم (lib/eval) لصيغة المطابقة -- "level" هي computeMajorFit
 * الحالية بالضبط. "shape" تطرح متوسط كل متجه قبل المسافة (تُلغي أثر ميل
 * الطالب العام للموافقة). "correlation" ارتباط بيرسون محوَّلاً إلى 0-100
 * (تُلغي المستوى والمدى معاً، أي أثر شدّة الإجابة أيضاً). "blend" نصف
 * level ونصف correlation.
 */
export function computeMajorFitWith(
  strategy: FitStrategy,
  userVector: Record<RiasecDimension, number>,
  majorProfile: RiasecVector
): number {
  if (strategy === "level") return computeMajorFit(userVector, majorProfile);
  if (strategy === "asymmetric") {
    let sumSquares = 0;
    RIASEC_DIMENSIONS.forEach((d) => {
      const diff = (userVector[d] ?? 0) - (majorProfile[d] ?? 0) * 10;
      sumSquares += diff > 0 ? (ASYMMETRIC_SURPLUS_WEIGHT * diff) ** 2 : diff ** 2;
    });
    return clamp(100 - Math.sqrt(sumSquares / RIASEC_DIMENSIONS.length), 0, 100);
  }
  const u = RIASEC_DIMENSIONS.map((d) => userVector[d] ?? 0);
  const m = RIASEC_DIMENSIONS.map((d) => (majorProfile[d] ?? 0) * 10);
  const uMean = u.reduce((s, x) => s + x, 0) / u.length;
  const mMean = m.reduce((s, x) => s + x, 0) / m.length;
  if (strategy === "shape") {
    const rmse = Math.sqrt(u.reduce((s, x, i) => s + (x - uMean - (m[i] - mMean)) ** 2, 0) / u.length);
    return clamp(100 - rmse, 0, 100);
  }
  const cov = u.reduce((s, x, i) => s + (x - uMean) * (m[i] - mMean), 0);
  const uVar = u.reduce((s, x) => s + (x - uMean) ** 2, 0);
  const mVar = m.reduce((s, x) => s + (x - mMean) ** 2, 0);
  // متجه طالب شبه مسطّح (إجابات محايدة تقريباً في كل الأبعاد) بلا "شكل" يُقارَن --
  // الارتباط هنا ضوضاء بحتة، فنعود لمطابقة المستوى بدل ترتيب اعتباطي.
  if (Math.sqrt(uVar / u.length) < FLAT_PROFILE_STD) return computeMajorFit(userVector, majorProfile);
  const r = uVar > 0 && mVar > 0 ? cov / Math.sqrt(uVar * mVar) : 0;
  const correlationFit = 50 * (1 + r);
  if (strategy === "correlation") return correlationFit;
  return 0.5 * computeMajorFit(userVector, majorProfile) + 0.5 * correlationFit;
}

/**
 * إعادة تصميم (2026-07-22، بناءً على تحليل الثغرات §3.2): الترتيب والتوافق
 * سؤالان مختلفان تماماً — "أي تخصص يشبهك؟" (نسبة التوافق) مقابل "ما فرص
 * هذا التخصص؟" (السوق). النسخة السابقة كانت تدمجهما في رقم واحد (السوق
 * يُرجّح الترتيب تلقائياً بحد أقصى ±7.5 نقطة)، ما دفع النظام نحو التخصصات
 * الرائجة سوقياً حتى عند تفوّق تخصص آخر في التوافق الفعلي، واضطرّ لاحقاً
 * لتعديل 17 بروفايل RIASEC يدوياً فقط لمعالجة تحيّز ترتيبي ناتج عن هذا
 * الدمج (انظر التاريخ في data/major_riasec_profiles.json — أُعيدت تلك
 * البروفايلات لقيمها النفسية الأصلية بعد هذا التغيير، لأن الحاجة لتعديلها
 * زالت جذرياً بمجرد أن توقّف السوق عن التأثير في الترتيب أصلاً).
 *
 * الآن: السوق لا يدخل الترتيب إطلاقاً افتراضياً (studentMarketWeight=0).
 * الطالب نفسه -- لا النظام -- من يقرّر عبر منزلق في الواجهة إن أراد ترجيح
 * السوق (0 = تجاهل كامل، 1 = نفس التأثير الأقصى القديم ±7.5 نقطة). هذا
 * يحوّل الانحياز من قرار خفي مُبرمَج إلى خيار واعٍ بيد الطالب.
 */
export function computeCombinedRankingScore(
  fitPercent: number,
  marketMultiplier: number,
  studentMarketWeight: number = 0
): number {
  const MAX_MARKET_INFLUENCE = 15;
  const weight = clamp(studentMarketWeight, 0, 1);
  return fitPercent + (marketMultiplier - 1) * MAX_MARKET_INFLUENCE * weight;
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

export interface DimensionGap {
  dimension: RiasecDimension;
  userScore: number;
  majorScore: number;
  /** موجب = المستخدم أعلى من التخصص، سالب = التخصص يتطلب أكثر مما يميل له المستخدم. */
  gap: number;
}

/**
 * يُرجع الأبعاد الستة كاملة (TASKS.md المهمة ٤) — لا أعلى بُعدين فقط كما
 * كان سابقاً — مرتّبة تنازلياً بالقيمة المطلقة للفارق، كي تظهر أبرز نقاط
 * الفجوة (سلباً أو إيجاباً) أولاً. الطالب يستحق معرفة أين *لا* يناسبه
 * التخصص أيضاً، لا فقط أين يتوافق معه.
 */
export function computeDimensionGaps(
  userVector: Record<RiasecDimension, number>,
  majorProfile: RiasecVector
): DimensionGap[] {
  return RIASEC_DIMENSIONS.map((d) => {
    const userScore = userVector[d] ?? 0;
    const majorScore = (majorProfile[d] ?? 0) * 10;
    return { dimension: d, userScore, majorScore, gap: userScore - majorScore };
  }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}

/**
 * يُرجع أبرز n بُعداً يُفرّقان بين ملفَّي تخصصين (الأكبر فارقاً فالأصغر) --
 * مُستخرَجة من منطق التكيّف متعددة الجولات في app/quiz/page.tsx (كان
 * مكرَّراً ضمنياً بين محرّك الاختبار الرئيسي وميزة "حسم الحيرة"، الآن مصدر
 * واحد يستخدمه كلاهما). المقياس نسبي بحت (فرق القيم كما هي، 0-10) --
 * التحجيم لا يؤثر على ترتيب التباين.
 */
export function findDivergentDimensions(profileA: RiasecVector, profileB: RiasecVector, n = 2): RiasecDimension[] {
  return [...RIASEC_DIMENSIONS]
    .sort(
      (a, b) => Math.abs((profileB[b] ?? 0) - (profileA[b] ?? 0)) - Math.abs((profileB[a] ?? 0) - (profileA[a] ?? 0))
    )
    .slice(0, n);
}

/** البُعد الأساسي لسؤال ترجيح (أعلى وزن مطلق ضمن dimensions) -- null لسؤال بلا أبعاد. */
export function primaryDimension(question: RiasecQuestion): RiasecDimension | null {
  const entries = Object.entries(question.dimensions) as [RiasecDimension, number][];
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a))[0];
}

/**
 * يختار من بنك أسئلة الترجيح ما يستهدف أبعاداً محدَّدة فقط (حسب البُعد
 * الأساسي لكل سؤال لا أي بُعد ثانوي يظهر فيه)، مع استبعاد معرّفات سبق
 * طرحها (لمنع التكرار عبر جولات/تدفقات متعددة تستخدم نفس البنك).
 */
export function selectQuestionsForDimensions(
  pool: RiasecQuestion[],
  targetDims: RiasecDimension[] | Set<RiasecDimension>,
  excludeIds?: Set<string>
): RiasecQuestion[] {
  const dims = targetDims instanceof Set ? targetDims : new Set(targetDims);
  return pool.filter((q) => {
    if (excludeIds?.has(q.id)) return false;
    const primary = primaryDimension(q);
    return primary !== null && dims.has(primary);
  });
}
