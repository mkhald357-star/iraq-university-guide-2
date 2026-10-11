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
 * شرط معدّل مُعلَن مسبقاً في دليل الجامعات الأهلية (لا نتيجة قبول بأثر
 * رجعي كـ averageGrades الحكومي) -- للأقسام الأهلية فقط. راجع
 * data/admission_rules.md §28 لتمييزه عن averageGrades/cutoffs الحكومية.
 */
export interface StatedMinimumGrade {
  value: number;
  raw: string;
  source: string;
  sourceYear: string;
}

/**
 * تمثيل واجهة القسم داخل الكلية، مع الحدود الدنيا الفعلية لكل فرع/جلسة.
 */
export interface Department {
  name: string;
  // اسم عرض مُصحَّح (أثر انعكاس رابطة "لا" من استخراج PDF، انظر
  // scripts/displayName.js) -- اختياري، يُستخدَم للعرض فقط ولا يمسّ name
  // (مفتاح المطابقة أعلاه). قد يغيب (undefined) لأي كائن Department مبني
  // يدوياً خارج خط أنابيب البناء.
  displayName?: string;
  branch: string[];
  sessions: string[];
  cutoffs: DepartmentCutoff[];
  averageGrades: {
    صباحي: number | null;
    مسائي: number | null;
  };
  isDirectAdmission: boolean;
  /** حد التقديم المسائي لكل فرع يقبله القسم (حكومي بدراسة مسائية). */
  eveningByBranch?: Record<string, number | null>;
  /** مصدر حد المسائي وسقف أجوره. */
  evening?: EveningInfo;
  /** يُذكر الجنس لقسم محدَّد فقط: قسم لجنس واحد (كل حدوده الرسمية لذلك الجنس). غائب لبقية الأقسام. */
  genderRestriction?: GenderRestriction;
  /** فروعٌ حدّ الذكور فيها يخالف حدّ الإناث (قسم محدَّد فقط): {فرع: {ذكر, أنثى}}. */
  genderByBranch?: Record<string, { ذكر: number; أنثى: number }>;
  // شرط معدّل مُعلَن -- للأقسام الأهلية فقط، null دائماً للحكومية. راجع §28.
  statedMinimumGrade?: StatedMinimumGrade | null;
  // أجر الدراسة السنوي -- للأقسام الأهلية فقط، غائب (undefined) دائماً
  // للحكومية (القبول الحكومي مركزي بلا أجر مماثل، غياب بنيوي مقصود لا نقص
  // بيانات). راجع data/admission_rules.md §41.
  tuitionFees?: { صباحي: number | null; مسائي: number | null };
  admissionSuspended?: boolean;
}

/**
 * تمثيل واجهة الكلية داخل الجامعة
 */
export interface College {
  id: string;
  name: string;
  displayName?: string;
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
  // حارس بادئة اختياري (TASKS.md المهمة ٢): يمنع هذا التخصص من مطابقة أي
  // قسم يبدأ اسمه فعلياً بإحدى هذه البادئات، حتى لو تطابق أحد أنماطه
  // العامة معه جذرياً. ضروري لفصل "هندسة X" (بكالوريوس هندسة، 4-5 سنوات،
  // كلية الهندسة) عن "تقنيات X" (دبلوم/بكالوريوس تقني، الجامعات التقنية)
  // حين يتشارك الاسمان جذراً مشتركاً (مثال: "هندسة الأمن السيبراني" مقابل
  // "تقنيات الأمن السيبراني" — شهادتان وجهتان ونقابتان مختلفتان تماماً).
  // يُفحَص على الاسم الخام (بعد حذف "قسم " فقط)، لا بعد التطبيع الكامل،
  // لأن التطبيع يحذف المسافات فيصعب فحص "يبدأ بـ" على النتيجة المدمجة.
  // ملاحظة: "هندسة تقنيات X" (شهادة هندسة من كلية تقنية هندسية) يبدأ بـ
  // "هندسة" فتُحسَب هندسية-المستوى هنا عمداً، لا تقنية — قرار موضعي مبرَّر
  // بأنها شهادة "هندسة" رسمياً بصرف النظر عن الكلمة الثانية في اسمها.
  excludeIfDepartmentStartsWith?: string[];
}

