import { describe, it, expect } from "vitest";
import { admissionCell, GOV_NO_PUBLISHED_CUTOFF } from "./admissionLabel";
import universitiesData from "../data/universities.json";
import exceptionsData from "../data/direct-admission-exceptions.json";

describe("Phase 4: Admission Truth Regression Tests (PLAN-ADMISSION-FIX.md §8)", () => {
  const universities = universitiesData.universities;
  const govUniversities = universities.filter((u) => u.type === "حكومية");

  it("1. المكامن النفطية / جامعة الموصل: معدل 90% وصفر تكرار مشوّه", () => {
    const mosul = govUniversities.find((u) => u.name === "جامعة الموصل");
    expect(mosul).toBeDefined();
    const miningCollege = mosul?.colleges.find((c) => c.name === "كلية هندسة النفط والتعدين");
    expect(miningCollege).toBeDefined();

    // القسم المعتمد يحمل 90
    const dept = miningCollege?.departments.find((d) => d.name === "قسم المكامن النفطية");
    expect(dept).toBeDefined();
    expect(dept?.averageGrades["صباحي"]).toBe(90);
    expect(dept?.admissionStatus).toBe("published");
    expect(dept?.isDirectAdmission).toBe(false);

    // القسم المكرر المشوّه من الفصل الثالث تم دمجه وحذفه
    const dupe = miningCollege?.departments.find((d) => d.name === "قسم هندسة المكامن النفطية");
    expect(dupe).toBeUndefined();
  });

  it("2. كيمياء التربية للعلوم الصرفة / جامعة بغداد: رقم مسائي وليس مباشراً", () => {
    const baghdad = govUniversities.find((u) => u.name === "جامعة بغداد");
    expect(baghdad).toBeDefined();
    const college = baghdad?.colleges.find((c) => c.name.includes("التربية للعلوم الصرفة"));
    expect(college).toBeDefined();
    const chemistry = college?.departments.find((d) => d.name.includes("الكيمياء"));
    expect(chemistry).toBeDefined();

    expect(chemistry?.isDirectAdmission).toBe(false);
    expect(chemistry?.averageGrades["مسائي"]).toBe(60);
    expect(chemistry?.admissionStatus).toBe("published");

    // فحص عرض الخلية: المسائي يعرض 60%
    const eveningCell = admissionCell(
      "حكومية",
      true,
      !!chemistry?.isDirectAdmission,
      chemistry?.averageGrades["مسائي"],
      null
    );
    expect(eveningCell.text).toBe("60%");
    expect(eveningCell.tone).toBe("competitive");
  });

  it("3. كلية التميز / جامعة بغداد: لا حدّ منشور في دليل 2025-2026 وصفر قبول مباشر", () => {
    const baghdad = govUniversities.find((u) => u.name === "جامعة بغداد");
    const tamayuz = baghdad?.colleges.find((c) => c.name === "كلية التميز");
    expect(tamayuz).toBeDefined();
    expect(tamayuz?.departments.length).toBeGreaterThan(0);

    for (const d of tamayuz!.departments) {
      expect(d.isDirectAdmission).toBe(false);
      expect(d.admissionStatus).toBe("noPublishedCutoff");
      expect(d.averageGrades["صباحي"]).toBeNull();
      expect(d.averageGrades["مسائي"]).toBeNull();

      const cell = admissionCell("حكومية", true, !!d.isDirectAdmission, d.averageGrades["صباحي"], null);
      expect(cell.text).toBe(GOV_NO_PUBLISHED_CUTOFF);
      expect(cell.tone).toBe("unstated");
    }
  });

  it("4. صفر قبول مباشر في كل الأقسام الحكومية (1,694 قسماً)", () => {
    let govDeptsCount = 0;
    const directOffenders: string[] = [];

    for (const u of govUniversities) {
      for (const c of u.colleges) {
        for (const d of c.departments) {
          govDeptsCount++;
          if (d.isDirectAdmission) {
            directOffenders.push(`${u.name} / ${c.name} / ${d.name}`);
          }
        }
      }
    }

    expect(govDeptsCount).toBe(1694);
    expect(directOffenders).toEqual([]);
  });

  it("5. تفريغ data/direct-admission-exceptions.json تماماً", () => {
    expect(exceptionsData).toEqual([]);
  });

  it("6. لا مسار في admissionCell يُنتج 'قبول مباشر' لأي قسم حكومي", () => {
    for (const u of govUniversities) {
      for (const c of u.colleges) {
        for (const d of c.departments) {
          for (const session of ["صباحي", "مسائي"] as const) {
            const available = (d.sessions as string[]).includes(session);
            const grade = (d.averageGrades as Record<string, number | null | undefined>)[session];
            const cell = admissionCell(u.type, available, d.isDirectAdmission, grade, null);
            expect(cell.text).not.toBe("قبول مباشر");
            expect(cell.tone).not.toBe("direct");
          }
        }
      }
    }
  });
});
