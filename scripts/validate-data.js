// Validates data/universities.json and data/majors.json against the same
// shape lib/validation.ts (Zod v4) expects, so a corrupted or malformed
// data file fails fast (in CI or locally) instead of silently breaking
// `next build` the way data/universities.json did before this was added.
const { z } = require("zod");
const fs = require("fs");
const path = require("path");
const SOURCES = require("./admissionSources");
const { fixLamAlef, normalizeForDedupMatch } = require("./displayName");

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
  // الحد الصباحي لكل فرع مقبول (أدنى حد غير حصة لذلك الفرع) -- حكومي فقط. averageGrades.صباحي
  // هو الأدنى بين كل الفروع فلا يُعرض لطالب فرع بعينه (lib/branchCutoff.ts).
  morningByBranch: z.record(z.string(), z.number().nullable()).optional(),
  // المسائي الحكومي: حد التقديم لكل فرع يقبله القسم + مصدره وسقف الأجور (data/evening-rules.json)
  eveningByBranch: z.record(z.string(), z.number().nullable()).optional(),
  evening: z
    .object({
      year: z.string(),
      status: z.string(),
      ruleId: z.string(),
      basis: z.string(),
      note: z.string().nullable(),
      feeCap: z.number().nullable(),
      feeYear: z.string().nullable(),
      feeRuleId: z.string().nullable(),
      genderFloors: z.object({ ذكر: z.number(), أنثى: z.number() }).optional(),
    })
    .optional(),
  // الجنس لقسم محدَّد فقط (م2): قسم لجنس واحد، أو فرع يختلف فيه حدّ الذكور عن الإناث
  genderRestriction: z.enum(["ذكر", "أنثى"]).optional(),
  // مصدر الفروع المقبولة (حكومي): cutoffs | chapter3 | guide | unknown (لا استدلال)
  branchBasis: z.enum(["cutoffs", "chapter3", "guide", "unknown", "none"]).optional(),
  // مستوى الحد الصباحي: college = حد الكلية كلها أُلحق بالقسم، department = صف باسم القسم نفسه
  // mixed = بعض فروعه حد كلية (collegeScopeBranches) وبعضها صف باسم القسم
  cutoffScope: z.enum(["college", "track", "department", "mixed"]).optional(),
  collegeScopeBranches: z.array(z.string()).optional(),
  trackScopeBranches: z.array(z.string()).optional(),
  trackName: z.string().optional(),
  // كلية بتقديم مباشر (data/direct-apply-colleges.json): لا حد مركزي، أو حد أدنى معلَن بمصدره
  directApply: z
    .object({
      kind: z.enum(["direct", "minimum"]),
      minimumAverage: z.number().optional(),
      note: z.string(),
      source: z.string(),
    })
    .optional(),
  genderByBranch: z.record(z.string(), z.object({ ذكر: z.number(), أنثى: z.number() })).optional(),
  isDirectAdmission: z.boolean(),
  admissionStatus: z.enum(["published", "noPublishedCutoff"]).optional(),
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
      // الحرم ومحافظته (data/campus-qualifiers.json): فلتر المحافظة يستعملهما
      campus: z.string().optional(),
      campusProvince: z.string().optional(),
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
  // stronglyYes/stronglyNo اختياريان (مرحلة مقياس الخمس نقاط) -- عند غيابهما
  // تُشتَق نصوصهما آلياً من yes/no في app/quiz/page.tsx (getAnswerLabels)،
  // فلا حاجة لإعادة كتابة الأسئلة الأربعين الحالية.
  answerLabels: z
    .object({
      yes: z.string(),
      maybe: z.string(),
      no: z.string(),
      stronglyYes: z.string().optional(),
      stronglyNo: z.string().optional(),
    })
    .strict()
    .optional(),
  // البنك متعدد الأشكال (lib/itemFormats.ts): صفّ موقف grid أو خيار pick مع
  // معرّف شاشته ونص الموقف/السؤال المشترك.
  format: z.enum(["single", "grid", "pick"]).optional(),
  screenId: z.string().optional(),
  lead: z.string().optional(),
});

const RiasecProfileSchema = z
  .object(Object.fromEntries(RIASEC_DIMENSIONS.map((d) => [d, z.number().min(0).max(10).optional()])))
  .strict();

