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

  it.fails("حرم كركوك للجامعة التقنية الشمالية يخصّ محافظة كركوك لا نينوى (مقر الجامعة): حقل province للحرم", () => {
    const c = uni("northern_technical").colleges.find((x) => x.name === "المعهد التقني الطبي/كركوك") as unknown as {
      province?: string;
    };
    expect(c.province).toBe("كركوك");
  });
});

describe("حالات ذهبية: إصلاحات قائمة (it)", () => {
  type EveningDept = Dept & {
    eveningByBranch?: Record<string, number | null>;
    evening?: { year: string; note: string | null; feeCap: number | null };
  };

  it("المسائي: إدارة واقتصاد 60 لعلمي وأدبي (جدول 2026-2027)، لا 58، ولا فنون", () => {
    const c = college("basrah", "كلية االدارة واالقتصاد");
    for (const d of c.departments as EveningDept[]) {
      expect(d.eveningByBranch?.["علمي"], d.name).toBe(60);
      expect(d.evening?.year).toBe("2026-2027");
    }
  });

  it("المسائي: الهندسة 70، التمريض 80، العلوم 65 (الرفع المعلَن لعام 2026-2027)", () => {
    const eng = (college("baghdad", "كلية الهندسة").departments as EveningDept[]).filter((d) => d.eveningByBranch);
    expect(eng.length).toBeGreaterThan(0);
    for (const d of eng) expect(d.eveningByBranch?.["علمي"], d.name).toBe(70);
    const nursing = unis.flatMap((u) => u.colleges).filter((c) => /تمريض/.test(c.name));
    for (const c of nursing)
      for (const d of c.departments as EveningDept[]) if (d.eveningByBranch) expect(d.eveningByBranch["علمي"]).toBe(80);
    const sci = college("baghdad", "كلية العلوم").departments as EveningDept[];
    for (const d of sci.filter((x) => x.eveningByBranch)) expect(d.eveningByBranch?.["علمي"], d.name).toBe(65);
  });

  it("المسائي: التربية البدنية 55 (الأدنى) مع تنبيه 57 ذكور/55 إناث، ولا قيمة 56 مختلَقة", () => {
    const values: number[] = [];
    for (const u of unis.filter((x) => x.type === "حكومية")) {
      for (const c of u.colleges) {
        if (!/التربية البدنية/.test(c.name)) continue;
        for (const d of c.departments as EveningDept[]) {
          if (d.averageGrades["مسائي"] == null) continue;
          values.push(d.averageGrades["مسائي"]);
          expect(d.evening?.note, `${u.name} / ${c.name}`).toContain("57");
        }
      }
    }
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => v === 55)).toBe(true);
  });

  it("المسائي: كل قسم مسائي يحمل سقف أجور وسنة مصدر، ولا قيمة خارج جدول القواعد", () => {
    const allowed = new Set([50, 55, 57, 58, 60, 65, 67, 70, 75, 80]);
    let n = 0;
    for (const u of unis.filter((x) => x.type === "حكومية")) {
      for (const c of u.colleges) {
        for (const d of c.departments as (Dept & { sessions: string[] } & EveningDept)[]) {
          if (!d.sessions.includes("مسائي")) continue;
          n++;
          expect(d.evening?.feeCap, `${u.name}/${c.name}/${d.name}`).toBeGreaterThan(0);
          for (const v of Object.values(d.eveningByBranch ?? {}))
            if (v != null) expect(allowed.has(v), String(v)).toBe(true);
        }
      }
    }
    expect(n).toBeGreaterThan(1000);
  });

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

  describe("الجنس لقسم محدَّد فقط (م2)", () => {
    type G = Dept & {
      genderRestriction?: string;
      genderByBranch?: Record<string, { ذكر: number; أنثى: number }>;
    };
    const gov = unis.filter((u) => u.type !== "أهلية" && u.type !== "private" && u.type !== "أهلي");
    const all: { d: G; c: string }[] = [];
    for (const u of gov) for (const c of u.colleges) for (const d of c.departments) all.push({ d: d as G, c: c.name });

    it("رياض أطفال الموصل للبنات: للإناث فقط", () => {
      const d = college("mosul", "كلية التربية األساسية").departments.find(
        (x) => x.name === "قسم رياض االطفال للبنات"
      ) as G;
      expect(d.genderRestriction).toBe("أنثى");
    });

    it("القيد يظهر فقط لقسم كل حدوده الرسمية لجنس واحد، ولا يظهر لقسم فيه حدّ مختلط", () => {
      for (const { d } of all) {
        const genders = new Set(d.cutoffs.filter((c) => !c.isQuota).map((c) => c.gender));
        if (d.genderRestriction) {
          expect([...genders], d.name).toEqual([d.genderRestriction]);
        } else {
          expect(genders.size === 1 && !genders.has("مختلط"), d.name).toBe(false);
        }
      }
    });

    it("genderByBranch: حدّان مختلفان فعلاً، ويطابقان cutoffs الرسمية", () => {
      let n = 0;
      for (const { d } of all) {
        for (const [branch, g] of Object.entries(d.genderByBranch ?? {})) {
          n++;
          expect(g.ذكر, d.name).not.toBe(g.أنثى);
          expect(values(d, branch, "ذكر")).toContain(g.ذكر);
          expect(values(d, branch, "أنثى")).toContain(g.أنثى);
        }
      }
      expect(n).toBeGreaterThan(0);
    });

    it("القسم المختلط لا يحمل أي حقل جنس (بيانات حكومية)", () => {
      const mixed = all.filter(({ d }) => d.cutoffs.length > 0 && d.cutoffs.every((c) => c.gender === "مختلط"));
      expect(mixed.length).toBeGreaterThan(500);
      for (const { d } of mixed) {
        expect(d.genderRestriction, d.name).toBeUndefined();
        expect(d.genderByBranch, d.name).toBeUndefined();
      }
    });
  });
});
