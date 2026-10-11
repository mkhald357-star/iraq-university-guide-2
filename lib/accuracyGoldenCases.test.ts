import { describe, it, expect } from "vitest";
import universitiesData from "../data/universities.json";

// حالات ذهبية لخطة الدقة (PLAN-ADMISSION-ACCURACY.md م0).
// `it.fails` = عيب معروف موثَّق: يمرّ الاختبار ما دام العيب قائماً، وحين يُصلَح العيب يبدأ بالفشل فيُنبّه
// إلى تحويله إلى `it` عادي. الحالات العادية (`it`) تحرس إصلاحات تمّت.

type Cut = { branch: string; gender: string; averagePercent: number; isQuota: boolean };
type Dept = {
  name: string;
  cutoffs: Cut[];
  averageGrades: { صباحي: number | null; مسائي: number | null };
  morningByBranch?: Record<string, number | null>;
};
type College = { name: string; departments: Dept[] };
type Uni = { id: string; name: string; type: string; colleges: College[] };
const unis = universitiesData.universities as unknown as Uni[];
const uni = (id: string) => unis.find((u) => u.id === id)!;
const college = (id: string, name: string) => uni(id).colleges.find((c) => c.name === name)!;
const values = (d: Dept, branch: string, gender = "مختلط") =>
  [
    ...new Set(
      d.cutoffs.filter((c) => !c.isQuota && c.branch === branch && c.gender === gender).map((c) => c.averagePercent)
    ),
  ].sort((a, b) => b - a);

describe("حالات ذهبية: عيوب معروفة (it.fails حتى تُصلَح)", () => {
  it.fails("إدارة واقتصاد البصرة: حد الحرم الرئيسي (علمي 70) لا يختلط بحد القرنة (68.29)", () => {
    const c = college("basrah", "كلية االدارة واالقتصاد");
    const d = c.departments.find((x) => x.name === "قسم ادارة االعمال")!;
    expect(values(d, "علمي")).toHaveLength(1);
  });

  it.fails("إدارة واقتصاد تكريت: حد الشرقاط (61.14) لا يختلط بحد الحرم الرئيسي (60)", () => {
    const c = college("tikrit", "كلية االدارة واالقتصاد");
    const merged = c.departments.filter((d) => values(d, "علمي").length > 1 || values(d, "أدبي").length > 1);
    expect(merged).toHaveLength(0);
  });

  it.fails("التربية البدنية مسائي: 57 للذكور و55 للإناث (القيمة 56 مختلَقة، والرقم الحالي 60/56)", () => {
    const rows: number[] = [];
    for (const u of unis.filter((x) => x.type === "حكومية")) {
      for (const c of u.colleges) {
        if (!/التربية البدنية/.test(c.name)) continue;
        for (const d of c.departments) if (d.averageGrades["مسائي"] != null) rows.push(d.averageGrades["مسائي"]);
      }
    }
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((v) => v === 57 || v === 55)).toBe(true);
  });

  it.fails("إدارة واقتصاد: حد المسائي الرسمي 60 (فقرة ح) لا 58", () => {
    const c = uni("basrah").colleges.find((x) => x.name === "كلية االدارة واالقتصاد")!;
    for (const d of c.departments) expect(d.averageGrades["مسائي"]).toBe(60);
  });

  it.fails("حرم كركوك للجامعة التقنية الشمالية يخصّ محافظة كركوك لا نينوى (مقر الجامعة): حقل province للحرم", () => {
    const c = uni("northern_technical").colleges.find((x) => x.name === "المعهد التقني الطبي/كركوك") as unknown as {
      province?: string;
    };
    expect(c.province).toBe("كركوك");
  });

  it.fails("لا يُعرض قسم بحد إناث فقط كأنه متاح للذكر: الحقل genders غير موجود بعد (م2)", () => {
    const d = college("mosul", "كلية التربية األساسية").departments.find((x) => x.name === "قسم رياض االطفال للبنات")!;
    expect(Object.prototype.hasOwnProperty.call(d, "genders")).toBe(true);
  });
});

describe("حالات ذهبية: إصلاحات قائمة (it)", () => {
  it("تمريض المعهد الطبي/الشمالية: الموصل 90.14 وكركوك 87.71 في سجلّين", () => {
    const nt = uni("northern_technical");
    const nursing = (campus: string) =>
      nt.colleges
        .find((c) => c.name === `المعهد التقني الطبي/${campus}`)!
        .departments.find((d) => d.name === "قسم تقنيات التمريض")!;
    expect(values(nursing("الموصل"), "علمي", "ذكر")).toEqual([90.14]);
    expect(values(nursing("كركوك"), "علمي", "ذكر")).toEqual([87.71]);
  });

  it("علم النفس/آداب بغداد لطالب العلمي: 81.71 لا 60 (أدنى حد بين الفروع)", () => {
    const d = college("baghdad", "كلية اآلداب").departments.find((x) => x.name === "قسم علم النفس")!;
    expect(d.averageGrades["صباحي"]).toBe(60);
    expect(d.morningByBranch?.["علمي"]).toBe(81.71);
  });

  it("آثار الموصل: كلية واحدة وحدودها الثلاثة الرسمية", () => {
    const arch = uni("mosul").colleges.filter((c) => /االثار|الآثار/.test(c.name));
    expect(arch).toHaveLength(1);
    const d = arch[0].departments.find((x) => x.name === "آثار قديمة")!;
    expect(values(d, "أدبي")).toEqual([57.14]);
    expect(values(d, "علمي")).toEqual([55.29]);
    expect(values(d, "فنون")).toEqual([55.14]);
  });
});
