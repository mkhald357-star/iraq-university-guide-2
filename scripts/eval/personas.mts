// تقييم الشخصيات المؤلَّفة (M1/M2) على بنك أسئلة معيّن.
//   node "$(node -e "console.log(require.resolve('tsx/cli'))")" scripts/eval/personas.mts \
//        [--answers=reports/personas/answers-round1.json] [--core=reports/short-form/selection.json] [--mode=legacy|reserve]
import fs from "fs";
import { buildSessionData, REAL_CORE_QUESTIONS, REAL_TIEBREAKER_QUESTIONS, REAL_VALIDITY_ITEMS } from "../../lib/eval/engineData.ts";
import { evaluatePersonas, type Persona } from "../../lib/eval/personaEval.ts";
import type { RiasecQuestion } from "../../lib/riasec.ts";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);
const personas = JSON.parse(fs.readFileSync("reports/personas/narratives.json", "utf8")) as Persona[];
const answers = JSON.parse(fs.readFileSync(String(args.answers ?? "reports/personas/answers-round1.json"), "utf8"));
// --pool: بنك مرشَّح مُراجَع (نصوص جديدة) -- يُقرَن بإجابات الجولة الثانية
const pool: RiasecQuestion[] = args.pool
  ? JSON.parse(fs.readFileSync(String(args.pool), "utf8"))
  : [...REAL_CORE_QUESTIONS, ...REAL_TIEBREAKER_QUESTIONS];
const byId = new Map(pool.map((q) => [q.id, q]));

let core = REAL_CORE_QUESTIONS;
if (args.core) {
  const sel = JSON.parse(fs.readFileSync(String(args.core), "utf8")) as { selected: string[] };
  core = sel.selected.map((id) => byId.get(id)!).filter(Boolean);
}
const coreIds = new Set(core.map((q) => q.id));
const mode = (args.mode ?? (args.core ? "reserve" : "legacy")) as "legacy" | "reserve";
const fitStrategy = args.fit as undefined | "level" | "shape" | "correlation" | "blend" | "asymmetric";
const reserve = pool.filter((q) => !coreIds.has(q.id));
const pairs = args.pairs ? JSON.parse(fs.readFileSync(String(args.pairs), "utf8")).pairs : undefined;
const data0 = buildSessionData({
  fitStrategy,
  minLoadingShare: args.share ? Number(args.share) : undefined,
  ...(args.context === "off" ? { contextIndex: {} } : {}),
  coreQuestions: core,
  roundMode: mode,
  reservePool: reserve,
  tiebreakerPool: mode === "legacy" ? REAL_TIEBREAKER_QUESTIONS : reserve,
});
const data = pairs ? { ...data0, contradictionPairs: pairs } : data0;
const validityIds = new Set(REAL_VALIDITY_ITEMS.map((v) => v.id));
const s = evaluatePersonas(personas, answers, validityIds, data);
const pct = (x: number) => (x * 100).toFixed(1) + "%";
console.log(
  `شخصيات=${s.personas} (${core.length} بنداً، وضع ${mode}): الأول صحيح ${pct(s.hitTop1)} | ضمن الثلاثة ${pct(s.hitTop3)} | ` +
    `مقبول ضمن الثلاثة ${pct(s.acceptableOrExpectedTop3)} | انتهاك ممنوعات ${s.forbiddenViolations} | توأمان ${s.twinCorrect}/${s.twinCases} | شاشات ${s.meanScreens.toFixed(1)}`
);
if (args.verbose) {
  s.outcomes.forEach((o) =>
    console.log(
      `  ${o.hitTop3 ? "✓" : "✗"} ${o.id}: ${o.shown.join(", ")}${o.forbiddenInTop3.length ? "  ⚠ممنوع:" + o.forbiddenInTop3.join(",") : ""}${o.twinCorrect === null ? "" : o.twinCorrect ? "  توأم✓" : "  توأم✗"}`
    )
  );
}
if (args.out) fs.writeFileSync(String(args.out), JSON.stringify(s, null, 2));
