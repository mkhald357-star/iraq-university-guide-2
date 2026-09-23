import { describe, it, expect } from "vitest";
import { computeUserRiasecVector } from "./riasec";
import { rankMajors, planTieBreak, type RankMajorsData, type RankedMajor } from "./recommendationEngine";
import questionsData from "../data/questions.json";
import majorsData from "../data/majors.json";
import riasecProfilesData from "../data/major_riasec_profiles.json";
import subjectAffinityWeightsData from "../data/subject_affinity_weights.json";
import tiebreakerQuestionsData from "../data/tiebreaker_questions.json";
import type { RiasecQuestion } from "./riasec";

// اختبار ثابت شاهد (golden master) على السلوك الفعلي الحالي لمحرك الترتيب،
// مُثبَّت *قبل* أي تعديل مستقبلي (مقياس 5 نقاط، محور السياق، إلخ) -- أي
// انحراف غير مقصود في هذه اللقطات يعني كسراً حقيقياً في أخطر منطق حسابي
// بالمنصة. الأرقام هنا ليست "متوقَّعة نظرياً"؛ هي نسخة مُصوَّرة مما يحسبه
// الكود فعلاً اليوم على بيانات المنصة الحقيقية (لا بيانات وهمية).
//
// إعادة تثبيت مقصودة للّقطات (2026-09-22): البنك الأساسي تغيّر من 40 بنداً
// إلى 23 بنداً مُراجَعاً (data/questions.json، QA-REPORT-ALGORITHM.md) --
// كل تغيّر في هذه اللقطات ناتج عن تغيّر البنود لا عن تغيّر منطق rankMajors
// (التسجيل الافتراضي هنا ما زال minLoadingShare=0 وlevel كما كان).

const DATA: RankMajorsData = {
  majors: majorsData,
  riasecProfiles: riasecProfilesData.profiles as RankMajorsData["riasecProfiles"],
  subjectWeights: subjectAffinityWeightsData.weights as RankMajorsData["subjectWeights"],
};

const QUESTIONS = questionsData as RiasecQuestion[];
const TIEBREAKERS = tiebreakerQuestionsData as RiasecQuestion[];

function summarize(ranked: RankedMajor[], n = 5) {
  return ranked.slice(0, n).map((m) => ({
    id: m.id,
    category: m.category,
    fitPercent: Math.round(m.fitPercent * 100) / 100,
    riasecFitPercent: Math.round(m.riasecFitPercent * 100) / 100,
    subjectFitPercent: m.subjectFitPercent === null ? null : Math.round(m.subjectFitPercent * 100) / 100,
    combinedScore: Math.round(m.combinedScore * 100) / 100,
  }));
}

function answersFromWeight(weight: -1 | 0 | 1): Record<string, number> {
  const answers: Record<string, number> = {};
  QUESTIONS.forEach((q) => (answers[q.id] = weight));
  return answers;
}

/** إجابة حاسمة موافقة بقوة على أول بُعد مهيمن يظهر في كل سؤال (R>I>A>S>E>C ضمنياً حسب ترتيب الملف). */
function answersFavoring(dim: string): Record<string, number> {
  const answers: Record<string, number> = {};
  QUESTIONS.forEach((q) => {
    const w = (q.dimensions as Record<string, number>)[dim];
    if (w === undefined) {
      answers[q.id] = 0;
    } else {
      answers[q.id] = w > 0 ? 1 : -1;
    }
  });
  return answers;
}

/** نفس answersFavoring لكن بميل معتدل (±0.5) لا حاسم -- يفحص مسار مقياس الخمس نقاط الجديد تحديداً. */
function answersMildlyFavoring(dim: string): Record<string, number> {
  const answers: Record<string, number> = {};
  QUESTIONS.forEach((q) => {
    const w = (q.dimensions as Record<string, number>)[dim];
    answers[q.id] = w === undefined ? 0 : w > 0 ? 0.5 : -0.5;
  });
  return answers;
}

