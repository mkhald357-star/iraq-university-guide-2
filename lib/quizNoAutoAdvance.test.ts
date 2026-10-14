import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// قرار المنتج (2026-10-14): السؤال الأحادي لا ينتقل تلقائياً بعد الإجابة؛ يبقى حتى يضغط الطالب «التالي» (أو Enter).
// حارس بسيط ضد عودة مؤقّت الانتقال (الفحص السلوكي الكامل بالمتصفح في تقرير الإصدار).
const src = fs.readFileSync(path.join(__dirname, "..", "app", "quiz", "page.tsx"), "utf8");

describe("الاختبار: لا انتقال تلقائي للسؤال الأحادي", () => {
  it("لا مؤقّت انتقال ولا ثابت AUTO_ADVANCE في صفحة الاختبار", () => {
    expect(src).not.toMatch(/AUTO_ADVANCE/);
    expect(src).not.toMatch(/advanceTimer/);
  });

  it("زر «التالي» يظهر بعد الإجابة ويستدعي finishScreen فقط من الضغط/التأكيد", () => {
    expect(src).toMatch(/onConfirm=\{\(\) => finishScreen\(screenIndex\)\}/);
    expect(src).toMatch(/onChange=\{\(v\) => answerItem\(screen\.items\[0\]\.id, v\)\}/);
  });
});
