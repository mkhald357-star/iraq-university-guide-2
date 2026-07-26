/**
 * أدوات جلب عروض الجامعات من جهة العميل، مشتركة بين app/report/page.tsx
 * وapp/wishlist/page.tsx -- استُخرجت لملف مستقل بدل تكرارها في كل صفحة
 * (كانت معرَّفة فقط في report/page.tsx أصلاً).
 */

import type { UniversityOffering } from "./majorMatcher";

// فئات التخصصات المسموحة لكل فرع دراسي -- تُستخدَم لحساب "أقرب البدائل"/
// "بدائل مريحة" عند عدم أهلية أو عدم كفاية التخصص الأساسي (TASKS.md المهمة ٣).
export const BRANCH_CATEGORY_MAP: Record<string, string[]> = {
  علمي: ["تكنولوجيا", "هندسة", "طبي", "تقنيات طبية مساندة", "علوم", "زراعة", "إدارة وتسويق"],
  أدبي: ["إنسانيات", "لغات", "تربية", "إدارة وتسويق"],
  فنون: ["فنون وتصميم"],
};

// عروض كل تخصص (وطنياً، غير مُصفّاة بالمحافظة) تُجلَب من ملف صغير منفصل بدل
// استيراد data/universities.json الكامل (2+ ميجابايت) داخل حزمة العميل --
// المطابقة نفسها محسوبة سلفاً وقت البناء (scripts/build-major-offerings.js)
// بنفس منطق matchMajorToDepartment في lib/majorMatcher.ts بالضبط.
export async function fetchOfferingsForMajor(majorId: string): Promise<UniversityOffering[]> {
  try {
    const res = await fetch(`/data/major-offerings/${majorId}.json`);
    if (!res.ok) return [];
    return (await res.json()) as UniversityOffering[];
  } catch {
    return [];
  }
}
