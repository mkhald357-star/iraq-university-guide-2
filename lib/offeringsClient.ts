/**
 * أدوات جلب عروض الجامعات من جهة العميل، مشتركة بين app/report/page.tsx
 * وapp/wishlist/page.tsx -- استُخرجت لملف مستقل بدل تكرارها في كل صفحة
 * (كانت معرَّفة فقط في report/page.tsx أصلاً).
 */

import type { UniversityOffering, StatedMinimumGrade } from "./majorMatcher";

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

export type Branch = "علمي" | "أدبي" | "فنون";

// شكل مُخفَّف من UniversityOffering لأداتي "فاحص المعدل"/"مستكشف الجامعات"
// (public/data/by-branch/<فرع>.json) -- بلا cutoffs[]/confidence/
// universityRanking/collegeId (غير مُستخدَمة في أي منطق تصنيف/عرض لهاتين
// الأداتين)، مع إضافة majorId/majorName (قد تكون null لقسم غير مطابَق لأي
// من التخصصات الـ88 المنسَّقة -- يظهر القسم رغم ذلك، وفاءً بوعد "كل قسم").
export interface ExplorerOffering {
  majorId: string | null;
  majorName: string | null;
  universityId: string;
  universityName: string;
  universityType: "حكومية" | "أهلية";
  province: string;
  collegeName: string;
  departmentName: string;
  departmentBranches: string[];
  sessions: string[];
  averageGrades: { صباحي: number | null; مسائي: number | null };
  isDirectAdmission: boolean;
  statedMinimumGrade?: StatedMinimumGrade | null;
}

// كل عروض فرع دراسي معيّن (عبر كل الجامعات وكل التخصصات، مطابَقة أو غير
// مطابَقة لأي منها) -- نفس نمط fetchOfferingsForMajor أعلاه بالضبط.
export async function fetchOfferingsForBranch(branch: Branch): Promise<ExplorerOffering[]> {
  try {
    const res = await fetch(`/data/by-branch/${branch}.json`);
    if (!res.ok) return [];
    return (await res.json()) as ExplorerOffering[];
  } catch {
    return [];
  }
}

// يكيّف ExplorerOffering المُخفَّف إلى UniversityOffering كامل بقيم افتراضية
// آمنة للحقول المحذوفة -- لازم فقط لاستدعاء classifyOffering من
// lib/wishlistPlanner.ts (يتطلّب الشكل الكامل بنيوياً، لكنه لا يقرأ فعلياً
// إلا isDirectAdmission وaverageGrades[session]). لا تُعدَّل wishlistPlanner.ts
// نفسها (مُختبَرة بـ21 اختباراً) لتفادي مخاطرة غير ضرورية.
export function toUniversityOffering(e: ExplorerOffering): UniversityOffering {
  return {
    ...e,
    collegeId: "",
    cutoffs: [],
    universityRanking: null,
    confidence: 100,
  };
}
