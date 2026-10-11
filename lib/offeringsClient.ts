/**
 * أدوات جلب عروض الجامعات من جهة العميل، مشتركة بين app/report/page.tsx
 * وapp/wishlist/page.tsx -- استُخرجت لملف مستقل بدل تكرارها في كل صفحة
 * (كانت معرَّفة فقط في report/page.tsx أصلاً).
 */

import type { UniversityOffering, StatedMinimumGrade, EveningInfo } from "./majorMatcher";
import { DataFetchError } from "./viewState";

const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * جلب مُصلَّب بمهلة إلزامية -- بلا AbortController، شبكة متقطّعة تُبقي
 * الطالب أمام دوّار تحميل إلى الأبد (data/admission_rules.md §31).
 */
export async function fetchJSON<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (res.status === 404) throw new DataFetchError("notFound", url);
    if (!res.ok) throw new DataFetchError("network", url, `HTTP ${res.status}`);

    try {
      return (await res.json()) as T;
    } catch {
      throw new DataFetchError("parse", url);
    }
  } catch (e) {
    if (e instanceof DataFetchError) throw e;
    if ((e as Error)?.name === "AbortError") throw new DataFetchError("timeout", url);
    throw new DataFetchError("network", url, (e as Error)?.message);
  } finally {
    clearTimeout(timer);
  }
}

// المصدر الوحيد لهذه الخريطة صار lib/branchEligibility.ts -- أُعيد تصديرها
// هنا فقط لإبقاء استيرادات app/report وapp/wishlist القائمة تعمل بلا تعديل.
export { BRANCH_CATEGORY_MAP } from "./branchEligibility";

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
  /** مصدر حد المسائي وسقف أجوره (حكومي بدراسة مسائية). */
  evening?: EveningInfo;
  statedMinimumGrade?: StatedMinimumGrade | null;
  /** false لقسم بلا فرع معروف (كل الأهلي اليوم، الدليل لا يذكر الفرع --
      data/admission_rules.md §29) -- يُعرَض دائماً موسوماً، لا يُخفى. */
  branchKnown: boolean;
}

// كل عروض فرع دراسي معيّن (عبر كل الجامعات وكل التخصصات، مطابَقة أو غير
// مطابَقة لأي منها). يُدمَج معها ملف by-branch/unknown.json (أقسام بلا فرع
// معروف تُعرَض في كل الفروع بدل إخفائها -- §29). ملف الفرع نفسه يستعمل
// fetchJSON المصلَّب (يرمي DataFetchError -- الصفحة المستدعية تلتقطه لعرض
// حالة فشل صريحة، §31)؛ ملف unknown وحده يبقى بفشل معزول (catch(() => []))
// لأن فشله لا يجب أن يُفقد النتائج المعروفة الأهمّ.
export async function fetchOfferingsForBranch(branch: Branch): Promise<ExplorerOffering[]> {
  const [known, unknown] = await Promise.all([
    fetchJSON<ExplorerOffering[]>(`/data/by-branch/${branch}.json`),
    fetchJSON<ExplorerOffering[]>(`/data/by-branch/unknown.json`).catch(() => []),
  ]);
  return [...known, ...unknown];
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
