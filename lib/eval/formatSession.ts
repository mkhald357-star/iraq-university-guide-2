/**
 * إجابات طالب اصطناعي على بنك متعدد الأشكال (lib/itemFormats.ts) بواقعية
 * اتُّفق عليها مع مدقّق المحاكاة -- كي لا تبدو شاشات الموقف أغنى معلوماتياً
 * مما هي فعلاً:
 *
 * - ضوضاء مترابطة داخل شاشة الموقف (grid): z_صفّ = √ρ·z_شاشة + √(1-ρ)·z_مستقل.
 * - أثر انتقال: الإجابة الخام للصف تنسحب نحو إجابة الصف السابق (carry).
 * - إرهاق: مضاعِف الضوضاء 1 + fatigue × ترتيب العبارة في الجلسة.
 * - "مسطّح الشبكة": نسبة من الطلاب العاديين يعطون كل صفوف بعض الشاشات إجابة
 *   الصف الأول نفسها.
 * - pick: اختيار ثورستوني (answerPickScreen).
 *
 * الناتج بنفس شكل precomputeAnswers فيُستخدم مع runSession كما هو.
 */
import type { RiasecQuestion } from "../riasec";
import { groupScreens, type FormattedItemLike } from "../itemFormats";
import type { SimStudent } from "./population";
import type { CachedAnswers, ValidityItemLike } from "./session";
import {
  answerPickScreen,
  answerScoredItemWithNoise,
  answerTimingMs,
  answerValidityItem,
  type ResponseModel,
} from "./responseModels";
import { gaussian, type Rng } from "./random";

export interface FormatRealism {
  rho: number;
  carry: number;
  fatiguePerStatement: number;
  /** ترتيب كل عبارة في الجلسة (للإرهاق)؛ غيابه = ترتيب ظهورها في القائمة. */
  position?: Map<string, number>;
  straightLinerShare: number;
  straightLineProbability: number;
}

export const DEFAULT_FORMAT_REALISM: FormatRealism = {
  rho: 0.3,
  carry: 0.15,
  fatiguePerStatement: 0.01,
  straightLinerShare: 0.15,
  straightLineProbability: 0.5,
};

export function precomputeFormatAnswers(
  student: SimStudent,
  model: ResponseModel,
  rng: Rng,
  items: (RiasecQuestion & FormattedItemLike)[],
  validityItems: ValidityItemLike[],
  realism: FormatRealism = DEFAULT_FORMAT_REALISM
): CachedAnswers {
  const scored: Record<string, number> = {};
  const timingsMs: Record<string, number> = {};
  const straightLiner = student.style === "normal" && rng() < realism.straightLinerShare;
  const fatigue = (id: string, fallback: number) =>
    1 + realism.fatiguePerStatement * (realism.position?.get(id) ?? fallback);
  let order = 0;
  for (const screen of groupScreens(items)) {
    if (screen.format === "pick") {
      Object.assign(scored, answerPickScreen(screen.items, student, model, rng, fatigue(screen.items[0].id, order)));
      order += 1;
    } else if (screen.format === "grid") {
      const shared = gaussian(rng);
      const flat = straightLiner && rng() < realism.straightLineProbability;
      let prev: number | null = null;
      for (const q of screen.items) {
        const z = Math.sqrt(realism.rho) * shared + Math.sqrt(1 - realism.rho) * gaussian(rng);
        const v: number =
          flat && prev !== null
            ? prev
            : answerScoredItemWithNoise(q, student, model, rng, z, fatigue(q.id, order), prev, realism.carry);
        scored[q.id] = v;
        prev = v;
        order += 1;
      }
    } else {
      for (const q of screen.items) {
        scored[q.id] = answerScoredItemWithNoise(q, student, model, rng, gaussian(rng), fatigue(q.id, order));
        order += 1;
      }
    }
    // زمن لكل قرار: صفوف الموقف قرارات منفصلة، وشاشة الأقرب/الأبعد قرار واحد
    // (كما تسجّله الصفحة بعد تشخيص المدقّق C4).
    if (screen.format === "pick") timingsMs[screen.id] = answerTimingMs(student, rng);
    else for (const q of screen.items) timingsMs[q.id] = answerTimingMs(student, rng);
  }
  const validity: Record<string, number> = {};
  validityItems.forEach((v) => {
    const paired = v.validity.pairsWith ? (scored[v.validity.pairsWith] ?? 0) : 0;
    validity[v.id] = answerValidityItem(v.validity.type, student, paired, rng);
    timingsMs[v.id] = answerTimingMs(student, rng);
  });
  return { scored, validity, timingsMs };
}
