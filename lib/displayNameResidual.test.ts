import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import universities from "../data/universities.json";

const require = createRequire(import.meta.url);
const { toDisplayName } = require("../scripts/displayName.js");

type Named = { name: string; displayName?: string };
type Uni = Named & { colleges: (Named & { departments: Named[] })[] };
const list = (universities as unknown as { universities: Uni[] }).universities;

describe("م6: أنماط انعكاس «لا» المتبقية في displayName", () => {
  it("همزة قبل اللام في مطلع الكلمة", () => {
    expect(toDisplayName("كلية اآلداب")).toBe("كلية الآداب");
    expect(toDisplayName("كلية التربية األساسية")).toBe("كلية التربية الأساسية");
    expect(toDisplayName("قسم اإلحصاء")).toBe("قسم الإحصاء");
    expect(toDisplayName("قسم علوم األغذية")).toBe("قسم علوم الأغذية");
    expect(toDisplayName("قسم الانسان اآللي")).toBe("قسم الانسان الآلي");
  });

  it("السابقة و/ب/ك/ل/ف تُحفظ", () => {
    expect(toDisplayName("واألجهزة")).toBe("والأجهزة");
    expect(toDisplayName("قسم الاتصاالت والاالت")).toBe("قسم الاتصالات والآلات");
    expect(toDisplayName("والاعالم الرقمي")).toBe("والإعلام الرقمي");
  });

  it("كلمات وسطها «لا» منعكسة", () => {
    expect(toDisplayName("قسم التحليالت المرضية")).toBe("قسم التحليلات المرضية");
    expect(toDisplayName("قسم العالج الطبيعي")).toBe("قسم العلاج الطبيعي");
    expect(toDisplayName("قسم العالقات العامة")).toBe("قسم العلاقات العامة");
    expect(toDisplayName("التربية الاسالمية")).toBe("التربية الإسلامية");
    expect(toDisplayName("قسم الالكترونيك والاتصالات")).toBe("قسم الإلكترونيك والاتصالات");
    expect(toDisplayName("قسم تقنيات السالمة المهنية")).toBe("قسم تقنيات السلامة المهنية");
    expect(toDisplayName("قسم المالحة والتوجيه")).toBe("قسم الملاحة والتوجيه");
    expect(toDisplayName("قسم الالسلكية")).toBe("قسم اللاسلكية");
  });

  it("«الء» في آخر الكلمة: كربلاء", () => {
    expect(toDisplayName("جامعة كربالء")).toBe("جامعة كربلاء");
  });

  it("كلمتان ملصوقتان: الذكاء الاصطناعي", () => {
    expect(toDisplayName("هندسة تقنيات الذكاءالاصطناعي")).toBe("هندسة تقنيات الذكاء الاصطناعي");
  });

  it("كلمات صحيحة فيها «ال» لا تُمسّ", () => {
    for (const ok of [
      "المالية",
      "الشمالية",
      "القبالة",
      "جامعة ديالى",
      "الاتصالات",
      "قسم العلوم المالية والمصرفية",
      "كلية الآداب",
      "قسم الأعمال",
      "قسم الإعلام",
      "قسم الإسلامية",
      "الجامعة التقنية الشمالية",
    ]) {
      expect(toDisplayName(ok)).toBe(ok);
    }
  });

  it("الدالة مستقرة (idempotent)", () => {
    for (const s of ["كلية اآلداب", "قسم التحليالت المرضية", "جامعة كربالء", "هندسة الذكاءالاصطناعي"]) {
      expect(toDisplayName(toDisplayName(s))).toBe(toDisplayName(s));
    }
  });
});

describe("م6: البيانات", () => {
  it("displayName = toDisplayName(name) لكل جامعة وكلية وقسم، وname لا يُمَسّ", () => {
    const bad: string[] = [];
    for (const u of list)
      for (const c of u.colleges) {
        if ((c.displayName ?? c.name) !== toDisplayName(c.name)) bad.push(`${u.name} / ${c.name}`);
        for (const d of c.departments)
          if ((d.displayName ?? d.name) !== toDisplayName(d.name)) bad.push(`${u.name} / ${c.name} / ${d.name}`);
      }
    expect(bad).toEqual([]);
  });

  it("صفر نمط مشوَّه من أنماط الانعكاس في أي displayName", () => {
    const re = /ا[آأإ]ل|اا|الء$/;
    const bad: string[] = [];
    const check = (s: string | undefined, where: string) => {
      for (const w of (s ?? "").split(/[\s/\-()،]+/)) if (w && re.test(w)) bad.push(`${where}: ${w}`);
    };
    for (const u of list) {
      check(u.displayName ?? u.name, u.name);
      for (const c of u.colleges) {
        check(c.displayName ?? c.name, `${u.name} / ${c.name}`);
        for (const d of c.departments) check(d.displayName ?? d.name, `${u.name} / ${c.name} / ${d.name}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("الكلمات الصريحة المصحَّحة لا تظهر بصيغتها المعطوبة في أي displayName", () => {
    const corrupt = new Set([
      "التحليالت",
      "العالج",
      "العالجية",
      "العالجي",
      "العالقات",
      "السالمة",
      "المالحة",
      "المعامالت",
      "المعدالت",
      "الالسلكية",
      "الالبان",
      "الاسالمية",
      "الاسالمي",
      "الاعالم",
      "الاعالن",
      "كربالء",
    ]);
    const found: string[] = [];
    const scan = (s: string | undefined) => {
      for (const w of (s ?? "").split(/[\s/\-()،]+/)) {
        const bare = w.replace(/^[وبكلف](?=ال)/, "");
        if (corrupt.has(bare)) found.push(w);
      }
    };
    for (const u of list) {
      scan(u.displayName ?? u.name);
      for (const c of u.colleges) {
        scan(c.displayName ?? c.name);
        for (const d of c.departments) scan(d.displayName ?? d.name);
      }
    }
    expect([...new Set(found)]).toEqual([]);
  });
});
