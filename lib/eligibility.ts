/**
 * بوّابة الأهلية كقرار قاطع (TASKS.md المهمة ٣). قبول الفرع الدراسي شرط
 * إداري صريح في نظام القبول المركزي (نعم/لا)، لا توافقاً متدرّجاً كما كانت
 * الصياغة القديمة توحي ("توافق جزئي بين فرعك وهذا التخصص"). هذه الوحدة
 * تفصل بوضوح بين ثلاثة أسئلة مختلفة تماماً كانت مدموجة سابقاً في جملة
 * تحذير غامضة واحدة بلا مخرج محسوب:
 * 1. هل فرعك مؤهَّل أصلاً لهذا التخصص؟ (قاطع)
 * 2. من بين العروض المؤهَّلة، أيّها معدلك يبلغه فعلياً الآن؟ (محسوب من البيانات)
 * 3. ما أقرب حد تنافسي لم تبلغه بعد، وكم يبعد عن معدلك؟ (رقم حقيقي لا جملة عامة)
 */

import type { UniversityOffering } from "./majorMatcher";

export interface EligibilityResult {
  /** مؤهَّل بالفرع أم لا -- قاطع، لا متدرّج. */
  branchEligible: boolean;
  /** الفروع المؤهَّلة فعلياً لهذا التخصص، مُشتقّة من بيانات الأقسام الحقيقية (لا فئة عامة تقريبية). */
  allowedBranches: string[];
  /** العروض التي يبلغها معدل الطالب فعلاً الآن (قبول مباشر، أو معدله ≥ حدّها الصباحي أو المسائي)، مرتّبة بالثقة ثم المعدل. */
  reachableOffers: UniversityOffering[];
  /** أدنى حدّ تنافسي صباحي حقيقي بين كل عروض هذا التخصص (null إن كانت كلها قبولاً مباشراً بلا حدّ تنافسي أصلاً). */
  lowestCutoff: number | null;
  /** الفارق بين معدل الطالب وأدنى حدّ (موجب = يتجاوزه، سالب = دونه). null إن لم يوجد حدّ تنافسي أصلاً. */
  gapToLowest: number | null;
}

/**
 * يحسب أهلية طالب لتخصص معيّن بناءً على فرعه ومعدله مقابل كل العروض
 * الجامعية الحقيقية المتاحة لهذا التخصص (offerings من findUniversitiesForMajor).
 */
export function computeEligibility(
  studentBranch: string,
  studentGrade: number,
  offerings: UniversityOffering[]
): EligibilityResult {
  const allowedBranches = [...new Set(offerings.flatMap((o) => o.departmentBranches))];
  // بلا أي عرض إطلاقاً لهذا التخصص، لا معنى لـ"مؤهَّل" -- لا شيء ليكون مؤهَّلاً له.
  const branchEligible = offerings.length > 0 && allowedBranches.includes(studentBranch);

  const reachableOffers = offerings.filter((o) => {
    if (o.isDirectAdmission) return true;
    const morning = o.averageGrades["صباحي"];
    const evening = o.averageGrades["مسائي"];
    if (morning !== null && studentGrade >= morning) return true;
    if (evening !== null && studentGrade >= evening) return true;
    return false;
  });

  const competitiveCutoffs = offerings
    .filter((o) => !o.isDirectAdmission && o.averageGrades["صباحي"] !== null)
    .map((o) => o.averageGrades["صباحي"] as number);
  const lowestCutoff = competitiveCutoffs.length > 0 ? Math.min(...competitiveCutoffs) : null;
  const gapToLowest = lowestCutoff !== null ? studentGrade - lowestCutoff : null;

  return { branchEligible, allowedBranches, reachableOffers, lowestCutoff, gapToLowest };
}
