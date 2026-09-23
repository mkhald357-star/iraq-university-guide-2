// قابلية الوصول لكل (تخصص × مركز 1/2/3) عبر خط المنتج الكامل.
//   node "$(node -e "console.log(require.resolve('tsx/cli'))")" scripts/eval/reachability.mts \
//        [--core=reports/short-form/selection.json] [--mode=legacy|reserve] [--grade=90]
import fs from "fs";
import { buildSessionData, REAL_CORE_QUESTIONS, REAL_TIEBREAKER_QUESTIONS } from "../../lib/eval/engineData.ts";
import { searchReachability, type ReachabilityCell } from "../../lib/eval/reachability.ts";
import { createRng } from "../../lib/eval/random.ts";
import { BRANCH_CATEGORY_MAP } from "../../lib/branchEligibility.ts";
import type { RiasecQuestion } from "../../lib/riasec.ts";
import reserveQuestions from "../../data/reserve_questions.json" with { type: "json" };

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);
// حوض الإجابة = ما قد يراه الطالب فعلاً في المنتج: البنك الأساسي + بنك
// الاحتياط المنشور (لا بنك /decider القديم، فهو ليس مصدر جولة الاحتياط).
const pool: RiasecQuestion[] = [...REAL_CORE_QUESTIONS, ...(reserveQuestions as RiasecQuestion[])];
const byId = new Map(pool.map((q) => [q.id, q]));
let core = REAL_CORE_QUESTIONS;
if (args.core) core = (JSON.parse(fs.readFileSync(String(args.core), "utf8")).selected as string[]).map((id) => byId.get(id)!);
const coreIds = new Set(core.map((q) => q.id));
const mode = (args.mode ?? (args.core ? "reserve" : "legacy")) as "legacy" | "reserve";
const reserve = pool.filter((q) => !coreIds.has(q.id));
const data = buildSessionData({
  coreQuestions: core,
  roundMode: mode,
  reservePool: reserve,
  tiebreakerPool: mode === "legacy" ? REAL_TIEBREAKER_QUESTIONS : reserve,
});
const grade = Number(args.grade ?? 90);
const rng = createRng(2718);
const cells: (ReachabilityCell & { branch: string })[] = [];
const t0 = Date.now();
for (const branch of ["علمي", "أدبي", "فنون"]) {
  const allowed = BRANCH_CATEGORY_MAP[branch] ?? [];
  const eligible = data.majors.filter((m) => allowed.includes(m.category));
  for (const m of eligible) {
    for (const position of [1, 2, 3]) {
      let cell = searchReachability(m.id, position, branch, grade, data, pool, rng);
      // تمريرة عميقة ثانية قبل الحكم بالاستحالة -- فشل البحث السريع ليس دليلاً
      if (!cell.reached) cell = searchReachability(m.id, position, branch, grade, data, pool, rng, { restarts: 30, iterations: 1500 });
      cells.push({ ...cell, branch });
    }
  }
}
const failed = cells.filter((c) => !c.reached);
console.log(
  `قابلية الوصول (${core.length} بنداً، وضع ${mode}، معدل ${grade}): ${cells.length - failed.length}/${cells.length} خانة ممكنة، ` +
    `${failed.length} مستحيلة [${((Date.now() - t0) / 1000).toFixed(0)}s]`
);
failed.forEach((c) => console.log(`  ✗ ${c.branch} ${c.majorId} @${c.position} (أقرب مركز بلغه: ${c.bestRank})`));
if (args.out) fs.writeFileSync(String(args.out), JSON.stringify(cells, null, 2));