function startsWithAnyPrefix(departmentName: string, prefixes: string[]): boolean {
  const stripped = departmentName.trim().replace(/^قسم\s+/, "");
  return prefixes.some((p) => stripped.startsWith(p));
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
    صباحي: number | null;
    مسائي: number | null;
  };
  cutoffs: DepartmentCutoff[];
  isDirectAdmission: boolean;
  statedMinimumGrade?: StatedMinimumGrade | null;
  confidence: number;
  // انظر Department.tuitionFees أعلاه لنفس القاعدة (أهلية فقط، undefined للحكومية).
  tuitionFees?: { صباحي: number | null; مسائي: number | null };
  admissionSuspended?: boolean;
  /** حد التقديم المسائي لكل فرع يقبله القسم (حكومي بدراسة مسائية فقط) -- data/evening-rules.json. */
  eveningByBranch?: Record<string, number | null>;
  /** مصدر حد المسائي وسقف أجوره: السنة وحالتها وصفّ القاعدة (data/evening-rules.json). */
  evening?: EveningInfo;
  /** الجنس لقسم محدَّد فقط (انظر Department.genderRestriction). */
  genderRestriction?: GenderRestriction;
  genderByBranch?: Record<string, { ذكر: number; أنثى: number }>;
}

export type GenderRestriction = "ذكر" | "أنثى";

/** وصف حد المسائي لقسم: من أي سنة وأي صف قاعدة، وسقف الأجور السنوية (دينار). */
export interface EveningInfo {
  year: string;
  status: "reported" | "official-guide" | string;
  ruleId: string;
  /** table = صف مباشر؛ official-2025 = احتياط دليل 2025-2026؛ inferred-* = استدلال موثَّق. */
  basis: string;
  note: string | null;
  feeCap: number | null;
  feeYear: string | null;
  feeRuleId: string | null;
  /** حدّا الذكور والإناث حين يختلفان (التربية البدنية 2025-2026 فقط). */
  genderFloors?: { ذكر: number; أنثى: number };
}

/**
 * تطبيع النص العربي لأغراض المطابقة فقط: يوحّد صيغ الهمزة (أ/إ/آ) ويحذف
 * حرف الألف المجرد بالكامل. هذا يعالج عيباً معروفاً ومتكرراً في استخراج
 * النصوص من ملفات PDF الرسمية (دليل الطالب) حيث ينعكس ترتيب حرفي "ل" و"ا"
 * ضمن رابطة "لا" أحياناً (مثال: "الاتصالات" تُستخرج أحياناً "االتصاالت").
 * إسقاط الألف من الجهتين قبل المقارنة يجعل المطابقة متينة أمام هذا الخلل
 * دون الحاجة لتكرار كل صيغة تالفة يدوياً في قاموس المطابقة.
 */
import { normalizeForPatternMatch } from "./departmentNormalizer";

function stripCollegePrefix(name: string): string {
  return (name || "").replace(/^(كلية|كليات|معهد|المعهد)\s+/, "").trim() || name;
}

function normalizeArabic(text: string): string {
  return normalizeForPatternMatch(text);
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
  // فحص البادئة المانعة *قبل* أي مطابقة جذر (TASKS.md المهمة ٢) — إن بدأ
  // اسم القسم الفعلي بإحدى البادئات المستبعَدة لهذا التخصص، لا يُطابَق
  // إطلاقاً بصرف النظر عن قوة تطابق النمط/الاسم البديل/التطابق التام.
  if (
    mapping.excludeIfDepartmentStartsWith &&
    startsWithAnyPrefix(departmentName, mapping.excludeIfDepartmentStartsWith)
  ) {
    return { isMatch: false, confidence: 0 };
  }

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
    const matchingPatterns = mapping.departmentPatterns.filter((pattern) => depNorm.includes(normalizeArabic(pattern)));

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
        let matchRes = matchMajorToDepartment(major, dept.name, mapping);
        if (!matchRes.isMatch && (dept.name === "عام" || (dept as any).isCollegeLevelProgram)) {
          const collegeStripped = stripCollegePrefix(college.name);
          const fallbackRes = matchMajorToDepartment(major, collegeStripped, mapping);
          if (fallbackRes.isMatch) {
            matchRes = fallbackRes;
          }
        }

        if (matchRes.isMatch) {
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
            confidence: matchRes.confidence,
            tuitionFees: dept.tuitionFees ?? undefined,
            admissionSuspended: dept.admissionSuspended ?? false,
            ...(dept.eveningByBranch ? { eveningByBranch: dept.eveningByBranch } : {}),
            ...(dept.evening ? { evening: dept.evening } : {}),
            ...(dept.genderRestriction ? { genderRestriction: dept.genderRestriction } : {}),
            ...(dept.genderByBranch ? { genderByBranch: dept.genderByBranch } : {}),
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
export function rankUniversityOfferings(offerings: UniversityOffering[]): UniversityOffering[] {
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
