import { describe, it, expect } from "vitest";
import { classifyOffering, analyzeWishlist, SAFE_MARGIN } from "./wishlistPlanner";
import type { WishOffering, AlternativeCandidate } from "./wishlistPlanner";
import type { UniversityOffering } from "./majorMatcher";
import fs from "fs";
import path from "path";

function makeOffering(overrides: Partial<UniversityOffering> = {}): UniversityOffering {
  return {
    universityId: "u1",
    universityName: "جامعة الاختبار",
    universityType: "حكومية",
    universityRanking: null,
    province: "بغداد",
    collegeId: "c1",
    collegeName: "كلية الاختبار",
    departmentName: "قسم الاختبار",
    departmentBranches: ["علمي"],
    sessions: ["صباحي"],
    averageGrades: { صباحي: 80, مسائي: null },
    cutoffs: [],
    isDirectAdmission: false,
    confidence: 100,
    ...overrides,
  };
}

function makeWish(overrides: Partial<UniversityOffering> = {}, session: "صباحي" | "مسائي" = "صباحي"): WishOffering {
  return {
    majorId: "m1",
    majorName: "تخصص الاختبار",
    session,
    offering: makeOffering(overrides),
  };
}

describe("classifyOffering", () => {
  it("مريح عند تجاوز المعدل الحدّ بهامش الأمان أو أكثر", () => {
    const w = makeWish({ averageGrades: { صباحي: 80, مسائي: null } });
    expect(classifyOffering(w, 80 + SAFE_MARGIN).band).toBe("safe");
  });

  it("متقارب عند تجاوز الحدّ بأقل من هامش الأمان", () => {
    const w = makeWish({ averageGrades: { صباحي: 80, مسائي: null } });
    expect(classifyOffering(w, 82).band).toBe("close");
  });

  it("طموح عند عدم بلوغ الحدّ", () => {
    const w = makeWish({ averageGrades: { صباحي: 90, مسائي: null } });
    expect(classifyOffering(w, 75).band).toBe("reach");
  });

  it("غير معروف عند غياب رقم الحدّ لهذه الجلسة تحديداً", () => {
    const w = makeWish({ averageGrades: { صباحي: null, مسائي: null } }, "صباحي");
    expect(classifyOffering(w, 75).band).toBe("unknown");
  });

  it("قبول مباشر حكومي بلا رقم ⇒ مجهول لا مريح (الإصدار 2): غياب الرقم ليس بلوغاً", () => {
    const w = makeWish({ isDirectAdmission: true, averageGrades: { صباحي: null, مسائي: null } });
    const result = classifyOffering(w, 40);
    expect(result.band).toBe("unknown");
    expect(result.cutoff).toBeNull();
  });

  it("قبول مباشر حكومي بدوام مسائي يُقارَن بأرضية المسائي -- لا يبلغه من هو دونها", () => {
    const w = makeWish({ isDirectAdmission: true, averageGrades: { صباحي: null, مسائي: 65 } }, "مسائي");
    expect(classifyOffering(w, 60).band).toBe("reach");
    expect(classifyOffering(w, 70).band).toBe("safe");
  });

  it("يقارن حدّ الجلسة المسائية تحديداً عند اختيار الطالب لها، لا الصباحية", () => {
    const w = makeWish({ averageGrades: { صباحي: 95, مسائي: 60 } }, "مسائي");
    const result = classifyOffering(w, 65);
    expect(result.cutoff).toBe(60);
    expect(result.band).toBe("safe");
  });

  it("الحافة الدقيقة (هامش = SAFE_MARGIN بالضبط) تُصنَّف مريحاً لا متقارباً", () => {
    const w = makeWish({ averageGrades: { صباحي: 70, مسائي: null } });
    expect(classifyOffering(w, 70 + SAFE_MARGIN).band).toBe("safe");
  });
});

