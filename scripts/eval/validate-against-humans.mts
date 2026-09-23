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
import fs from "fs";
import path from "path";
import { decodePilotRecord, type PilotRecord } from "../../lib/pilotCode.ts";
import { computeUserRiasecVector } from "../../lib/riasec.ts";
import { rankMajorsFromVector, PRODUCT_FIT_STRATEGY, PRODUCT_MIN_LOADING_SHARE, type RankMajorsData } from "../../lib/recommendationEngine.ts";
import { buildScoredPool } from "../../lib/scoredPool.ts";
import { MAJOR_FAMILIES, familyOf } from "../../lib/majorFamilies.ts";
import { selectFamilyRecommendations } from "../../lib/familyRecommendation.ts";
import { buildProductSessionData } from "../../lib/eval/productConfig.ts";

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
const candidatePath = path.join(process.cwd(), "data/major_riasec_profiles.candidate.json");
const variants: { name: string; profiles: RankMajorsData["riasecProfiles"] }[] = [
  { name: "الحالية", profiles: product.riasecProfiles },
];
if (fs.existsSync(candidatePath)) {
  variants.push({ name: "المرشَّحة", profiles: JSON.parse(fs.readFileSync(candidatePath, "utf8")).profiles });
}

function evaluate(profiles: RankMajorsData["riasecProfiles"]) {
  const withIntent = records.filter((r) => r.intendedMajorId);
  let familyHit = 0, majorShown = 0, rankSum = 0, top1Family = 0;
  for (const r of withIntent) {
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
    const intendedFam = familyOf(MAJOR_FAMILIES, r.intendedMajorId!);
    if (sel.recommendations.some((x) => x.familyId === intendedFam)) familyHit++;
    if (sel.recommendations[0]?.familyId === intendedFam) top1Family++;
    if (sel.recommendations.some((x) => x.lead.id === r.intendedMajorId || x.siblings.some((s) => s.id === r.intendedMajorId))) majorShown++;
    const pos = ranked.findIndex((m) => m.id === r.intendedMajorId);
    rankSum += pos < 0 ? ranked.length : pos + 1;
  }
  const n = withIntent.length || 1;
  return {
    studentsWithIntendedMajor: withIntent.length,
    intendedFamilyFirst: +(top1Family / n).toFixed(3),
    intendedFamilyInShown3: +(familyHit / n).toFixed(3),
    intendedMajorVisible: +(majorShown / n).toFixed(3),
    meanRankOfIntendedMajor: +(rankSum / n).toFixed(1),
  };
}

const ratings = records.map((r) => r.fitRating).filter((x): x is number => x !== null);
const result = {
  generatedAt: new Date().toISOString(),
  records: records.length,
  rejected,
  enoughForProfileDecision: records.length >= MIN_N,
  meanFitRating: ratings.length ? +(ratings.reduce((s, x) => s + x, 0) / ratings.length).toFixed(2) : null,
  fitRatingDistribution: [1, 2, 3, 4, 5].map((k) => ratings.filter((x) => x === k).length),
  variants: variants.map((v) => ({ name: v.name, ...evaluate(v.profiles) })),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.enoughForProfileDecision) {
  console.log(`\nتنبيه: عدد الطلاب ${records.length} فقط — قرار البروفايلات يحتاج ${MIN_N} طالب على الأقل (قرار المالك).`);
}
