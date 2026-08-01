import { describe, it, expect } from "vitest";
import { findBestAnswer, type AssistantEntry } from "./assistant";
import realKnowledgeData from "../data/assistant_knowledge.json";

const realKnowledge = realKnowledgeData as AssistantEntry[];

const knowledge: AssistantEntry[] = [
  {
    id: "how_it_works",
    question: "كيف يعمل اختبار الميول؟",
    keywords: ["كيف يعمل الاختبار", "طريقة الاختبار"],
    answer: "شرح آلية الاختبار",
  },
  {
    id: "private_vs_public",
    question: "ما الفرق بين الجامعات الحكومية والأهلية؟",
    keywords: ["حكومية ام اهلية", "الفرق بين الحكومي والاهلي", "جامعات اهلية"],
    answer: "شرح الفرق",
  },
  {
    id: "cutoffs_meaning",
    question: "ما معنى الحد الأدنى للقبول؟",
    keywords: ["الحد الادنى", "معدل القبول", "كم يحتاج معدل"],
    answer: "شرح الحد الأدنى",
  },
];

describe("findBestAnswer -- تطابق فصيح أساسي", () => {
  it("يطابق سؤالاً بصياغة قريبة من كلمة مفتاحية مرجعية", () => {
    const result = findBestAnswer("كيف يعمل الاختبار بالضبط؟", knowledge);
    expect(result?.entry.id).toBe("how_it_works");
  });

  it("يُرجع null لسؤال لا علاقة له بأي مُدخل في القاعدة", () => {
    const result = findBestAnswer("ما هو الطقس اليوم؟", knowledge);
    expect(result).toBeNull();
  });

  it("يُرجع null لرسالة ترحيب عابرة قصيرة (لا تطابق كاذبة على كلمة عامة)", () => {
    const result = findBestAnswer("هلو كيف الحال", knowledge);
    expect(result).toBeNull();
  });
});

describe("findBestAnswer -- دعم اللهجة العراقية", () => {
  it('"شلون" تُطابَق كمرادف لـ"كيف"', () => {
    const result = findBestAnswer("شلون يشتغل الاختبار؟", knowledge);
    expect(result?.entry.id).toBe("how_it_works");
  });

  it('"شنو" تُطابَق كمرادف لـ"ما"', () => {
    const result = findBestAnswer("شنو الفرق بين الحكومي والاهلي؟", knowledge);
    expect(result?.entry.id).toBe("private_vs_public");
  });

  it('"شكد" تُطابَق كمرادف لـ"كم"', () => {
    const result = findBestAnswer("شكد يحتاج معدل للقبول؟", knowledge);
    expect(result?.entry.id).toBe("cutoffs_meaning");
  });

  it("سؤال بلهجة عراقية كاملة يطابق نفس نتيجة صياغته الفصحى المكافئة", () => {
    const dialectResult = findBestAnswer("شلون تسجل بيه؟ شنو الحد الادنى للقبول؟", knowledge);
    const formalResult = findBestAnswer("ما هو الحد الادنى للقبول؟", knowledge);
    expect(dialectResult?.entry.id).toBe(formalResult?.entry.id);
  });
});

describe("findBestAnswer -- فلترة كلمات الحشو (STOPWORDS)", () => {
  it("كلمة استفهام تحوي ألفاً (اين) لا تُحتسَب كمطابقة محتوى وهمية بمفردها", () => {
    // "اين" وحدها (بلا أي كلمة محتوى حقيقية) يجب ألا تُطابِق أي مُدخل حتى لو
    // تصادف أن أحد المداخل يحوي "اين" ضمن نص إجابته أو سؤاله المرجعي
    const result = findBestAnswer("اين", knowledge);
    expect(result).toBeNull();
  });

  it("كلمة استفهام تحوي ألفاً (انا) لا تُفسَد فتصبح جزءاً من مطابقة محتوى بالخطأ", () => {
    const entryWithAlifWord: AssistantEntry[] = [
      { id: "x", question: "س", keywords: ["ناجح"], answer: "ج" }, // "ناجح" يحوي "ن" وحدها بعد تطبيع "انا"
    ];
    const result = findBestAnswer("انا", entryWithAlifWord);
    expect(result).toBeNull();
  });
});

