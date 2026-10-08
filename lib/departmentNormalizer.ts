// دالة موحدة لتطبيع أسماء الأقسام والكليات لمطابقة الحدود الدنيا والتخصصات
// تُستخدَم في المنطق المشترك واختبارات التطابق.
// انظر PLAN-ADMISSION-FIX.md §5 (1-ب)

export function normalizeArabicText(s: string): string {
  if (!s) return "";
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/ئ/g, "ي")
      .replace(/ؤ/g, "و")
      // إزالة تكرار الألف الناتج عن أخطاء OCR (مثل االقتصاد -> الاقتصاد)
      .replace(/ا{2,}/g, "ا")
      // إزالة "ال" التعريف عند حدود الكلمات
      .replace(/(^|\s)ال/g, "$1")
      // إزالة كل الألف المتبقية لتفادي تقلبات رابطة لام-ألف
      .replace(/ا/g, "")
      // إزالة المسافات وعلامات الترقيم
      .replace(/[\s\-_/\\().,]+/g, "")
  );
}

// تطبيع مطابقة التخصصات بالأنماط -- مطابق حرفياً لسلوك majorMatcher.ts قبل PLAN-ADMISSION-FIX.
// لا تُدمج فيه تحويلات إضافية: أنماط major_department_mapping.json كُتبت على هذا السلوك بالذات
// ("االعالم" تبقى "لعلم" لا "علم")، ودمج الألفات أو تحويل ئ->ي يحوّل الأنماط إلى جذور قصيرة
// تطابق أقساماً لا علاقة لها ("علم النفس" ← الإعلام، "كهربائية" ← البيئة).
// يجب أن يبقى مطابقاً لنسخة scripts/departmentNormalizer.js (يفرضه lib/departmentNormalizer.test.ts).
export function normalizeForPatternMatch(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/(^|\s)ال/g, "$1")
    .replace(/ا/g, "")
    .replace(/\s+/g, "");
}

export function stripDepartmentPrefixes(name: string): string {
  if (!name) return "";
  let clean = name.trim();
  // إزالة الكلمات البادئة الشائعة: قسم، فرع، هندسة، علوم، كلية، معهد
  clean = clean.replace(/^(قسم|فرع)\s+/, "");
  clean = clean.replace(/^(هندسة|علوم|كلية|كليات|معهد|المعهد)\s+/, "");
  clean = clean.replace(/^(قسم|فرع)\s+/, "");
  return clean.trim();
}

export interface DepartmentKeyResult {
  deptKey: string;
  fullKey: string;
  fallbackKey: string;
}

export function normalizeDepartmentKey(deptName: string, collegeName?: string, uniName?: string): DepartmentKeyResult {
  const cleanDept = stripDepartmentPrefixes(deptName);
  const normDept = normalizeArabicText(cleanDept);
  const normCol = collegeName ? normalizeArabicText(collegeName.replace(/^(كلية|كليات|معهد|المعهد)\s+/, "")) : "";
  const normUni = uniName ? normalizeArabicText(uniName.replace(/^(جامعة|الجامعة)\s+/, "")) : "";

  return {
    deptKey: normDept,
    fullKey: `${normUni}|${normCol}|${normDept}`,
    fallbackKey: `${normUni}|${normDept}`,
  };
}
