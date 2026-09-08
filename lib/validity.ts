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

export interface ScoredQuestionLike {
  id: string;
  dimensions: Partial<Record<string, number>>;
}

/**
 * اتساق الإجابات داخل كل بُعد: طالب بميل حقيقي في بُعد ما يُجيب أسئلة ذلك
 * البُعد بنفس الاتجاه غالباً (تصويت متفق)؛ ضجيج عشوائي بحت ينتج تصويتاً
 * شبه متساوٍ (نصفه موافق ونصفه معارض) داخل نفس البُعد رغم عدم "الخط
 * المستقيم" (mode_ratio) ولا "الموافقة المفرطة" (p_yes) — هذا هو تحديداً
 * النمط الذي أفلت من الكشف في نحو نصف محاكاة "الطالب العشوائي البحت"
 * أثناء اختبار المنصة (يعتمد آنذاك على سؤال تحقق واحد فقط، فرصة كشفه
 * بالصدفة 1/3). يُرجع رقماً بين 0 (تصويت عشوائي تماماً داخل كل بُعد) و1
 * (اتساق تام) — متوسط على كل الأبعاد التي تملك 3 أسئلة على الأقل.
 */
function computeDimensionConsistency(scoredAnswers: Record<string, number>, questions: ScoredQuestionLike[]): number {
  const votes: Record<string, number[]> = {};
  questions.forEach((q) => {
    const ans = scoredAnswers[q.id];
    if (ans === undefined || ans === 0) return;
    Object.entries(q.dimensions).forEach(([dim, w]) => {
      if (!w) return;
      votes[dim] ??= [];
      votes[dim].push(ans * Math.sign(w));
    });
  });
  const consistencies: number[] = [];
  Object.values(votes).forEach((v) => {
    if (v.length < 3) return;
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    consistencies.push(Math.abs(mean));
  });
  if (consistencies.length === 0) return 1;
  return consistencies.reduce((s, x) => s + x, 0) / consistencies.length;
}

/**
 * @param scoredAnswers إجابات كل الأسئلة المُسجَّلة على RIASEC، أي كل ما ليس
 *   سؤال تحقق (validity item). مقياس خمس نقاط: -1/-0.5/0/0.5/1 (مرحلة
 *   ترقية الإجابة من 3 إلى 5 نقاط، 2026-09) -- كل الإشارات أدناه مُصمَّمة
 *   لتُعيد حرفياً نفس نتيجة مقياس 3 نقاط الأصلي متى وردت قيم -1/0/1 فقط،
 *   فلا تنحدر أي معايرة قائمة.
 * @param validityAnswers إجابات أسئلة التحقق الثلاثة فقط (q_attention_check،
 *   q_help_others_reverse، q_lie_scale)، بنفس المقياس.
 * @param timingsMs زمن الإجابة بالمللي ثانية لكل سؤال (سجلّ فارغ إن لم يُقَس).
 * @param contradictionPairs جدول أزواج التناقض المنطقي القابل للتوسعة.
 * @param questions بيانات أبعاد الأسئلة المُسجَّلة (اختياري) — إن مُرِّرت
 *   يُفعَّل فحص اتساق الإجابات داخل كل بُعد (انظر computeDimensionConsistency).
 */
