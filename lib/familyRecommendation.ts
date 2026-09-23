/**
 * التوصية بالعائلة (قرار المالك 2026-09-23): بدل ثلاثة تخصصات شبه متطابقة
 * («هندسة البرمجيات»، «علوم الحاسوب»، «الذكاء الاصطناعي») تُعرض ثلاث
 * **عائلات مختلفة**، كل واحدة بأقرب أفرادها إلى الطالب ومعها بقية أفرادها.
 *
 * السبب قياسي لا تجميلي: أداة القياس لا تستطيع الفصل داخل العائلة الواحدة
 * (ارتباط «بُعد أقرب جار» بالاستدعاء 0.52، وأزواج التوائم تتبادل المركز
 * الأول بين نموذج إجابة وآخر)، فترتيبها ادّعاء دقة غير موجودة. أما أي
 * عائلة تناسب الطالب فأداتنا تجيب عنه.
 *
 * طبقة **فوق** الترتيب لا داخله: تستقبل القائمة المرتّبة كاملة كما أنتجها
 * المحرك (بعد الجولة والمنزلقات) فلا يتغيّر أي مقياس قائم.
 */
import type { RankedMajor } from "./recommendationEngine";
import { familyOf, familyName, type FamilyData } from "./majorFamilies";

export interface FamilyRecommendation {
  familyId: string;
  familyName: string;
  /** أقرب أفراد العائلة إلى الطالب -- هو التوصية المعروضة. */
  lead: RankedMajor;
  /** بقية أفرادها المؤهَّلين مرتّبين تنازلياً (قد تكون فارغة). */
  siblings: RankedMajor[];
  familyScore: number;
  /** الفارق عن العائلة التالية -- يسمح بإفصاح «متقاربتان» على مستوى العائلة. */
  gapToNext: number;
}

export interface FamilySelection {
  recommendations: FamilyRecommendation[];
  /** العائلات المتاحة أقل من المطلوب (فرع الفنون: 3 عائلات فقط) -- يُفصَح عنه ولا يُحشى. */
  insufficientFamilies: boolean;
  familiesAvailable: number;
}

export const DEFAULT_FAMILY_COUNT = 3;
export const DEFAULT_MAX_SIBLINGS = 3;

export function selectFamilyRecommendations(
  ranked: RankedMajor[],
  families: FamilyData,
  opts: { count?: number; maxSiblings?: number } = {}
): FamilySelection {
  const count = opts.count ?? DEFAULT_FAMILY_COUNT;
  const maxSiblings = opts.maxSiblings ?? DEFAULT_MAX_SIBLINGS;

  // مرور واحد على القائمة المرتّبة: أول عضو يُرى من عائلة هو قائدها، فترتيب
  // العائلات يرث ترتيب المحرك بلا فرز ثانٍ (وبلا كسر التعادلات المستقرة).
  const order: string[] = [];
  const groups = new Map<string, { lead: RankedMajor; siblings: RankedMajor[] }>();
  for (const major of ranked) {
    const fid = familyOf(families, major.id);
    const g = groups.get(fid);
    if (!g) {
      groups.set(fid, { lead: major, siblings: [] });
      order.push(fid);
    } else {
      g.siblings.push(major);
    }
  }

  const recommendations = order.slice(0, count).map((fid, i) => {
    const g = groups.get(fid)!;
    const nextId = order[i + 1];
    const next = nextId ? groups.get(nextId)!.lead.combinedScore : -Infinity;
    return {
      familyId: fid,
      familyName: familyName(families, fid) || g.lead.name,
      lead: g.lead,
      siblings: g.siblings.slice(0, maxSiblings),
      familyScore: g.lead.combinedScore,
      gapToNext: Number.isFinite(next) ? g.lead.combinedScore - next : Infinity,
    };
  });

  return {
    recommendations,
    insufficientFamilies: order.length < count,
    familiesAvailable: order.length,
  };
}