describe("golden master: rankMajors على بيانات المنصة الحقيقية (قبل أي تعديل خوارزمي)", () => {
  it("كل الإجابات محايدة (0) — علمي، معدل 70، بلا درجات مواد", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFromWeight(0),
        questionPool: QUESTIONS,
        branch: "علمي",
        grade: 70,
        subjectGrades: {},
      },
      DATA
    );
    expect(summarize(ranked)).toMatchSnapshot();
    expect(ranked.length).toMatchSnapshot("عدد التخصصات المؤهَّلة (علمي، معدل 70)");
  });

  it("كل الإجابات 'نعم' (1) — أدبي، معدل 85، بلا درجات مواد", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFromWeight(1),
        questionPool: QUESTIONS,
        branch: "أدبي",
        grade: 85,
        subjectGrades: {},
      },
      DATA
    );
    expect(summarize(ranked)).toMatchSnapshot();
  });

  it("كل الإجابات 'لا' (-1) — فنون، معدل 60", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFromWeight(-1),
        questionPool: QUESTIONS,
        branch: "فنون",
        grade: 60,
        subjectGrades: {},
      },
      DATA
    );
    expect(summarize(ranked)).toMatchSnapshot();
  });

  it("طالب واقعي عملي (R مهيمن) — علمي، معدل 75", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFavoring("R"),
        questionPool: QUESTIONS,
        branch: "علمي",
        grade: 75,
        subjectGrades: {},
      },
      DATA
    );
    expect(summarize(ranked)).toMatchSnapshot();
  });

  it("طالب استقصائي (I مهيمن) — علمي، معدل 92، بوابة الطب مفتوحة", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFavoring("I"),
        questionPool: QUESTIONS,
        branch: "علمي",
        grade: 92,
        subjectGrades: {},
      },
      DATA
    );
    expect(summarize(ranked)).toMatchSnapshot();
  });

  it("طالب استقصائي (I مهيمن) — علمي، معدل 80 (بوابة الطب مغلقة، تحت 85)", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFavoring("I"),
        questionPool: QUESTIONS,
        branch: "علمي",
        grade: 80,
        subjectGrades: {},
      },
      DATA
    );
    // لا تخصص من فئة "طبي" يجب أن يظهر إطلاقاً
    expect(ranked.some((m) => m.category === "طبي")).toBe(false);
    expect(summarize(ranked)).toMatchSnapshot();
  });

  it("طالب فني (A مهيمن) مع محور قرابة دراسية (رياضيات عالية) — علمي، معدل 88", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFavoring("A"),
        questionPool: QUESTIONS,
        branch: "علمي",
        grade: 88,
        subjectGrades: { math: 95, physics: 60, chemistry: 60, biology: 60, arabic: 60, english: 60 },
      },
      DATA
    );
    expect(summarize(ranked)).toMatchSnapshot();
  });

  it("طالب اجتماعي (S مهيمن) — أدبي، معدل 78", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFavoring("S"),
        questionPool: QUESTIONS,
        branch: "أدبي",
        grade: 78,
        subjectGrades: {},
      },
      DATA
    );
    expect(summarize(ranked)).toMatchSnapshot();
  });

  it("طالب مقاولاتي (E مهيمن) — علمي، معدل 65", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFavoring("E"),
        questionPool: QUESTIONS,
        branch: "علمي",
        grade: 65,
        subjectGrades: {},
      },
      DATA
    );
    expect(summarize(ranked)).toMatchSnapshot();
  });

  it("طالب تقليدي منظَّم (C مهيمن) — أدبي، معدل 82", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFavoring("C"),
        questionPool: QUESTIONS,
        branch: "أدبي",
        grade: 82,
        subjectGrades: {},
      },
      DATA
    );
    expect(summarize(ranked)).toMatchSnapshot();
  });

  it("[مقياس 5 نقاط] الميل المعتدل (0.5) ينتج متجه مستخدم أقلّ تطرّفاً رياضياً من الميل الحاسم (1) على البُعد المستهدَف نفسه", () => {
    // خاصية رياضية مضمونة بصرف النظر عن بروفايلات التخصصات (خلافاً لأثرها
    // النهائي على الترتيب، الذي يعتمد على تفاعل كل الأبعاد الستة معاً مع
    // بروفايل كل تخصص فعلياً -- غير قابل للتنبؤ ببساطة، فلا يصلح أساساً
    // لاختبار هنا). computeUserRiasecVector تُطبِّع بمقدار الإجابة مباشرة:
    // بُعد يحمل وزناً موجباً بحتاً (R لا سلبيات فيه إطلاقاً حالياً) عند
    // إجابة 0.5 على كل بنوده ينتج بالضبط 75 (منتصف المسافة بين 50 المحايد
    // و100 الحاسم)، لا 100.
    const decisiveVector = computeUserRiasecVector(answersFavoring("R"), QUESTIONS);
    const mildVector = computeUserRiasecVector(answersMildlyFavoring("R"), QUESTIONS);
    expect(decisiveVector.R).toBe(100);
    expect(mildVector.R).toBe(75);
    expect(mildVector.R).toBeLessThan(decisiveVector.R);

    // الأثر الفعلي على الترتيب (تفاعل الأبعاد الستة مع بيانات حقيقية) --
    // مُسجَّل كشاهد لا كفرضية مُثبَتة رياضياً، والفارق بين الحالتين حقيقي
    // ومفيد أيضاً حتى لو لم يكن رتيباً (monotonic) على كل تخصص.
    const decisive = rankMajors(
      { scoredAnswers: answersFavoring("R"), questionPool: QUESTIONS, branch: "علمي", grade: 75, subjectGrades: {} },
      DATA
    );
    const mild = rankMajors(
      {
        scoredAnswers: answersMildlyFavoring("R"),
        questionPool: QUESTIONS,
        branch: "علمي",
        grade: 75,
        subjectGrades: {},
      },
      DATA
    );
    expect(summarize(decisive)).toMatchSnapshot("الميل الحاسم (1)");
    expect(summarize(mild)).toMatchSnapshot("الميل المعتدل (0.5)");
  });

  it("[مقياس 5 نقاط] مزيج إجابات واقعي (بعض شديد، بعض معتدل، بعض محايد) — أدبي، معدل 88", () => {
    const answers: Record<string, number> = {};
    QUESTIONS.forEach((q, i) => {
      const cyclePosition = i % 5;
      const values = [1, 0.5, 0, -0.5, -1];
      answers[q.id] = values[cyclePosition];
    });
    const ranked = rankMajors(
      { scoredAnswers: answers, questionPool: QUESTIONS, branch: "أدبي", grade: 88, subjectGrades: {} },
      DATA
    );
    expect(summarize(ranked)).toMatchSnapshot();
  });

  it("مساحة خالية: فرع غير معروف يُرجع صفر تخصصات مؤهَّلة", () => {
    const ranked = rankMajors(
      {
        scoredAnswers: answersFromWeight(0),
        questionPool: QUESTIONS,
        branch: "غير موجود",
        grade: 70,
        subjectGrades: {},
      },
      DATA
    );
    expect(ranked).toEqual([]);
  });
});

