/**
 * الفروع الرسمية الثلاثة فقط في نظام القبول المركزي العراقي (علمي/أدبي/
 * فنون) -- "إدارة" ليست فرعاً رسمياً مستقلاً (data/admission_rules.md §8)،
 * فتخصصات الإدارة والتسويق والمحاسبة مُدرَجة ضمن كلا الفرعين العلمي والأدبي،
 * تماماً كما تقبلها الجامعات فعلياً من خريجي الفرعين معاً.
 *
 * مصدر وحيد لهذه الخريطة. كانت مكرَّرة حرفياً في app/quiz/page.tsx (باسم
 * محلي branchMap) وlib/offeringsClient.ts (باسم BRANCH_CATEGORY_MAP)، مع
 * نسخة ثالثة منحرفة في scripts/archive/persona-simulation-harness.mts ناقصة
 * "تقنيات طبية مساندة" -- ما جعل كل محاكاة أُجريت بذلك الحزام تتعامل مع 58
 * تخصصاً علمياً لا 67.
 */
export const BRANCHES = ["علمي", "أدبي", "فنون"] as const;
export type Branch = (typeof BRANCHES)[number];

export const BRANCH_CATEGORY_MAP: Readonly<Record<string, readonly string[]>> = {
  علمي: ["تكنولوجيا", "هندسة", "طبي", "تقنيات طبية مساندة", "علوم", "زراعة", "إدارة وتسويق"],
  أدبي: ["إنسانيات", "لغات", "تربية", "إدارة وتسويق"],
  فنون: ["فنون وتصميم"],
};

export function isEligibleByBranch(majorCategory: string, branch: string): boolean {
  return BRANCH_CATEGORY_MAP[branch]?.includes(majorCategory) ?? false;
}

export function eligibleMajors<T extends { category: string }>(majors: T[], branch: string): T[] {
  return majors.filter((m) => isEligibleByBranch(m.category, branch));
}
