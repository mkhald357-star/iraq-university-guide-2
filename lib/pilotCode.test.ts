import { describe, it, expect } from "vitest";
import { encodePilotRecord, decodePilotRecord, bankFingerprint, roundSubjectGrade } from "./pilotCode";

const rec = {
  day: "2026-09-23",
  branch: "علمي",
  grade: 84,
  subjectGrades: { math: 90, physics: 75 },
  answers: { g30_a: 1, g30_b: -0.5, q_help_others: 0.5, k06_R: 1, k06_I: 0 },
  shownLeads: ["software_engineering", "civil_engineering", "medicine"],
  intendedMajorId: "computer_science",
  intentSource: "interest" as const,
  intentCertainty: 4,
  fitRating: 4,
  bank: bankFingerprint(["g30", "k06", "q_help_others"]),
  vrsBand: "low",
};

describe("رمز التجربة الميدانية", () => {
  it("يُرمَّز ويُفكّ بلا فقد -- مع نص عربي", () => {
    const code = encodePilotRecord(rec);
    expect(code.startsWith("IQM1.")).toBe(true);
    const back = decodePilotRecord(code);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.record).toEqual({ ...rec, v: 2 });
  });

  it("يقرّب درجات المواد لأقرب 5 داخل المكتبة -- شبه-معرِّف داخل الصفّ (المدقّق)", () => {
    const back = decodePilotRecord(
      encodePilotRecord({ ...rec, grade: 84.6, subjectGrades: { math: 93, physics: 71.4 } })
    );
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.record.subjectGrades).toEqual({ math: 95, physics: 70 });
      expect(back.record.grade).toBe(85);
    }
    expect(roundSubjectGrade(92.4)).toBe(90);
  });

  it("بصمة البنك لا تتأثّر بالترتيب وتتغيّر بتغيّر البنك", () => {
    expect(bankFingerprint(["a", "b", "c"])).toBe(bankFingerprint(["c", "a", "b"]));
    expect(bankFingerprint(["a", "b", "c"])).not.toBe(bankFingerprint(["a", "b", "d"]));
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
