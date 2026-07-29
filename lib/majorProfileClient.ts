// جلب ملف تفصيل تخصص واحد (public/data/major-profiles/<majorId>.json، مبنية
// وقت البناء عبر scripts/build-major-profiles.js) بدل استيراد
// data/major_profiles_detailed.json الكامل (كل الـ88 تخصصاً، ~530 كيلوبايت
// خاماً) داخل حزمة العميل في كل صفحة تحتاج تفصيل تخصص واحد فقط -- نفس نمط
// lib/offeringsClient.ts بالضبط.

export interface DetailedMajorProfile {
  id: string;
  study?: {
    description?: string;
    yearsOfStudy?: number;
    hasPreparatoryOrInternshipYear?: boolean;
    coreSubjects?: string[];
    studyNature?: { theoretical: number; lab: number; field: number; clinical: number };
  };
  career?: {
    realJobTitles?: string[];
    employerSectors?: string[];
    licensingRequirement?: { required: boolean; body: string; note: string };
    postgradNeededForPractice?: boolean;
    governmentBaseSalary?: {
      amount: number;
      currency: string;
      basis: string;
      scope: string;
      source: string;
      lastVerified: string;
    } | null;
  };
  market?: {
    demandLevel?: string;
    saturationNote?: string;
    source?: string | null;
    lastVerified?: string | null;
  };
  eligibility?: {
    allowedBranches?: string[];
    observedCutoffRange?: { min: number; max: number } | null;
    hasDirectAdmissionOffers?: boolean;
    offeringsCount?: number;
    source?: string;
  };
}

export async function fetchMajorProfile(majorId: string): Promise<DetailedMajorProfile | null> {
  try {
    const res = await fetch(`/data/major-profiles/${majorId}.json`);
    if (!res.ok) return null;
    return (await res.json()) as DetailedMajorProfile;
  } catch {
    return null;
  }
}