describe("classifyOffering -- الأهلي (data/admission_rules.md §32)", () => {
  it("أهلي بلا حدّ منشور ⇒ unknown لا safe -- رغم isDirectAdmission=true دائماً", () => {
    const w = makeWish({ universityType: "أهلية", isDirectAdmission: true, statedMinimumGrade: null });
    const result = classifyOffering(w, 45);
    expect(result.band).toBe("unknown");
    expect(result.cutoff).toBeNull();
  });

  it("أهلي بحدّ منشور يُقارَن بالمعدل كالحكومي تماماً", () => {
    const w = makeWish({
      universityType: "أهلية",
      isDirectAdmission: true,
      statedMinimumGrade: { value: 90, raw: "معدل (90)%", source: "s", sourceYear: "2025-2026" },
    });
    expect(classifyOffering(w, 95).band).toBe("safe");
    expect(classifyOffering(w, 85).band).toBe("reach");
  });

  it("حكومي بقبول مباشر لا يُصنَّف safe لمعدل 50 -- عائق الإصدار الذي رصده المدقّق", () => {
    const w = makeWish({
      universityType: "حكومية",
      isDirectAdmission: true,
      averageGrades: { صباحي: null, مسائي: null },
    });
    expect(classifyOffering(w, 50).band).toBe("unknown");
  });

  it("unknown لا تُحتسَب رغبة آمنة في NO_SAFETY_NET", () => {
    const wishes = [
      makeWish({ universityType: "أهلية", isDirectAdmission: true, statedMinimumGrade: null }),
      makeWish({ universityType: "أهلية", isDirectAdmission: true, statedMinimumGrade: null }),
    ];
    const result = analyzeWishlist(wishes, 70);
    expect(result.counts.safe).toBe(0);
    expect(result.diagnostics.some((d) => d.code === "NO_SAFETY_NET")).toBe(true);
  });
});

