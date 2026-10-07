/**
 * نماذج إجابة الطالب الاصطناعي على بند واحد (مقياس 5 نقاط). ثلاثة نماذج
 * مختلفة الشكل عمداً -- أي إصلاح يجب أن يصمد تحتها كلها، كي لا نفصّل
 * المحرك على افتراض واحد عن كيف يجيب الطلاب.
 */
import { RIASEC_DIMENSIONS, primaryDimension, type RiasecDimension, type RiasecQuestion } from "../riasec";
import type { ResponseStyle, SimStudent } from "./population";
import { clamp, gaussian, type Rng } from "./random";

export type ResponseModel = "linear" | "graded" | "ideal_point";
export const RESPONSE_MODELS: ResponseModel[] = ["linear", "graded", "ideal_point"];

export const ANSWER_LEVELS = [-1, -0.5, 0, 0.5, 1] as const;

export function quantize(x: number): number {
  let best: number = ANSWER_LEVELS[0];
  for (const level of ANSWER_LEVELS) if (Math.abs(level - x) < Math.abs(best - x)) best = level;
  return best;
}

/** إسقاط θ على اتجاه البند: -1 (معاكس تماماً) .. +1 (منسجم تماماً). */
export function itemSignal(item: Pick<RiasecQuestion, "dimensions">, theta: Record<RiasecDimension, number>): number {
  let s = 0;
  let total = 0;
  RIASEC_DIMENSIONS.forEach((d) => {
    const w = item.dimensions[d] ?? 0;
    s += w * ((theta[d] - 50) / 50);
    total += Math.abs(w);
  });
  return total > 0 ? clamp(s / total, -1, 1) : 0;
}

const GAIN = 1.6;
const NOISE = 0.35;
const GRADED_THRESHOLDS = [-1.2, -0.4, 0.4, 1.2];
const GRADED_DISCRIMINATION = 2.5;
const IDEAL_POINT_LOCATION = 0.6;
const IDEAL_POINT_SLOPE = 1.6;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function continuousResponse(model: ResponseModel, s: number, rng: Rng): number | { level: number } {
  if (model === "linear") return GAIN * s + NOISE * gaussian(rng);
  if (model === "ideal_point")
    return 1 - IDEAL_POINT_SLOPE * Math.abs(s - IDEAL_POINT_LOCATION) + NOISE * gaussian(rng);
  // graded response: P(level >= k) منحدر لوجستي لكل عتبة
  const u = rng();
  let index = 0;
  GRADED_THRESHOLDS.forEach((b, k) => {
    if (u < sigmoid(GRADED_DISCRIMINATION * (GAIN * s - b))) index = k + 1;
  });
  return { level: ANSWER_LEVELS[index] };
}

function applyStyle(style: ResponseStyle, x: number, item: Pick<RiasecQuestion, "dimensions">, rng: Rng): number {
  switch (style) {
    case "acquiescent":
      return x + 0.6;
    case "extreme":
      return Math.abs(x) > 0.15 ? Math.sign(x) : x;
    case "midpoint":
      return x * 0.35;
    case "random":
      return ANSWER_LEVELS[Math.floor(rng() * ANSWER_LEVELS.length)];
    case "social_desirability": {
      const primary = primaryDimension(item as RiasecQuestion);
      return primary === "S" || primary === "C" ? x + 0.4 : x;
    }
    default:
      return x;
  }
}

export function answerScoredItem(
  item: Pick<RiasecQuestion, "dimensions">,
  student: SimStudent,
  model: ResponseModel,
  rng: Rng
): number {
  const s = itemSignal(item, student.theta);
  const raw = continuousResponse(model, s, rng);
  const x = typeof raw === "number" ? raw : raw.level;
  return quantize(clamp(applyStyle(student.style, x, item, rng), -1, 1));
}

