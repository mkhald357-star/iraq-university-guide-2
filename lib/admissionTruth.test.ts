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

  // 1,694 ← 1,687 بعد إصلاح الأحرم/السجلات المكررة (2026-10-11): 7 أقسام وهمية أو مكررة
  // اندمجت (4 أقسام آثار الموصل ← 3، علوم أغذية تكريت، ثلاثة أقسام بجامعة الفرات الأوسط
  // بأسماء الكلية نفسها، الطارمية/المقدادية/الدواية) دون فقد أي حد رسمي.
  it("4. صفر قبول مباشر في كل الأقسام الحكومية (1,687 قسماً)", () => {
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

    expect(govDeptsCount).toBe(1687);
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

  // ===== حراس إصلاح الأحرم والسجلات المكررة (تدقيق «الحدود الدنيا» ص15-24، 2026-10-11) =====
  const uniById = (id: string) => govUniversities.find((u) => u.id === id)!;
  type Cut = { branch: string; gender: string; averagePercent: number; isQuota: boolean };
  const pubCutoffs = (d: { cutoffs?: Cut[] }) =>
    (d.cutoffs ?? [])
      .filter((c) => !c.isQuota)
      .map((c) => `${c.branch}:${c.averagePercent}`)
      .sort();

  it("7. كلية آثار الموصل: سجل واحد، وأقسامها الثلاثة تحمل حد الكلية بفروعها الصحيحة", () => {
    const mosul = uniById("mosul");
    const arch = mosul.colleges.filter((c) => /االثار|الآثار|الاثار/.test(c.name));
    expect(arch.length).toBe(1);
    const byName = Object.fromEntries(arch[0].departments.map((d) => [d.name, d]));
    expect(Object.keys(byName).sort()).toEqual(
      ["آثار قديمة", "الحفاظ على الآثار والمخطوطات", "اللغات العراقية القديمة"].sort()
    );
    // حد الكلية الرسمي: أدبي 57.14، علمي 55.29، فنون 55.14 -- والفنون لـ"آثار قديمة" وحدها (فروع الفصل 3)
    expect(pubCutoffs(byName["آثار قديمة"])).toEqual(["أدبي:57.14", "علمي:55.29", "فنون:55.14"]);
    expect(pubCutoffs(byName["الحفاظ على الآثار والمخطوطات"])).toEqual(["أدبي:57.14", "علمي:55.29"]);
    expect(pubCutoffs(byName["اللغات العراقية القديمة"])).toEqual(["أدبي:57.14", "علمي:55.29"]);
    for (const d of arch[0].departments) expect(d.admissionStatus).toBe("published");
  });

  it("8. أحرم الجامعة التقنية الشمالية لا تُدمج: حدّ كل حرم في سجله (الأجهزة الطبية: الموصل 84.57، كركوك 81.57)", () => {
    const nt = uniById("northern_technical");
    const eng = nt.colleges.filter((c) => c.name.startsWith("الكلية التقنية الهندسية/"));
    const names = eng.map((c) => c.name).sort();
    expect(names).toContain("الكلية التقنية الهندسية/الموصل");
    expect(names).toContain("الكلية التقنية الهندسية/كركوك");
    expect(nt.colleges.some((c) => c.name === "الكلية التقنية الهندسية")).toBe(false);
    const dev = (campus: string) =>
      nt.colleges
        .find((c) => c.name === `الكلية التقنية الهندسية/${campus}`)!
        .departments.find((d) => /االجهزة الطبية|الاجهزة الطبية/.test(d.name.replace("األ", "اال")))!;
    expect(pubCutoffs(dev("الموصل"))).toEqual(["علمي:84.57"]);
    expect(pubCutoffs(dev("كركوك"))).toEqual(["علمي:81.57"]);
  });

  it("9. الكلية التقنية الصحية والطبية / الفرات الأوسط: الكوفة 96.57 وبابل 96.14 كلٌّ في سجله", () => {
    const mec = uniById("middle_euphrates_technical");
    const kufa = mec.colleges.find((c) => c.name === "الكلية التقنية الصحية والطبية")!;
    const babil = mec.colleges.find((c) => c.name === "الكلية التقنية الصحية والطبية/بابل")!;
    expect(kufa).toBeDefined();
    expect(babil).toBeDefined();
    const lab = kufa.departments.find((d) => d.name.includes("المختبرات الطبية"))!;
    expect(pubCutoffs(lab)).toEqual(["علمي:96.57"]);
    expect(babil.departments.length).toBeGreaterThan(0);
    for (const d of babil.departments) {
      expect(pubCutoffs(d)).toEqual(["علمي:96.14"]);
      expect(d.admissionStatus).toBe("published");
    }
  });

  it("10. أقسام أحرم المسائي كانت بلا حد صباحي: تحمل الآن حد حرمها الرسمي", () => {
    const expectCut = (uniId: string, college: string, grade: Record<string, number[]>) => {
      const c = uniById(uniId).colleges.find((x) => x.name === college);
      expect(c, `${uniId} / ${college}`).toBeDefined();
      expect(c!.departments.length).toBeGreaterThan(0);
      for (const d of c!.departments) {
        const vals = (d.cutoffs as Cut[])
          .filter((x) => !x.isQuota)
          .map((x) => x.averagePercent)
          .sort((a, b) => a - b);
        expect(vals, `${uniId} / ${college} / ${d.name}`).toEqual(
          Object.values(grade)
            .flat()
            .sort((a, b) => a - b)
        );
        expect(d.admissionStatus).toBe("published");
      }
    };
    expectCut("tikrit", "كلية علوم االغذية/الشرقاط", { a: [60] });
    expectCut("middle_euphrates_technical", "الكلية التقنية االقسام الطبية/المسيب", { a: [91.29] });
    expectCut("middle_euphrates_technical", "كلية تقنيات التاهيل الطبي واالطراف الصناعية/الكوفة", { a: [89.29] });
    // إدارة المستشفيات علمي فقط بحسب الدليل (dalel.full.txt:2681) فلا يصلها حد الأدبي 61.57
    const kufaAdmin = uniById("middle_euphrates_technical").colleges.find(
      (x) => x.name === "الكلية التقنية االدارية/الكوفة"
    )!;
    const kufaCuts = (needle: string) =>
      (kufaAdmin.departments.find((d) => d.name.includes(needle))!.cutoffs as Cut[])
        .map((x) => x.averagePercent)
        .sort((a, b) => a - b);
    expect(kufaCuts("ادارة االعمال")).toEqual([60, 61.57]);
    expect(kufaCuts("المحاسبة")).toEqual([60, 61.57]);
    expect(kufaCuts("المستشفيات")).toEqual([60]);
    expectCut("middle_technical", "معهد اعداد المدربين التقنيين/بغداد", { a: [50.57] });
  });

  it("11. لا سجل كلية مكرَّر بنفس الاسم الأساسي بلا أقسام تحمل حدوداً (سجل مسائي موازٍ بلا حد)", () => {
    // سجل "X/حرم" الذي كل أقسامه بلا حد صباحي بينما سجل "X" المقابل يحمل حد الكلية = العطل المُصلَح.
    const offenders: string[] = [];
    type LooseCollege = { name: string; departments: { cutoffs: unknown[]; sessions: string[] }[] };
    for (const u of govUniversities) {
      const byBase = new Map<string, LooseCollege[]>();
      for (const c of u.colleges as unknown as LooseCollege[]) {
        const base = c.name.split("/")[0].trim();
        (byBase.get(base) ?? byBase.set(base, []).get(base)!).push(c);
      }
      for (const [base, list] of byBase) {
        if (list.length < 2) continue;
        const campusOnly = list.filter((c) => c.name.includes("/"));
        for (const c of campusOnly) {
          const noMorning = c.departments.every((d) => !d.cutoffs.length);
          const siblingHasCut = list.some((o) => o !== c && o.departments.some((d) => d.cutoffs.length));
          if (noMorning && siblingHasCut && c.departments.some((d) => d.sessions.includes("صباحي"))) {
            offenders.push(`${u.name} / ${c.name}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
