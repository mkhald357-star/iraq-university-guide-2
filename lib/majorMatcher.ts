/**
 * تمثيل واجهة التخصص (Major) المأخوذة من بيانات التخصصات
 */
export interface Major {
  id: string;
  name: string;
  category: string;
  marketMultiplier: number;
  rawScore?: number;
  finalScore?: number;
}

/**
 * تمثيل واجهة الكلية داخل الجامعة
 */
export interface College {
  id: string;
  name: string;
  nameEn: string;
  departments: string[];
  category: string;
  branch: "علمي" | "أدبي" | "mixed";
  sessions: string[];
  averageGrades: {
    "صباحي": number | null;
    "مسائي": number | null;
  };
  capacity: number | null;
  contactEmail: string | null;
}

/**
 * تمثيل واجهة الجامعة (University)
 */
export interface University {
  id: string;
  name: string;
  nameEn: string;
  type: "حكومية" | "أهلية";
  province: string;
  founded: number;
  website: string | null;
  ranking: number | null;
  colleges: College[];
}

/**
 * تمثيل واجهة خريطة مطابقة التخصص مع أقسام الكليات
 */
export interface MajorMapping {
  majorId: string;
  majorName: string;
  aliases: string[];
  departmentPatterns: string[];
  priority: number;
}

/**
 * تمثيل واجهة العرض المقترح للجامعة والقسم المطابق
 */
export interface UniversityOffering {
  universityId: string;
  universityName: string;
  universityType: "حكومية" | "أهلية";
  universityRanking: number | null;
  province: string;
  collegeId: string;
  collegeName: string;
  collegeCategory: string;
  collegeBranch: string;
  departmentName: string;
  sessions: string[];
  averageGrades: {
    "صباحي": number | null;
    "مسائي": number | null;
  };
  capacity: number | null;
  confidence: number;
}

/**
 * دالة لمطابقة اسم التخصص مع اسم القسم في الكلية وحساب درجة الثقة والتقارب.
 * 
 * @param major التخصص المطلوب مطابقته
 * @param departmentName اسم القسم الجامعي المراد فحصه
 * @param mapping خريطة مطابقة التخصص التي تحتوي على المترادفات والأنماط
 * @returns كائن يحتوي على نتيجة المطابقة ونسبة الثقة (من 0 إلى 100)
 */
export function matchMajorToDepartment(
  major: Major,
  departmentName: string,
  mapping: MajorMapping
): { isMatch: boolean; confidence: number } {
  const depLower = departmentName.toLowerCase().trim();
  const majorNameLower = major.name.toLowerCase().trim();
  const mappingNameLower = mapping.majorName.toLowerCase().trim();

  let score = 0;

  // 1. تحقق من التطابق التام والمباشر
  if (depLower === majorNameLower || depLower === mappingNameLower) {
    score = 100;
  }
  // 2. تحقق من وجود الاسم في الأسماء البديلة الشائعة (Aliases)
  else if (
    mapping.aliases.some(
      (alias) => alias.toLowerCase().trim() === depLower
    )
  ) {
    score = 85;
  }
  // 3. تحقق من وجود أي من الأنماط النصية (Patterns) في اسم القسم
  else {
    const matchingPatterns = mapping.departmentPatterns.filter((pattern) =>
      depLower.includes(pattern.toLowerCase().trim())
    );

    if (matchingPatterns.length > 1) {
      score = 75; // مطابقة عدة أنماط فرعية
    } else if (matchingPatterns.length === 1) {
      score = 60; // مطابقة نمط فرعي واحد
    }
  }

  return {
    isMatch: score >= 60,
    confidence: score,
  };
}

/**
 * دالة للبحث عن الجامعات والكليات التي توفر تخصصاً معيناً مع إمكانية الفلترة.
 * 
 * @param major التخصص المراد البحث عنه
 * @param universities قائمة الجامعات المتاحة
 * @param mappings قائمة خرائط المطابقة لجميع التخصصات
 * @param filters فلاتر اختيارية مثل المحافظة أو نوع الجامعة (حكومي/أهلي)
 * @returns قائمة بالعروض المطابقة للتخصص في الجامعات والكليات
 */
export function findUniversitiesForMajor(
  major: Major,
  universities: University[],
  mappings: MajorMapping[],
  filters?: { province?: string; type?: string }
): UniversityOffering[] {
  const offerings: UniversityOffering[] = [];

  // البحث عن خريطة المطابقة للتخصص الحالي
  let mapping = mappings.find((m) => m.majorId === major.id);
  
  if (!mapping) {
    // خريطة افتراضية احتياطية في حال عدم العثور عليها
    mapping = {
      majorId: major.id,
      majorName: major.name,
      aliases: [major.name],
      departmentPatterns: [major.name],
      priority: 1,
    };
  }

  for (const uni of universities) {
    // تصفية المحافظة
    if (filters?.province && uni.province !== filters.province) {
      continue;
    }
    // تصفية نوع الجامعة (حكومية / أهلية)
    if (filters?.type && uni.type !== filters.type) {
      continue;
    }

    for (const college of uni.colleges) {
      for (const dept of college.departments) {
        const { isMatch, confidence } = matchMajorToDepartment(
          major,
          dept,
          mapping
        );

        if (isMatch) {
          offerings.push({
            universityId: uni.id,
            universityName: uni.name,
            universityType: uni.type,
            universityRanking: uni.ranking,
            province: uni.province,
            collegeId: college.id,
            collegeName: college.name,
            collegeCategory: college.category,
            collegeBranch: college.branch,
            departmentName: dept,
            sessions: college.sessions,
            averageGrades: college.averageGrades,
            capacity: college.capacity,
            confidence,
          });
        }
      }
    }
  }

  return offerings;
}

/**
 * دالة لترتيب عروض الجامعات المطابقة بناءً على معايير الجودة والقبول.
 * الترتيب:
 * 1. نسبة الثقة والمطابقة (confidence) من الأعلى للأقل.
 * 2. معدل القبول الصباحي (averageGrades.صباحي) من الأعلى للأقل.
 * 3. ترتيب وتصنيف الجامعة (ranking) من الأعلى للأقل (الأرقام الصغيرة أولاً، والقيم الفارغة في النهاية).
 * 
 * @param offerings قائمة العروض غير المرتبة
 * @returns قائمة العروض مرتبة تنازلياً وتصاعدياً حسب المعايير
 */
export function rankUniversityOfferings(
  offerings: UniversityOffering[]
): UniversityOffering[] {
  return [...offerings].sort((a, b) => {
    // 1. المقارنة بنسبة الثقة
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }

    // 2. المقارنة بمعدل القبول الصباحي
    const gradeA = a.averageGrades["صباحي"] ?? 0;
    const gradeB = b.averageGrades["صباحي"] ?? 0;
    if (gradeB !== gradeA) {
      return gradeB - gradeA;
    }

    // 3. المقارنة بترتيب الجامعة
    const rankA = a.universityRanking ?? 99999;
    const rankB = b.universityRanking ?? 99999;
    return rankA - rankB;
  });
}