describe("golden master: planTieBreak", () => {
  it("لا ترجيح عند فارق كبير بين أفضل تخصصين", () => {
    const ranked: RankedMajor[] = [
      { id: "a", name: "أ", category: "x", marketMultiplier: 1, fitPercent: 90, riasecFitPercent: 90, subjectFitPercent: null, combinedScore: 90 },
      { id: "b", name: "ب", category: "x", marketMultiplier: 1, fitPercent: 70, riasecFitPercent: 70, subjectFitPercent: null, combinedScore: 70 },
    ];
    const decision = planTieBreak(ranked, 0, new Set(), TIEBREAKERS, DATA.riasecProfiles);
    expect(decision.needsTieBreak).toBe(false);
    expect(decision.candidates).toEqual([]);
  });

  it("يطلق ترجيحاً عند فارق أقل من AMBIGUITY_THRESHOLD (6)، ويختار 6 أسئلة بالضبط لبُعدين", () => {
    const ranked: RankedMajor[] = [
      { id: "electrical_engineering", name: "هندسة الكهرباء", category: "هندسة", marketMultiplier: 1, fitPercent: 80, riasecFitPercent: 80, subjectFitPercent: null, combinedScore: 80 },
      { id: "electrical_tech", name: "تقنيات الكهرباء", category: "تقنيات طبية مساندة", marketMultiplier: 1, fitPercent: 77, riasecFitPercent: 77, subjectFitPercent: null, combinedScore: 77 },
    ];
    const decision = planTieBreak(ranked, 0, new Set(), TIEBREAKERS, DATA.riasecProfiles);
    expect(decision.needsTieBreak).toBe(true);
    expect(decision.candidates.length).toBeGreaterThan(0);
    expect(decision.tieBreakInfo).toEqual({ a: "هندسة الكهرباء", b: "تقنيات الكهرباء" });
  });

  it("يتوقف بعد 3 جولات (MAX_TIEBREAK_ROUNDS) حتى لو بقي الفارق ضئيلاً", () => {
    const ranked: RankedMajor[] = [
      { id: "a", name: "أ", category: "x", marketMultiplier: 1, fitPercent: 71, riasecFitPercent: 71, subjectFitPercent: null, combinedScore: 71 },
      { id: "b", name: "ب", category: "x", marketMultiplier: 1, fitPercent: 70, riasecFitPercent: 70, subjectFitPercent: null, combinedScore: 70 },
    ];
    const decision = planTieBreak(ranked, 3, new Set(), TIEBREAKERS, DATA.riasecProfiles);
    expect(decision.needsTieBreak).toBe(false);
  });

  it("لا ترجيح مع أقل من تخصصين مؤهَّلين", () => {
    const decision = planTieBreak(
      [{ id: "a", name: "أ", category: "x", marketMultiplier: 1, fitPercent: 50, riasecFitPercent: 50, subjectFitPercent: null, combinedScore: 50 }],
      0,
      new Set(),
      TIEBREAKERS,
      DATA.riasecProfiles
    );
    expect(decision.needsTieBreak).toBe(false);
  });
});