// بصمة السياق (data/major_context_index.json، المرحلة 3 من خطة إصلاح
// خوارزمية الترتيب -- lib/contextAxisMap.ts) -- محاور 0-100 مشتقّة حسابياً
// من study.studyNature/subject_affinity_weights، زائداً yearsOfStudy وصفياً.
const CONTEXT_AXES = ["appliedness", "quantitative", "humanContact", "fieldwork"];
const ContextIndexEntrySchema = z
  .object({
    ...Object.fromEntries(CONTEXT_AXES.map((axis) => [axis, z.number().min(0).max(100)])),
    yearsOfStudy: z.number().min(1).max(10),
    studyLengthDisplayScore: z.number().min(0).max(100),
  })
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
  if (sourcesOk)
    console.log("[OK] كل مصادر admissionSources.js موجودة، وسنوات أسماء الملفات (حيث تُستخرَج) تطابق المُعلَنة");
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
        if (dept.admissionStatus === "noPublishedCutoff") continue;
        for (const session of dept.sessions) {
          if (session === "صباحي" && dept.cutoffs.length === 0) continue;
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

// حراس خطة حقيقة القبول (خطة تصحيح القبول §8 وdata/admission_rules.md):
// 1. لا قبول مباشر في أي قسم حكومي (isDirectAdmission = false دائماً للحكومي)
// 2. تفريغ data/direct-admission-exceptions.json إلى مصفوفة فارغة تماماً
// 3. تماسك admissionStatus للحكومي: إما published (له رقم) أو noPublishedCutoff (بلا رقم)
// 4. اكتمال استيراد مصادر الحدود الخام (cutoffs و evening_study)
// 5. حالات انحدار مسمّاة (المكامن النفطية = 90، كيمياء التربية الصرفة مسائي، كلية التميز بلا حد منشور)
{
  const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
  const exceptionsPath = path.join(ROOT, "data/direct-admission-exceptions.json");
  const exceptions = fs.existsSync(exceptionsPath) ? JSON.parse(fs.readFileSync(exceptionsPath, "utf8")) : [];

  if (!Array.isArray(exceptions) || exceptions.length !== 0) {
    console.error("[FAIL] data/direct-admission-exceptions.json يجب أن يكون مصفوفة فارغة تماماً []:", exceptions);
    hasErrors = true;
  } else {
    console.log("[OK] ملف direct-admission-exceptions.json مفرّغ تماماً []");
  }

  const govDirectDepts = [];
  const statusIncoherent = [];
  let govDeptsCount = 0;

  for (const uni of universities) {
    if (uni.type !== "حكومية") continue;
    for (const college of uni.colleges) {
      for (const dept of college.departments) {
        govDeptsCount++;
        if (dept.isDirectAdmission === true) {
          govDirectDepts.push(`${uni.name} / ${college.name} / ${dept.name}`);
        }
        if (dept.admissionStatus === "published") {
          const hasGrade =
            dept.averageGrades && (dept.averageGrades["صباحي"] != null || dept.averageGrades["مسائي"] != null);
          if (!hasGrade) {
            statusIncoherent.push(`${uni.name} / ${college.name} / ${dept.name}: موسوم published بلا أي رقم`);
          }
        } else if (dept.admissionStatus === "noPublishedCutoff") {
          const hasGrade =
            dept.averageGrades && (dept.averageGrades["صباحي"] != null || dept.averageGrades["مسائي"] != null);
          if (hasGrade) {
            statusIncoherent.push(
              `${uni.name} / ${college.name} / ${dept.name}: موسوم noPublishedCutoff لكن يحمل رقماً`
            );
          }
        } else {
          statusIncoherent.push(
            `${uni.name} / ${college.name} / ${dept.name}: حالة admissionStatus غير صالحة (${dept.admissionStatus})`
          );
        }
      }
    }
  }

  if (govDirectDepts.length) {
    console.error(`[FAIL] وُجدت أقسام حكومية تحمل isDirectAdmission=true (${govDirectDepts.length}):`, govDirectDepts);
    hasErrors = true;
  } else {
    console.log(
      `[OK] صفر قبول مباشر في الجامعات الحكومية (${govDeptsCount} قسماً حكومياً كلها isDirectAdmission=false)`
    );
  }

  if (statusIncoherent.length) {
    console.error("[FAIL] تضارب في admissionStatus للأقسام الحكومية:", statusIncoherent);
    hasErrors = true;
  } else {
    console.log("[OK] تماسك تام لحقل admissionStatus عبر كل الأقسام الحكومية");
  }

  // اكتمال الاستيراد: التحقق من أن كل صفوف cutoffs_2025_2026.json تنتمي لجامعات حكومية معتمدة
  const cutoffsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/cutoffs_2025_2026.json"), "utf8"));
  const eveningRaw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/evening_study_2025_2026.json"), "utf8"));
  const govUniNames = new Set(universities.filter((u) => u.type === "حكومية").map((u) => u.name));
  const normKeySimple = (s) => (s || "").replace(/[أإآ]/g, "ا").replace(/ا/g, "").replace(/\s+/g, "").trim();
  const govUniNorms = new Set([...govUniNames].map(normKeySimple));

  const orphanCutoffs = cutoffsRaw.filter((r) => !govUniNorms.has(normKeySimple(r.university)));
  const orphanEvening = eveningRaw.filter((r) => !govUniNorms.has(normKeySimple(r.university)));

  if (orphanCutoffs.length || orphanEvening.length) {
    console.error("[FAIL] أيتام في مصادر الحدود الخام:", {
      orphanCutoffs: orphanCutoffs.length,
      orphanEvening: orphanEvening.length,
    });
    hasErrors = true;
  } else {
    console.log(
      `[OK] اكتمال استيراد مصادر الحدود الخام: ${cutoffsRaw.length} صباحي و${eveningRaw.length} مسائي مربوطة بالجامعات`
    );
  }

  // اختبارات انحدار مسمّاة (Named Regression Assertions)
  // 1. المكامن النفطية / جامعة الموصل / كلية هندسة النفط والتعدين = 90 وصفر تكرار
  const mosulUni = universities.find((u) => u.name === "جامعة الموصل");
  const mosulMining = mosulUni?.colleges?.find((c) => c.name === "كلية هندسة النفط والتعدين");
  const reservoirsDept = mosulMining?.departments?.find((d) => d.name === "قسم المكامن النفطية");
  const dupeReservoirs = mosulMining?.departments?.find((d) => d.name === "قسم هندسة المكامن النفطية");

  if (!reservoirsDept || reservoirsDept.averageGrades?.["صباحي"] !== 90 || dupeReservoirs) {
    console.error("[FAIL] انحدار في حالة المكامن النفطية / جامعة الموصل:", {
      found: !!reservoirsDept,
      grade: reservoirsDept?.averageGrades?.["صباحي"],
      dupeExists: !!dupeReservoirs,
    });
    hasErrors = true;
  } else {
    console.log("[OK] فحص انحدار المكامن النفطية / الموصل: المعدل 90 وصفر تكرار");
  }

  // 2. الكيمياء / جامعة بغداد / كلية التربية للعلوم الصرفة = مسائي وليس مباشراً
  const baghdadUni = universities.find((u) => u.name === "جامعة بغداد");
  const pureScience = baghdadUni?.colleges?.find((c) => c.name.includes("التربية للعلوم الصرفة"));
  const chemistryDept = pureScience?.departments?.find((d) => d.name.includes("الكيمياء"));
  if (!chemistryDept || chemistryDept.isDirectAdmission || chemistryDept.averageGrades?.["مسائي"] == null) {
    console.error("[FAIL] انحدار في كيمياء التربية للعلوم الصرفة / جامعة بغداد:", {
      found: !!chemistryDept,
      isDirectAdmission: chemistryDept?.isDirectAdmission,
      eveningGrade: chemistryDept?.averageGrades?.["مسائي"],
    });
    hasErrors = true;
  } else {
    console.log("[OK] فحص انحدار كيمياء التربية للعلوم الصرفة / بغداد: رقم مسائي وليس مباشراً");
  }

  // 3. كلية التميز / جامعة بغداد = noPublishedCutoff
  const tamayuzCollege = baghdadUni?.colleges?.find((c) => c.name === "كلية التميز");
  const invalidTamayuz = tamayuzCollege?.departments?.filter(
    (d) => d.admissionStatus !== "noPublishedCutoff" || d.isDirectAdmission || d.averageGrades?.["صباحي"] != null
  );
  if (!tamayuzCollege || (invalidTamayuz && invalidTamayuz.length > 0)) {
    console.error("[FAIL] انحدار في كلية التميز / جامعة بغداد:", invalidTamayuz);
    hasErrors = true;
  } else {
    console.log(`[OK] فحص انحدار كلية التميز / بغداد: كل أقسامها (${tamayuzCollege.departments.length}) بلا حدّ منشور`);
  }
}

// أجور الجامعات الأهلية (data/admission_rules.md §41): ثلاثة حراس مستقلون
// اكتُشفت أعطالها بتحقّق يدوي مباشر من النص الخام، لا افتراضاً. كلها تعمل
// على مجموعات مُطبَّعة بـnormalizeForDedupMatch (لا مقارنة نصّية ساذجة --
// كانت السبب الجذري للعطل الأول).
{
  const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
  const hasFee = (f) => f && (f["صباحي"] != null || f["مسائي"] != null);
  const isFullyNull = (f) => f && f["صباحي"] == null && f["مسائي"] == null;

  // (أ) [FAIL] تكرار حقيقي/فارغ بنفس الجامعة (عبر كليات مختلفة أحياناً) --
  // توقيع عطل دمج extraManualMajors قبل إصلاحه (§41) -- حارس ارتداد، يجب أن
  // يكون صفراً دائماً بعد الإصلاح.
  const realNullDupes = [];
  for (const uni of universities) {
    if (uni.type !== "أهلية") continue;
    const byName = new Map();
    for (const college of uni.colleges) {
      for (const dept of college.departments) {
        if (!dept.tuitionFees) continue;
        const key = normalizeForDedupMatch(dept.displayName ?? dept.name);
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push({ college: college.name, dept: dept.displayName ?? dept.name, fee: dept.tuitionFees });
      }
    }
    for (const entries of byName.values()) {
      if (entries.length < 2) continue;
      if (entries.some((e) => hasFee(e.fee)) && entries.some((e) => isFullyNull(e.fee))) {
        realNullDupes.push(`${uni.name}: ${JSON.stringify(entries)}`);
      }
    }
  }
  if (realNullDupes.length) {
    console.error("[FAIL] tuitionFees: تكرار قسم بأجر حقيقي + نسخة بأجر فارغ بالكامل (نفس الجامعة):", realNullDupes);
    hasErrors = true;
  } else {
    console.log("[OK] tuitionFees: صفر تكرار حقيقي/فارغ عبر كل الجامعات الأهلية");
  }

  // ── المسائي الحكومي: بيانات القواعد كاملة وبلا قيم مختلَقة (PLAN-ADMISSION-ACCURACY.md م1) ──
  {
    const rulesPath = path.join(ROOT, "data/evening-rules.json");
    const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
    const allowed = new Set();
    for (const y of Object.values(rules.years)) {
      for (const r of y.floors) {
        for (const v of [...Object.values(r.floors || {}), r.floor, r.floorMale, r.floorFemale]) {
          if (typeof v === "number") allowed.add(v);
        }
      }
    }
    const badEvening = [];
    let withEvening = 0;
    const { universities: eveningUniversities } = JSON.parse(
      fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")
    );
    for (const uni of eveningUniversities) {
      if (uni.type !== "حكومية") continue;
      for (const college of uni.colleges) {
        for (const dept of college.departments) {
          const where = `${uni.name}/${college.name}/${dept.name}`;
          if (!dept.sessions.includes("مسائي")) {
            if (dept.eveningByBranch || dept.evening) badEvening.push(`${where}: حقول مسائي بلا جلسة مسائية`);
            continue;
          }
          withEvening++;
          if (!dept.eveningByBranch || !dept.evening) {
            badEvening.push(`${where}: جلسة مسائية بلا eveningByBranch/evening`);
            continue;
          }
          if (!(dept.evening.feeCap > 0)) badEvening.push(`${where}: بلا سقف أجور`);
          const vals = [];
          for (const [b, v] of Object.entries(dept.eveningByBranch)) {
            if (v == null) continue;
            vals.push(v);
            if (!allowed.has(v)) badEvening.push(`${where}: قيمة ${v} خارج جدول القواعد`);
            if (dept.branch.length && !dept.branch.includes(b))
              badEvening.push(`${where}: حد مسائي لفرع غير مقبول (${b})`);
          }
          const min = vals.length ? Math.min(...vals) : null;
          if (min !== dept.averageGrades["مسائي"])
            badEvening.push(`${where}: averageGrades.مسائي≠أدنى eveningByBranch`);
        }
      }
    }
    if (badEvening.length) {
      console.error(`[FAIL] بيانات المسائي: ${badEvening.length} مخالفة`, badEvening.slice(0, 10));
      process.exitCode = 1;
    } else {
      console.log(
        `[OK] بيانات المسائي الحكومي (${withEvening} قسماً): حد لكل فرع + مصدر + سقف أجور، وكل قيمة ضمن data/evening-rules.json`
      );
    }
  }

  // ── الجنس لقسم محدَّد فقط: كل قيد مدعوم بحدود رسمية، ولا قيد على قسم مختلط (م2) ──
  {
    const { universities: genderUniversities } = JSON.parse(
      fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8")
    );
    const badGender = [];
    let restricted = 0;
    let differing = 0;
    for (const uni of genderUniversities) {
      for (const college of uni.colleges) {
        for (const dept of college.departments) {
          const where = `${uni.name}/${college.name}/${dept.name}`;
          const rows = (dept.cutoffs || []).filter((c) => !c.isQuota);
          const genders = new Set(rows.map((c) => c.gender));
          const onlyOne = genders.size === 1 && !genders.has("مختلط") ? [...genders][0] : null;
          if (dept.genderRestriction) {
            restricted++;
            if (dept.genderRestriction !== onlyOne) badGender.push(`${where}: قيد جنس لا تدعمه الحدود الرسمية`);
          } else if (onlyOne) {
            badGender.push(`${where}: قسم لجنس واحد (${onlyOne}) بلا genderRestriction`);
          }
          for (const [b, g] of Object.entries(dept.genderByBranch || {})) {
            differing++;
            const m = rows.filter((c) => c.branch === b && c.gender === "ذكر").map((c) => c.averagePercent);
            const f = rows.filter((c) => c.branch === b && c.gender === "أنثى").map((c) => c.averagePercent);
            if (!m.includes(g.ذكر) || !f.includes(g.أنثى) || g.ذكر === g.أنثى)
              badGender.push(`${where}: genderByBranch[${b}] لا يطابق الحدود الرسمية`);
          }
        }
      }
    }
    if (badGender.length) {
      console.error(`[FAIL] الجنس: ${badGender.length} مخالفة`, badGender.slice(0, 10));
      process.exitCode = 1;
    } else {
      console.log(
        `[OK] الجنس لقسم محدَّد فقط: ${restricted} قسماً لجنس واحد، ${differing} فرعاً بحدّين مختلفين، وكلها مطابقة للحدود الرسمية`
      );
    }
  }

  // (ب) [WARN] تناقض بين حقل note ("لا توجد دراسة مسائية") وأجر مسائي حقيقي
  // فعلياً -- حالة واحدة مؤكَّدة (zahraa_women)، لا تُصلَح تخميناً (لا نعرف
  // أي حقل هو الخاطئ فعلياً بلا رجوع للمصدر) -- تبقى تحذيراً حتى تصحيح يدوي.
  const NO_EVENING_NOTE_RE = /لا\s*توجد\s*دراسة\s*مسائية|التوجد\s*دراسة\s*مسائية/;
  const polarityMismatches = [];
  for (const uni of universities) {
    if (uni.type !== "أهلية") continue;
    for (const college of uni.colleges) {
      for (const dept of college.departments) {
        if (!dept.tuitionFees || !dept.note) continue;
        if (NO_EVENING_NOTE_RE.test(dept.note) && dept.tuitionFees["مسائي"] != null) {
          polarityMismatches.push(
            `${uni.name}/${college.name}/${dept.displayName ?? dept.name}: note="${dept.note}" لكن مسائي=${dept.tuitionFees["مسائي"]}`
          );
        }
      }
    }
  }
  if (polarityMismatches.length) {
    console.warn(
      "[WARN] tuitionFees: تناقض بين note وأجر مسائي حقيقي -- يحتاج مراجعة يدوية للمصدر:",
      polarityMismatches
    );
  } else {
    console.log("[OK] tuitionFees: لا تناقض بين note وأجر مسائي");
  }

  // (ج) [WARN] تكرار حقيقي×حقيقي بنفس الكلية بالضبط -- توقيع تكرار استخراج
  // من الدليل نفسه (لا عطل دمج extraManualMajors)، اكتُشف في "ishtar" فقط
  // (بحث يدوي في النص الخام كشف جذراً أعمق: تعذّر إسناد جدولين متجاورين
  // لمؤسستين حقيقيتين منفصلتين باسم "عشتار" -- يحتاج تحقيقاً تصالحياً منفصلاً
  // بالكامل، خارج نطاق هذه الميزة). [WARN] لا [FAIL] عمداً -- حاجب كامل غير
  // متناسب لحالة معزولة موثَّقة، والصفحة الاستهلاكية تستبعدها صراحة (§41).
  const sameCollegeDupes = [];
  for (const uni of universities) {
    if (uni.type !== "أهلية") continue;
    for (const college of uni.colleges) {
      const byName = new Map();
      for (const dept of college.departments) {
        if (!dept.tuitionFees) continue;
        const key = normalizeForDedupMatch(dept.displayName ?? dept.name);
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(dept.tuitionFees);
      }
      for (const [key, fees] of byName) {
        if (fees.length >= 2 && fees.filter(hasFee).length >= 2) {
          sameCollegeDupes.push(`${uni.name}/${college.name}/${key}: ${JSON.stringify(fees)}`);
        }
      }
    }
  }
  if (sameCollegeDupes.length) {
    console.warn(
      "[WARN] tuitionFees: تكرار حقيقي×حقيقي بنفس الكلية (استخراج مصدر غامض، يحتاج مراجعة يدوية):",
      sameCollegeDupes
    );
  } else {
    console.log("[OK] tuitionFees: لا تكرار حقيقي×حقيقي بنفس الكلية");
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
          badBranchSource.push(
            `${uni.name}/${college.name}/${dept.name}: بلا فرع وبلا وسم unknown (branchSource=${dept.branchSource})`
          );
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

// مهن مقنَّنة لا تُقبل بقبول مباشر في الجامعات الحكومية العراقية (الطب/طب
// الأسنان/الصيدلة تنافسية حصراً بلا استثناء موثَّق -- data/admission_rules.md
// §30). المطابقة على *اسم القسم* (بعد fixLamAlef) لا اسم الكلية -- مطابقة
// اسم الكلية بالاحتواء ("طب"/"صيدل") تجرف معها برامج دبلوم تقنية مساندة
// ("تقنيات الصيدلة"، "المعلوماتية الطبية الحيوية") ليست نفس المهنة المقنَّنة
// إطلاقاً (اكتُشف فعلياً أثناء بناء هذا الفحص -- راجع §30).
{
  const { universities } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities.json"), "utf8"));
  const REGULATED_DEPARTMENTS = new Set(["الطب", "طب الاسنان", "الصيدلة"]);
  const exceptions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/direct-admission-exceptions.json"), "utf8"));
  const exceptionKey = (u, c, d) => `${u}|${c}|${d}`;
  const allowedExceptions = new Set(
    exceptions
      .filter((e) => e.sourceLine && e.verifiedAt) // بلا دليل = غير مسموح كاستثناء
      .map((e) => exceptionKey(e.university, e.college, e.department))
  );

  const violations = [];
  for (const uni of universities) {
    if (uni.type !== "حكومية") continue;
    for (const college of uni.colleges) {
      for (const dept of college.departments) {
        if (!REGULATED_DEPARTMENTS.has(fixLamAlef((dept.name || "").trim()))) continue;
        if (!dept.isDirectAdmission) continue;
        if (allowedExceptions.has(exceptionKey(uni.name, college.name, dept.name))) continue;
        violations.push(`${uni.name} / ${college.name} / ${dept.name}`);
      }
    }
  }
  if (violations.length) {
    console.error("[FAIL] قبول مباشر في مهنة مقنَّنة بجامعة حكومية بلا استثناء موثَّق:", violations);
    hasErrors = true;
  } else {
    console.log("[OK] لا قبول مباشر في مهنة مقنَّنة (طب/طب الأسنان/صيدلة) بجامعة حكومية بلا استثناء موثَّق");
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

// البنك الأساسي (2026-09-22): 22 شاشة محتوى (+3 تحقق = 25 شاشة يراها الطالب)
// بثلاثة أشكال: عبارة مفردة (منها أسئلة المقارنة الطرفية)، وموقف grid بعبارتين
// أو ثلاث، وأقرب-أبعد pick بين 4 أنشطة. مختارة بمحاكاة خط المنتج الكامل
// (scripts/eval/select-formats.mts، QA-REPORT-ALGORITHM.md).
// قرار المالك: 90% من الشاشات سطر أو سطران، و10% فقط ثلاثة أسطر -- شاشة بثلاثة
// أسطر تُتعب القارئ، وغالباً يكون السطر الثالث مستنتَجاً من الآخرين.
// كل بُعد يحتاج 3 عبارات موافقة أساسية على الأقل (lib/validity.ts يتجاهل أي بُعد
// بأقل من 3 بنود في فحص الاتساق)، وخيارات pick لا تُحتسب منها.
const CORE_SCREEN_COUNT = 22;
const PICK_SCREENS_MAX = 5;
const THREE_ROW_SCREENS_MAX = 2;
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/questions.json"), "utf8"));
const coreScreens = [];
{
  const byKey = new Map();
  questions.forEach((q) => {
    const format = q.format || "single";
    if (format !== "single" && !q.screenId) {
      console.error(`[FAIL] data/questions.json: ${q.id} (${format}) بلا screenId`);
      hasErrors = true;
    }
    const key = format === "single" ? `single:${q.id}` : q.screenId;
    if (!byKey.has(key)) {
      const screen = { key, format, lead: q.lead, items: [] };
      byKey.set(key, screen);
      coreScreens.push(screen);
    }
    const screen = byKey.get(key);
    if (screen.format !== format || screen.lead !== q.lead) {
      console.error(`[FAIL] data/questions.json: شاشة ${key} بأشكال أو نص موقف غير متّسق (${q.id})`);
      hasErrors = true;
    }
    if (screen.items.length && screen.items[screen.items.length - 1] !== questions[questions.indexOf(q) - 1]) {
      console.error(`[FAIL] data/questions.json: عناصر الشاشة ${key} غير متجاورة (${q.id})`);
      hasErrors = true;
    }
    screen.items.push(q);
  });
}
if (coreScreens.length !== CORE_SCREEN_COUNT) {
  console.error(
    `[FAIL] data/questions.json: expected exactly ${CORE_SCREEN_COUNT} screens, found ${coreScreens.length}`
  );
  hasErrors = true;
} else {
  console.log(`[OK] data/questions.json has exactly ${CORE_SCREEN_COUNT} screens (${questions.length} statements)`);
}
const primaryDim = (q) =>
  Object.entries(q.dimensions || {}).reduce(
    (best, [d, w]) => (Math.abs(w) > Math.abs(best[1]) ? [d, w] : best),
    ["", 0]
  )[0];
const pickScreens = coreScreens.filter((s) => s.format === "pick");
pickScreens.forEach((s) => {
  const dims = s.items.map(primaryDim);
  if (s.items.length !== 4 || new Set(dims).size !== 4 || !s.lead) {
    console.error(
      `[FAIL] data/questions.json: شاشة pick ${s.key} يجب أن تضم 4 خيارات من 4 أبعاد مختلفة مع نص سؤال`,
      dims
    );
    hasErrors = true;
  }
});
const gridScreens = coreScreens.filter((s) => s.format === "grid");
gridScreens.forEach((s) => {
  if (s.items.length < 2 || s.items.length > 3 || !s.lead) {
    console.error(`[FAIL] data/questions.json: شاشة grid ${s.key} يجب أن تضم 2-3 عبارات مع نص موقف`);
    hasErrors = true;
  }
});
const threeRow = gridScreens.filter((s) => s.items.length === 3).length;
if (threeRow > THREE_ROW_SCREENS_MAX) {
  console.error(
    `[FAIL] data/questions.json: ${threeRow} شاشات بثلاثة أسطر، والحد ${THREE_ROW_SCREENS_MAX} (10% من الشاشات)`
  );
  hasErrors = true;
} else {
  console.log(`[OK] ${threeRow} شاشة بثلاثة أسطر من ${coreScreens.length} (الحد ${THREE_ROW_SCREENS_MAX})`);
}
// وزن خيار pick = PICK_WEIGHT_SCALE (0.5، lib/itemFormats.ts) × وزن العبارة
// الأساسي 7 = 3.5. الوزن الكامل يسحب متجه الطالب نحو 50 ويضخّم التخصصات
// متوسّطة البروفايل (تشخيص المعايرة، QA-REPORT-ALGORITHM.md)، فيُفرض هنا كي
// لا يعود بصمت عند إعادة كتابة البنك.
const PICK_OPTION_WEIGHT = 3.5;
const badPickWeights = [];
pickScreens.forEach((s) =>
  s.items.forEach((q) => {
    const ws = Object.values(q.dimensions || {}).filter((w) => w !== 0);
    if (ws.length !== 1 || Math.abs(Math.abs(ws[0]) - PICK_OPTION_WEIGHT) > 1e-9)
      badPickWeights.push(`${q.id}:${JSON.stringify(q.dimensions)}`);
  })
);
if (badPickWeights.length) {
  console.error(
    `[FAIL] data/questions.json: خيار pick يجب أن يحمل بُعداً واحداً بوزن ±${PICK_OPTION_WEIGHT}:`,
    badPickWeights
  );
  hasErrors = true;
} else if (pickScreens.length) {
  console.log(`[OK] كل خيارات pick بوزن ±${PICK_OPTION_WEIGHT} (PICK_WEIGHT_SCALE مطبَّق)`);
}
const pickDimCounts = {};
pickScreens.forEach((s) =>
  s.items.forEach((q) => (pickDimCounts[primaryDim(q)] = (pickDimCounts[primaryDim(q)] || 0) + 1))
);
if (
  pickScreens.length > PICK_SCREENS_MAX ||
  (pickScreens.length > 0 && RIASEC_DIMENSIONS.some((d) => (pickDimCounts[d] || 0) < 2))
) {
  console.error(
    `[FAIL] data/questions.json: pick ≤${PICK_SCREENS_MAX} شاشات وكل بُعد في شاشتين منها على الأقل`,
    pickScreens.length,
    pickDimCounts
  );
  hasErrors = true;
} else if (pickScreens.length) {
  console.log(`[OK] ${pickScreens.length} pick screens, every dimension in ≥2`, JSON.stringify(pickDimCounts));
}
const primaryCounts = {};
questions
  .filter((q) => (q.format || "single") !== "pick")
  .forEach((q) => (primaryCounts[primaryDim(q)] = (primaryCounts[primaryDim(q)] || 0) + 1));
const thinDims = RIASEC_DIMENSIONS.filter((d) => (primaryCounts[d] || 0) < 3);
if (thinDims.length) {
  console.error(
    "[FAIL] data/questions.json: dimensions with fewer than 3 primary agree-scale items:",
    thinDims,
    primaryCounts
  );
  hasErrors = true;
} else {
  console.log(
    "[OK] every RIASEC dimension has at least 3 primary agree-scale core items",
    JSON.stringify(primaryCounts)
  );
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
const orphanTwins = validityQuestions.filter(
  (v) => v.validity?.pairsWith && !questionIds.includes(v.validity.pairsWith)
);
if (orphanTwins.length) {
  console.error(
    "[FAIL] validity reverse-twin partner missing from the core bank:",
    orphanTwins.map((v) => v.validity.pairsWith)
  );
  hasErrors = true;
}
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

// بنك الاحتياط (data/reserve_questions.json) -- بلا حد للعدد، يُسحب منه حتى
// 5 بنود في جولة واحدة (lib/adaptiveRound.ts). نفس مخطّط الأسئلة، وبلا تصادم
// معرّفات مع الأساسية/التحقق/بنك /decider (tiebreaker_questions.json).
const reserveQuestions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/reserve_questions.json"), "utf8"));
const reserveResult = z.array(QuestionSchema).safeParse(reserveQuestions);
if (!reserveResult.success) {
  console.error("[FAIL] data/reserve_questions.json: schema validation failed");
  for (const issue of reserveResult.error.issues.slice(0, 20))
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  hasErrors = true;
} else {
  console.log(`[OK] data/reserve_questions.json (${reserveQuestions.length} بنداً)`);
}
const reserveIds = reserveQuestions.map((q) => q.id);
const reserveCollisions = reserveIds.filter(
  (id, i) =>
    questionIds.includes(id) || validityIds.has(id) || tiebreakerIds.includes(id) || reserveIds.indexOf(id) !== i
);
if (reserveCollisions.length) {
  console.error("[FAIL] data/reserve_questions.json ids collide with other banks or repeat:", reserveCollisions);
  hasErrors = true;
}

// Every contradiction pair must reference two distinct, real question ids.
const contradictionPairs = JSON.parse(fs.readFileSync(path.join(ROOT, "data/contradiction_pairs.json"), "utf8"));
const allKnownIds = new Set([...questionIds, ...reserveIds, ...validityIds]);
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

// بصمة السياق (data/major_context_index.json، المرحلة 3) -- نفس منطق تحقق
// RIASEC/القرابة الدراسية أعلاه بالضبط: تغطية 88/88 كاملة (مصدراها
// study.studyNature وsubject_affinity_weights متوفران لكل الـ88 تخصصاً)،
// فلا عذر لتخصص ناقص هنا كما في major_profiles_detailed الجزئي عمداً.
const contextIndexFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_context_index.json"), "utf8"));
const contextResult = z.record(z.string(), ContextIndexEntrySchema).safeParse(contextIndexFile.contexts);
if (!contextResult.success) {
  console.error("[FAIL] data/major_context_index.json: schema validation failed");
  for (const issue of contextResult.error.issues.slice(0, 20)) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  hasErrors = true;
} else {
  console.log("[OK] data/major_context_index.json");
}
const contextIds = new Set(Object.keys(contextIndexFile.contexts || {}));
const majorsMissingContext = majors.map((m) => m.id).filter((id) => !contextIds.has(id));
const contextWithoutMajor = [...contextIds].filter((id) => !majorIds.has(id));
if (majorsMissingContext.length) {
  console.error("[FAIL] majors missing a context-fingerprint entry:", majorsMissingContext);
  hasErrors = true;
}
if (contextWithoutMajor.length) {
  console.error("[FAIL] context-fingerprint entries reference unknown major ids:", contextWithoutMajor);
  hasErrors = true;
}
if (!majorsMissingContext.length && !contextWithoutMajor.length) {
  console.log("[OK] every major has exactly one context-fingerprint entry");
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

// مهارات تسبق التخرّج (data/major_skills.json، data/admission_rules.md §40):
// محتوى استشاري لا واقعي (نفس اتفاقية study.coreSubjects/career.realJobTitles
// بلا source -- القرار موثَّق في §40)، لكن يبقى عرضة لخطرين آليَّين حقيقيين لا
// يحتاجان قراءة بشرية لاكتشافهما: (أ) رقم/نسبة مختلَقة تسرّبت رغم تعليمات
// التوليد الصريحة، (ب) قالب واحد مُكرَّر بلا تمايز حقيقي بين التخصصات (نقيض
// الشرط الصريح من المستخدم: "مرنة ومتغيرة حسب التخصص وليست نص ثابت للجميع").
const SkillEntrySchema = z.object({
  name: z.string().min(2),
  why: z.string().min(15),
  how: z.string().min(15),
});
const MajorSkillsSchema = z.object({
  id: z.string(),
  soft: z.array(SkillEntrySchema).length(3),
  practical: z.array(SkillEntrySchema).length(3),
  digital: z.array(SkillEntrySchema).length(3),
});

const skillsPath = path.join(ROOT, "data/major_skills.json");
if (fs.existsSync(skillsPath)) {
  const majorSkills = JSON.parse(fs.readFileSync(skillsPath, "utf8"));
  let skillsHasErrors = false;

  for (const entry of majorSkills) {
    const result = MajorSkillsSchema.safeParse(entry);
    if (!result.success) {
      console.error(
        `[FAIL] data/major_skills.json (${entry.id}):`,
        result.error.issues.map((i) => i.message).join("; ")
      );
      skillsHasErrors = true;
    } else if (!majorIds.has(entry.id)) {
      console.error(`[FAIL] data/major_skills.json: unknown major id ${entry.id}`);
      skillsHasErrors = true;
    }
  }
  const skillsCoveredIds = new Set(majorSkills.map((e) => e.id));
  const missingSkillsIds = [...majorIds].filter((id) => !skillsCoveredIds.has(id));
  if (missingSkillsIds.length) {
    console.error(`[FAIL] data/major_skills.json missing ${missingSkillsIds.length} majors:`, missingSkillsIds);
    skillsHasErrors = true;
  }

  // حاجز افتعال صارم: لا استخدام مشروع لأي رمز نسبة داخل محتوى مهارات --
  // كل نسبة سوق عمل حقيقية موجودة بمكانها الصحيح المُستشهَد به في market/
  // governmentBaseSalary فقط، لا هنا.
  const percentOffenders = [];
  for (const entry of majorSkills) {
    for (const cat of ["soft", "practical", "digital"]) {
      for (const skill of entry[cat] || []) {
        for (const field of ["name", "why", "how"]) {
          const v = skill[field] || "";
          if (v.includes("%") || v.includes("٪")) percentOffenders.push(`${entry.id}.${cat}.${field}: "${v}"`);
        }
      }
    }
  }
  if (percentOffenders.length) {
    console.error("[FAIL] data/major_skills.json يحوي رمز نسبة داخل محتوى استشاري (افتعال محتمل):", percentOffenders);
    skillsHasErrors = true;
  }

  // كاشف قوالب/تكرار: تطبيع اسم كل مهارة (بلا تشكيل/همزات موحَّدة) وعدّ
  // تكراره عبر الـ88 لكل فئة على حدة -- تكرار مرتفع يعني نصّاً ثابتاً مُعاد
  // استخدامه بدل محتوى مصمَّم لكل تخصص فعلياً.
  const normalizeSkill = (s) =>
    s
      .replace(/[ً-ْـ]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  const totalMajors = majorSkills.length;
  for (const cat of ["soft", "practical", "digital"]) {
    const nameCounts = new Map();
    const whyHowCounts = new Map();
    for (const entry of majorSkills) {
      for (const skill of entry[cat] || []) {
        const nameKey = normalizeSkill(skill.name || "");
        const whyHowKey = normalizeSkill((skill.why || "") + (skill.how || ""));
        if (!nameCounts.has(nameKey)) nameCounts.set(nameKey, new Set());
        nameCounts.get(nameKey).add(entry.id);
        if (!whyHowCounts.has(whyHowKey)) whyHowCounts.set(whyHowKey, new Set());
        whyHowCounts.get(whyHowKey).add(entry.id);
      }
    }
    for (const [label, counts] of [
      ["اسم المهارة", nameCounts],
      ["نص why+how", whyHowCounts],
    ]) {
      for (const [key, ids] of counts) {
        const ratio = ids.size / totalMajors;
        if (ratio >= 0.3) {
          console.error(
            `[FAIL] data/major_skills.json (${cat}): ${label} مكرَّر حرفياً في ${ids.size}/${totalMajors} تخصصاً (≥30%، قالب لا تمايز) -- "${key.slice(0, 60)}"`
          );
          skillsHasErrors = true;
        } else if (ratio >= 0.15) {
          console.warn(
            `[WARN] data/major_skills.json (${cat}): ${label} مكرَّر في ${ids.size}/${totalMajors} تخصصاً (≥15%) -- راجع يدوياً: "${key.slice(0, 60)}"`
          );
        }
      }
    }
  }

  if (skillsHasErrors) {
    hasErrors = true;
  } else {
    console.log(
      `[OK] data/major_skills.json matches strict schema (${majorSkills.length}/${majors.length} majors, 3+3+3 لكل تخصص، صفر افتعال نسب، صفر تكرار قوالب ≥30%)`
    );
  }
}

// بنك أفكار مشاريع التخرّج (data/major_projects.json، data/admission_rules.md
// §42): نفس اتفاقية المحتوى الاستشاري بلا source التي نجحت في المهارات (§40)،
// لكن حقل problem هنا يصف "حاجة حقيقية في السوق المحلي" (نص خدمة "projects"
// نفسه في data/services.ts) -- أعلى خطر افتعال محتمل في المنصة كلها، فيحمل
// حاجزاً إضافياً (عبارات تفوّق مطلقة) لا يملكه حارس المهارات.
const ProjectIdeaSchema = z.object({
  title: z.string().min(10),
  problem: z.string().min(40),
  description: z.string().min(60),
});
const MajorProjectsSchema = z.object({
  id: z.string(),
  technical: z.array(ProjectIdeaSchema).length(17),
  ai: z.array(ProjectIdeaSchema).length(16),
  research: z.array(ProjectIdeaSchema).length(17),
});

const projectsPath = path.join(ROOT, "data/major_projects.json");
if (fs.existsSync(projectsPath)) {
  const majorProjects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));
  let projectsHasErrors = false;

  for (const entry of majorProjects) {
    const result = MajorProjectsSchema.safeParse(entry);
    if (!result.success) {
      console.error(
        `[FAIL] data/major_projects.json (${entry.id}):`,
        result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      );
      projectsHasErrors = true;
    } else if (!majorIds.has(entry.id)) {
      console.error(`[FAIL] data/major_projects.json: unknown major id ${entry.id}`);
      projectsHasErrors = true;
    }
  }
  const projectsCoveredIds = new Set(majorProjects.map((e) => e.id));
  const missingProjectsIds = [...majorIds].filter((id) => !projectsCoveredIds.has(id));
  if (missingProjectsIds.length) {
    console.error(`[FAIL] data/major_projects.json missing ${missingProjectsIds.length} majors:`, missingProjectsIds);
    projectsHasErrors = true;
  }

  const PROJECT_ANGLE_KEYS = ["technical", "ai", "research"];

  // حاجز افتعال صارم -- مطابق تماماً لحارس المهارات، على الحقول الثلاثة كلها.
  const percentOffenders = [];
  for (const entry of majorProjects) {
    for (const angle of PROJECT_ANGLE_KEYS) {
      for (const idea of entry[angle] || []) {
        for (const field of ["title", "problem", "description"]) {
          const v = idea[field] || "";
          if (v.includes("%") || v.includes("٪")) percentOffenders.push(`${entry.id}.${angle}.${field}: "${v}"`);
        }
      }
    }
  }
  if (percentOffenders.length) {
    console.error("[FAIL] data/major_projects.json يحوي رمز نسبة داخل محتوى استشاري (افتعال محتمل):", percentOffenders);
    projectsHasErrors = true;
  }

  // حاجز إضافي خاص بهذه الميزة: عبارات تفوّق مطلقة غير قابلة للتحقق -- خطر
  // افتعال مختلف عن الأرقام، لا يغطيه حاجز % (data/admission_rules.md §42).
  const SUPERLATIVE_PHRASES = ["الأول من نوعه", "لا مثيل له", "لا يوجد حل مشابه", "الوحيد في العراق", "أول نظام"];
  const superlativeOffenders = [];
  for (const entry of majorProjects) {
    for (const angle of PROJECT_ANGLE_KEYS) {
      for (const idea of entry[angle] || []) {
        for (const field of ["title", "problem", "description"]) {
          const v = idea[field] || "";
          for (const phrase of SUPERLATIVE_PHRASES) {
            if (v.includes(phrase)) superlativeOffenders.push(`${entry.id}.${angle}.${field}: "${phrase}"`);
          }
        }
      }
    }
  }
  if (superlativeOffenders.length) {
    console.error("[FAIL] data/major_projects.json يحوي ادّعاء تفوّق مطلقاً غير قابل للتحقق:", superlativeOffenders);
    projectsHasErrors = true;
  }

  // كاشف قوالب/تكرار -- مطابق تماماً لحارس المهارات، لكل زاوية من الأربع.
  const normalizeIdea = (s) =>
    s
      .replace(/[ً-ْـ]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  const totalProjectMajors = majorProjects.length;
  for (const angle of PROJECT_ANGLE_KEYS) {
    const titleCounts = new Map();
    const bodyCounts = new Map();
    for (const entry of majorProjects) {
      for (const idea of entry[angle] || []) {
        const titleKey = normalizeIdea(idea.title || "");
        const bodyKey = normalizeIdea((idea.problem || "") + (idea.description || ""));
        if (!titleCounts.has(titleKey)) titleCounts.set(titleKey, new Set());
        titleCounts.get(titleKey).add(entry.id);
        if (!bodyCounts.has(bodyKey)) bodyCounts.set(bodyKey, new Set());
        bodyCounts.get(bodyKey).add(entry.id);
      }
    }
    for (const [label, counts] of [
      ["عنوان الفكرة", titleCounts],
      ["نص problem+description", bodyCounts],
    ]) {
      for (const [key, ids] of counts) {
        const ratio = ids.size / totalProjectMajors;
        if (ratio >= 0.3) {
          console.error(
            `[FAIL] data/major_projects.json (${angle}): ${label} مكرَّر حرفياً في ${ids.size}/${totalProjectMajors} تخصصاً (≥30%، قالب لا تمايز) -- "${key.slice(0, 60)}"`
          );
          projectsHasErrors = true;
        } else if (ratio >= 0.15) {
          console.warn(
            `[WARN] data/major_projects.json (${angle}): ${label} مكرَّر في ${ids.size}/${totalProjectMajors} تخصصاً (≥15%) -- راجع يدوياً: "${key.slice(0, 60)}"`
          );
        }
      }
    }
  }

  if (projectsHasErrors) {
    hasErrors = true;
  } else {
    console.log(
      `[OK] data/major_projects.json matches strict schema (${majorProjects.length}/${majors.length} majors, 17+16+17 لكل تخصص، صفر افتعال نسب/تفوّق، صفر تكرار قوالب ≥30%)`
    );
  }
}

// عائلات التخصصات (data/major_families.json): المجال الدراسي الذي تُعرض به
// التوصية. ثلاثة شروط تجعل "ثلاث توصيات من عائلات مختلفة" قابلاً للتحقيق:
// تغطية كاملة بلا تكرار، وتماسك الفرع داخل العائلة (وإلا صارت فارغة لطالب من
// فرع آخر)، وثلاث عائلات متاحة على الأقل لكل فرع.
{
  const familiesFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_families.json"), "utf8"));
  const fams = familiesFile.families;
  const catOf = Object.fromEntries(majors.map((m) => [m.id, m.category]));
  const BRANCH_CATEGORIES = {
    علمي: ["تكنولوجيا", "هندسة", "طبي", "تقنيات طبية مساندة", "علوم", "زراعة", "إدارة وتسويق"],
    أدبي: ["إنسانيات", "لغات", "تربية", "إدارة وتسويق"],
    فنون: ["فنون وتصميم"],
  };
  const branchKeyOf = (id) =>
    Object.keys(BRANCH_CATEGORIES)
      .filter((b) => BRANCH_CATEGORIES[b].includes(catOf[id]))
      .sort()
      .join("|");
  const seen = new Map();
  const famProblems = [];
  fams.forEach((f) => {
    f.memberIds.forEach((id) => {
      if (!catOf[id]) famProblems.push(`${f.id}: معرّف غير موجود ${id}`);
      else if (seen.has(id)) famProblems.push(`${id} في عائلتين: ${seen.get(id)} و${f.id}`);
      else seen.set(id, f.id);
    });
    const keys = [...new Set(f.memberIds.filter((id) => catOf[id]).map(branchKeyOf))];
    if (keys.length > 1) famProblems.push(`${f.id}: أفرادها عبر فروع مختلفة (${keys.join(" / ")})`);
  });
  majors.forEach((m) => {
    if (!seen.has(m.id)) famProblems.push(`تخصص بلا عائلة: ${m.id}`);
  });
  const perBranch = Object.fromEntries(
    Object.keys(BRANCH_CATEGORIES).map((b) => [
      b,
      fams.filter((f) => f.memberIds.some((id) => BRANCH_CATEGORIES[b].includes(catOf[id]))).length,
    ])
  );
  Object.entries(perBranch).forEach(([b, n]) => {
    if (n < 3) famProblems.push(`فرع ${b}: ${n} عائلة فقط -- لا تكفي لثلاث توصيات من عائلات مختلفة`);
  });
  if (famProblems.length) {
    console.error("[FAIL] data/major_families.json:", famProblems);
    hasErrors = true;
  } else {
    console.log(
      `[OK] data/major_families.json: ${fams.length} عائلة تغطي ${seen.size} تخصصاً، متماسكة بالفرع`,
      JSON.stringify(perBranch)
    );
  }
}

// فهرس واقعية القبول (data/major_admission_index.json، يولّده
// scripts/build-major-admission-index.js): كل تخصص له مدخل، وتخصص بلا حدّ
// تنافسي موثَّق يُطبَع صراحةً (محايد في الترتيب لا "سهل").
{
  const admission = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_admission_index.json"), "utf8")).majors;
  const missing = majors.filter((m) => !admission[m.id]).map((m) => m.id);
  const none = Object.entries(admission)
    .filter(([, e]) => e.confidence === "none")
    .map(([id]) => id);
  if (missing.length) {
    console.error("[FAIL] data/major_admission_index.json: تخصصات بلا مدخل:", missing);
    hasErrors = true;
  } else {
    console.log(
      `[OK] data/major_admission_index.json: ${Object.keys(admission).length} تخصصاً` +
        (none.length ? `، بلا حدّ تنافسي موثَّق (محايدة): ${none.join("، ")}` : "")
    );
  }
}

// ملفات "مرشَّحة" لا تُشحن: أي بيانات مشتقّة تنتظر مصادقة ميدانية (مثل
// بروفايلات أقسام مُعاد اشتقاقها) تُسمّى <name>.candidate.json ويُمنع على كود
// المنتج استيرادها -- أقوى من راية تشغيل، لأن الملف يصير غير قابل للوصول من
// حزمة المنتج أصلاً ويصمد أمام دمج متسرّع. المسموح لها وحدها: أدوات القياس.
{
  const productDirs = ["app", "lib", "components"];
  const allowedPrefixes = [path.join("lib", "eval"), path.join("scripts", "eval"), "reports"];
  const offenders = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx|mts)$/.test(entry.name)) continue;
      const rel = path.relative(ROOT, full);
      if (allowedPrefixes.some((p) => rel.startsWith(p))) continue;
      if (/\.candidate\.json/.test(fs.readFileSync(full, "utf8"))) offenders.push(rel);
    }
  };
  productDirs.forEach((d) => walk(path.join(ROOT, d)));
  if (offenders.length) {
    console.error("[FAIL] كود المنتج يستورد ملفاً مرشَّحاً (.candidate.json) لم يُصادَق عليه بعد:", offenders);
    hasErrors = true;
  } else {
    console.log("[OK] لا ملف مرشَّح (.candidate.json) مستورَد في كود المنتج");
  }

  // البروفايلات المرشَّحة (المسار ج) -- إن وُجدت يجب أن تكون قابلة للقياس جنباً
  // إلى جنب مع الحالية: نفس التخصصات، ستة أبعاد صحيحة 0-10، وغير المحكَّم منسوخ حرفياً.
  const candPath = path.join(ROOT, "data", "major_riasec_profiles.candidate.json");
  if (fs.existsSync(candPath)) {
    const cand = JSON.parse(fs.readFileSync(candPath, "utf8"));
    const cur = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "major_riasec_profiles.json"), "utf8")).profiles;
    const rated = new Set(cand._meta?.candidate?.ratedMajors ?? []);
    const problems = [];
    const curIds = Object.keys(cur).sort().join();
    if (
      Object.keys(cand.profiles ?? {})
        .sort()
        .join() !== curIds
    )
      problems.push("مجموعة التخصصات تختلف عن الحالية");
    for (const [id, p] of Object.entries(cand.profiles ?? {})) {
      for (const d of ["R", "I", "A", "S", "E", "C"]) {
        if (!Number.isInteger(p[d]) || p[d] < 0 || p[d] > 10) problems.push(`${id}.${d}`);
      }
      if (!rated.has(id) && JSON.stringify(p) !== JSON.stringify(cur[id]))
        problems.push(`${id} غير محكَّم لكنه يختلف عن الحالي`);
    }
    if (problems.length) {
      console.error("[FAIL] data/major_riasec_profiles.candidate.json:", problems.slice(0, 10));
      hasErrors = true;
    } else {
      console.log(`[OK] البروفايلات المرشَّحة: ${rated.size} محكَّماً، والباقي منسوخ حرفياً`);
    }
  }
}

if (hasErrors) {
  console.error("\nData validation FAILED.");
  process.exit(1);
} else {
  console.log("\nAll data files valid.");
}
