import { describe, it, expect } from "vitest";
import { migrateWish, migrateWishlist, collegeBase, sanitizeWishlist } from "./wishlistMigration";
import type { UniversityOffering } from "./majorMatcher";
import type { WishOffering } from "./wishlistPlanner";

function off(over: Partial<UniversityOffering>): UniversityOffering {
  return {
    majorId: "business_admin",
    majorName: "إدارة الأعمال",
    universityId: "basrah",
    universityName: "جامعة البصرة",
    universityType: "حكومية",
    universityRanking: null,
    province: "البصرة",
    collegeId: "basrah_c_aaaa1111",
    collegeName: "كلية االدارة واالقتصاد",
    departmentName: "قسم ادارة االعمال",
    departmentBranches: ["علمي", "أدبي"],
    sessions: ["صباحي", "مسائي"],
    averageGrades: { صباحي: 70, مسائي: 70 },
    cutoffs: [],
    isDirectAdmission: false,
    confidence: 100,
    ...over,
  } as unknown as UniversityOffering;
}

const wish = (o: UniversityOffering, session: "صباحي" | "مسائي" = "صباحي"): WishOffering => ({
  majorId: "business_admin",
  majorName: "إدارة الأعمال",
  session,
  offering: o,
});

describe("ترحيل الرغبات المحفوظة", () => {
  it("collegeBase يحذف لاحقة الحرم", () => {
    expect(collegeBase("كلية االدارة واالقتصاد/القرنة")).toBe("كلية االدارة واالقتصاد");
    expect(collegeBase("كلية الهندسة")).toBe("كلية الهندسة");
  });

  it("معرّف قديم موضعي يُستبدل بالعرض الحالي وأرقامه", () => {
    const saved = off({ collegeId: "basrah_col_12", averageGrades: { صباحي: 60, مسائي: 60 } });
    const cur = off({});
    const r = migrateWish(wish(saved), [cur]);
    expect(r.unavailable).toBeUndefined();
    expect(r.offering.collegeId).toBe("basrah_c_aaaa1111");
    expect(r.offering.averageGrades.صباحي).toBe(70);
  });

  it("قسم انتقل إلى سجل حرم بلاحقة: يُطابَق بالاسم دون اللاحقة إن كان وحيداً", () => {
    const saved = off({ departmentName: "قسم ادارة المشاريع", collegeId: "basrah_col_12" });
    const cur = off({
      departmentName: "قسم ادارة المشاريع",
      collegeName: "كلية االدارة واالقتصاد/القرنة",
      collegeId: "basrah_c_bbbb2222",
      averageGrades: { صباحي: 68.29, مسائي: 65 },
    });
    const r = migrateWish(wish(saved), [off({}), cur]);
    expect(r.unavailable).toBeUndefined();
    expect(r.offering.collegeName).toBe("كلية االدارة واالقتصاد/القرنة");
    expect(r.offering.averageGrades.صباحي).toBe(68.29);
  });

  it("لبس بين حرمين: لا تخمين، تُوسَم غير متاحة وتبقى", () => {
    const saved = off({ collegeName: "كلية الهندسة", departmentName: "قسم المدني" });
    const a = off({ collegeName: "كلية الهندسة/الموصل", departmentName: "قسم المدني" });
    const b = off({ collegeName: "كلية الهندسة/كركوك", departmentName: "قسم المدني" });
    const r = migrateWish(wish(saved), [a, b]);
    expect(r.unavailable).toBe(true);
    expect(r.offering).toBe(saved);
  });

  it("قسم غاب أو جلسة لم تعد متاحة: يُوسَم ولا يُحذف", () => {
    const saved = off({});
    expect(migrateWish(wish(saved), [off({ departmentName: "قسم آخر" })]).unavailable).toBe(true);
    expect(migrateWish(wish(saved, "مسائي"), [off({ sessions: ["صباحي"] })]).unavailable).toBe(true);
  });

  it("فشل الجلب (null أو []) لا يوسم الرغبة غير متاحة", () => {
    const w = wish(off({}));
    expect(migrateWish(w, null)).toBe(w);
    expect(migrateWish(w, [])).toBe(w);
  });

  it("migrateWishlist: يجلب كل تخصص مرة واحدة ويحافظ على الترتيب", async () => {
    const calls: string[] = [];
    const w1 = wish(off({ departmentName: "قسم المحاسبة", collegeId: "basrah_col_12" }));
    const w2 = wish(off({ departmentName: "قسم االقتصاد", collegeId: "basrah_col_12" }));
    const res = await migrateWishlist([w1, w2], async (id) => {
      calls.push(id);
      return [off({ departmentName: "قسم االقتصاد" }), off({ departmentName: "قسم المحاسبة" })];
    });
    expect(calls).toEqual(["business_admin"]);
    expect(res.map((r) => r.offering.departmentName)).toEqual(["قسم المحاسبة", "قسم االقتصاد"]);
    expect(res.every((r) => r.offering.collegeId === "basrah_c_aaaa1111")).toBe(true);
  });
});

describe("sanitizeWishlist: بيانات المتصفح التالفة لا تكسر الصفحة", () => {
  const good = {
    majorId: "business_admin",
    majorName: "x",
    session: "صباحي",
    offering: {
      universityId: "basrah",
      departmentName: "قسم المحاسبة",
      averageGrades: { صباحي: 70, مسائي: null },
      sessions: ["صباحي"],
    },
  };
  it("يُسقط null وكائناً فارغاً وعنصراً بلا offering وجلسة غير معروفة وأرقاماً غير صالحة", () => {
    const bad = [
      null,
      {},
      { ...good, offering: undefined },
      { ...good, session: "ليلي" },
      { ...good, offering: { ...good.offering, averageGrades: { صباحي: "70", مسائي: null } } },
      { ...good, offering: { ...good.offering, sessions: "صباحي" } },
      { ...good, offering: { ...good.offering, cutoffs: "x" } },
      "نص",
      42,
    ];
    expect(sanitizeWishlist([good, ...bad])).toEqual([good]);
  });

  it("ما ليس مصفوفة يعيد []", () => {
    expect(sanitizeWishlist(null)).toEqual([]);
    expect(sanitizeWishlist({})).toEqual([]);
    expect(sanitizeWishlist("x")).toEqual([]);
  });
});
