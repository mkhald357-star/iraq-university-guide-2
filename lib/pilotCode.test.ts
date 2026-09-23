import { describe, it, expect } from "vitest";
import { encodePilotRecord, decodePilotRecord } from "./pilotCode";

const rec = {
  day: "2026-09-23",
  branch: "علمي",
  grade: 84,
  subjectGrades: { math: 90 },
  answers: { g30_a: 1, g30_b: -0.5, q_help_others: 0.5, k06_R: 1, k06_I: 0 },
  shownLeads: ["software_engineering", "civil_engineering", "medicine"],
  intendedMajorId: "computer_science",
  fitRating: 4,
};

describe("رمز التجربة الميدانية", () => {
  it("يُرمَّز ويُفكّ بلا فقد -- مع نص عربي", () => {
    const code = encodePilotRecord(rec);
    expect(code.startsWith("IQM1.")).toBe(true);
    const back = decodePilotRecord(code);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.record).toEqual({ ...rec, v: 1 });
  });

  it("يكشف رمزاً منقوصاً أو محرَّفاً عند النسخ", () => {
    const code = encodePilotRecord(rec);
    expect(decodePilotRecord(code.slice(0, -3)).ok).toBe(false);
    const tampered = code.replace(/.(?=\.[^.]+$)/, (c) => (c === "A" ? "B" : "A"));
    expect(decodePilotRecord(tampered).ok).toBe(false);
    expect(decodePilotRecord("نص عشوائي").ok).toBe(false);
  });

  it("لا يحمل ما يعرّف الطالب", () => {
    const decoded = JSON.parse(JSON.stringify(rec));
    ["name", "province", "phone", "email"].forEach((k) => expect(decoded).not.toHaveProperty(k));
  });

  it("الرمز قصير بما يكفي للإرسال في رسالة", () => {
    // بنك من ~55 إجابة -- يجب أن يبقى الرمز دون حدود الرسائل الشائعة
    const big = { ...rec, answers: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`item_${i}`, 0.5])) };
    expect(encodePilotRecord(big).length).toBeLessThan(2500);
  });
});
