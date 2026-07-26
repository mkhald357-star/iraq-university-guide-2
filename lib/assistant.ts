/**
 * محرك مطابقة محلي (بلا أي اتصال شبكي أو نموذج لغوي حقيقي) لمساعد المنصة
 * العائم — يبحث في قاعدة أسئلة شائعة مُعدَّة مسبقاً
 * (data/assistant_knowledge.json) عن أقرب تطابق لسؤال المستخدم عبر تقاطع
 * كلمات مفتاحية بعد تطبيع لهجي، لا فهماً لغوياً حقيقياً. هذا اختيار مقصود
 * (طلبه المستخدم صراحة بعد نقاش التكلفة): "ذكاء اصطناعي دائم" بلا تكلفة
 * تشغيل مستمرة (استدعاء API مدفوع لكل رسالة) وبلا حاجة لخادم خلفي أو مفتاح
 * API في منصة Client-side بالكامل حالياً. يدعم اللهجة العراقية الشائعة عبر
 * DIALECT_MAP أدناه (بدل الاعتماد فقط على تكرار كل عبارة بلهجتين يدوياً في
 * كل مُدخَل من قاعدة المعرفة).
 */

export interface AssistantEntry {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
}

// خريطة تطبيع لهجة عراقية شائعة → مرادفها الفصيح الأقرب، تُطبَّق *قبل* إزالة
// الألف/التاء المربوطة في normalizeArabic أدناه. الهدف: سؤال حقيقي بلهجة
// عراقية ("شلون أسجل؟"، "اكو تخصصات طبية؟"، "شكد ياخذ الاختبار وكت؟") يطابق
// نفس القاعدة المعرفية التي كُتبت أصلاً بصياغة فصحى قريبة ("كيف أسجل؟").
const DIALECT_MAP: Record<string, string> = {
  شلون: "كيف",
  شلونية: "كيف",
  شنو: "ما",
  شنهي: "ما",
  شنهو: "ما",
  "شنو هي": "ما هي",
  وين: "اين",
  منين: "من اين",
  شكد: "كم",
  جم: "كم",
  چم: "كم",
  ليش: "لماذا",
  ليه: "لماذا",
  اكو: "يوجد",
  ماكو: "لا يوجد",
  هسه: "الان",
  هسا: "الان",
  هلحين: "الان",
  مو: "ليس",
  مب: "ليس",
  تكدر: "تستطيع",
  أكدر: "استطيع",
  اكدر: "استطيع",
  يكدر: "يستطيع",
  يشتغل: "يعمل",
  تشتغل: "تعمل",
  اشتغل: "اعمل",
  شغال: "يعمل",
  خوش: "جيد",
  زين: "جيد",
  كلش: "جدا",
  هواي: "كثيرا",
  جان: "كان",
  ارد: "اريد",
  دز: "ارسل",
  يديز: "يرسل",
  شوكت: "متى",
  بيها: "بها",
  بيه: "به",
  چذي: "هكذا",
  جذي: "هكذا",
  اهم: "هم",
  اهنا: "هنا",
};

function applyDialectMap(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => DIALECT_MAP[word] ?? word)
    .join(" ");
}