function normalCdf(z: number): number {
  // تقريب Zelen-Severo (خطأ < 7.5e-8)
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * إجابة على عبارة بضوضاء معيارية z يمرّرها المستدعي (لربط ضوضاء صفوف شاشة
 * الموقف ببعضها) ومضاعِف ضوضاء (الإرهاق). z مستقل و noiseScale=1 يطابقان
 * توزيع answerScoredItem. carryFrom: إجابة الصفّ السابق في نفس الشاشة
 * (أثر الانتقال) -- تسحب الإجابة الخام نحوها بمعامل carry.
 */
export function answerScoredItemWithNoise(
  item: Pick<RiasecQuestion, "dimensions">,
  student: SimStudent,
  model: ResponseModel,
  rng: Rng,
  z: number,
  noiseScale = 1,
  carryFrom: number | null = null,
  carry = 0
): number {
  const s = itemSignal(item, student.theta);
  let x: number;
  if (model === "linear") x = GAIN * s + NOISE * noiseScale * z;
  else if (model === "ideal_point")
    x = 1 - IDEAL_POINT_SLOPE * Math.abs(s - IDEAL_POINT_LOCATION) + NOISE * noiseScale * z;
  else {
    const u = normalCdf(z);
    let index = 0;
    GRADED_THRESHOLDS.forEach((b, k) => {
      if (u < sigmoid((GRADED_DISCRIMINATION / noiseScale) * (GAIN * s - b))) index = k + 1;
    });
    x = ANSWER_LEVELS[index];
  }
  if (carryFrom !== null && carry > 0) x = (1 - carry) * x + carry * carryFrom;
  return quantize(clamp(applyStyle(student.style, x, item, rng), -1, 1));
}

/**
 * اختيار "الأقرب/الأبعد" بين خيارات شاشة pick (نموذج ثورستوني): منفعة كل
 * خيار = الاستجابة الكامنة لنموذج الإجابة نفسه + ضوضاء مستقلة؛ الأقرب =
 * الأعلى منفعةً، الأبعد = الأدنى. نمط العشوائي يختار عشوائياً؛ الموافقة
 * التلقائية والتطرّف والحياد لا أثر لها على اختيار نسبي؛ المرغوبية
 * الاجتماعية ترفع خيارات S/C كما في البنود العادية.
 */
export function answerPickScreen(
  options: Pick<RiasecQuestion, "id" | "dimensions">[],
  student: SimStudent,
  model: ResponseModel,
  rng: Rng,
  noiseScale = 1
): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(options.map((o) => [o.id, 0]));
  if (student.style === "random") {
    const order = options.map((o) => o.id).sort(() => rng() - 0.5);
    out[order[0]] = 1;
    out[order[1]] = -1;
    return out;
  }
  const utility = options.map((o) => {
    const s = itemSignal(o, student.theta);
    let u = model === "ideal_point" ? 1 - IDEAL_POINT_SLOPE * Math.abs(s - IDEAL_POINT_LOCATION) : GAIN * s;
    u += NOISE * noiseScale * gaussian(rng) * (model === "graded" ? 1.25 : 1);
    if (student.style === "social_desirability") {
      const primary = primaryDimension(o as RiasecQuestion);
      if (primary === "S" || primary === "C") u += 0.4;
    }
    return { id: o.id, u };
  });
  utility.sort((a, b) => b.u - a.u);
  out[utility[0].id] = 1;
  out[utility[utility.length - 1].id] = -1;
  return out;
}

/** إجابات أسئلة التحقق الثلاثة حسب نمط الاستجابة (لا تمرّ على θ). */
export function answerValidityItem(
  validityType: "instructed" | "reverse_twin" | "lie_scale",
  student: SimStudent,
  pairedAnswer: number,
  rng: Rng
): number {
  const r = rng();
  switch (student.style) {
    case "random":
      return ANSWER_LEVELS[Math.floor(rng() * ANSWER_LEVELS.length)];
    case "midpoint":
      return 0;
    case "acquiescent":
      if (validityType === "instructed") return r < 0.5 ? 0.5 : 0;
      return validityType === "lie_scale" ? 0.5 : r < 0.5 ? 1 : 0.5;
    case "social_desirability":
      if (validityType === "lie_scale") return 1;
      if (validityType === "reverse_twin") return -1;
      return 0;
    case "extreme":
      if (validityType === "instructed") return r < 0.8 ? 0 : r < 0.9 ? 1 : -1;
      if (validityType === "lie_scale") return -1;
      return pairedAnswer === 0 ? 0 : -Math.sign(pairedAnswer);
    default:
      if (validityType === "instructed") return r < 0.95 ? 0 : r < 0.975 ? 0.5 : -0.5;
      if (validityType === "lie_scale") return r < 0.6 ? -1 : -0.5;
      return quantize(clamp(-pairedAnswer + 0.25 * gaussian(rng), -1, 1));
  }
}

/** زمن الإجابة (ملّي ثانية) -- المتعجّل العشوائي أسرع بوضوح من البقية. */
export function answerTimingMs(student: SimStudent, rng: Rng): number {
  if (student.style === "random") return Math.round(900 + rng() * 700);
  return Math.round(3000 + rng() * 6000);
}
