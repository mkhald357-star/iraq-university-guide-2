/**
 * قابلية الوصول: لكل تخصص ولكل مركز (1، 2، 3) -- هل توجد ورقة إجابات
 * متّسقة (نطاق VRS "low") تضعه في ذلك المركز بالضبط عبر خط المنتج الكامل؟
 * بحث تسلّق تلّ بإعادة تشغيل عشوائية، يبدأ من إجابات "الطالب المثالي"
 * لذلك التخصص (θ = البروفايل × 10، بلا ضوضاء). تخصص لا يمكن إيصاله لمركزٍ
 * ما مهما كانت الإجابات = انحياز بنيوي في المحرك.
 */
import type { RiasecQuestion } from "../riasec";
import { groupScreens, pickAnswers, type FormattedItemLike } from "../itemFormats";
import type { SimStudent } from "./population";
import { ANSWER_LEVELS, itemSignal, quantize } from "./responseModels";
import { runSession, type SessionData, type ValidityItemLike } from "./session";
import { clamp, type Rng } from "./random";

export interface ReachabilityCell {
  majorId: string;
  position: number;
  reached: boolean;
  bestRank: number;
}

// خيارات شاشة pick تُجاب دائماً كورقة صالحة: أقرب واحد (+1) وأبعد واحد (−1).
function pickScreensOf(pool: RiasecQuestion[]): RiasecQuestion[][] {
  return groupScreens(pool as (RiasecQuestion & FormattedItemLike)[])
    .filter((s) => s.format === "pick")
    .map((s) => s.items);
}

function idealAnswers(pool: RiasecQuestion[], theta: SimStudent["theta"]): Record<string, number> {
  const out: Record<string, number> = {};
  pool.forEach((q) => (out[q.id] = quantize(clamp(1.6 * itemSignal(q, theta), -1, 1))));
  pickScreensOf(pool).forEach((options) => {
    const sorted = [...options].sort((a, b) => itemSignal(b, theta) - itemSignal(a, theta));
    Object.assign(
      out,
      pickAnswers(
        options.map((o) => o.id),
        sorted[0].id,
        sorted[sorted.length - 1].id
      )
    );
  });
  return out;
}

function randomPick(options: RiasecQuestion[], rng: Rng): Record<string, number> {
  const ids = options.map((o) => o.id);
  const most = ids[Math.floor(rng() * ids.length)];
  const rest = ids.filter((id) => id !== most);
  return pickAnswers(ids, most, rest[Math.floor(rng() * rest.length)]);
}

function coherentValidity(validityItems: ValidityItemLike[], answers: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  validityItems.forEach((v) => {
    if (v.validity.type === "instructed") out[v.id] = 0;
    else if (v.validity.type === "lie_scale") out[v.id] = -1;
    else out[v.id] = -(answers[v.validity.pairsWith ?? ""] ?? 0);
  });
  return out;
}

export function searchReachability(
  majorId: string,
  position: number,
  branch: string,
  grade: number,
  data: SessionData,
  pool: RiasecQuestion[],
  rng: Rng,
  opts: { restarts?: number; iterations?: number } = {}
): ReachabilityCell {
  const profile = data.riasecProfiles[majorId] ?? {};
  const theta = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 } as SimStudent["theta"];
  (Object.keys(theta) as (keyof typeof theta)[]).forEach((d) => (theta[d] = (profile[d] ?? 0) * 10));
  const student: SimStudent = {
    id: 0,
    theta,
    branch,
    grade,
    subjectGrades: {},
    style: "normal",
    anchorMajorId: majorId,
  };
  const timings: Record<string, number> = {};
  [...pool, ...data.validityItems].forEach((q) => (timings[q.id] = 5000));

  const score = (answers: Record<string, number>) => {
    const validity = coherentValidity(data.validityItems, answers);
    const r = runSession(student, (q) => answers[q.id] ?? 0, validity, timings, data);
    const rank = r.rankedAll.indexOf(majorId) + 1;
    if (rank === 0) return { cost: Infinity, rank: Infinity, coherent: false };
    const coherent = r.vrsBand === "low";
    return { cost: Math.abs(rank - position) + (coherent ? 0 : 0.5), rank, coherent };
  };

  const base = idealAnswers(pool, theta);
  const pickScreens = pickScreensOf(pool);
  const pickOf = new Map(pickScreens.flatMap((options) => options.map((o) => [o.id, options] as const)));
  let bestRank = Infinity;
  const restarts = opts.restarts ?? 4;
  const iterations = opts.iterations ?? 250;
  for (let restart = 0; restart < restarts; restart++) {
    const answers = { ...base };
    if (restart > 0) {
      pool.forEach((q) => {
        if (!pickOf.has(q.id) && rng() < 0.25) answers[q.id] = ANSWER_LEVELS[Math.floor(rng() * ANSWER_LEVELS.length)];
      });
      pickScreens.forEach((options) => rng() < 0.25 && Object.assign(answers, randomPick(options, rng)));
    }
    let current = score(answers);
    if (current.coherent && Math.abs(current.rank - position) < Math.abs(bestRank - position)) bestRank = current.rank;
    if (current.cost === 0) return { majorId, position, reached: true, bestRank: current.rank };
    for (let it = 0; it < iterations; it++) {
      const q = pool[Math.floor(rng() * pool.length)];
      const options = pickOf.get(q.id);
      const previous = options
        ? Object.fromEntries(options.map((o) => [o.id, answers[o.id]]))
        : { [q.id]: answers[q.id] };
      if (options) Object.assign(answers, randomPick(options, rng));
      else {
        const next = ANSWER_LEVELS[Math.floor(rng() * ANSWER_LEVELS.length)];
        if (next === answers[q.id]) continue;
        answers[q.id] = next;
      }
      const trial = score(answers);
      if (trial.cost <= current.cost) {
        current = trial;
        if (trial.coherent && Math.abs(trial.rank - position) < Math.abs(bestRank - position)) bestRank = trial.rank;
        if (trial.cost === 0) return { majorId, position, reached: true, bestRank: trial.rank };
      } else {
        Object.assign(answers, previous);
      }
    }
  }
  return { majorId, position, reached: false, bestRank };
}
