import { describe, it, expect } from "vitest";
import { matchMajorToDepartment, type Major } from "./majorMatcher";
import universitiesData from "../data/universities.json";
import majorsData from "../data/majors.json";
import mappingData from "../data/major_department_mapping.json";

// اختبار انحدار حقيقي (اكتُشف 2026-07-25 أثناء تدقيق مسح شامل لكل أنماط
// المطابقة القصيرة الطول بعد الملاحظة العامة "أي أنماط مطابقة أخرى عرضة
// لنفس نوع عطل §5.3-ب؟"): بعض أنماط `departmentPatterns` القصيرة كانت
// تتطابق -- بعد التطبيع العربي (`normalizeArabic` يحذف "ال" وكل حرف ألف) --
// مع جذر عربي مشترك مصادفة داخل كلمة أطول لا علاقة لها إطلاقاً بالتخصص
// المقصود. مثال جوهري: نمط "الطب" (طب) كان يطابق أي قسم يحتوي كلمة تحوي
// "طبي"/"طبية" (الصفة "طبي" الوصفية) أو حتى "تطبيقية" (تطبيق) كجذر فرعي --
// فتصادف نتيجة أن "قسم الجغرافية التطبيقية" و"هندسة الطب الحياتي" و"طب
// الأسنان" (تخصص منفصل تماماً) كانت كلها تُحتسَب ضمن عروض تخصص "الطب" ذاته،
// وكانت تُفسِد حتى "الحد الأدنى الملاحَظ" المعروض للطالب (50.29% بدل الرقم
// الحقيقي 99.57% لكلية الطب ببغداد -- خطأ يضلِّل طالباً بمعدل متوسط ليظن أن
// فرصته حقيقية).
//
// هذا الاختبار يفحص كامل قاعدة البيانات الحقيقية (لا عيّنة) لكل حالة
// مؤكَّدة، بنفس منهجية lib/prefixGuard.test.ts بالضبط.

const allDepartments: string[] = [];
for (const uni of (universitiesData as any).universities) {
  for (const college of uni.colleges) {
    for (const dept of college.departments) {
      allDepartments.push(dept.name);
    }
  }
}

const majors = majorsData as Major[];
const mappings = mappingData.mappings as any[];

function majorById(id: string): Major {
  const m = majors.find((x) => x.id === id);
  if (!m) throw new Error(`اختبار غير صالح: لا يوجد تخصص بمعرّف ${id}`);
  return m;
}
function mappingById(id: string) {
  const m = mappings.find((x) => x.majorId === id);
  if (!m) throw new Error(`اختبار غير صالح: لا خريطة مطابقة لمعرّف ${id}`);
  return m;
}
function isMatch(majorId: string, dep: string): boolean {
  return matchMajorToDepartment(majorById(majorId), dep, mappingById(majorId)).isMatch;
}

describe("لا تصادم بين تخصصات غير مرتبطة بسبب جذر عربي قصير مشترك مصادفة", () => {
  it("قائمة الأقسام الحقيقية غير فارغة (تحقّق أن التحميل نجح)", () => {
    expect(allDepartments.length).toBeGreaterThan(1000);
  });

  describe('medicine (الطب) لا يبتلع تخصصات أخرى تحوي صفة "طبي/طبية" أو جذر "تطبيق"', () => {
    it('لا قسم "تطبيقية" (جغرافيا/فنون/كيمياء تطبيقية إلخ) يُطابَق الطب', () => {
      const falsePositives = allDepartments.filter((d) => d.includes("تطبيق") && isMatch("medicine", d));
      expect(falsePositives).toEqual([]);
    });
    it('لا قسم "طب الأسنان" (تخصص dentistry منفصل) يُطابَق الطب العام', () => {
      const dep = allDepartments.find((d) => d.includes("طب") && d.includes("سنان"));
      expect(dep).toBeTruthy();
      expect(isMatch("medicine", dep as string)).toBe(false);
    });
    it('لا قسم "هندسة الطب الحياتي" (biomedical engineering، تخصص منفصل) يُطابَق الطب العام', () => {
      const dep = allDepartments.find((d) => d.includes("الطب الحياتي"));
      expect(dep).toBeTruthy();
      expect(isMatch("medicine", dep as string)).toBe(false);
    });
    it('القسم الحقيقي "الطب" (البسيط) لا يزال يُطابَق (الإصلاح لم يفقد المطابقة الصحيحة)', () => {
      const dep = allDepartments.find((d) => d.trim() === "الطب");
      expect(dep).toBeTruthy();
      expect(isMatch("medicine", dep as string)).toBe(true);
    });
  });

  describe('islamic_studies (العلوم الإسلامية) لا يبتلع "التعدين" (Mining، جذر "دين" داخل "تعدين" مصادفة)', () => {
    it("لا قسم تعدين حقيقي يُطابَق العلوم الإسلامية", () => {
      const falsePositives = allDepartments.filter((d) => d.includes("تعدين") && isMatch("islamic_studies", d));
      expect(falsePositives).toEqual([]);
    });
    it("الفقه (قسم إسلامي حقيقي) لا يزال يُطابَق", () => {
      const dep = allDepartments.find((d) => d.includes("الفقه") && !d.includes("تعدين"));
      expect(dep).toBeTruthy();
      expect(isMatch("islamic_studies", dep as string)).toBe(true);
    });
  });

  describe('business_admin (إدارة الأعمال) لا يبتلع أقسام هندسة "العمليات" (جذر "عمل" داخل "عمليات" مصادفة)', () => {
    it("لا قسم هندسة عمليات كيمياوية/نفطية يُطابَق إدارة الأعمال", () => {
      const falsePositives = allDepartments.filter((d) => d.includes("هندسة العمليات") && isMatch("business_admin", d));
      expect(falsePositives).toEqual([]);
    });
    it("إدارة الأعمال (القسم الحقيقي) لا يزال يُطابَق", () => {
      const dep = allDepartments.find((d) => d.trim() === "إدارة الأعمال" || d.trim() === "ادارة الاعمال");
      expect(dep).toBeTruthy();
      expect(isMatch("business_admin", dep as string)).toBe(true);
    });
  });

  describe('archaeology (الآثار) لا يبتلع "الأنثروبولوجيا وا لاجتماع" (جذر "ثر" داخل الكلمة مصادفة)', () => {
    it("لا قسم أنثروبولوجيا يُطابَق الآثار", () => {
      const falsePositives = allDepartments.filter((d) => d.includes("نثروبولوج") && isMatch("archaeology", d));
      expect(falsePositives).toEqual([]);
    });
    it("الآثار (القسم الحقيقي، جامعة الموصل) لا يزال يُطابَق", () => {
      // ملاحظة (2026-08-10، راجع §32 في admission_rules.md): كان هذا الاختبار
      // يبحث عن تطابق نصّي حرفي تام مع "الآثار" -- سلسلة لم تكن موجودة أبداً في
      // أي جدول جامعة حقيقي؛ كانت تنجح مصادفةً فقط بسبب سجل ملفَّق (جامعة نينوى
      // / كلية الآثار / الآثار) لم يكن له وجود في المصدر الرسمي. بعد حذف السجل
      // الملفَّق وإضافة الأقسام الحقيقية الثلاثة لكلية الآثار بجامعة الموصل
      // (المصدر الفعلي)، الاختبار الآن يتحقق من اسم قسم حقيقي فعلاً.
      const dep = allDepartments.find((d) => d.includes("آثار قديمة"));
      expect(dep).toBeTruthy();
      expect(isMatch("archaeology", dep as string)).toBe(true);
    });
  });
});
