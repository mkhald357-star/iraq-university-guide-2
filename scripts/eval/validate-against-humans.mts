// التحقق مقابل طلاب حقيقيين (الإصدار 2، المسار هـ) -- المخرج الوحيد من دائرة
// المحاكاة: حقيقة المدقّق مشتقّة من البروفايلات نفسها، فلا تحكم على صحّتها.
//
//   node "$(node -e "console.log(require.resolve('tsx/cli'))")" scripts/eval/validate-against-humans.mts \
//        [--codes reports/validation/pilot-codes.txt] [--out reports/validation/results.json]
//
// الملف: رمز واحد في كل سطر كما أرسله الطالب (lib/pilotCode.ts)؛ السطور التي
// تبدأ بـ# تُهمَل. الرموز التالفة تُعَدّ وتُذكر ولا تُسقط التشغيل.
//
// لكل طالب يُعاد حساب الترتيب بمسار التقرير نفسه (مطابقته لمحرك الاختبار مثبتة
// في lib/reportQuizParity.test.ts)، ثم يُقارَن بما قاله الطالب:
//   - هل مجال تخصصه الفعلي ضمن المجالات الثلاثة المعروضة؟
//   - هل تخصصه نفسه معروض (قائداً أو ضمن أقرانه)؟
//   - ترتيبه في القائمة الكاملة، وتقييمه لملاءمة التوصيات (1-5).
//
// بروفايلات مرشَّحة (data/major_riasec_profiles.candidate.json) إن وُجدت تُقاس
// جنباً إلى جنب مع الحالية -- هنا فقط يُحسم أيّهما أصدق، لا في المحاكاة.
//
// ── قواعد القرار، مسجَّلة قبل أول رمز (المدقّق، مراجعة المسار هـ) ──
// الاستبعاد: رمز من بنك أسئلة غير الحالي (بصمة مختلفة)، أو نطاق صدق "high".
// P1 (صلاحية التوصية): لكل فرع على حدة، intendedFamilyInShown3 ≥ خطّ الصدفة
//    + 0.20، وخطّ الصدفة = متوسط 2000 تبديل عشوائي للنيّات بين طلاب الفرع نفسه.
//    فرع الفنون يُقاس ويُعرض ولا يدخل الحكم (3 مجالات فقط -- الصدفة شبه كاملة).
// P2 (المرشَّحة مقابل الحالية): اختبار ويلكوكسون للأزواج المرتّبة على رتبة
//    تخصص النيّة، ثنائي الطرف α=0.05. تُعتمد المرشَّحة فقط إن كانت رتبتها أفضل
//    بدلالة **و** لم يسقط P1 بها في أي فرع.
// التحليل الأساسي: كل من سمّى تخصصاً. الثانوي (للقراءة لا للحكم): مصدر النيّة
//    "ميول" أو "قُبلت فعلاً" مع يقين ≥ 4.
// القدرة: مع 100 طالب يُكشف فرق نحو 15 نقطة فقط -- فرق أصغر لا يُحسم بها.
import fs from "fs";
import path from "path";
import { decodePilotRecord, type PilotRecord } from "../../lib/pilotCode.ts";
import { computeUserRiasecVector } from "../../lib/riasec.ts";
import { rankMajorsFromVector, PRODUCT_FIT_STRATEGY, PRODUCT_MIN_LOADING_SHARE, type RankMajorsData } from "../../lib/recommendationEngine.ts";
import { buildScoredPool } from "../../lib/scoredPool.ts";
import { MAJOR_FAMILIES, familyOf } from "../../lib/majorFamilies.ts";
import { selectFamilyRecommendations } from "../../lib/familyRecommendation.ts";
import { buildProductSessionData } from "../../lib/eval/productConfig.ts";
import { bankFingerprint } from "../../lib/pilotCode.ts";

const args = process.argv.slice(2);
const opt = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const CODES = opt("--codes", "reports/validation/pilot-codes.txt");
const OUT = opt("--out", "reports/validation/results.json");
const MIN_N = 100; // عتبة المالك قبل أي قرار على البروفايلات

