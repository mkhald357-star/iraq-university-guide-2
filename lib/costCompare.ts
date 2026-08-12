// منطق ميزة "كلفة الدراسة الأهلية" -- خدمة "cost" في data/services.ts، كانت
// "قيد التطوير". يعيد استخدام UniversityOffering (lib/majorMatcher.ts) بعد
// توسعته بحقلَي tuitionFees/admissionSuspended (data/admission_rules.md §41).
//
// ملاحظة تصميم مهمة (تحوير واعٍ عن lib/compareMajors.ts، لا نسخ أعمى):
// compareMajors.computeComparisonHighlights يشترط أن يملك *كل* عنصر مُقارَن
// بيانات قبل أي إبراز -- منطقي لقائمة 2-3 عناصر اختارها المستخدم بنفسه (كل
// عنصر "يستحق" الإبراز إن فاز). هنا القائمة مُولَّدة تلقائياً (كل الجامعات
// الأهلية العارضة لتخصص ما، قد تتجاوز 50 صفاً) -- تطبيق نفس الشرط الحرفي
// كان سيعني عملياً أن الإبراز لا يظهر أبداً (كافٍ قسم أهلي واحد بلا أجر
// منشور من أصل عشرات ليُسقِط الإبراز بالكامل، رغم وجود بيانات حقيقية كافية
// للمقارنة بين البقية). البديل الأصدق: يُحسَب "الأرخص" *ضمن الأقسام ذات
// الأجر المنشور فعلاً فقط* (لا إسقاطها من المقارنة، بل استبعادها من المضمار
// من الأصل) -- والنص المعروض في الواجهة يجب أن يقول "الأرخص من بين الأجور
// المنشورة" صراحة، لا "الأرخص" مطلقة، حفاظاً على نفس مبدأ عدم الإيحاء بمقارنة
// لم تحدث فعلياً.
import type { UniversityOffering } from "./majorMatcher";
import { TUITION_UNVERIFIED_UNIVERSITY_IDS } from "./admissionDisclosure";

const UNVERIFIED_IDS = new Set(TUITION_UNVERIFIED_UNIVERSITY_IDS);

export interface PricedOffering extends UniversityOffering {
  /** الأرخص بين صباحي/مسائي إن وُجدا معاً كرقمين حقيقيين، أو أيهما وُجد
   *  منفرداً، أو null إن غاب كلاهما. */
  effectiveFee: number | null;
}

export function computeEffectiveFee(fees: UniversityOffering["tuitionFees"]): number | null {
  if (!fees) return null;
  const values = [fees["صباحي"], fees["مسائي"]].filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return Math.min(...values);
}

/** يفصل عروض جامعة واحدة إلى أهلية موثوقة / أهلية مستبعَدة (مصدر غير موثوق
 *  بنيوياً، §41) / حكومية -- الأخيرتان لا تدخلان حساب "الأرخص" إطلاقاً. */
export function splitOfferings(offerings: UniversityOffering[]): {
  private: PricedOffering[];
  unverifiedPrivate: PricedOffering[];
  government: PricedOffering[];
} {
  const priced = offerings.map((o) => ({ ...o, effectiveFee: computeEffectiveFee(o.tuitionFees) }));
  return {
    private: priced.filter((o) => o.universityType === "أهلية" && !UNVERIFIED_IDS.has(o.universityId)),
    unverifiedPrivate: priced.filter((o) => o.universityType === "أهلية" && UNVERIFIED_IDS.has(o.universityId)),
    government: priced.filter((o) => o.universityType === "حكومية"),
  };
}

/** ترتيب تصاعدي: المُسعَّرة فعلياً أولاً (الأرخص فالأعلى)، ثم غير المُسعَّرة
 *  (أجر غير منشور) في النهاية -- لا نرتّبها كصفر ولا نُسقِطها بصمت. */
export function sortByFeeAscending(offerings: PricedOffering[]): PricedOffering[] {
  return [...offerings].sort((a, b) => {
    if (a.effectiveFee === null && b.effectiveFee === null) return 0;
    if (a.effectiveFee === null) return 1;
    if (b.effectiveFee === null) return -1;
    return a.effectiveFee - b.effectiveFee;
  });
}

function offeringKey(o: UniversityOffering): string {
  return `${o.universityId}|${o.collegeId}|${o.departmentName}`;
}

/** مفتاح العرض الأرخص "من بين المنشور" -- null إن لم يوجد عرضان مُسعَّران
 *  على الأقل، أو عند تعادل (لا إبراز فائز وهمي عند تعادل حقيقي). */
export function computeCheapestHighlight(privateOfferings: PricedOffering[]): string | null {
  const priced = privateOfferings.filter((o) => o.effectiveFee !== null);
  if (priced.length < 2) return null;
  const min = Math.min(...priced.map((o) => o.effectiveFee as number));
  const winners = priced.filter((o) => o.effectiveFee === min);
  if (winners.length !== 1) return null;
  return offeringKey(winners[0]);
}

export { offeringKey };
