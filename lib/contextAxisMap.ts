/**
 * محور "بصمة السياق" (Context Fingerprint) -- المرحلة 3 من خطة إصلاح
 * الخوارزمية: RIASEC (والقرابة الدراسية) لا يفصلان زوجاً مثل
 * electrical_engineering/electrical_tech لأن بروفايليهما متطابقان تقريباً
 * بتصميم متعمَّد (إزاحة ±1 موثَّقة في major_riasec_profiles.json._meta).
 * هذا المحور يشتق إشارة إضافية من حقول *موثَّقة بالفعل* في
 * data/major_profiles_detailed.json (لا بيانات مؤلَّفة، ولا لمس لملف
 * RIASEC المحكوم) -- راجع scripts/build-major-context.js لاشتقاق جانب
 * التخصص، وهذا الملف لجانب الطالب فقط: كيف تُترجَم إجاباته على الأسئلة
 * الأربعين *الحالية* (بلا أي سؤال جديد) إلى نفس المحاور.
 *
 * أربعة محاور فقط، لا خمسة: `studyLength` (سنوات الدراسة) بقي جانب
 * التخصص وصفياً فقط (data/major_context_index.json) لأنه لا يوجد بين
 * الأسئلة الأربعين أي سؤال حقيقي يقيس "استعداد الطالب لعدد سنوات دراسة
 * أطول/أقصر" -- واختراع وزن لسؤال لا يقيس هذا فعلاً يخالف مبدأ المشروع
 * القاطع بعدم تأليف بيانات. الفصل بين electrical_engineering/electrical_tech
 * يتحقق عملياً عبر `appliedness` وحده (فجوة حقيقية 15 نقطة في studyNature).
 */

export const CONTEXT_AXES = ["appliedness", "quantitative", "humanContact", "fieldwork"] as const;
export type ContextAxis = (typeof CONTEXT_AXES)[number];
export type ContextVector = Record<ContextAxis, number>;

export interface ContextQuestion {
  id: string;
  contextWeights?: Partial<Record<ContextAxis, number>>;
}

/**
 * كل وزن مأخوذ مباشرة من نص السؤال الفعلي في data/questions.json (لا تخمين):
 * - appliedness: q_pure_theory_vs_applied_build (وزن سالب -- "نعم" = تفضيل
 *   نظري مجرد يعني أقل تطبيقاً)، q_hands_on، q_tangible_result، q_tinkering.
 * - quantitative: q_math_logic، q_data_patterns، q_numbers_finance.
 * - humanContact: q_people_facing، q_empathy، q_volunteering.
 * - fieldwork: q_outdoor_fieldwork، q_nature_animals.
 * كل سؤال يُحمَّل على محور واحد فقط (لا تداخل) لسهولة التدقيق والاختبار.
 */
