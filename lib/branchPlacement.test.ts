import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import universitiesData from "../data/universities.json";
import { acceptsBranch, morningCutoffForBranch, offeringsForBranch, morningCutoffsByBranch } from "./branchCutoff";
import { computeEligibility } from "./eligibility";
import type { UniversityOffering } from "./majorMatcher";

// القسم في مكانه الصحيح (فروع الدليل) وبحدّه الصحيح (حد فرع الطالب لا أدنى حد بين الفروع).
// تدقيق 2026-10-11: reports/admission-fix/decisions-log.md (المرحلة 7).

type Cut = { branch: string; gender: string; averagePercent: number; isQuota: boolean };
type Dept = {
  name: string;
  branch: string[];
  cutoffs: Cut[];
  averageGrades: { صباحي: number | null; مسائي: number | null };
  morningByBranch?: Record<string, number | null>;
};
type Uni = { id: string; name: string; type: string; colleges: { name: string; departments: Dept[] }[] };
const universities = universitiesData.universities as unknown as Uni[];
const dept = (uniId: string, college: string, deptName: string): Dept => {
  const u = universities.find((x) => x.id === uniId)!;
  const c = u.colleges.find((x) => x.name === college)!;
  expect(c, `${uniId} / ${college}`).toBeDefined();
  const d = c.departments.find((x) => x.name === deptName)!;
  expect(d, `${uniId} / ${college} / ${deptName}`).toBeDefined();
  return d;
};
const byBranchFile = (b: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "../public/data/by-branch", `${b}.json`), "utf8")) as {
    universityId: string;
    collegeName: string;
    departmentName: string;
    universityType: string;
    averageGrades: { صباحي: number | null };
  }[];

const offering = (over: Partial<UniversityOffering>): UniversityOffering =>
  ({
    universityId: "u",
    universityName: "جامعة",
    universityType: "حكومية",
    universityRanking: null,
    province: "بغداد",
    collegeId: "c",
    collegeName: "كلية",
    departmentName: "قسم",
    departmentBranches: ["علمي", "أدبي"],
    sessions: ["صباحي"],
    averageGrades: { صباحي: 60, مسائي: null },
    cutoffs: [
      { branch: "علمي", gender: "مختلط", averagePercent: 81.71, isQuota: false },
      { branch: "أدبي", gender: "مختلط", averagePercent: 60, isQuota: false },
      { branch: "علمي", gender: "مختلط", averagePercent: 70, isQuota: true },
    ],
    isDirectAdmission: false,
    confidence: 100,
    ...over,
  }) as UniversityOffering;

describe("lib/branchCutoff: حد فرع الطالب", () => {
  it("أدنى حد غير حصة لفرع الطالب، لا أدنى حد بين الفروع، والحصة مستبعدة", () => {
    expect(morningCutoffForBranch(offering({}), "علمي")).toBe(81.71);
    expect(morningCutoffForBranch(offering({}), "أدبي")).toBe(60);
    expect(morningCutoffForBranch(offering({}), "فنون")).toBeNull();
  });

  it("قسم لا يقبل فرع الطالب لا يُعرض له؛ الأهلي بلا فروع معروفة لا يُستبعد", () => {
    expect(acceptsBranch(offering({}), "فنون")).toBe(false);
    expect(acceptsBranch(offering({ departmentBranches: [] }), "فنون")).toBe(true);
    const list = offeringsForBranch([offering({}), offering({ departmentBranches: ["فنون"] })], "علمي");
    expect(list).toHaveLength(1);
    expect(list[0].averageGrades["صباحي"]).toBe(81.71);
    expect(list[0].forBranch).toBe("علمي");
  });

  it("الأهلي (بلا cutoffs) يبقى كما هو", () => {
    const p = offering({ universityType: "أهلية", cutoffs: [], averageGrades: { صباحي: null, مسائي: null } });
    expect(morningCutoffForBranch(p, "علمي")).toBeNull();
    expect(morningCutoffsByBranch(p)).toEqual([]);
  });

  it("الأهلية تُقاس بحد فرع الطالب: طالب علمي بمعدل 70 لا يبلغ قسماً حده العلمي 81.71", () => {
    const r = computeEligibility("علمي", 70, [offering({})]);
    expect(r.branchEligible).toBe(true);
    expect(r.reachableOffers).toHaveLength(0);
    expect(r.lowestCutoff).toBe(81.71);
    const adabi = computeEligibility("أدبي", 70, [offering({})]);
    expect(adabi.reachableOffers).toHaveLength(1);
  });
});

