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
 * حد أدنى واحد للقبول (فرع دراسي/جنس/سنة) كما يظهر في بيانات الحدود الدنيا الرسمية.
 */
export interface DepartmentCutoff {
  branch: string;
  gender: string;
  averagePercent: number;
  isQuota: boolean;
}

/**
 * تمثيل واجهة القسم داخل الكلية، مع الحدود الدنيا الفعلية لكل فرع/جلسة.
 */
export interface Department {
  name: string;
  branch: string[];
  sessions: string[];
  cutoffs: DepartmentCutoff[];
  averageGrades: {
    "صباحي": number | null;
    "مسائي": number | null;
  };
  isDirectAdmission: boolean;
}

/**
 * تمثيل واجهة الكلية داخل الجامعة
 */
export interface College {
  id: string;
  name: string;
  nameEn: string | null;
  departments: Department[];
}

/**
 * تمثيل واجهة الجامعة (University)
 */
export interface University {
  id: string;
  name: string;
  nameEn: string | null;
  type: "حكومية" | "أهلية";
  province: string;
  founded: number | null;
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
  departmentName: string;
  departmentBranches: string[];
  sessions: string[];
  averageGrades: {
    "صباحي": number | null;
    "مسائي": number | null;
  };
  cutoffs: DepartmentCutoff[];
  isDirectAdmission: boolean;
  confidence: number;
}

/**
 * تطبيع النص العربي لأغراض المطابقة فقط: يوحّد صيغ الهمزة (أ/إ/آ) ويحذف
 * حرف الألف المجرد بالكامل. هذا يعالج عيباً معروفاً ومتكرراً في استخراج
 * النصوص من ملفات PDF الرسمية (دليل الطالب) حيث ينعكس ترتيب حرفي "ل" و"ا"
 * ضمن رابطة "لا" أحياناً (مثال: "الاتصالات" تُستخرج أحياناً "االتصاالت").
 * إسقاط الألف من الجهتين قبل المقارنة يجعل المطابقة متينة أمام هذا الخلل
 * دون الحاجة لتكرار كل صيغة تالفة يدوياً في قاموس المطابقة.
 */
function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ا/g, "")
    .replace(/\s+/g, "");
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
  const depNorm = normalizeArabic(departmentName);
  const majorNameNorm = normalizeArabic(major.name);
  const mappingNameNorm = normalizeArabic(mapping.majorName);

  let score = 0;

  // 1. تحقق من التطابق التام والمباشر
  if (depNorm === majorNameNorm || depNorm === mappingNameNorm) {
    score = 100;
  }
  // 2. تحقق من وجود الاسم في الأسماء البديلة الشائعة (Aliases)
  else if (mapping.aliases.some((alias) => normalizeArabic(alias) === depNorm)) {
    score = 85;
  }
  // 3. تحقق من وجود أي من الأنماط النصية (Patterns) في اسم القسم
  else {
    const matchingPatterns = mapping.departmentPatterns.filter((pattern) =>
      depNorm.includes(normalizeArabic(pattern))
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
          dept.name,
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
            departmentName: dept.name,
            departmentBranches: dept.branch,
            sessions: dept.sessions,
            averageGrades: dept.averageGrades,
            cutoffs: dept.cutoffs,
            isDirectAdmission: dept.isDirectAdmission,
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
