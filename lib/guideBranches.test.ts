import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createGuideLookup, _internals: I } = require("../scripts/guideBranches");

// مطابِق جدول «الفروع المقبولة» في الدليل (scripts/guideBranches.js): يتسامح مع تشوّه نص PDF
// الموثَّق ولا يُنتج مطابقة كاذبة. كل حالة أدناه حقيقية من data/raw/dalel.full.txt.

const uni = { website: "www.test.edu.iq" };
const group = (college: string, items: string[], branches: string[], entry?: string[]) => ({
  website: "test.edu.iq",
  college,
  items,
  entry: entry ?? items,
  branches,
  sourceLine: 1,
});

describe("scripts/guideBranches: أنماط التشوّه", () => {
  it("التمديد (الكشيدة حروفاً مكرَّرة) يُزال، والتاريد = التاريخ", () => {
    expect(I.fixName("الشوووووووريعة")).toBe("الشريعة");
    expect(I.fixName("قسم التاريد")).toBe("قسم التاريخ");
    expect(I.fixName("كلية القانون")).toBe("كلية القانون"); // "ون" ليست تمديداً
  });

  it("تبديل ه/ل وسقوط النون: «اللندسة» = الهندسة، «القانو» = القانون", () => {
    expect(I.guideKey("اللندسة")).toBe(I.guideKey("الهندسة"));
    expect(I.guideKey("القانو")).toBe(I.guideKey("القانون"));
  });

  it("ترتيب كلمات مقلوب ومقطَّع: «اال كليزي اللغ» = اللغة الانكليزية، «خاص تربي» = التربية الخاصة", () => {
    const lookup = createGuideLookup([
      group("التربية", ["التربية", "اال كليزي اللغ"], ["علمي", "أدبي"]),
      group("التربية األساسية", ["خاص تربي"], ["علمي", "أدبي"]),
    ]);
    expect([...lookup(uni, "كلية التربية", "قسم اللغة االنكليزية")].sort()).toEqual(["أدبي", "علمي"]);
    expect([...lookup(uni, "كلية التربية األساسية", "قسم التربية الخاصة")].sort()).toEqual(["أدبي", "علمي"]);
  });

  it("قسم «عام» يُطابَق باسم الكلية بلا كلمة «كلية»", () => {
    const lookup = createGuideLookup([group("التمريض", ["التمريض"], ["علمي"])]);
    expect([...lookup(uni, "كلية التمريض", "عام")]).toEqual(["علمي"]);
  });
});

describe("scripts/guideBranches: لا مطابقة كاذبة", () => {
  it("«المساحة» ليست «المحاسبة» (حروف متقاربة لا تكفي)", () => {
    const lookup = createGuideLookup([
      group("المعلد التقني", ["المعلد التقني", "الكوت", "التخصصات", "االداري", "تقنيات المحاسبة"], ["علمي", "أدبي"]),
    ]);
    expect(lookup(uni, "المعهد التقني الكوت", "قسم تقنيات المساحة")).toBeNull();
  });

  it("«الكلية التقنية الكوت» ليست «المعهد التقني الكوت» (نوع المؤسسة جزء من الهوية)", () => {
    const lookup = createGuideLookup([
      group(
        "الكلية التقنية الكوت",
        ["الكلية التقنية الكوت", "التخصصات", "االدارية", "تقنيات المحاسبة"],
        ["علمي", "أدبي"]
      ),
      group("المعلد التقني", ["المعلد التقني", "الكوت", "التخصصات", "االداري", "تقنيات المحاسبة"], ["علمي", "أدبي"]),
      group("المعلد التقني", ["المعلد التقني", "الكوت", "التخصصات", "اله دسي", "تقنيات المساحة"], ["علمي"]),
    ]);
    expect([...lookup(uni, "المعهد التقني الكوت", "قسم تقنيات المساحة")]).toEqual(["علمي"]);
  });

  it("نفس القسم في كليتين بفروع مختلفة ⇒ يُختار سجل كليته، والالتباس = لا معلومة", () => {
    const lookup = createGuideLookup([
      group("اآلداب", ["اآلداب", "اللغة االنكليزية"], ["علمي", "أدبي"]),
      group("الجميلة الفنو", ["الجميلة الفنو", "اللغة االنكليزية"], ["فنون"]),
    ]);
    expect([...lookup(uni, "كلية اآلداب", "قسم اللغة االنكليزية")].sort()).toEqual(["أدبي", "علمي"]);
    expect(lookup(uni, "كلية الهندسة", "قسم اللغة االنكليزية")).toBeNull();
  });

  it("فروع الكلية كلها (collegeBranches) لكشف قسم يقبل فرعاً لكنه غائب عن المنصة", () => {
    const lookup = createGuideLookup([
      group("اآلداب", ["اآلداب", "اللغة االنكليزية"], ["علمي", "أدبي"]),
      group("اآلداب", ["الفلسفة"], ["علمي", "أدبي", "فنون"]),
    ]);
    expect([...lookup.collegeBranches(uni, "كلية اآلداب")].sort()).toEqual(["أدبي", "علمي", "فنون"]);
  });
});
