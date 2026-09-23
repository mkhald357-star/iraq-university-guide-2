import { describe, it, expect } from "vitest";
import { selectFamilyRecommendations } from "./familyRecommendation";
import { MAJOR_FAMILIES, familyOf } from "./majorFamilies";
import type { RankedMajor } from "./recommendationEngine";
import majorsData from "../data/majors.json";
import { BRANCH_CATEGORY_MAP } from "./branchEligibility";

const mk = (id: string, score: number): RankedMajor => ({
  id,
  name: id,
  category: "x",
  marketMultiplier: 1,
  fitPercent: score,
  riasecFitPercent: score,
  subjectFitPercent: null,
  combinedScore: score,
});

describe("التوصية بالعائلة", () => {
  it("ثلاث عائلات مختلفة، وقائد كل عائلة أعلى أفرادها ترتيباً", () => {
    // أربعة تخصصات حوسبة متتالية ثم كهرباء ثم بناء: بلا العائلات تكون التوصية
    // ثلاث شاشات حوسبة متطابقة تقريباً.
    const ranked = [
      mk("software_engineering", 90),
      mk("computer_science", 89),
      mk("ai", 88),
      mk("electrical_engineering", 80),
      mk("civil_engineering", 75),
      mk("architecture", 74),
    ];
    const sel = selectFamilyRecommendations(ranked, MAJOR_FAMILIES);
    expect(sel.recommendations.map((r) => r.familyId)).toEqual(["computing", "electrical_electronics", "civil_built"]);
    expect(sel.recommendations[0].lead.id).toBe("software_engineering");
    expect(sel.recommendations[0].siblings.map((s) => s.id)).toEqual(["computer_science", "ai"]);
    expect(sel.recommendations[2].siblings.map((s) => s.id)).toEqual(["architecture"]);
    expect(sel.insufficientFamilies).toBe(false);
  });

  it("فارق العائلة عن التالية محسوب، والأخيرة بلا تالٍ", () => {
    const sel = selectFamilyRecommendations([mk("ai", 90), mk("civil_engineering", 82)], MAJOR_FAMILIES, { count: 2 });
    expect(sel.recommendations[0].gapToNext).toBe(8);
    expect(sel.recommendations[1].gapToNext).toBe(Infinity);
  });

  it("عائلات أقل من المطلوب تُفصَح ولا تُحشى", () => {
    const sel = selectFamilyRecommendations([mk("fine_arts", 70), mk("graphic_design", 68)], MAJOR_FAMILIES);
    expect(sel.recommendations).toHaveLength(2);
    expect(sel.insufficientFamilies).toBe(true);
    expect(sel.familiesAvailable).toBe(2);
  });

  it("تخصص خارج خريطة العائلات لا يسقط من التوصية", () => {
    const sel = selectFamilyRecommendations([mk("brand_new_major", 90), mk("ai", 80)], MAJOR_FAMILIES);
    expect(sel.recommendations[0].familyId).toBe("__solo:brand_new_major");
    expect(sel.recommendations[0].lead.id).toBe("brand_new_major");
  });

  it("كل فرع يملك ثلاث عائلات متاحة على الأقل (شرط قابلية التنويع)", () => {
    for (const [branch, cats] of Object.entries(BRANCH_CATEGORY_MAP)) {
      const eligible = majorsData.filter((m) => cats.includes(m.category));
      const fams = new Set(eligible.map((m) => familyOf(MAJOR_FAMILIES, m.id)));
      expect(fams.size, `فرع ${branch}`).toBeGreaterThanOrEqual(3);
    }
  });
});
