// Validates data/universities.json and data/majors.json against the same
// shape lib/validation.ts (Zod v4) expects, so a corrupted or malformed
// data file fails fast (in CI or locally) instead of silently breaking
// `next build` the way data/universities.json did before this was added.
const { z } = require("zod");
const fs = require("fs");
const path = require("path");
const SOURCES = require("./admissionSources");

const ROOT = path.join(__dirname, "..");

const DepartmentCutoffSchema = z.object({
  branch: z.string(),
  gender: z.string(),
  averagePercent: z.number(),
  isQuota: z.boolean(),
});

const DepartmentSchema = z.object({
  name: z.string(),
  // اسم عرض مُصحَّح (أثر انعكاس رابطة "لا" من استخراج PDF) -- عرض فقط، لا
  // يمسّ name (مفتاح المطابقة). انظر scripts/displayName.js.
  displayName: z.string().optional(),
  branch: z.array(z.string()),
  sessions: z.array(z.string()),
  cutoffs: z.array(DepartmentCutoffSchema),
  averageGrades: z.object({
    صباحي: z.number().nullable(),
    مسائي: z.number().nullable(),
  }),
  isDirectAdmission: z.boolean(),
  // أجور الدراسة السنوية (دينار عراقي) -- خاصة بالجامعات الأهلية فقط، مصدرها
  // الدليل الرسمي لأجور الجامعات والكليات الأهلية 2025-2026. اختيارية لأن
  // الجامعات الحكومية بلا أجور دراسة مركزية مماثلة (القبول تنافسي بلا رسوم).
  tuitionFees: z
    .object({
      صباحي: z.number().nullable(),
      مسائي: z.number().nullable(),
    })
    .optional(),
  admissionSuspended: z.boolean().optional(),
  note: z.string().nullable().optional(),
});

const UniversitySchema = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string().nullable().optional(),
  type: z.string(),
  province: z.string(),
  founded: z.number().int().nullable().optional(),
  website: z.string().nullable().optional(),
  ranking: z.number().int().nullable().optional(),
  colleges: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      displayName: z.string().optional(),
      nameEn: z.string().nullable().optional(),
      departments: z.array(DepartmentSchema),
    })
  ),
});

const UniversitiesFileSchema = z.object({
  meta: z.object({}).passthrough(),
  universities: z.array(UniversitySchema),
});

const MajorSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  marketMultiplier: z.number(),
});

const RIASEC_DIMENSIONS = ["R", "I", "A", "S", "E", "C"];
const DimensionsSchema = z
  .object(Object.fromEntries(RIASEC_DIMENSIONS.map((d) => [d, z.number().optional()])))
  .strict();

const QuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  dimensions: DimensionsSchema,
  // اختياري: أسئلة المقارنة الصريحة ("تفضّل A على B؟") فقط تستخدمه لاستبدال
  // نصوص الأزرار العامة بنص يوضّح أي طرف من المقارنة يختاره كل زر.
  answerLabels: z.object({ yes: z.string(), maybe: z.string(), no: z.string() }).strict().optional(),
});

const RiasecProfileSchema = z
  .object(Object.fromEntries(RIASEC_DIMENSIONS.map((d) => [d, z.number().min(0).max(10).optional()])))
  .strict();

const ValidityQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  dimensions: z.object({}).strict(),
  validity: z.object({
    type: z.enum(["instructed", "reverse_twin", "lie_scale"]),
    expected: z.number().optional(),
    pairsWith: z.string().optional(),
  }),
});

const ContradictionPairSchema = z.object({
  a: z.string(),
  b: z.string(),
  message: z.string(),
});

const AssistantEntrySchema = z.object({
  id: z.string(),
  question: z.string(),
  keywords: z.array(z.string()).min(1),
  answer: z.string(),
});

let hasErrors = false;

