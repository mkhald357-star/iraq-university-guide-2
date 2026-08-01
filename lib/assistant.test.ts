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
