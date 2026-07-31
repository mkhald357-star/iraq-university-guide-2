import { describe, it, expect } from "vitest";
import { normalizeTriState } from "./triState";
import profiles from "../data/major_profiles_detailed.json";

describe("normalizeTriState", () => {
  it("يطبّع الحالات المعروفة", () => {
    expect(normalizeTriState(true)).toBe("yes");
    expect(normalizeTriState(false)).toBe("no");
    expect(normalizeTriState("جزئياً")).toBe("partial");
  });

  it("يفشل بأمان إلى unknown", () => {
    expect(normalizeTriState(null)).toBe("unknown");
    expect(normalizeTriState(undefined)).toBe("unknown");
    expect(normalizeTriState("غير محدد" as never)).toBe("unknown");
  });

  it('"جزئياً" لا تُعامَل كـ yes', () => {
    expect(normalizeTriState("جزئياً")).not.toBe("yes");
  });
});

/* ── حارس البيانات الحقيقية: يمرّ على كل الـ88 ── */
describe("قيم ثلاثية الحالات في البيانات الفعلية", () => {
  const ALLOWED = new Set<unknown>([true, false, "جزئياً"]);

  it("لا قيمة خارج المجموعة المعروفة في licensingRequirement.required", () => {
    const bad = (profiles as any[])
      .filter((m) => m.career?.licensingRequirement !== undefined)
      .filter((m) => !ALLOWED.has(m.career?.licensingRequirement?.required))
      .map((m) => `${m.id}=${JSON.stringify(m.career?.licensingRequirement?.required)}`);
    expect(bad).toEqual([]);
  });

  it("لا قيمة خارج المجموعة المعروفة في postgradNeededForPractice", () => {
    const bad = (profiles as any[])
      .filter((m) => m.career?.postgradNeededForPractice !== undefined)
      .filter((m) => !ALLOWED.has(m.career?.postgradNeededForPractice))
      .map((m) => `${m.id}=${JSON.stringify(m.career?.postgradNeededForPractice)}`);
    expect(bad).toEqual([]);
  });
});