describe("البيانات: القسم بالمكان الصحيح وبالحد الصحيح", () => {
  it("علم النفس/آداب بغداد: حد كل فرع على حدة (علمي 81.71، فنون 63.57، أدبي 60)", () => {
    const d = dept("baghdad", "كلية اآلداب", "قسم علم النفس");
    expect(d.morningByBranch).toEqual({ علمي: 81.71, فنون: 63.57, أدبي: 60 });
    const rec = byBranchFile("علمي").find(
      (r) => r.universityId === "baghdad" && r.collegeName === "كلية اآلداب" && r.departmentName === "قسم علم النفس"
    );
    expect(rec?.averageGrades["صباحي"]).toBe(81.71); // لا 60 (حد الأدبي)
  });

  it("رياضيات تربية القادسية علمي فقط بحسب الدليل: لا يظهر لطالب الأدبي ولا يحمل حد الأدبي", () => {
    const d = dept("qadisiyah", "كلية التربية", "قسم الرياضيات");
    expect(d.branch).toEqual(["علمي"]);
    expect(d.cutoffs.every((c) => c.branch === "علمي")).toBe(true);
    const inAdabi = byBranchFile("أدبي").some(
      (r) => r.universityId === "qadisiyah" && r.collegeName === "كلية التربية" && r.departmentName === "قسم الرياضيات"
    );
    expect(inAdabi).toBe(false);
  });

  it("فلسفة المستنصرية تقبل الفنون بحسب الدليل: تظهر لطالب الفنون بلا حد منشور لفرعه (لا حد فرع آخر)", () => {
    const d = dept("mustansiriyah", "كلية اآلداب", "قسم الفلسفة");
    expect(d.branch).toContain("فنون");
    expect(d.morningByBranch?.["فنون"]).toBeNull();
    const rec = byBranchFile("فنون").find(
      (r) => r.universityId === "mustansiriyah" && r.collegeName === "كلية اآلداب" && r.departmentName === "قسم الفلسفة"
    );
    expect(rec).toBeDefined();
    expect(rec?.averageGrades["صباحي"]).toBeNull();
  });

  it("كل سجل حكومي في ملفات by-branch يحمل حد فرعه بالضبط (morningByBranch)", () => {
    const index = new Map<string, Dept>();
    for (const u of universities)
      for (const c of u.colleges) for (const d of c.departments) index.set(`${u.id}|${c.name}|${d.name}`, d);
    const displayIndex = new Map<string, Dept>();
    for (const u of universitiesData.universities as unknown as {
      id: string;
      colleges: { name: string; displayName?: string; departments: (Dept & { displayName?: string })[] }[];
    }[])
      for (const c of u.colleges)
        for (const d of c.departments)
          displayIndex.set(`${u.id}|${c.displayName ?? c.name}|${d.displayName ?? d.name}`, d);
    const offenders: string[] = [];
    for (const b of ["علمي", "أدبي", "فنون"]) {
      for (const r of byBranchFile(b)) {
        if (r.universityType === "أهلية") continue;
        const d = displayIndex.get(`${r.universityId}|${r.collegeName}|${r.departmentName}`);
        if (!d || !d.morningByBranch) continue;
        if (!d.branch.includes(b) || r.averageGrades["صباحي"] !== (d.morningByBranch[b] ?? null)) {
          offenders.push(`${b}: ${r.universityId} / ${r.collegeName} / ${r.departmentName}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
