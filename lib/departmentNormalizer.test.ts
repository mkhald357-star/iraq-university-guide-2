import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import {
  normalizeArabicText as normTs,
  stripDepartmentPrefixes as stripTs,
  normalizeDepartmentKey as keyTs,
} from "./departmentNormalizer";

const require = createRequire(import.meta.url);
const jsModule = require("../scripts/departmentNormalizer.js");

describe("departmentNormalizer - تكافؤ النسختين والتعامل مع حالات OCR", () => {
  it("النسخة TypeScript والنسخة JS تنتجان نفس المخرجات تماماً (تكافؤ 100%)", () => {
    const testCases = [
      "قسم هندسة المكامن النفطية",
      "قسم المكامن النفطية",
      "قسم هندسة تقنيات األجهزة الطبية",
      "قسم هندسة تقنيات االجهزة الطبية",
      "قسم تقنيات األدلة الجنائية",
      "قسم تقنيات االدلة الجنائية",
      "كلية هندسة االنتاج والمعادن",
      "كلية هندسة الإنتاج والمعادن",
      "قسم اللغة اإلنكليزية",
      "قسم اللغة االنكليزية",
      "كلية االدارة واالقتصاد",
      "قسم االقتصاد الزراعي",
    ];

    for (const tc of testCases) {
      expect(normTs(tc)).toBe(jsModule.normalizeArabicText(tc));
      expect(stripTs(tc)).toBe(jsModule.stripDepartmentPrefixes(tc));
      expect(keyTs(tc, "كلية الهندسة", "جامعة بغداد")).toEqual(
        jsModule.normalizeDepartmentKey(tc, "كلية الهندسة", "جامعة بغداد")
      );
    }
  });

  it("تطابق حالات التكرار والأسماء البديلة المعروفة", () => {
    // حالة المكامن النفطية
    const k1 = keyTs("قسم هندسة المكامن النفطية", "كلية هندسة النفط والتعدين", "جامعة الموصل");
    const k2 = keyTs("قسم المكامن النفطية", "كلية هندسة النفط والتعدين", "جامعة الموصل");
    expect(k1.deptKey).toBe(k2.deptKey);

    // حالة تقنيات الأجهزة الطبية (OCR همزة)
    const dev1 = keyTs("قسم هندسة تقنيات األجهزة الطبية");
    const dev2 = keyTs("قسم هندسة تقنيات االجهزة الطبية");
    expect(dev1.deptKey).toBe(dev2.deptKey);

    // حالة الأدلة الجنائية (OCR همزة)
    const foren1 = keyTs("قسم تقنيات األدلة الجنائية");
    const foren2 = keyTs("قسم تقنيات االدلة الجنائية");
    expect(foren1.deptKey).toBe(foren2.deptKey);

    // حالة اللغة الإنكليزية
    const eng1 = keyTs("قسم اللغة اإلنكليزية");
    const eng2 = keyTs("قسم اللغة االنكليزية");
    expect(eng1.deptKey).toBe(eng2.deptKey);
  });
});
