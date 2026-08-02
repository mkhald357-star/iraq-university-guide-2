import { describe, it, expect } from "vitest";
import { diagnoseEmpty, type GpaCheckFilters } from "./emptyDiagnosis";

interface Offering {
  province: string;
  sessions: string[];
  cutoff: Record<string, number | null>;
  isDirectAdmission: boolean;
}

function matches(o: Offering, f: GpaCheckFilters): boolean {
  if (f.province && o.province !== f.province) return false;
  const sessions = f.session === "both" ? ["صباحي", "مسائي"] : [f.session];
  const relevant = sessions.filter((s) => o.sessions.includes(s));
  if (relevant.length === 0) return false;
  // "متاح" منطقياً هنا يعني: قبول مباشر، أو له حدّ حقيقي لأي جلسة ذات صلة
  // (بصرف النظر عن بلوغه -- يطابق سلوك classifyOffering الحقيقي: reach
  // تُحسَب متاحة أيضاً، لا فقط safe/close).
  if (o.isDirectAdmission) return true;
  return relevant.some((s) => o.cutoff[s] != null);
}

function reachable(o: Offering, grade: number, session: string) {
  if (o.isDirectAdmission) return { ok: true, gap: -Infinity };
  const cutoff = o.cutoff[session];
  if (cutoff == null) return { ok: false, gap: Infinity };
  return { ok: grade >= cutoff, gap: cutoff - grade };
}

describe("تشخيص الفراغ", () => {
  it("يعزو الفراغ للمحافظة حين تكون هي القيد", () => {
    const all: Offering[] = [
      { province: "بغداد", sessions: ["صباحي"], cutoff: { صباحي: 70 }, isDirectAdmission: false },
    ];
    const filters: GpaCheckFilters = { grade: 80, session: "both", province: "البصرة" };
    const d = diagnoseEmpty(all, filters, matches, reachable);
    expect(d.code).toBe("PROVINCE_TOO_NARROW");
    expect(d.relaxable).toBe("province");
    expect(d.wouldYield).toBeGreaterThan(0);
  });

  it("يعزو الفراغ للجلسة حين تكون هي القيد", () => {
    const all: Offering[] = [
      { province: "بغداد", sessions: ["مسائي"], cutoff: { مسائي: 60 }, isDirectAdmission: false },
    ];
    const filters: GpaCheckFilters = { grade: 80, session: "صباحي", province: "" };
    const d = diagnoseEmpty(all, filters, matches, reachable);
    expect(d.code).toBe("SESSION_UNAVAILABLE");
    expect(d.relaxable).toBe("session");
    expect(d.wouldYield).toBeGreaterThan(0);
  });

  it("يرتّب الأقرب تصاعدياً بالفارق", () => {
    // لا province ولا session يحلّان المشكلة، فقط المعدّل -- كل الأقسام
    // مطابقة تماماً (matches ترجع true دائماً هنا) لكن reachable ترجع فوارق
    // موجبة (المعدّل دون كل الحدود)، فتصل النتيجة إلى GRADE_BELOW_ALL.
    const all: Offering[] = [
      { province: "بغداد", sessions: ["صباحي"], cutoff: { صباحي: 95 }, isDirectAdmission: false },
      { province: "بغداد", sessions: ["صباحي"], cutoff: { صباحي: 99 }, isDirectAdmission: false },
      { province: "بغداد", sessions: ["صباحي"], cutoff: { صباحي: 90 }, isDirectAdmission: false },
    ];
    // matches يمنع الوصول الفعلي عبر إعادة تعريفها هنا لتُرجع true فقط حين reachable=false --
    // نستخدم matches/reachable بسيطتين تحديداً لهذا الاختبار بدل المشتركتين أعلاه.
    const localMatches = () => false; // يجعل matches(all)=0 دائماً كي لا يُحسَم القرار بمرحلة أولى
    const localReachable = reachable;
    const filters: GpaCheckFilters = { grade: 80, session: "both", province: "" };
    const d = diagnoseEmpty(all, filters, localMatches, localReachable);
    expect(d.code).toBe("GRADE_BELOW_ALL");
    expect(d.nearest.map((n) => n.gap)).toEqual([10, 15, 19]);
  });

  it("يرجع NO_DATA على مصفوفة فارغة", () => {
    const d = diagnoseEmpty<Offering>([], { grade: 80, session: "both", province: "" }, matches, reachable);
    expect(d.code).toBe("NO_DATA");
    expect(d.relaxable).toBeNull();
  });

  it("لا يقترح رفع فلتر لا يُنتج نتائج", () => {
    // كل الأقسام في محافظة أخرى، ورفع المحافظة لا يفيد لأن matches ترفض
    // الكل دوماً هنا -- يجب ألا يُختار PROVINCE_TOO_NARROW في هذه الحالة.
    const all: Offering[] = [
      { province: "بغداد", sessions: ["صباحي"], cutoff: { صباحي: 70 }, isDirectAdmission: false },
    ];
    const alwaysFalse = () => false;
    const filters: GpaCheckFilters = { grade: 80, session: "both", province: "البصرة" };
    const d = diagnoseEmpty(all, filters, alwaysFalse, reachable);
    expect(d.code).not.toBe("PROVINCE_TOO_NARROW");
  });
});