describe("classifyOffering على بيانات حقيقية (لا وهمية، data/admission_rules.md §32)", () => {
  it("عروض أهلية حقيقية بلا حدّ منشور تُصنَّف unknown -- لا safe", () => {
    const dir = path.join(__dirname, "../public/data/by-branch");
    let checked = 0;
    let wronglySafe = 0;
    for (const f of fs.readdirSync(dir)) {
      const offerings = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as UniversityOffering[];
      for (const o of offerings) {
        if (o.universityType !== "أهلية" || o.statedMinimumGrade?.value != null) continue;
        checked++;
        const result = classifyOffering({ majorId: "", majorName: "", session: "صباحي", offering: o }, 99);
        if (result.band === "safe") wronglySafe++;
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(wronglySafe).toBe(0);
  });
});

describe("NO_REACHABLE على بيانات حقيقية (فرع علمي، data/admission_rules.md §32)", () => {
  const dir = path.join(__dirname, "../public/data/by-branch");
  const allOfferings = JSON.parse(fs.readFileSync(path.join(dir, "علمي.json"), "utf8")) as UniversityOffering[];

  function classifyAll(grade: number, offerings: UniversityOffering[] = allOfferings) {
    const counts = { safe: 0, close: 0, unknown: 0, reach: 0 };
    const safeOfferings: UniversityOffering[] = [];
    for (const o of offerings) {
      if (!o.sessions.includes("صباحي")) continue;
      const { band } = classifyOffering({ majorId: "", majorName: "", session: "صباحي", offering: o }, grade);
      counts[band]++;
      if (band === "safe") safeOfferings.push(o);
    }
    return { counts, safeOfferings };
  }

  it("معدّل 45 لا يُنتج 'مريح' لأي أهلي بلا حدّ منشور -- الحارس ضد العطل الأصلي", () => {
    // العطل الأصلي: كل الأهلي (98% منه بلا حدّ منشور) كان يُصنَّف safe لأي
    // معدّل. وكانت 82 "مريحة" باقية بمعدل 45 كلها حكومي "قبول مباشر" -- وهو
    // عطل ثانٍ (الإصدار 2): الوسم مستنتَج من غياب الرقم. أدنى أرضية منشورة 55،
    // فالصحيح لمعدل 45 صفر "مريح" إطلاقاً.
    const { safeOfferings } = classifyAll(45);
    const wronglySafe = safeOfferings.filter(
      (o) => o.universityType === "أهلية" && o.statedMinimumGrade?.value == null
    );
    expect(wronglySafe).toEqual([]);
    expect(safeOfferings.filter((o) => o.isDirectAdmission && o.universityType === "حكومية")).toEqual([]);
  });

  it("NO_REACHABLE تُفعَّل فعلاً حين تُستبعَد كل خيارات القبول المباشر الحكومي (محاكاة فلترة جامعة واحدة)", () => {
    // كان الحكومي المباشر (82 عند معدل 45) يمنع NO_REACHABLE في الفرع كاملاً؛
    // النطاق الأضيق يبقى فحصاً مستقلاً عن ذلك التغيير.
    const withoutGovDirect = allOfferings.filter((o) => !(o.universityType === "حكومية" && o.isDirectAdmission));
    const { counts } = classifyAll(45, withoutGovDirect);
    const reachable = counts.safe + counts.close;
    const hasOther = counts.reach > 0 || counts.unknown > 0;
    expect(reachable).toBe(0);
    expect(hasOther).toBe(true);
  });

  it("معدّل 90 لا يُفعّل NO_REACHABLE -- خيارات مريحة/متقاربة حقيقية موجودة", () => {
    const { counts } = classifyAll(90);
    expect(counts.safe + counts.close).toBeGreaterThan(0);
  });
});

describe("analyzeWishlist -- التشخيصات", () => {
  it("يرفع تحذير 'غياب شبكة الأمان' عندما تقل الرغبات المريحة عن الحد الأدنى", () => {
    const wishes = [
      makeWish({ averageGrades: { صباحي: 95, مسائي: null } }),
      makeWish({ averageGrades: { صباحي: 96, مسائي: null } }),
    ];
    const result = analyzeWishlist(wishes, 70);
    expect(result.diagnostics.some((d) => d.code === "NO_SAFETY_NET")).toBe(true);
  });

  it("لا يرفع تحذير غياب الأمان عند وجود 3 رغبات مريحة فأكثر", () => {
    const wishes = [
      makeWish({ averageGrades: { صباحي: 50, مسائي: null } }),
      makeWish({ averageGrades: { صباحي: 50, مسائي: null } }),
      makeWish({ averageGrades: { صباحي: 50, مسائي: null } }),
    ];
    const result = analyzeWishlist(wishes, 90);
    expect(result.diagnostics.some((d) => d.code === "NO_SAFETY_NET")).toBe(false);
  });

  it("يكشف التكرار المُهدِر عند 4 رغبات فأكثر لنفس التخصص/المحافظة", () => {
    const wishes = ["a", "b", "c", "d"].map(() => makeWish({ averageGrades: { صباحي: 70, مسائي: null } }));
    const result = analyzeWishlist(wishes, 90);
    expect(result.diagnostics.some((d) => d.code === "REDUNDANT_CLUSTER")).toBe(true);
  });

  it("لا يكشف تكراراً مُهدِراً عند 3 رغبات فقط لنفس التخصص/المحافظة", () => {
    const wishes = ["a", "b", "c"].map(() => makeWish({ averageGrades: { صباحي: 70, مسائي: null } }));
    const result = analyzeWishlist(wishes, 90);
    expect(result.diagnostics.some((d) => d.code === "REDUNDANT_CLUSTER")).toBe(false);
  });

  it("لا يكشف تكراراً عندما تختلف المحافظة رغم تكرار التخصص", () => {
    const wishes = ["البصرة", "النجف", "بغداد", "أربيل"].map((province) =>
      makeWish({ province, averageGrades: { صباحي: 70, مسائي: null } })
    );
    const result = analyzeWishlist(wishes, 90);
    expect(result.diagnostics.some((d) => d.code === "REDUNDANT_CLUSTER")).toBe(false);
  });

  it("يكشف ترتيباً معكوساً عندما تكون رغبة لاحقة أصعب (حدّها أعلى) بفارق كبير من سابقة", () => {
    // حدّ أعلى = تنافسية أعلى = أصعب. رغبة لاحقة أصعب من سابقة تعني أن
    // الطالب لم يستغل ترتيبه المتقدّم لأصعب خياراته -- هذا هو "الانعكاس".
    const wishes = [
      makeWish({ averageGrades: { صباحي: 60, مسائي: null } }),
      makeWish({ averageGrades: { صباحي: 95, مسائي: null } }),
    ];
    const result = analyzeWishlist(wishes, 90);
    expect(result.diagnostics.some((d) => d.code === "ORDER_INVERSION")).toBe(true);
  });

  it("لا يكشف ترتيباً معكوساً عندما تتناقص الحدود تدريجياً كالمتوقع", () => {
    const wishes = [
      makeWish({ averageGrades: { صباحي: 95, مسائي: null } }),
      makeWish({ averageGrades: { صباحي: 90, مسائي: null } }),
      makeWish({ averageGrades: { صباحي: 85, مسائي: null } }),
    ];
    const result = analyzeWishlist(wishes, 96);
    expect(result.diagnostics.some((d) => d.code === "ORDER_INVERSION")).toBe(false);
  });

  it("قائمة فارغة تُرجع تشخيص EMPTY فقط، بلا انهيار", () => {
    const result = analyzeWishlist([], 80);
    expect(result.diagnostics).toEqual([{ level: "info", code: "EMPTY", message: expect.any(String) }]);
    expect(result.counts).toEqual({ safe: 0, close: 0, reach: 0, unknown: 0 });
  });
});

describe("analyzeWishlist -- اقتراح البدائل المريحة", () => {
  it("يقترح عروضاً مريحة من التخصصات المؤهَّلة غير المُضافة للقائمة", () => {
    const candidates: AlternativeCandidate[] = [
      {
        majorId: "alt1",
        majorName: "بديل مريح",
        offerings: [makeOffering({ averageGrades: { صباحي: 50, مسائي: null } })],
      },
    ];
    const result = analyzeWishlist([], 90, candidates);
    expect(result.suggestedSafe.length).toBe(1);
    expect(result.suggestedSafe[0].majorId).toBe("alt1");
  });

  it("لا يقترح عرضاً تم اختياره فعلاً في القائمة (لا تكرار)", () => {
    const offering = makeOffering({ averageGrades: { صباحي: 50, مسائي: null } });
    const wish: WishOffering = { majorId: "alt1", majorName: "بديل", session: "صباحي", offering };
    const candidates: AlternativeCandidate[] = [{ majorId: "alt1", majorName: "بديل", offerings: [offering] }];
    const result = analyzeWishlist([wish], 90, candidates);
    expect(result.suggestedSafe.length).toBe(0);
  });

  it("لا يقترح أكثر من 5 بدائل حتى لو توفّر أكثر من ذلك", () => {
    const candidates: AlternativeCandidate[] = Array.from({ length: 8 }, (_, i) => ({
      majorId: `alt${i}`,
      majorName: `بديل ${i}`,
      offerings: [makeOffering({ universityId: `u${i}`, averageGrades: { صباحي: 40, مسائي: null } })],
    }));
    const result = analyzeWishlist([], 90, candidates);
    expect(result.suggestedSafe.length).toBeLessThanOrEqual(5);
  });
});

describe("تحقّق بيانات حقيقية: كل حدّ في public/data/major-offerings مُصنَّف ضمن نطاق منطقي", () => {
  const DIR = path.join(__dirname, "..", "public", "data", "major-offerings");
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];

  it("مجلد عروض التخصصات موجود وغير فارغ (تحقّق أن التحميل نجح)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("كل حدّ قبول حقيقي (صباحي/مسائي) عبر كل ملفات التخصصات ضمن نطاق منطقي", () => {
    // ليس [0,100] صرامةً: حدود قبول حقيقية موثَّقة (خصوصاً الطب) تتجاوز
    // 100% أحياناً بسبب معادلات الوزن التنافسي الرسمية (مثال حقيقي مرصود:
    // 101.41% لكلية طب بغداد) -- هذا ليس عطل بيانات، بل نطاق واقعي معروف.
    // السقف 120 هو حارس أمان واسع يكشف عطلاً حقيقياً (كرقم 9999 خطأً) لا
    // يرفض بيانات صحيحة معروفة.
    let checked = 0;
    const outOfRange: string[] = [];
    for (const file of files) {
      const offerings: UniversityOffering[] = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
      for (const o of offerings) {
        for (const session of ["صباحي", "مسائي"] as const) {
          const grade = o.averageGrades[session];
          checked++;
          if (grade !== null && (grade < 0 || grade > 120)) {
            outOfRange.push(`${file}: ${o.universityName}/${o.departmentName}/${session} = ${grade}`);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect(outOfRange).toEqual([]);
  });

  it("تصنيف classifyOffering لا ينهار على أي عرض حقيقي فعلي من عيّنة تخصصات متنوعة", () => {
    const sample = ["medicine", "software_engineering", "law", "history"].filter((id) => files.includes(`${id}.json`));
    expect(sample.length).toBeGreaterThan(0);
    for (const id of sample) {
      const offerings: UniversityOffering[] = JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), "utf8"));
      for (const o of offerings.slice(0, 20)) {
        for (const session of o.sessions as ("صباحي" | "مسائي")[]) {
          const result = classifyOffering({ majorId: id, majorName: id, session, offering: o }, 75);
          expect(["safe", "close", "reach", "unknown"]).toContain(result.band);
        }
      }
    }
  });
});

describe("حقيقة القبول الحكومي على بيانات حقيقية", () => {
  it("صفر قبول مباشر في الحكومي، ولا عرض بلا رقم منشور يُصنَّف مريحاً", () => {
    const dir = path.join(__dirname, "../public/data/by-branch");
    let directGov = 0;
    let unnotedCount = 0;
    const wronglySafe: string[] = [];
    for (const f of fs.readdirSync(dir)) {
      const offerings = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as UniversityOffering[];
      for (const o of offerings) {
        if (o.universityType === "أهلية") continue;
        if (o.isDirectAdmission) directGov++;
        for (const session of ["صباحي", "مسائي"] as const) {
          const r = classifyOffering({ majorId: "", majorName: "", session, offering: o }, 55);
          if (r.cutoff === null) unnotedCount++;
          if (r.band === "safe" && (r.cutoff === null || r.cutoff > 55 - SAFE_MARGIN))
            wronglySafe.push(`${o.departmentName}/${session}`);
        }
      }
    }
    expect(directGov).toBe(0);
    expect(unnotedCount).toBeGreaterThan(0);
    expect(wronglySafe).toEqual([]);
  });
});
