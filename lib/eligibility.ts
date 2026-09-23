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
import { classifyOffering } from "./wishlistPlanner";
import type { StudySession } from "./wishlistPlanner";

export interface EligibilityResult {
  /** مؤهَّل بالفرع أم لا -- قاطع، لا متدرّج. */
  branchEligible: boolean;
  /** الفروع المؤهَّلة فعلياً لهذا التخصص، مُشتقّة من بيانات الأقسام الحقيقية (لا فئة عامة تقريبية). */
  allowedBranches: string[];
  /** العروض التي يبلغها معدل الطالب فعلاً الآن (مريح أو قريب بحسب classifyOffering). */
  reachableOffers: UniversityOffering[];
  /**
   * عروض لا نعرف حدّها أصلاً (أهلي بلا حدّ منشور، أو حكومي تنافسي بلا رقم):
   * ليست "في المتناول" ولا "بعيدة" -- تُعرض للطالب بوصفها مجهولة بدل أن
   * تُحتسب صامتة في أي اتجاه (data/admission_rules.md §28 و§32).
   */
  unknownOffers: UniversityOffering[];
  /**
   * من reachableOffers: ما لا يُبلَغ إلا بالدوام المسائي (أرضية ثابتة، دراسة
   * بأجور). يجب أن تقول الواجهة ذلك صراحةً -- شرط المدقّق لاعتبار المسائي بلوغاً.
   */
  eveningOnlyOffers: UniversityOffering[];
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

  // **تفويض لا تكرار**: قواعد "هل يبلغه معدل الطالب؟" مصدرها الوحيد
  // classifyOffering في lib/wishlistPlanner.ts (مغطّاة باختباراتها). كانت
  // مكرَّرة هنا بنسخة قديمة فيها عطلان حقيقيان رصدهما تدقيق الإصدار 2:
  //   1. `isDirectAdmission` يُفحَص بلا شرط قبل نوع الجامعة -- وهو true لكل
  //      قسم أهلي بلا استثناء (1346 قسماً)، فكان كل الأهلي "في المتناول" لأي
  //      معدل مهما انخفض. نفس صنف العطل الذي أُصلح في wishlistPlanner (§32)
  //      وبقي حيّاً في هذا الملف.
  //   2. الحدّ المسائي يُعامَل كحدّ تنافسي، وهو أرضية ثابتة حسب نوع الكلية
  //      (ستّ قيم فقط: 56-75) لا نتيجة تنافس (§8 و§31).
  //
  // القسم في المتناول إن بلغه الطالب في **أيّ** دوام يقدّمه (كما في /gpa-check):
  // الصباحي بحدّه التنافسي، والمسائي بأرضيته -- وهي حدّ أدنى حقيقي للتقديم على
  // الدراسة المسائية (§8 بند 1: "المسائي خيار احتياطي واقعي")، لا حدّ تنافسي.
  const BAND_RANK = { safe: 0, close: 1, unknown: 2, reach: 3 } as const;
  const classified = offerings.map((o) => {
    const sessions = (o.sessions.length ? o.sessions : ["صباحي"]) as StudySession[];
    const bySession = sessions.map((session) => ({
      session,
      band: classifyOffering({ majorId: "", majorName: "", session, offering: o }, studentGrade).band,
    }));
    const band = bySession.map((x) => x.band).reduce((best, b) => (BAND_RANK[b] < BAND_RANK[best] ? b : best));
    const reachedIn = bySession.filter((x) => x.band === "safe" || x.band === "close").map((x) => x.session);
    return { offering: o, band, eveningOnly: reachedIn.length > 0 && reachedIn.every((s) => s === "مسائي") };
  });
  const reachableOffers = classified.filter((c) => c.band === "safe" || c.band === "close").map((c) => c.offering);
  const unknownOffers = classified.filter((c) => c.band === "unknown").map((c) => c.offering);
  const eveningOnlyOffers = classified.filter((c) => c.eveningOnly).map((c) => c.offering);

  // الحدّ التنافسي: حكومي غير مباشر بحدّ صباحي منشور فقط.
  const competitiveCutoffs = offerings
    .filter((o) => o.universityType !== "أهلية" && !o.isDirectAdmission && o.averageGrades["صباحي"] !== null)
    .map((o) => o.averageGrades["صباحي"] as number);
  const lowestCutoff = competitiveCutoffs.length > 0 ? Math.min(...competitiveCutoffs) : null;
  const gapToLowest = lowestCutoff !== null ? studentGrade - lowestCutoff : null;

  return { branchEligible, allowedBranches, reachableOffers, unknownOffers, eveningOnlyOffers, lowestCutoff, gapToLowest };
}
