/**
 * تقييم المحرك على شخصيات طلاب مكتوبة كقصص (reports/personas/) أجاب عنها
 * وكيل منفصل بقراءة نص الأسئلة فقط، مع توقّعات مسجَّلة مسبقاً -- هذا هو
 * مقياس الصلاحية الواقعية M1 (لا يعتمد على نموذج استجابة من صنعنا)، وM2
 * (هل يتقدّم الجانب الصحيح من زوج التوأمين على نظيره).
 */
import type { SubjectGrades } from "../subjectAffinity";
import type { SimStudent } from "./population";
import { runSession, type SessionData } from "./session";

export interface Persona {
  id: string;
  branch: string;
  grade: number;
  subjectGrades?: SubjectGrades;
  expectedTop: string[];
  acceptable?: string[];
  forbidden: string[];
  twinPair?: string;
  twinSide?: "bachelor" | "technical";
}

export const TWIN_PAIRS: Record<string, { bachelor: string; technical: string }> = {
  electrical: { bachelor: "electrical_engineering", technical: "electrical_tech" },
  renewable: { bachelor: "renewable_energy", technical: "renewable_energy_tech" },
  petroleum: { bachelor: "petroleum_engineering", technical: "petroleum_refining_tech" },
  communications: { bachelor: "communications_engineering", technical: "electronics_comm_tech" },
  prosthetics: { bachelor: "prosthetics_engineering", technical: "prosthetics_tech" },
};

export interface PersonaOutcome {
  id: string;
  shown: string[];
  hitTop1: boolean;
  hitTop3: boolean;
  acceptableInTop3: boolean;
  forbiddenInTop3: string[];
  twinCorrect: boolean | null;
  screens: number;
  vrsBand: string;
}

export interface PersonaSummary {
  personas: number;
  hitTop1: number;
  hitTop3: number;
  acceptableOrExpectedTop3: number;
  forbiddenViolations: number;
  twinCorrect: number;
  twinCases: number;
  meanScreens: number;
  outcomes: PersonaOutcome[];
}

const NEUTRAL_THETA = { R: 50, I: 50, A: 50, S: 50, E: 50, C: 50 };

export function evaluatePersonas(
  personas: Persona[],
  answersByPersona: Record<string, Record<string, number>>,
  validityIds: ReadonlySet<string>,
  data: SessionData
): PersonaSummary {
  const outcomes: PersonaOutcome[] = [];
  for (const p of personas) {
    const all = answersByPersona[p.id];
    if (!all) continue;
    const validity: Record<string, number> = {};
    const timings: Record<string, number> = {};
    Object.entries(all).forEach(([id, v]) => {
      if (validityIds.has(id)) validity[id] = v;
      timings[id] = 5000;
    });
    // الحقيقة الكامنة غير معروفة للشخصيات -- θ محايد هنا فقط لتلبية التوقيع؛
    // حقول truth في النتيجة تُهمَل، والحكم يأتي من التوقّعات المسجَّلة مسبقاً.
    const student: SimStudent = {
      id: 0,
      theta: NEUTRAL_THETA,
      branch: p.branch,
      grade: p.grade,
      subjectGrades: p.subjectGrades ?? {},
      style: "normal",
      anchorMajorId: null,
    };
    const result = runSession(student, (q) => all[q.id] ?? 0, validity, timings, data);
    const expected = new Set(p.expectedTop);
    const acceptable = new Set([...p.expectedTop, ...(p.acceptable ?? [])]);
    let twinCorrect: boolean | null = null;
    if (p.twinPair && p.twinSide && TWIN_PAIRS[p.twinPair]) {
      const pair = TWIN_PAIRS[p.twinPair];
      const want = p.twinSide === "bachelor" ? pair.bachelor : pair.technical;
      const other = p.twinSide === "bachelor" ? pair.technical : pair.bachelor;
      const wi = result.rankedAll.indexOf(want);
      const oi = result.rankedAll.indexOf(other);
      twinCorrect = wi !== -1 && (oi === -1 || wi < oi);
    }
    outcomes.push({
      id: p.id,
      shown: result.shown,
      hitTop1: expected.has(result.shown[0]),
      hitTop3: result.shown.some((id) => expected.has(id)),
      acceptableInTop3: result.shown.some((id) => acceptable.has(id)),
      forbiddenInTop3: result.shown.filter((id) => p.forbidden.includes(id)),
      twinCorrect,
      screens: result.screens,
      vrsBand: result.vrsBand,
    });
  }
  const n = outcomes.length || 1;
  const twins = outcomes.filter((o) => o.twinCorrect !== null);
  return {
    personas: outcomes.length,
    hitTop1: outcomes.filter((o) => o.hitTop1).length / n,
    hitTop3: outcomes.filter((o) => o.hitTop3).length / n,
    acceptableOrExpectedTop3: outcomes.filter((o) => o.acceptableInTop3).length / n,
    forbiddenViolations: outcomes.reduce((s, o) => s + o.forbiddenInTop3.length, 0),
    twinCorrect: twins.filter((o) => o.twinCorrect).length,
    twinCases: twins.length,
    meanScreens: outcomes.reduce((s, o) => s + o.screens, 0) / n,
    outcomes,
  };
}