function validate(label, filePath, schema) {
  const raw = fs.readFileSync(filePath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`[FAIL] ${label}: invalid JSON -- ${e.message}`);
    hasErrors = true;
    return;
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[FAIL] ${label}: schema validation failed`);
    for (const issue of result.error.issues.slice(0, 20)) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    hasErrors = true;
    return;
  }
  console.log(`[OK] ${label}`);
}

// حارس بنيوي على سنوات مصادر البيانات الخام (data/admission_rules.md §24):
// يمنع آلياً الخطر الذي وُصف صراحةً -- تحديث ملف مصدر واحد (وثيقة الحدود
// الدنيا مثلاً) بلا تحديث السنة المُعلَنة معه في scripts/admissionSources.js.
// فحصان لكل مصدر معروف:
//   (١) وجود الملف المُعلَن فعلياً على القرص -- تبديله بملف جديد (مثال:
//       cutoffs_2026_2027.json) بلا تحديث admissionSources.js يكسر البناء
//       فوراً، لأن المسار القديم لم يعد موجوداً.
//   (٢) إن حمل اسم الملف نمط سنة قابلاً للاستخراج (YYYY[-_]YYYY)، يجب أن
//       يطابق حرفياً السنة المُعلَنة -- يمسك حالة أخطر: تبديل الملف *مع*
//       نسيان تحديث السنة (لا حذف الملف القديم فقط). بعض الملفات (دليل
//       الطالب المُستخرَج نصاً كاملاً، دليل الأهلية المُطابَق) لا تحمل سنة في
//       اسمها إطلاقاً -- الفحص (٢) لا ينطبق عليها عندئذٍ، والفحص (١) وحده
//       ضمانتها الآلية اليوم.
{
  let sourcesOk = true;
  for (const [key, src] of Object.entries(SOURCES)) {
    const filePath = path.join(ROOT, src.file);
    if (!fs.existsSync(filePath)) {
      console.error(`[FAIL] admissionSources.${key}: الملف المُعلَن غير موجود على القرص: ${src.file}`);
      hasErrors = true;
      sourcesOk = false;
      continue;
    }
    const yearMatch = src.file.match(/(\d{4})[-_](\d{4})/);
    if (yearMatch) {
      const fileYear = `${yearMatch[1]}-${yearMatch[2]}`;
      if (fileYear !== src.year) {
        console.error(
          `[FAIL] admissionSources.${key}: سنة اسم الملف (${fileYear}) لا تطابق السنة المُعلَنة (${src.year}) -- الملف ${src.file}`
        );
        hasErrors = true;
        sourcesOk = false;
      }
    }
  }
  if (sourcesOk) console.log("[OK] كل مصادر admissionSources.js موجودة، وسنوات أسماء الملفات (حيث تُستخرَج) تطابق المُعلَنة");
}

validate("data/universities.json", path.join(ROOT, "data/universities.json"), UniversitiesFileSchema);

// حارس انحدار (data/admission_rules.md §17): isDirectAdmission مستقل تماماً
// عن averageGrades (محسوب من طول مصفوفة cutoffs الفعلية في
// scripts/build-universities-data.js، لا من فراغ الرقم) -- لكن الواجهة
// (app/components/UniversitiesTable.tsx سابقاً) كانت تشتقّ "قبول مباشر" من
// فراغ الرقم مباشرة، فأي فجوة استخراج مستقبلية (قسم تنافسي حقيقي فقد رقمه)
// كانت ستُعرَض بصمت كقبول مباشر بدل بيانات مفقودة. هذا الفحص يمنع الانحدار
// عند مصدر البيانات نفسه: قسم غير مباشر (تنافسي) يجب أن يحمل رقماً حقيقياً
// لكل جلسة مذكورة في sessions -- لا فراغاً.
{
  const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
  const missingCompetitiveGrades = [];
  for (const uni of universities) {
    for (const college of uni.colleges) {
      for (const dept of college.departments) {
        if (dept.isDirectAdmission) continue;
        for (const session of dept.sessions) {
          if (dept.averageGrades[session] == null) {
            missingCompetitiveGrades.push(`${uni.name} / ${college.name} / ${dept.name} / ${session}`);
          }
        }
      }
    }
  }
  if (missingCompetitiveGrades.length) {
    console.error(
      "[FAIL] أقسام تنافسية (isDirectAdmission=false) بجلسة مذكورة بلا رقم حقيقي -- ستُعرَض خطأً كـ'قبول مباشر':",
      missingCompetitiveGrades
    );
    hasErrors = true;
  } else {
    console.log("[OK] كل الأقسام التنافسية تحمل رقماً حقيقياً لكل جلسة مذكورة");
  }
}

// تغطية الفرع (data/admission_rules.md §29): قسم بمصفوفة branch فارغة يختفي
// بنيوياً من by-branch/{علمي,أدبي,فنون}.json (المستكشف/فاحص المعدل) ما لم
// يُوسَم صراحة "unknown" ليُلتقَط عبر by-branch/unknown.json بدلاً منها --
// وإلا فهو قسم مفقود صامتاً لا مجهول الفرع مُعلَناً.
{
  const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
  const badBranchSource = [];
  for (const uni of universities) {
    for (const college of uni.colleges) {
      for (const dept of college.departments) {
        if (!dept.branchSource) {
          badBranchSource.push(`${uni.name}/${college.name}/${dept.name}: بلا branchSource`);
          continue;
        }
        const hasBranch = (dept.branch || []).length > 0;
        if (!hasBranch && dept.branchSource !== "unknown") {
          badBranchSource.push(`${uni.name}/${college.name}/${dept.name}: بلا فرع وبلا وسم unknown (branchSource=${dept.branchSource})`);
        }
      }
    }
  }
  if (badBranchSource.length) {
    console.error("[FAIL] تغطية فرع غير صالحة:", badBranchSource);
    hasErrors = true;
  } else {
    console.log("[OK] كل قسم يحمل branchSource صريحاً، ولا قسم بلا فرع بلا وسم unknown");
  }
}

// statedMinimumGrade (data/admission_rules.md §28): شرط معدّل مُعلَن مسبقاً
// في دليل الجامعات الأهلية -- حصراً للأقسام الأهلية (لا حكومية، تلك أرقام
// نتائج بأثر رجعي في averageGrades لا شروطاً معلَنة)، وبقيمة منطقية (٤٠-١٠٠،
// نطاق شرط معلَن لا نتيجة قبول)، وبأثر مصدر كامل (raw/source/sourceYear) --
// وإلا فالحقل ادّعاء بلا دليل، يخالف مبدأ المنصة الحاكم "لا رقم بلا مصدر".
{
  const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
  const badStatedMinimum = [];
  for (const uni of universities) {
    for (const college of uni.colleges) {
      for (const dept of college.departments) {
        const s = dept.statedMinimumGrade;
        if (!s) continue;

        if (uni.type === "حكومية") {
          badStatedMinimum.push(`${uni.name}/${college.name}/${dept.name}: statedMinimumGrade على قسم حكومي`);
          continue;
        }
        if (typeof s.value !== "number" || s.value < 40 || s.value > 100) {
          badStatedMinimum.push(`${uni.name}/${college.name}/${dept.name}: قيمة غير منطقية (${s.value})`);
        }
        if (!s.raw || !s.source || !s.sourceYear) {
          badStatedMinimum.push(`${uni.name}/${college.name}/${dept.name}: بلا أثر مصدر كامل`);
        }
      }
    }
  }
  if (badStatedMinimum.length) {
    console.error("[FAIL] statedMinimumGrade غير صالح:", badStatedMinimum);
    hasErrors = true;
  } else {
    console.log("[OK] statedMinimumGrade صالح لكل الأقسام التي تحمله (أهلية فقط، قيمة منطقية، أثر مصدر كامل)");
  }
}

validate("data/majors.json", path.join(ROOT, "data/majors.json"), z.array(MajorSchema));
validate("data/questions.json", path.join(ROOT, "data/questions.json"), z.array(QuestionSchema));
validate(
  "data/validity_questions.json",
  path.join(ROOT, "data/validity_questions.json"),
  z.array(ValidityQuestionSchema)
);
validate(
  "data/contradiction_pairs.json",
  path.join(ROOT, "data/contradiction_pairs.json"),
  z.array(ContradictionPairSchema)
);
validate("data/tiebreaker_questions.json", path.join(ROOT, "data/tiebreaker_questions.json"), z.array(QuestionSchema));
validate(
  "data/assistant_knowledge.json",
  path.join(ROOT, "data/assistant_knowledge.json"),
  z.array(AssistantEntrySchema)
);

// المساعد الذكي (lib/assistant.ts + data/assistant_knowledge.json): معرّف
// مكرَّر يعني أن أحد المُدخَلين صامت تماماً (لن يظهر أبداً في نتائج البحث
// عن معرّفه، مثال: SUGGESTED_QUESTION_IDS)، وكلمة مفتاحية فارغة بعد التطبيع
// (سطر فراغ فقط) تُحتسَب بلا فائدة صامتة أيضاً في lib/assistant.ts.
const assistantKnowledge = JSON.parse(fs.readFileSync(path.join(ROOT, "data/assistant_knowledge.json"), "utf8"));
const assistantIds = assistantKnowledge.map((e) => e.id);
const dupAssistantIds = assistantIds.filter((id, i) => assistantIds.indexOf(id) !== i);
if (dupAssistantIds.length) {
  console.error("[FAIL] data/assistant_knowledge.json has duplicate ids:", [...new Set(dupAssistantIds)]);
  hasErrors = true;
} else {
  console.log(`[OK] data/assistant_knowledge.json has ${assistantKnowledge.length} unique entries`);
}
const blankKeywordEntries = assistantKnowledge.filter((e) => e.keywords.some((k) => !k.trim()));
if (blankKeywordEntries.length) {
  console.error(
    "[FAIL] data/assistant_knowledge.json has entries with a blank keyword:",
    blankKeywordEntries.map((e) => e.id)
  );
  hasErrors = true;
}

const majors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/majors.json"), "utf8"));
const majorIds = new Set(majors.map((m) => m.id));

// حارس تقادم صامت (data/admission_rules.md §26): إجابات ودجت المساعد نصوص
// ثابتة مكتوبة يدوياً -- عُرضة للتقادم تماماً كأي رقم مُصلَّب آخر في المشروع.
// اكتُشف فعلياً أثناء مسح آخر: مدخل majors_count كان يذكر "81 تخصصاً" بينما
// data/majors.json يحمل 88 اليوم (تطوّر العدد 46→81→88 عبر جولات سابقة، بلا
// تحديث نصّ المساعد معه في آخر جولة). لا يمنع كل تقادم ممكن، لكنه يمسك أكثر
// حالتين قابلتين للقياس آلياً بدقة: عدد التخصصات وعدد الجامعات.
{
  const majorsCountEntry = assistantKnowledge.find((e) => e.id === "majors_count");
  if (majorsCountEntry) {
    const mentioned = Number((majorsCountEntry.answer.match(/^(\d+)/) || [])[1]);
    if (mentioned !== majors.length) {
      console.error(
        `[FAIL] assistant_knowledge.majors_count: يذكر ${mentioned} تخصصاً لكن data/majors.json يحمل ${majors.length} فعلياً`
      );
      hasErrors = true;
    } else {
      console.log(`[OK] assistant_knowledge.majors_count يطابق عدد التخصصات الحقيقي (${majors.length})`);
    }
  }

  const uniCountEntry = assistantKnowledge.find((e) => e.id === "universities_count");
  if (uniCountEntry) {
    const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
    const gov = universities.filter((u) => u.type === "حكومية").length;
    const priv = universities.filter((u) => u.type === "أهلية").length;
    const total = universities.length;
    const nums = [...uniCountEntry.answer.matchAll(/\d+/g)].map((m) => Number(m[0]));
    if (nums[0] !== gov || nums[1] !== priv || nums[2] !== total) {
      console.error(
        `[FAIL] assistant_knowledge.universities_count: يذكر ${nums.join("/")} لكن الأعداد الحقيقية ${gov}/${priv}/${total}`
      );
      hasErrors = true;
    } else {
      console.log(`[OK] assistant_knowledge.universities_count يطابق الأعداد الحقيقية (${gov}/${priv}/${total})`);
    }
  }
}

// Must have exactly 40 questions (36 single/dual-dimension items + 4 dual-
// dimension "إما/أو" comparison items added 2026-07-22 specifically to sharpen
// discrimination between near-duplicate RIASEC profile pairs -- the algorithm
// assumes a fixed, curated question bank -- a silent drop/duplication would
// skew every dimension).
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/questions.json"), "utf8"));
if (questions.length !== 40) {
  console.error(`[FAIL] data/questions.json: expected exactly 40 questions, found ${questions.length}`);
  hasErrors = true;
} else {
  console.log("[OK] data/questions.json has exactly 40 questions");
}
const questionIds = questions.map((q) => q.id);
const dupQuestionIds = questionIds.filter((id, i) => questionIds.indexOf(id) !== i);
if (dupQuestionIds.length) {
  console.error("[FAIL] data/questions.json has duplicate question ids:", [...new Set(dupQuestionIds)]);
  hasErrors = true;
}

// Must have exactly 3 validity-check items (attention check, reverse-scored
// twin, lie scale), each with fully empty `dimensions` (they must never
// silently leak into the RIASEC vector) and no id collision with questions.json.
const validityQuestions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/validity_questions.json"), "utf8"));
if (validityQuestions.length !== 3) {
  console.error(`[FAIL] data/validity_questions.json: expected exactly 3 items, found ${validityQuestions.length}`);
  hasErrors = true;
} else {
  console.log("[OK] data/validity_questions.json has exactly 3 items");
}
const validityIds = new Set(validityQuestions.map((q) => q.id));
const idCollisions = [...validityIds].filter((id) => questionIds.includes(id));
if (idCollisions.length) {
  console.error("[FAIL] data/validity_questions.json ids collide with data/questions.json:", idCollisions);
  hasErrors = true;
}

// أسئلة الترجيح الإضافية (data/tiebreaker_questions.json) -- تُعرض فقط حين
// تتقارب نتيجة أول تخصصين بعد الأسئلة الأربعين الأساسية، لحسم الدقة عبر
// أبعاد إضافية محدَّدة بدل ترك التعادل يُحسم بمعامل السوق وحده. يجب ألا
// تتقاطع معرّفاتها مع أسئلة الاختبار الأساسي أو أسئلة التحقق.
const tiebreakerQuestions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/tiebreaker_questions.json"), "utf8"));
if (tiebreakerQuestions.length !== 18) {
  console.error(
    `[FAIL] data/tiebreaker_questions.json: expected exactly 18 questions, found ${tiebreakerQuestions.length}`
  );
  hasErrors = true;
} else {
  console.log("[OK] data/tiebreaker_questions.json has exactly 18 questions");
}
const tiebreakerIds = tiebreakerQuestions.map((q) => q.id);
const tiebreakerCollisions = tiebreakerIds.filter((id) => questionIds.includes(id) || validityIds.has(id));
if (tiebreakerCollisions.length) {
  console.error(
    "[FAIL] data/tiebreaker_questions.json ids collide with questions.json/validity_questions.json:",
    tiebreakerCollisions
  );
  hasErrors = true;
}

// Every contradiction pair must reference two distinct, real question ids.
const contradictionPairs = JSON.parse(fs.readFileSync(path.join(ROOT, "data/contradiction_pairs.json"), "utf8"));
const allKnownIds = new Set([...questionIds, ...validityIds]);
const badPairs = contradictionPairs.filter((p) => p.a === p.b || !allKnownIds.has(p.a) || !allKnownIds.has(p.b));
if (badPairs.length) {
  console.error("[FAIL] data/contradiction_pairs.json has pairs referencing unknown/identical ids:", badPairs);
  hasErrors = true;
} else {
  console.log("[OK] data/contradiction_pairs.json pair references");
}

// Every major must have a RIASEC profile, and every profile must map to a real major.
const riasecFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_riasec_profiles.json"), "utf8"));
const profileResult = z.record(z.string(), RiasecProfileSchema).safeParse(riasecFile.profiles);
if (!profileResult.success) {
  console.error("[FAIL] data/major_riasec_profiles.json: schema validation failed");
  for (const issue of profileResult.error.issues.slice(0, 20)) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  hasErrors = true;
} else {
  console.log("[OK] data/major_riasec_profiles.json");
}
const profileIds = new Set(Object.keys(riasecFile.profiles || {}));
const majorsMissingProfile = majors.map((m) => m.id).filter((id) => !profileIds.has(id));
const profilesWithoutMajor = [...profileIds].filter((id) => !majorIds.has(id));
if (majorsMissingProfile.length) {
  console.error("[FAIL] majors missing a RIASEC profile:", majorsMissingProfile);
  hasErrors = true;
}
if (profilesWithoutMajor.length) {
  console.error("[FAIL] RIASEC profiles reference unknown major ids:", profilesWithoutMajor);
  hasErrors = true;
}
if (!majorsMissingProfile.length && !profilesWithoutMajor.length) {
  console.log("[OK] every major has exactly one RIASEC profile");
}

// محور القرابة الدراسية (data/subject_affinity_weights.json، §1.2 من تحليل
// الثغرات) -- نفس منطق تحقق بروفايلات RIASEC أعلاه بالضبط: كل تخصص يجب أن
// يملك وزناً واحداً بالضبط ولا وزن يتيماً بلا تخصص مطابق.
const subjectAffinityFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data/subject_affinity_weights.json"), "utf8"));
const subjectWeightIds = new Set(Object.keys(subjectAffinityFile.weights || {}));
const majorsMissingSubjectWeight = majors.map((m) => m.id).filter((id) => !subjectWeightIds.has(id));
const subjectWeightsWithoutMajor = [...subjectWeightIds].filter((id) => !majorIds.has(id));
if (majorsMissingSubjectWeight.length) {
  console.error("[FAIL] majors missing subject-affinity weights:", majorsMissingSubjectWeight);
  hasErrors = true;
}
if (subjectWeightsWithoutMajor.length) {
  console.error("[FAIL] subject-affinity weights reference unknown major ids:", subjectWeightsWithoutMajor);
  hasErrors = true;
}
if (!majorsMissingSubjectWeight.length && !subjectWeightsWithoutMajor.length) {
  console.log("[OK] every major has exactly one subject-affinity weight entry");
}

// التقرير المفصَّل لكل تخصص (data/major_profiles_detailed.json، §4.2 من تحليل
// الثغرات) -- نسخة أولية جزئية عمداً (14 من 88 تخصصاً، بحث حقيقي موثَّق
// المصادر لا يُستنسَخ بسرعة لبقية التخصصات) -- فلا نطلب اكتمال 88/88 هنا
// كما في RIASEC/القرابة الدراسية. المخطّط (TASKS.md المهمة ٦):
// study/career/market/personality_translation/eligibility/nearest_competitors.
// القاعدة القاطعة: أي حقل واقعي في market بقيمة غير فارغة (لا "غير متوفر"
// ولا null) يجب أن يملك source وlastVerified معاً -- وإلا فشل البناء. هذا
// يمنع مستقبلاً إضافة رقم سوق بلا توثيق مثل ما حدث في المهمة ١.
const DetailedMarketSchema = z
  .object({
    demandLevel: z.string().nullable(),
    saturationNote: z.string().nullable(),
    source: z.string().nullable(),
    lastVerified: z.string().nullable(),
  })
  .strict()
  .refine(
    (m) => {
      // "غير متوفر" *بادئة* (لا تطابقاً حرفياً كاملاً) -- حقول كثيرة تبدأ
      // بـ"غير متوفر" ثم تشرح السبب بصدق (مثال: "غير متوفر — لم يُعثر على
      // مصدر عراقي رسمي")، وهذا شرح غياب لا ادّعاء واقعياً يحتاج توثيقاً.
      const isUnavailable = (v) => !v || v.trim().startsWith("غير متوفر");
      const hasRealClaim = !isUnavailable(m.demandLevel) || !isUnavailable(m.saturationNote);
      if (!hasRealClaim) return true; // لا ادّعاء واقعياً هنا أصلاً، لا حاجة لمصدر
      return Boolean(m.source) && Boolean(m.lastVerified);
    },
    { message: "حقل سوق بقيمة واقعية بلا source أو lastVerified" }
  );
// الراتب الحكومي الأساسي عند التعيين الأول (career.governmentBaseSalary) --
// يخضع لنفس قاعدة "بلا توثيق = ممنوع" أعلاه بالضبط: قيمة amount غير فارغة
// بلا source وlastVerified تعني رقماً مختلَقاً، والقانون العراقي يربط هذا
// الرقم بالشهادة لا بالتخصص فهو موحّد عبر كل الملفات (انظر §9 من PROJECT.md).
const GovernmentBaseSalarySchema = z
  .object({
    amount: z.number().nullable(),
    currency: z.literal("IQD"),
    basis: z.string().nullable(),
    scope: z.string().nullable(),
    source: z.string().nullable(),
    lastVerified: z.string().nullable(),
  })
  .strict()
  .refine((s) => s.amount === null || (Boolean(s.source) && Boolean(s.lastVerified)), {
    message: "governmentBaseSalary.amount بلا source أو lastVerified",
  });

// المخصصات القانونية (data/salary-allowances.json) -- نفس قاعدة "بلا توثيق =
// ممنوع" أعلاه بالضبط، مطبَّقة على ملف مشترك واحد (لا يتكرّر لكل تخصص، انظر
// data/admission_rules.md §20): أي كائن يحمل رقماً فعلياً (amountIQD/
// rangePercent/minPercent/percentOfSalary) يجب أن يحمل source وlastVerified
// غير فارغين معاً.
const SourcedFieldsSchema = z.object({ source: z.string().min(1), lastVerified: z.string().min(1) }).catchall(z.any());
const SalaryAllowancesSchema = z.object({
  lastVerified: z.string(),
  legalBasis: z.object({ primary: z.string(), amendment: z.string() }).strict(),
  universal: z.object({
    dependency: SourcedFieldsSchema.extend({ amountIQD: z.number() }),
    perChild: SourcedFieldsSchema.extend({ amountIQD: z.number() }),
  }),
  hazardAllowance: SourcedFieldsSchema.extend({ rangePercent: z.tuple([z.number(), z.number()]) }),
  practiceProhibitionAllowance: SourcedFieldsSchema.extend({ minPercent: z.number() }),
  totalCap: SourcedFieldsSchema.extend({ percentOfSalary: z.number() }),
});

// حقل ثلاثي الحالات (data/admission_rules.md §21): true/false/"جزئياً" -- ليس
// boolean بحت. اكتُشف عملياً حين حمل تخصص "accounting" القيمة "جزئياً" في
// كلا الحقلين، فعُرِض خطأً كـ"يتطلّب ترخيصاً" (فحص truthy في الواجهة كان
// يعامل أي سلسلة غير فارغة كـ"نعم"). أي قيمة رابعة غير هذه الثلاث تُرفَض هنا
// بدل السماح لها بالمرور صامتة إلى الواجهة (التي بدورها تسقطها إلى "unknown"
// عبر lib/triState.ts -- لكن يجب رصدها هنا أيضاً لأنها تعني بياناً مشبوهاً).
const TRI_STATE = z.union([z.boolean(), z.literal("جزئياً")]);
const LicensingRequirementSchema = z
  .object({
    required: TRI_STATE,
    body: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .refine((l) => (l.required === true || l.required === "جزئياً" ? Boolean(l.body?.trim()) : true), {
    message: "licensingRequirement.required=true/جزئياً بلا body (جهة الترخيص)",
  })
  .refine((l) => l.required !== "جزئياً" || Boolean(l.note?.trim()), {
    message: "licensingRequirement.required=جزئياً بلا note يوضّح المسار المشمول",
  });

const DetailedProfileSchema = z.object({
  id: z.string(),
  study: z.record(z.string(), z.any()),
  career: z
    .object({
      governmentBaseSalary: GovernmentBaseSalarySchema.optional(),
      licensingRequirement: LicensingRequirementSchema.optional(),
      postgradNeededForPractice: TRI_STATE.optional(),
    })
    .catchall(z.any()),
  market: DetailedMarketSchema,
  personality_translation: z.record(z.string(), z.any()),
  eligibility: z.record(z.string(), z.any()),
  nearest_competitors: z.array(z.record(z.string(), z.any())),
});

const detailedProfilesPath = path.join(ROOT, "data/major_profiles_detailed.json");
if (fs.existsSync(detailedProfilesPath)) {
  const detailedProfiles = JSON.parse(fs.readFileSync(detailedProfilesPath, "utf8"));
  let detailedHasErrors = false;
  for (const entry of detailedProfiles) {
    const result = DetailedProfileSchema.safeParse(entry);
    if (!result.success) {
      console.error(
        `[FAIL] data/major_profiles_detailed.json (${entry.id}):`,
        result.error.issues.map((i) => i.message).join("; ")
      );
      detailedHasErrors = true;
    } else if (!majorIds.has(entry.id)) {
      console.error(`[FAIL] data/major_profiles_detailed.json: unknown major id ${entry.id}`);
      detailedHasErrors = true;
    }
  }
  if (detailedHasErrors) {
    hasErrors = true;
  } else {
    console.log(
      `[OK] data/major_profiles_detailed.json matches strict schema (${detailedProfiles.length}/${majors.length} majors covered so far)`
    );
  }
}

validate("data/salary-allowances.json", path.join(ROOT, "data/salary-allowances.json"), SalaryAllowancesSchema);

// حارس بنيوي لـchapter3_additions.json (data/admission_rules.md §22): المصدر
// الوحيد غير المتحقَّق منه بنيوياً في المشروع -- كل عطل مؤكَّد هذه الجلسة
// (UOITC، البصرة للنفط والغاز، تكريت/القادسية، الفلوجة/جابر بن حيان،
// العراقية، سامراء، واسط، ديالى، تلعفر) خرج منه. مرحلة تحذير فقط الآن
// (مراجعة الـ89 سجلاً المتبقية لم تكتمل بعد -- 0/89 يحمل sourceLine/
// verifiedAt، فتفعيله [FAIL] فوراً يكسر البناء اليوم بلا فائدة). يُحوَّل إلى
// [FAIL] فور اكتمال المراجعة اليدوية لكل السجلات المتبقية.
{
  const chapter3Path = path.join(ROOT, "data/raw/chapter3_additions.json");
  if (fs.existsSync(chapter3Path)) {
    const chapter3Records = JSON.parse(fs.readFileSync(chapter3Path, "utf8"));
    const unverified = chapter3Records.filter((r) => !r.sourceLine || !r.verifiedAt);
    if (unverified.length) {
      console.warn(
        `[WARN] data/raw/chapter3_additions.json: ${unverified.length}/${chapter3Records.length} سجلاً بلا sourceLine أو verifiedAt -- راجع reports/chapter3-presence.csv (لا يُفشل البناء بعد، انظر §22)`
      );
    } else {
      console.log("[OK] كل سجلات chapter3_additions.json تحمل sourceLine وverifiedAt");
    }
  }
}

// ترجمة الأبعاد الشخصية لنشاط يومي واقعي حسب فئة التخصص (§4 من تحليل
// الثغرات) -- كل فئة تخصص فعلية يجب أن تملك ترجمة، وإلا يظهر جدول الفجوة
// بحقل فارغ صامت لتخصصات تلك الفئة كاملة.
const personalityTranslations = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/personality_translations.json"), "utf8")
);
const translatedCategories = new Set(Object.keys(personalityTranslations.translations || {}));
const majorCategories = new Set(majors.map((m) => m.category));
const categoriesMissingTranslation = [...majorCategories].filter((c) => !translatedCategories.has(c));
if (categoriesMissingTranslation.length) {
  console.error("[FAIL] data/personality_translations.json missing categories:", categoriesMissingTranslation);
  hasErrors = true;
} else {
  console.log("[OK] every major category has a personality-translation entry");
}

const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_department_mapping.json"), "utf8"));
const unknownInMapping = mapping.mappings.filter((m) => !majorIds.has(m.majorId)).map((m) => m.majorId);
if (unknownInMapping.length) {
  console.error("[FAIL] data/major_department_mapping.json references unknown major ids:", unknownInMapping);
  hasErrors = true;
} else {
  console.log("[OK] data/major_department_mapping.json major-id references");
}

if (hasErrors) {
  console.error("\nData validation FAILED.");
  process.exit(1);
} else {
  console.log("\nAll data files valid.");
}