describe("findBestAnswer -- data/assistant_knowledge.json الحقيقية: kurdistan_gap", () => {
  // اكتُشف فعلياً أثناء توسيع كلمات هذا المدخل (data/admission_rules.md §25):
  // إضافة عدة عبارات مفتاحية تبدأ كلها بـ"جامعة" (مثال: "جامعة كوية"، "جامعة
  // دهوك") جعلت الكلمة العامة "جامعة" تُحتسَب مراراً (مرة لكل عبارة تحويها)
  // في مجموع النقاط -- فأي سؤال عادي عن أي جامعة عراقية (بما فيها جامعات
  // اتحادية حقيقية كتكريت/سامراء) كان يتجاوز عتبة التطابق زوراً. الإصلاح:
  // كلمات مفردة مميّزة بلا بادئة "جامعة" مكرَّرة.
  it("يطابق سؤالاً عن جامعات إقليم كردستان بأسمائها الفعلية", () => {
    for (const q of ["وين جامعة كوية", "جامعة دهوك وين اكو", "جامعة زاخو", "هولير", "جامعة جيهان", "جامعة السليمانية"]) {
      expect(findBestAnswer(q, realKnowledge)?.entry.id).toBe("kurdistan_gap");
    }
  });

  it("لا يطابق زوراً سؤالاً عن جامعة اتحادية حقيقية بمحافظة صلاح الدين", () => {
    for (const q of ["جامعة تكريت في محافظة صلاح الدين", "جامعة سامراء صلاح الدين وين تقع"]) {
      expect(findBestAnswer(q, realKnowledge)?.entry.id).not.toBe("kurdistan_gap");
    }
  });
});

describe("findBestAnswer -- حارس بنيوي: صنف عطل اختطاف الكلمة المشتركة (data/admission_rules.md §26)", () => {
  // عطل kurdistan_gap لم يكن حالة معزولة -- أي مدخل تتكرّر فيه كلمة شائعة ≥2
  // مرة ضمن كلماته المفتاحية عرضة لنفس الآلية: تراكم نقاط زائفة لأي سؤال
  // عادي يذكر تلك الكلمة مرة واحدة فقط. مسح آلي على كامل
  // data/assistant_knowledge.json (لا فحص يدوي لكل مدخل) وجد 5 مداخل إضافية
  // بكلمات المنصّة العامة (cutoffs_meaning، admin_branch_myth، grade_type،
  // majors_count، universities_count) — أُصلحت جميعاً. "برمجيات" أُضيفت لاحقاً
  // بدليل مباشر لا تخميناً: اختبار الأسئلة العشرين (§27) أثبت أن سؤالاً عن
  // راتب مهندس البرمجيات كان يُطابَق زوراً بمدخل ai_vs_swe بسبب تكرار
  // "برمجيات"/"ذكاء"/"اصطناعي" ثلاث مرات في كلماته -- أُصلح، وأُضيفت الكلمة
  // هنا لمنع تكرارها هناك أو في أي مدخل جديد مستقبلاً. القائمة تتّسع بالدليل
  // لا بالتخمين -- ليست مضمونة الاكتمال لكل كلمة شائعة ممكنة.
  const COMMON_WORDS = ["جامعة", "كلية", "قسم", "معدل", "تخصص", "دراسة", "قبول", "فرع", "برمجيات"];

  it("لا مدخل يكرّر كلمة شائعة ≥2 مرة ضمن كلماته المفتاحية", () => {
    const offenders: string[] = [];
    for (const entry of realKnowledge) {
      const counts: Record<string, number> = {};
      for (const kw of entry.keywords) {
        for (const w of kw.split(/\s+/)) counts[w] = (counts[w] ?? 0) + 1;
      }
      const bad = COMMON_WORDS.filter((w) => (counts[w] ?? 0) >= 2);
      if (bad.length) offenders.push(`${entry.id}: ${bad.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  // فحص انحدار: التخفيف من التكرار لا يجب أن يُفقِد المداخل الخمسة قدرتها
  // على مطابقة أسئلتها الحقيقية الأصلية (لا مجرد اجتياز الفحص البنيوي أعلاه
  // بإفراغ الكلمات المفتاحية من المعنى).
  it("المداخل المُصلَحة ما زالت تطابق أسئلتها الأصلية", () => {
    const cases: Array<[string, string]> = [
      ["ما معنى الحد الأدنى للقبول؟", "cutoffs_meaning"],
      ["هل الإدارة فرع دراسي مستقل؟", "admin_branch_myth"],
      ["ما الفرق بين المعدل المتوقع والمعدل الحقيقي؟", "grade_type"],
      ["كم عدد التخصصات المتوفرة؟", "majors_count"],
      ["كم جامعة موجودة في المنصة؟", "universities_count"],
      ["ما الفرق بين هندسة البرمجيات والذكاء الاصطناعي؟", "ai_vs_swe"],
    ];
    for (const [q, expectedId] of cases) {
      expect(findBestAnswer(q, realKnowledge)?.entry.id).toBe(expectedId);
    }
  });

  it('لا يطابق زوراً سؤال راتب عاماً يذكر "برمجيات" مرة واحدة بمدخل ai_vs_swe', () => {
    expect(findBestAnswer("شكد راتب مهندس البرمجيات؟", realKnowledge)?.entry.id).not.toBe("ai_vs_swe");
  });
});