function normalizeArabic(text: string): string {
  return applyDialectMap(
    text
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, "ا")
      .replace(/چ/g, "ك")
      .replace(/گ/g, "ك")
      .replace(/[؟?!.,]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  )
    .replace(/(^|\s)ال/g, "$1")
    .replace(/[ةه]$/g, "")
    .replace(/ا/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// كلمات استفهام/حشو عامة تتكرر في كل سؤال عربي تقريباً (هل/ما/كيف/لماذا...) —
// بلا استبعادها، رسالة عابرة مثل "هلو كيف الحال" تطابق أي مدخلة تحتوي "كيف"
// في أحد عباراتها المرجعية بالخطأ. تُستبعد من حساب التقاطع فقط (لا تُحذف من
// نص السؤال نفسه، فتطابق العبارة الكاملة في queryNorm.includes(keywordNorm)
// أدناه يبقى سليماً). القائمة الخام تُكتب بصيغتها المقروءة الطبيعية، ثم
// تُطبَّع عبر normalizeArabic نفسها قبل التخزين في STOPWORDS الفعلية --
// وإلا فكلمات تحوي ألفاً ("اين"→"ين" بعد التطبيع، "انا"→"ن"...) لن تطابق
// أبداً القائمة الخام غير المطبَّعة، فيفشل الاستبعاد صامتاً لمعظم الكلمات
// (عطل رُصد وأُصلح هنا -- كان موجوداً قبل إضافة الدعم اللهجي).
const RAW_STOPWORDS = [
  "هل",
  "ما",
  "ماذا",
  "شنو",
  "كيف",
  "شلون",
  "لماذا",
  "ليش",
  "متى",
  "اين",
  "وين",
  "من",
  "الى",
  "عن",
  "في",
  "على",
  "هذا",
  "هذه",
  "ذلك",
  "هاي",
  "هاذا",
  "يعني",
  "او",
  "و",
  "ثم",
  "قد",
  "لا",
  "نعم",
  "اي",
  "شكد",
  "كم",
  "انا",
  "اني",
  "انت",
  "انتي",
  "هو",
  "هي",
  "لي",
  "الي",
  "لك",
  "يا",
  "كل",
  "بعض",
  "عندي",
  "لديك",
  "عدنه",
  "عده",
  "اكو",
  "ماكو",
  "مو",
];
const STOPWORDS = new Set(RAW_STOPWORDS.map((w) => normalizeArabic(w)).filter(Boolean));

/**
 * يُرجع أفضل تطابق (إن وُجد) عبر عدّ كلمات سؤال المستخدم الموجودة فعلياً
 * ضمن كل كلمة مفتاحية مرجعية (أو العكس) — تطابق جزئي متسامح، لا حرفياً.
 */
export function findBestAnswer(
  userQuery: string,
  knowledge: AssistantEntry[]
): { entry: AssistantEntry; score: number } | null {
  const queryNorm = normalizeArabic(userQuery);
  if (!queryNorm) return null;
  const queryWords = queryNorm.split(" ").filter((w) => w.length >= 2 && !STOPWORDS.has(w));

  let best: { entry: AssistantEntry; score: number } | null = null;

  for (const entry of knowledge) {
    let score = 0;
    for (const keyword of entry.keywords) {
      const keywordNorm = normalizeArabic(keyword);
      if (!keywordNorm) continue;
      // شرط الطول الأدنى (3 أحرف) يمنع شظية قصيرة جداً بعد التطبيع (مثال:
      // "اين" تصبح "ين" بعد حذف الألف) من "مطابقة" أي كلمة أطول تحوي نفس
      // الحرفين مصادفة (مثال: "بين")، وهو خلل رُصد فعلياً عبر اختبار مخصَّص.
      const minLen = Math.min(queryNorm.length, keywordNorm.length);
      if (minLen >= 3 && (queryNorm.includes(keywordNorm) || keywordNorm.includes(queryNorm))) {
        score += keywordNorm.split(" ").length * 3; // تطابق شبه كامل لعبارة كاملة
        continue;
      }
      const keywordWords = keywordNorm.split(" ").filter((w) => w.length >= 2 && !STOPWORDS.has(w));
      const overlap = keywordWords.filter((kw) => queryWords.some((qw) => qw.includes(kw) || kw.includes(qw)));
      score += overlap.length;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }

  // عتبة دنيا لتفادي عرض إجابة غير ذات صلة لمجرد تطابق كلمة عامة واحدة أو
  // كلمتين قصيرتين عرضاً (رُفعت من 2 إلى 3 بعد ملاحظة تطابقات كاذبة على
  // رسائل ترحيب عابرة مثل "هلو كيف الحال").
  if (best && best.score < 3) return null;
  return best;
}

/** أسئلة مقترحة تُعرض كأزرار سريعة عند فتح المساعد لأول مرة. */
export const SUGGESTED_QUESTION_IDS = [
  "how_it_works",
  "majors_count",
  "cutoffs_meaning",
  "private_vs_public",
  "disclaimer",
];
