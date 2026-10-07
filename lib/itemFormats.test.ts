import { describe, it, expect } from "vitest";
import { estimateSeconds, groupScreens, isAgreeScaleItem, pickAnswers, type FormattedItemLike } from "./itemFormats";
import { computeValidityRiskScore, computeAcquiescenceIndex, computeGridStraightLineShare } from "./validity";
import { computeUserRiasecVector } from "./riasec";
import questionsData from "../data/questions.json";

const single = (id: string, dims: Record<string, number>): FormattedItemLike => ({ id, text: id, dimensions: dims });
const row = (screenId: string, id: string, dims: Record<string, number>): FormattedItemLike => ({
  id,
  text: id,
  dimensions: dims,
  format: "grid",
  screenId,
  lead: `موقف ${screenId}`,
});
const option = (screenId: string, id: string, dims: Record<string, number>): FormattedItemLike => ({
  id,
  text: id,
  dimensions: dims,
  format: "pick",
  screenId,
  lead: "أيّها أقرب إليك؟",
});

const bank: FormattedItemLike[] = [
  single("s1", { R: 8 }),
  row("g1", "g1_a", { I: 7 }),
  row("g1", "g1_b", { A: -7 }),
  row("g1", "g1_c", { S: 7 }),
  option("k1", "k1_R", { R: 7 }),
  option("k1", "k1_I", { I: 7 }),
  option("k1", "k1_E", { E: 7 }),
  option("k1", "k1_C", { C: 7 }),
];

describe("itemFormats", () => {
  it("يجمع العبارات المسطّحة في شاشات بترتيب ظهورها", () => {
    const screens = groupScreens(bank);
    expect(screens.map((s) => [s.id, s.format, s.items.length])).toEqual([
      ["s1", "single", 1],
      ["g1", "grid", 3],
      ["k1", "pick", 4],
    ]);
    expect(screens[1].lead).toBe("موقف g1");
  });

  it("الأقرب +1، الأبعد −1، الباقيان 0", () => {
    expect(pickAnswers(["a", "b", "c", "d"], "b", "d")).toEqual({ a: 0, b: 1, c: 0, d: -1 });
  });

  it("خيار pick ليس مقياس موافقة", () => {
    expect(isAgreeScaleItem(bank[0])).toBe(true);
    expect(isAgreeScaleItem(bank[1])).toBe(true);
    expect(isAgreeScaleItem(bank[4])).toBe(false);
  });

  it("الزمن التقديري: مفردة 6 ث، صفّ موقف 4 ث، شاشة أقرب/أبعد 12 ث", () => {
    expect(estimateSeconds(bank)).toBe(6 + 3 * 4 + 12);
  });

  it("تسجيل pick: الأقرب يرفع بُعده والأبعد يخفضه بنفس المقدار، ولا يتحرّك بُعد غائب عن الشاشة", () => {
    const options = bank.filter((q) => q.format === "pick") as {
      id: string;
      text: string;
      dimensions: Record<string, number>;
    }[];
    const v = computeUserRiasecVector(
      pickAnswers(
        options.map((o) => o.id),
        "k1_R",
        "k1_C"
      ),
      options
    );
    expect(v.R).toBe(100);
    expect(v.C).toBe(0);
    expect(v.I).toBe(50);
    expect(v.E).toBe(50);
    expect(v.A).toBe(50);
  });
});

describe("VRS مع الأشكال", () => {
  const picks = bank.filter((q) => q.format === "pick");
  it("خيارات pick (±1/0 بالتصميم) لا تُحتسب في مؤشر الموافقة ولا الخط المستقيم ولا التطرّف", () => {
    const pickOnly = pickAnswers(
      picks.map((q) => q.id),
      "k1_R",
      "k1_C"
    );
    const r = computeValidityRiskScore(pickOnly, {}, {}, [], picks);
    expect(r.score).toBe(0);
    expect(computeAcquiescenceIndex(pickOnly, picks)).toBeNull();
  });

  const grids: FormattedItemLike[] = Array.from({ length: 6 }, (_, i) => [
    row(`g${i}`, `g${i}_a`, { R: 7 }),
    row(`g${i}`, `g${i}_b`, { A: -7 }),
    row(`g${i}`, `g${i}_c`, { S: 7 }),
  ]).flat();

  it("خط مستقيم داخل أغلب شاشات المواقف يُرفع إلى تنبيه", () => {
    const flat = Object.fromEntries(grids.map((q, i) => [q.id, i < 15 ? 0.5 : [1, -0.5, 0][i % 3]]));
    expect(computeGridStraightLineShare(flat, grids)).toBeCloseTo(5 / 6);
    const r = computeValidityRiskScore(flat, {}, {}, [], grids);
    expect(r.reasons.some((x) => x.includes("الموقف"))).toBe(true);
  });

  it("إجابات متنوّعة داخل المواقف لا تُطلق إشارة الخط المستقيم", () => {
    const varied = Object.fromEntries(grids.map((q, i) => [q.id, [1, -0.5, 0][i % 3]]));
    expect(computeGridStraightLineShare(varied, grids)).toBe(0);
  });

  it("كل الإجابات غير المحايدة طرفية بلا أي درجة وسيطة = نمط تطرّف يرفع إلى متوسط", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      single(`x${i}`, { [["R", "I", "A", "S", "E", "C"][i % 6]]: i % 4 === 0 ? -7 : 7 })
    );
    const extreme = Object.fromEntries(items.map((q, i) => [q.id, i % 5 === 0 ? 0 : i % 2 ? 1 : -1]));
    const r = computeValidityRiskScore(extreme, {}, {}, [], items);
    expect(r.reasons.some((x) => x.includes("درجة وسيطة واحدة"))).toBe(true);
    const oneMiddle = { ...extreme, x1: 0.5 };
    expect(
      computeValidityRiskScore(oneMiddle, {}, {}, [], items).reasons.some((x) => x.includes("درجة وسيطة واحدة"))
    ).toBe(false);
  });
});

describe("البنك المنشور", () => {
  it("كل صفّ/خيار في data/questions.json له screenId ونص موقف متّسق داخل شاشته", () => {
    const items = questionsData as FormattedItemLike[];
    groupScreens(items).forEach((s) => {
      if (s.format === "single") return;
      expect(s.lead).toBeTruthy();
      s.items.forEach((q) => expect(q.lead).toBe(s.lead));
      if (s.format === "pick") expect(s.items).toHaveLength(4);
    });
  });
});