export function computeValidityRiskScore(
  scoredAnswers: Record<string, number>,
  validityAnswers: Record<string, number>,
  timingsMs: Record<string, number>,
  contradictionPairs: ContradictionPair[],
  questions?: ScoredQuestionLike[]
): ValidityCheckResult {
  const reasons: string[] = [];
  let score = 0;

  const values = Object.values(scoredAnswers);
  const n = values.length;

  // 1) كشف الإجابة المتطابقة (Straight-Lining) -- عتبات مُعاد معايرتها لمقياس
  // الخمس نقاط (كانت 0.85/0.70 لمقياس 3 نقاط): بخمس قيم أدقّ، تطابق عشوائي
  // بالصدفة على نفس القيمة الحرفية أقل احتمالاً من مقياس 3 نقاط، فيمكن خفض
  // العتبة قليلاً دون زيادة الإيجابيات الكاذبة -- بينما إجابة متكررة فعلياً
  // (نقرة واحدة متكررة بصرف النظر عن عدد الأزرار) تبقى مكتشَفة بلا تغيير.
  if (n > 0) {
    const counts: Record<string, number> = {};
    values.forEach((v) => {
      counts[v] = (counts[v] ?? 0) + 1;
    });
    const modeCount = Math.max(...Object.values(counts));
    const modeRatio = modeCount / n;
    if (modeRatio >= 0.8) {
      score += 3;
      reasons.push("إجابات شبه متطابقة عبر كل الأسئلة");
    } else if (modeRatio >= 0.65) {
      score += 1.5;
      reasons.push("تكرار كبير لنفس الإجابة عبر الأسئلة");
    }
  }

  // 1-ب) نمط الميل الشديد لأطراف المقياس -- إشارة جديدة لا يمكن قياسها على
  // مقياس 3 نقاط أصلاً (كل إجابة غير محايدة كانت طرفية بالتعريف). طالب يختار
  // "أوافق بشدة"/"لا أوافق إطلاقاً" في كل الأسئلة تقريباً، بلا أي درجة
  // متوسطة، نمط استجابة معروف نفسياً (extreme response style) يستحق تنبيهاً
  // مستقلاً عن الخط المستقيم (قد تتنوّع الإجابات طرفياً بين نعم/لا بشدة دون
  // أي تكرار حرفي يُثير modeRatio).
  if (n > 0) {
    const pExtreme = values.filter((v) => Math.abs(v) === 1).length / n;
    if (pExtreme > 0.9) {
      score += 1;
      reasons.push("ميل شديد لأقصى طرفي مقياس الإجابة في كل الأسئلة تقريباً، بلا أي إجابة وسيطة");
    }
  }

  // 2) مؤشر التناقض المنطقي (يشمل مفهوم "الأشكال المتوازية" أيضاً — أزواج
  //    ذات محتوى متعاكس دلالياً، لا مجرد صياغة شبه مكرَّرة)
  //
  //    الإصدار السابق كان يُسقِّف المساهمة عند +2 بصرف النظر عن عدد الأزواج
  //    المُفعَّلة فعلياً (حتى 5 من 5!) — رُصد فعلياً أثناء محاكاة طالب
  //    متناقض عمداً على كل الأزواج الخمسة أن هذا يُصنَّف "low risk" في 40%
  //    من الحالات رغم تحذير الطالب بكل الرسائل الخمس على الشاشة. الإصلاح:
  //    التصعيد يتناسب مع عدد الأزواج المُفعَّلة فعلاً، بحيث يكفي تناقضان
  //    وحدهما لبلوغ "medium"، وأربعة فأكثر وحدها لبلوغ "high".
  const triggered: ContradictionPair[] = contradictionPairs.filter((pair) => {
    const va = scoredAnswers[pair.a] ?? 0;
    const vb = scoredAnswers[pair.b] ?? 0;
    // >= 0.5 صريحاً (لا > 0 كما كان) -- على مقياس القيم المسموحة
    // {-1,-0.5,0,0.5,1} كلاهما يلتقط بالضبط نفس المجموعة {0.5,1}، فهذا
    // توضيح للنيّة لا تغيير سلوكي.
    return va >= 0.5 && vb >= 0.5;
  });
  if (triggered.length >= 4) {
    score += 6;
    reasons.push("تناقضات منطقية متعددة وقوية بين إجاباتك");
  } else if (triggered.length >= 2) {
    score += 3;
    reasons.push("تناقضات منطقية متعددة بين إجاباتك");
  } else if (triggered.length === 1) {
    score += 1;
    reasons.push("تناقض منطقي واحد بين إجاباتك");
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
  if (helpOthers >= 0.5 && helpOthersReverse >= 0.5) {
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
    reasons.push('ميل مفرط لإجابة "ربما" الحيادية');
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

  // 6) اتساق الإجابات داخل كل بُعد — يكشف الضجيج العشوائي البحت الذي لا
  // يُنتج "خطاً مستقيماً" ولا موافقة/حياداً مفرطاً (المكوّنان 1 و4 أعلاه)
  // فيفلت منهما، ولا يعتمد على سؤال تحقق واحد فرصة كشفه بالصدفة 1/3 فقط.
  if (questions && questions.length > 0) {
    const consistency = computeDimensionConsistency(scoredAnswers, questions);
    if (consistency < 0.15) {
      score += 3;
      reasons.push("إجاباتك داخل نفس البُعد غير متسقة بشكل ملحوظ (نمط قد يوحي بعدم قراءة الأسئلة بعناية)");
    }
  }

  let band: ValidityRiskBand = "low";
  if (score >= 6) band = "high";
  else if (score >= 3) band = "medium";

  return { score, band, triggeredContradictions: triggered, reasons };
}