if (!fs.existsSync(CODES)) {
  console.log(`لا ملف رموز بعد (${CODES}). ضع رمزاً واحداً في كل سطر ثم أعد التشغيل.`);
  process.exit(0);
}

const records: PilotRecord[] = [];
const rejected: { line: number; reason: string }[] = [];
fs.readFileSync(CODES, "utf8")
  .split(/\r?\n/)
  .forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith("#")) return;
    const r = decodePilotRecord(line);
    if (r.ok) records.push(r.record);
    else rejected.push({ line: i + 1, reason: r.reason });
  });

const product = buildProductSessionData();
const CURRENT_BANK = bankFingerprint(product.coreQuestions.map((q) => q.id));
const excluded = { otherBank: 0, highVrs: 0 };
const usable = records.filter((r) => {
  if (r.bank !== CURRENT_BANK) return excluded.otherBank++, false;
  if (r.vrsBand === "high") return excluded.highVrs++, false;
  return true;
});
const candidatePath = path.join(process.cwd(), "data/major_riasec_profiles.candidate.json");
const variants: { name: string; profiles: RankMajorsData["riasecProfiles"] }[] = [
  { name: "الحالية", profiles: product.riasecProfiles },
];
if (fs.existsSync(candidatePath)) {
  variants.push({ name: "المرشَّحة", profiles: JSON.parse(fs.readFileSync(candidatePath, "utf8")).profiles });
}

type Row = { branch: string; intended: string; familiesShown: string[]; firstFamily: string; majorShown: boolean; rank: number; primary: boolean };

function rowsFor(profiles: RankMajorsData["riasecProfiles"]): Row[] {
  return usable
    .filter((r) => r.intendedMajorId)
    .map((r) => {
      const pool = buildScoredPool(r.answers, product.coreQuestions, [product.reservePool ?? [], product.tiebreakerPool]);
      const vector = computeUserRiasecVector(r.answers, pool, PRODUCT_MIN_LOADING_SHARE);
      const ranked = rankMajorsFromVector(vector, { branch: r.branch, grade: r.grade, subjectGrades: r.subjectGrades }, {
        fitStrategy: PRODUCT_FIT_STRATEGY,
        minLoadingShare: PRODUCT_MIN_LOADING_SHARE,
        majors: product.majors,
        riasecProfiles: profiles,
        subjectWeights: product.subjectWeights,
      });
      const sel = selectFamilyRecommendations(ranked, MAJOR_FAMILIES);
      const pos = ranked.findIndex((m) => m.id === r.intendedMajorId);
      return {
        branch: r.branch,
        intended: r.intendedMajorId!,
        familiesShown: sel.recommendations.map((x) => x.familyId),
        firstFamily: sel.recommendations[0]?.familyId ?? "",
        majorShown: sel.recommendations.some((x) => x.lead.id === r.intendedMajorId || x.siblings.some((s) => s.id === r.intendedMajorId)),
        rank: pos < 0 ? ranked.length : pos + 1,
        primary: (r.intentSource === "interest" || r.intentSource === "admitted") && (r.intentCertainty ?? 0) >= 4,
      };
    });
}

