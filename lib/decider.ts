/**
 * تسجيل ميزة "حسم الحيرة" -- ترجيح بين تخصصين متقاربين عبر عدد قليل من
 * أسئلة التفضيل (وفق lib/riasec.ts: findDivergentDimensions +
 * selectQuestionsForDimensions تختاران الأبعاد والأسئلة المستهدَفة).
 *
 * الفرق الجوهري عن lib/riasec.ts's computeMajorFit: تلك الدالة تفترض متجه
 * مستخدم كامل الأبعاد الستة (من اختبار 40 سؤالاً). هنا المستخدم يجيب على
 * أسئلة بُعدين فقط -- استخدام computeMajorFit مباشرة كان سيُدخل 4 أبعاد
 * "محايدة" (50 افتراضياً) في مقارنة RMSE، فيُخفّف الفارق الحقيقي بلا مبرّر
 * ويوهم بدقة أعلى مما تسمح به 6 أسئلة فقط. الحل: مقارنة محصورة بالأبعاد
 * المُجابة فعلياً حصراً.
 */
import type { RiasecDimension, RiasecVector } from "./riasec";

export interface DimensionLean {
  dimension: RiasecDimension;
  userScore: number; // 0-100
  majorAScore: number; // 0-100 (بروفايل التخصص ×10)
  majorBScore: number; // 0-100
  /** موجب = المستخدم أقرب للتخصص أ على هذا البُعد، سالب = أقرب لـ ب، صفر = تعادل. */
  leanToA: number;
}

/** يحسب ميل كل بُعد مستهدَف على حدة -- لا يخلط بأبعاد لم تُطرَح أسئلة عنها. */
export function computeDimensionLeans(
  userVector: Record<RiasecDimension, number>,
  majorAProfile: RiasecVector,
  majorBProfile: RiasecVector,
  targetDims: RiasecDimension[]
): DimensionLean[] {
  return targetDims.map((d) => {
    const userScore = userVector[d] ?? 50;
    const majorAScore = (majorAProfile[d] ?? 0) * 10;
    const majorBScore = (majorBProfile[d] ?? 0) * 10;
    const distToA = Math.abs(userScore - majorAScore);
    const distToB = Math.abs(userScore - majorBScore);
    return { dimension: d, userScore, majorAScore, majorBScore, leanToA: distToB - distToA };
  });
}

/** "قوي"/"قاطع" ليست خياراً مطروحاً عمداً -- عدد قليل من الأسئلة (نمطياً 6)
 *  لا يبرّر أبداً الإيحاء بثقة عالية، مهما بلغ الفارق الرقمي. */
export type DeciderStrength = "weak" | "moderate";

export interface DeciderVerdict {
  leans: DimensionLean[];
  netLean: number;
  /** null = داخل نطاق التعادل الصريح -- لا ترجيح موثوق لأي طرف. */
  leaningTowardA: boolean | null;
  strength: DeciderStrength | null; // null فقط حين leaningTowardA === null
}

// نطاق leanToA النظري لكل بُعد: [-100, 100] (فرق مسافتين كل منهما 0-100).
const MAX_LEAN_PER_DIMENSION = 100;

// أقل من 10% من أقصى مدى نظري ⇒ تعادل صريح، لا ترجيح مضلِّل لفارق تافه.
const TIE_ZONE_RATIO = 0.1;

// أعلى من ثلث أقصى مدى نظري ⇒ "moderate"، غير ذلك "weak" (لكن خارج نطاق التعادل).
const MODERATE_THRESHOLD_RATIO = 1 / 3;

export function computeDeciderVerdict(leans: DimensionLean[]): DeciderVerdict {
  const netLean = leans.reduce((sum, l) => sum + l.leanToA, 0);
  const maxRange = MAX_LEAN_PER_DIMENSION * leans.length;

  if (maxRange === 0 || Math.abs(netLean) < TIE_ZONE_RATIO * maxRange) {
    return { leans, netLean, leaningTowardA: null, strength: null };
  }

  const strength: DeciderStrength = Math.abs(netLean) >= MODERATE_THRESHOLD_RATIO * maxRange ? "moderate" : "weak";
  return { leans, netLean, leaningTowardA: netLean > 0, strength };
}
