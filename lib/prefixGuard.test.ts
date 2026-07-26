import { describe, it, expect } from "vitest";
import { matchMajorToDepartment, type Major } from "./majorMatcher";
import universitiesData from "../data/universities.json";
import majorsData from "../data/majors.json";
import mappingData from "../data/major_department_mapping.json";

// اختبار انحدار (TASKS.md المهمة ٢): يمرّ فعلياً على كل قسم حقيقي في
// data/universities.json (لا عيّنة) للتأكد أن أياً من أزواج «هندسة/تقنيات»
// السبعة المُصلَحة لا يتصادم بعد الآن. اختبار حقيقي على البيانات الحقيقية،
// لا بيانات وهمية -- لهذا هو الدليل الأقوى على أن الإصلاح يعمل فعلاً على
// نطاق المنصة كلها لا حالة واحدة معزولة.

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

// الأزواج السبعة المكتشَفة فعلياً عبر مسح كامل لـ data/universities.json
// (150 اسم قسم هندسي، 174 اسم قسم تقني) -- موثَّقة في TASKS.md المهمة ٢
// وفي data/major_riasec_profiles.json._meta.engineering_vs_technical_split_2026_07_23
const PAIRS: [string, string][] = [
  ["cybersecurity", "cybersecurity_tech"],
  ["ai", "ai_tech"],
  ["electrical_engineering", "electrical_tech"],
  ["renewable_energy", "renewable_energy_tech"],
  ["petroleum_engineering", "petroleum_refining_tech"],
  ["communications_engineering", "electronics_comm_tech"],
  ["prosthetics_engineering", "prosthetics_tech"], // هندسي أولاً هنا عمداً للتناسق مع بقية القائمة
];

describe("حارس البادئة: لا تصادم بين أزواج هندسة/تقنيات السبعة على كامل قاعدة البيانات الحقيقية", () => {
  it(`فحص ${allDepartments.length} قسماً حقيقياً (تحقّق أن القائمة نفسها غير فارغة، أي أن التحميل نجح)`, () => {
    expect(allDepartments.length).toBeGreaterThan(1000);
  });

  for (const [engId, techId] of PAIRS) {
    describe(`${engId} ↔ ${techId}`, () => {
      it(`لا قسم يبدأ بـ"هندسة" يُطابَق التخصص التقني (${techId})`, () => {
        const techMajor = majorById(techId);
        const techMapping = mappingById(techId);
        const falsePositives = allDepartments.filter((dep) => {
          const stripped = dep.trim().replace(/^قسم\s+/, "");
          if (!stripped.startsWith("هندسة")) return false;
          return matchMajorToDepartment(techMajor, dep, techMapping).isMatch;
        });
        expect(falsePositives).toEqual([]);
      });

      it(`لا قسم يبدأ بـ"تقنيات" يُطابَق التخصص الهندسي (${engId})`, () => {
        const engMajor = majorById(engId);
        const engMapping = mappingById(engId);
        const falsePositives = allDepartments.filter((dep) => {
          const stripped = dep.trim().replace(/^قسم\s+/, "");
          if (!stripped.startsWith("تقنيات") && !stripped.startsWith("تقنية")) return false;
          return matchMajorToDepartment(engMajor, dep, engMapping).isMatch;
        });
        expect(falsePositives).toEqual([]);
      });
    });
  }

  // الحالة الأصلية المؤكَّدة يدوياً التي أطلقت هذا الإصلاح (TASKS.md المهمة ٢)
  it("الحالة المرجعية: قسم هندسة الأطراف والمساند الصناعية/النهرين لا يُطابَق تقنيات الأطراف الصناعية والتعويضات", () => {
    const dep = allDepartments.find((d) => d.includes("هندسة") && (d.includes("طراف") || d.includes("مساند")));
    expect(dep).toBeTruthy();
    const techMajor = majorById("prosthetics_tech");
    const techMapping = mappingById("prosthetics_tech");
    expect(matchMajorToDepartment(techMajor, dep as string, techMapping).isMatch).toBe(false);
  });
});
