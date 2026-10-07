import { describe, it, expect } from "vitest";
import {
  ADMISSION_INDEX,
  computeFeasibilityPercent,
  feasibilityNote,
  type MajorAdmissionEntry,
} from "./admissionFeasibility";
import { applyAdmissionWeight } from "./riasec";
import majorsData from "../data/majors.json";

const entry = (
  cutoffMin: number | null,
  confidence: MajorAdmissionEntry["confidence"] = "high"
): MajorAdmissionEntry => ({
  competitiveOfferings: cutoffMin === null ? 0 : 10,
  directAdmissionOfferings: 0,
  privateOfferings: 0,
  statedPrivateMinCount: 0,
  unknownOfferings: 0,
  suspendedOfferings: 0,
  cutoffMin,
  cutoffP25: cutoffMin,
  cutoffMedian: cutoffMin,
  cutoffMax: cutoffMin,
  coverage: 1,
  confidence,
});

describe("واقعية القبول", () => {
  it("كل تخصص له مدخل في الفهرس", () => {
    majorsData.forEach((m) => expect(ADMISSION_INDEX[m.id], m.id).toBeDefined());
  });

  it("المعدل على أسهل باب تماماً = 50، و±10 نقاط يُشبع المنحدر", () => {
    expect(computeFeasibilityPercent(70, entry(70))).toBe(50);
    expect(computeFeasibilityPercent(80, entry(70))).toBe(100);
    expect(computeFeasibilityPercent(60, entry(70))).toBe(0);
    expect(computeFeasibilityPercent(95, entry(70))).toBe(100);
  });

  it("رتيب في المعدل: معدل أعلى لا يعطي واقعية أقل أبداً", () => {
    let prev = -1;
    for (let g = 50; g <= 100; g += 0.5) {
      const f = computeFeasibilityPercent(g, entry(72))!;
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });

  it("بلا حدّ تنافسي موثَّق = null لا صفر (المجهول ليس صعباً ولا سهلاً)", () => {
    expect(computeFeasibilityPercent(90, entry(null, "none"))).toBeNull();
    expect(computeFeasibilityPercent(90, undefined)).toBeNull();
    expect(computeFeasibilityPercent(90, ADMISSION_INDEX["data_science"])).toBeNull();
  });

  it("المنزلق المطفأ لا يغيّر النتيجة إطلاقاً -- مساواة حرفية لا تقريبية", () => {
    for (const score of [0, 37.25, 62.123456789, 100]) {
      for (const f of [0, 25, 50, 100, null]) expect(applyAdmissionWeight(score, f, 0)).toBe(score);
    }
    expect(applyAdmissionWeight(62.5, 100)).toBe(62.5); // الوزن الافتراضي 0
  });

  it("المجهول لا يتحرّك بأي وزن", () => {
    for (const w of [0, 0.3, 1]) expect(applyAdmissionWeight(70, null, w)).toBe(70);
  });

  it("بوزن كامل: أسهل باب بفارق +10 يرفع 15 نقطة، وبفارق −10 يخفض 15", () => {
    expect(applyAdmissionWeight(70, 100, 1)).toBe(85);
    expect(applyAdmissionWeight(70, 0, 1)).toBe(55);
    expect(applyAdmissionWeight(70, 50, 1)).toBe(70);
  });

  it("السطر المعروض لا يقول «سهل» أبداً ويذكر الفارق بالنقاط", () => {
    const above = feasibilityNote(80, entry(70));
    const below = feasibilityNote(60, entry(70));
    const none = feasibilityNote(80, entry(null, "none"));
    [above, below, none].forEach((n) => expect(n.text).not.toMatch(/سهل/));
    expect(above).toMatchObject({ tone: "above" });
    expect(above.text).toContain("10");
    expect(below).toMatchObject({ tone: "below" });
    expect(none.tone).toBe("unknown");
  });

  it("الطب: حدّه الأدنى يبقى فوق 99 -- القسم الحكومي بلا حدّ منشور لا يُحتسب باباً مفتوحاً", () => {
    expect(ADMISSION_INDEX["medicine"].cutoffMin).toBeGreaterThan(99);
    expect(computeFeasibilityPercent(86, ADMISSION_INDEX["medicine"])).toBe(0);
  });
});