export const CONTEXT_QUESTION_WEIGHTS: Record<string, Partial<Record<ContextAxis, number>>> = {
  q_pure_theory_vs_applied_build: { appliedness: -8 },
  q_hands_on: { appliedness: 8 },
  q_tangible_result: { appliedness: 6 },
  q_tinkering: { appliedness: 6 },

  q_math_logic: { quantitative: 8 },
  q_data_patterns: { quantitative: 5 },
  q_numbers_finance: { quantitative: 6 },

  q_people_facing: { humanContact: 8 },
  q_empathy: { humanContact: 5 },
  q_volunteering: { humanContact: 4 },

  q_outdoor_fieldwork: { fieldwork: 8 },
  q_nature_animals: { fieldwork: 5 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * يحسب متجه السياق للطالب (0-100 لكل محور) من إجاباته -- نفس منهج
 * computeUserRiasecVector بالضبط (lib/riasec.ts): تطبيع بحدود ممكنة فعلياً
 * لا ثوابت تحكيمية. أسئلة غير مُجابة تُحسَب كصفر (محايدة)، مطابقةً لسلوك
 * RIASEC، وليس هذا سؤالاً جديداً يُطرَح على الطالب -- فقط قراءة إضافية
 * لإجابات طُرحت عليه أصلاً.
 */
export function computeUserContextVector(answers: Record<string, number>, questionIds: string[]): ContextVector {
  const raw: Record<ContextAxis, number> = { appliedness: 0, quantitative: 0, humanContact: 0, fieldwork: 0 };
  const maxPossible: Record<ContextAxis, number> = { appliedness: 0, quantitative: 0, humanContact: 0, fieldwork: 0 };
  const minPossible: Record<ContextAxis, number> = { appliedness: 0, quantitative: 0, humanContact: 0, fieldwork: 0 };

  questionIds.forEach((id) => {
    const weights = CONTEXT_QUESTION_WEIGHTS[id];
    if (!weights) return;
    const ans = answers[id] ?? 0;
    CONTEXT_AXES.forEach((axis) => {
      const w = weights[axis] ?? 0;
      if (w === 0) return;
      raw[axis] += w * ans;
      maxPossible[axis] += Math.abs(w);
      minPossible[axis] += -Math.abs(w);
    });
  });

  const normalized: ContextVector = { appliedness: 50, quantitative: 50, humanContact: 50, fieldwork: 50 };
  CONTEXT_AXES.forEach((axis) => {
    const range = maxPossible[axis] - minPossible[axis];
    if (range <= 0) return; // يبقى 50 المحايد -- لا سؤال طُرح فعلياً على هذا المحور
    normalized[axis] = clamp(((raw[axis] - minPossible[axis]) / range) * 100, 0, 100);
  });

  return normalized;
}

/**
 * نسبة توافق سياقي بين متجه الطالب وبصمة التخصص (كلاهما 0-100 بالفعل، لا
 * حاجة لضرب ×10 كما في RIASEC) -- نفس منهج RMSE في computeMajorFit تماماً.
 * ملاحظة استخدام: هذا مقياس *عام* عبر المحاور الأربعة معاً -- مفيد للعرض
 * التوصيفي، لكن applyContextTieBreak (lib/recommendationEngine.ts) لا
 * يستخدمه لأن متوسط أربعة محاور يخفّف إشارة المحور الوحيد الذي يفرّق زوجاً
 * بعينه فعلياً (مثال: appliedness بين هندسة/تقنيات الكهرباء) وسط ثلاثة
 * محاور مشتركة بين التوأمين لا تحمل معلومة تمييزية أصلاً -- استُخدم بدلاً
 * منه findMostDivergentContextAxis أدناه.
 */
export function computeContextFit(userVector: ContextVector, majorVector: ContextVector): number {
  let sumSquares = 0;
  CONTEXT_AXES.forEach((axis) => {
    const u = userVector[axis] ?? 50;
    const m = majorVector[axis] ?? 50;
    sumSquares += (u - m) ** 2;
  });
  const rmse = Math.sqrt(sumSquares / CONTEXT_AXES.length);
  return clamp(100 - rmse, 0, 100);
}

/**
 * أبرز محور يفرّق بين بصمتَي تخصصين (الأكبر فارقاً) -- نفس منطق
 * findDivergentDimensions في lib/riasec.ts تماماً، مطبَّقاً على محاور
 * السياق بدل RIASEC. مصمَّم خصيصاً لزوج "توأمين" (بروفايل RIASEC شبه
 * متطابق) حيث محور واحد فقط يحمل الفارق الحقيقي (الدراسة النظرية/التطبيقية
 * عادة)، وبقية المحاور مشتركة بينهما فلا تحمل معلومة مفيدة للفصل.
 */
export function findMostDivergentContextAxis(majorA: ContextVector, majorB: ContextVector): ContextAxis {
  return [...CONTEXT_AXES].sort(
    (a, b) => Math.abs((majorB[b] ?? 50) - (majorA[b] ?? 50)) - Math.abs((majorB[a] ?? 50) - (majorA[a] ?? 50))
  )[0];
}