// مولّد عشوائي ثابت البذرة -- كي يعيد التحليل نفس خطّ الصدفة في كل تشغيل.
function rng(seed: number) {
  return () => ((seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 2 ** 32);
}
const familyHitRate = (rows: Row[], intents: string[]) =>
  rows.filter((row, i) => row.familiesShown.includes(familyOf(MAJOR_FAMILIES, intents[i]))).length / (rows.length || 1);

function permutationChance(rows: Row[], n = 2000): number {
  const rand = rng(20260923);
  let total = 0;
  for (let k = 0; k < n; k++) {
    const shuffled = rows.map((r) => r.intended);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    total += familyHitRate(rows, shuffled);
  }
  return total / n;
}

function summarize(rows: Row[]) {
  const n = rows.length || 1;
  const byBranch: Record<string, unknown> = {};
  for (const branch of [...new Set(rows.map((r) => r.branch))]) {
    const br = rows.filter((r) => r.branch === branch);
    const hit = familyHitRate(br, br.map((r) => r.intended));
    const chance = permutationChance(br);
    byBranch[branch] = {
      n: br.length,
      intendedFamilyInShown3: +hit.toFixed(3),
      chance: +chance.toFixed(3),
      liftOverChance: +(hit - chance).toFixed(3),
      P1: branch === "فنون" ? "خارج الحكم" : br.length < 20 ? "عيّنة صغيرة" : hit - chance >= 0.2 ? "يمرّ" : "يسقط",
    };
  }
  return {
    studentsWithIntendedMajor: rows.length,
    intendedFamilyFirst: +(rows.filter((r) => r.firstFamily === familyOf(MAJOR_FAMILIES, r.intended)).length / n).toFixed(3),
    intendedFamilyInShown3: +familyHitRate(rows, rows.map((r) => r.intended)).toFixed(3),
    intendedMajorVisible: +(rows.filter((r) => r.majorShown).length / n).toFixed(3),
    meanRankOfIntendedMajor: +(rows.reduce((s, r) => s + r.rank, 0) / n).toFixed(1),
    byBranch,
  };
}

/** ويلكوكسون للأزواج (تقريب طبيعي مع تصحيح التعادل)؛ الفروق الصفرية تُسقط. */
export function wilcoxon(a: number[], b: number[]) {
  const d = a.map((x, i) => x - b[i]).filter((x) => x !== 0);
  const n = d.length;
  if (n < 10) return { n, W: null, z: null, p: null };
  const order = d.map((x, i) => ({ abs: Math.abs(x), i })).sort((x, y) => x.abs - y.abs);
  const ranks = new Array(n).fill(0);
  let tieCorr = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && order[j + 1].abs === order[i].abs) j++;
    const avg = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[order[k].i] = avg;
    const t = j - i + 1;
    tieCorr += t ** 3 - t;
    i = j + 1;
  }
  const Wplus = d.reduce((s, x, i) => s + (x > 0 ? ranks[i] : 0), 0);
  const mean = (n * (n + 1)) / 4;
  const sd = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieCorr / 48);
  const z = (Wplus - mean) / sd;
  // p ثنائي الطرف من التوزيع الطبيعي (تقريب Abramowitz-Stegun 7.1.26)
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return { n, W: Wplus, z: +z.toFixed(3), p: +(1 - erf).toFixed(4) };
}

const rowsByVariant = variants.map((v) => ({ name: v.name, rows: rowsFor(v.profiles) }));

const ratings = usable.map((r) => r.fitRating).filter((x): x is number => x !== null);
const result = {
  generatedAt: new Date().toISOString(),
  records: records.length,
  rejected,
  excluded,
  usable: usable.length,
  enoughForProfileDecision: usable.length >= MIN_N,
  meanFitRating: ratings.length ? +(ratings.reduce((s, x) => s + x, 0) / ratings.length).toFixed(2) : null,
  fitRatingDistribution: [1, 2, 3, 4, 5].map((k) => ratings.filter((x) => x === k).length),
  variants: rowsByVariant.map((v) => ({
    name: v.name,
    primaryAnalysis: summarize(v.rows),
    secondary_interestOrAdmitted_certain: summarize(v.rows.filter((r) => r.primary)),
  })),
  // P2: رتبة تخصص النيّة، المرشَّحة مقابل الحالية (أصغر = أفضل)
  P2:
    rowsByVariant.length === 2
      ? (() => {
          const cur = rowsByVariant[0].rows.map((r) => r.rank);
          const cand = rowsByVariant[1].rows.map((r) => r.rank);
          const w = wilcoxon(cand, cur);
          const candBetter = cand.reduce((s, x) => s + x, 0) < cur.reduce((s, x) => s + x, 0);
          return { ...w, candidateBetterOnAverage: candBetter, significant: w.p !== null && w.p < 0.05 };
        })()
      : "لا بروفايلات مرشَّحة",
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.enoughForProfileDecision) {
  console.log(`\nتنبيه: عدد الطلاب الصالحين ${usable.length} فقط — قرار البروفايلات يحتاج ${MIN_N} طالب على الأقل (قرار المالك).`);
}
