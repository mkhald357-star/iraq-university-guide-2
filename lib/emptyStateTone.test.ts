import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// عبارات ممنوعة مطلقاً في نصوص حالات الفراغ/الفشل -- حكم على الطالب لا
// الفلاتر، مواساة تُضخّم الموقف، أو نصيحة بلا فائدة (data/admission_rules.md §31).
const FORBIDDEN = ["يناسبك", "للأسف", "نأسف", "لا يوجد شيء", "حسّن معدّلك"];

describe("نبرة حالات الفراغ (data/admission_rules.md §31)", () => {
  it("نصوص StateViews.tsx خالية من العبارات الممنوعة", () => {
    const src = fs.readFileSync(path.join(__dirname, "../app/components/StateViews.tsx"), "utf8");
    const found = FORBIDDEN.filter((p) => src.includes(p));
    expect(found).toEqual([]);
  });

  it("الكاشف يعمل فعلاً (فحص إيجابي مباشر)", () => {
    const sample = "للأسف لا يوجد شيء يناسبك، حاول تحسّن معدّلك";
    const found = FORBIDDEN.filter((p) => sample.includes(p));
    expect(found.length).toBeGreaterThan(0);
  });
});
