/**
 * مصدر واحد لكل نصوص الإفصاح عن نطاق بيانات القبول. لا تكرّر هذه النصوص في
 * أي مكوّن -- استوردها من هنا.
 */
import universitiesMeta from "../data/universities_meta.json";
import homepageStats from "../data/homepage_stats.json";

/**
 * سنة/وثيقة الحدود الدنيا تحديداً -- لا academicYear العام (يمثّل دليل
 * الطالب، وثيقة مختلفة). يُقرأ من data/universities_meta.json (مُشتقّ هناك
 * من scripts/admissionSources.js، مصدر الحقيقة الوحيد المُتحقَّق منه بنيوياً
 * في scripts/validate-data.js). كل عرض لرقم averagePercent/averageGrades
 * يجب أن يستورد هذا الثابت -- لا يكتب السنة يدوياً (data/admission_rules.md §24).
 */
export const CUTOFFS_YEAR = (universitiesMeta as { cutoffsSourceYear: string }).cutoffsSourceYear;

/** اسم وثيقة الحدود الدنيا الكامل -- لعرضه لاحقاً في أي صفحة "عن البيانات"،
    ولجعل مصدر الرقم مقروءاً لأي مطوّر بلا رجوع لسجلّ القرارات. */
export const CUTOFFS_DOCUMENT = (universitiesMeta as { cutoffsSourceDocument: string }).cutoffsSourceDocument;

export const ADMISSION_CHANNEL = "القناة العامة";

/**
 * قواعد الدراسة المسائية الحكومية (data/evening-rules.json عبر universities_meta.json):
 * السنة المعروضة وحالتها. «reported» = معلَنة من الوزارة لتلك السنة ولم يُحصَل بعد على نص الكتاب الرسمي.
 */
export interface EveningRulesMeta {
  year: string;
  status: string;
  label: string;
  note: string;
  fallbackYear: string;
}
export const EVENING_RULES = (universitiesMeta as unknown as { eveningRules: EveningRulesMeta }).eveningRules;

/** سطر قصير بجوار عمود المسائي: السنة وحالة المصدر. */
export const EVENING_COLUMN_YEAR = EVENING_RULES.year;

/** تنبيه المسائي الكامل: الأرقام المعروضة هي حدود التقديم (لا معدلات تنافسية) لسنة معيّنة بحالة مصدرها. */
export const EVENING_RULES_NOTICE =
  `${EVENING_RULES.label}. ${EVENING_RULES.note} ` +
  `هذه حدود للتقديم وليست معدلات تنافسية للقسم. قائمة الأقسام ذات الدراسة المسائية من دليل الطالب ${EVENING_RULES.fallbackYear}.`;

/**
 * محافظات إقليم كردستان -- غير مغطّاة إطلاقاً في أي مصدر بيانات على المنصة
 * اليوم (تحقَّق مباشرةً عبر فحص كل من data/universities.json المدموج،
 * data/private_universities.json، وdata/raw/chapter3_additions.json تحديداً
 * -- صفر مطابقة في الثلاثة). الغياب مقصود (نظام قبول إقليمي منفصل)، لا نسياناً
 * -- انظر data/admission_rules.md §25. تُعرَض معطَّلة ومُعلَّمة في كل قائمة
 * محافظات بدل إخفائها كلياً، كي لا يقرأ طالب من الإقليم الغياب عطلاً.
 */
export const UNCOVERED_PROVINCES = ["أربيل", "دهوك", "السليمانية"] as const;

export const UNCOVERED_PROVINCES_REASON = "إقليم كردستان له نظام قبول منفصل عن القبول المركزي، ولم ندخل بياناته بعد.";

export const SPECIAL_CHANNELS = [
  "ذوي الشهداء",
  "أوائل المحافظات",
  "الرياضيين",
  "أبناء التدريسيين",
  "ذوي الاحتياجات الخاصة",
] as const;

/** شارة مختصرة بجوار الجداول والبطاقات */
export const CHANNEL_BADGE = `${ADMISSION_CHANNEL} · ${CUTOFFS_YEAR}`;

export const CHANNEL_NOTICE_TITLE = `الأرقام المعروضة تخصّ ${ADMISSION_CHANNEL} فقط`;

// ملاحظة صياغة مقصودة: "تكون عادةً أدنى" لا "أدنى دائماً" -- الثانية ادّعاء
// كمّي لا نملك دليلاً عليه لكل قناة خاصة وكل قسم على حدة.
export const CHANNEL_NOTICE_BODY =
  `هذه هي الحدود الدنيا لـ${ADMISSION_CHANNEL} وفق نتائج القبول المركزي ${CUTOFFS_YEAR}. ` +
  `إذا كنت تتقدّم ضمن قناة خاصة (${SPECIAL_CHANNELS.join("، ")}) ` +
  `فالحدود التي تنطبق عليك تختلف، وتكون عادةً أدنى من المعروض هنا.`;

/** نصّ عادي للتصدير والقوالب غير التفاعلية (قالب PDF في app/report/page.tsx
    مثلاً -- HTML/CSS مستقل لا يلتقط مكوّنات React، انظر data/admission_rules.md §23). */
export const CHANNEL_NOTICE_PLAIN = `${CHANNEL_NOTICE_TITLE}. ${CHANNEL_NOTICE_BODY} المرجع الرسمي الوحيد هو دائرة القبول المركزي.`;

/**
 * الأهلي بلا حدّ منشور -- "قبول مباشر" غير دقيق بنيوياً هنا (الدليل ينشر
 * شرط معدّل انتقائياً لبعض الأقسام فقط، فغياب الرقم لا يعني غياب الشرط،
 * بخلاف الحكومي حيث cutoffs.length===0 دليل موثوق على غياب المنافسة فعلاً).
 * راجع data/admission_rules.md §28.
 */
export const PRIVATE_NO_PUBLISHED_MIN = "الحدّ الأدنى غير متوفّر";

export const privateStatedMin = (v: number) => `يشترط معدل ${v}% فأكثر`;

export const PRIVATE_MIN_HINT =
  "شرط معلن مسبقاً في دليل الجامعات الأهلية — لا يمثّل نتيجة قبول سنة سابقة كحدود الجامعات الحكومية.";

export const PRIVATE_NO_MIN_HINT =
  "الدليل الرسمي لا يذكر حدّاً أدنى لهذا القسم تحديداً — هذا لا يعني بالضرورة عدم وجود شرط، بل أنه غير منشور في مصدرنا.";

/** ملاحظة مجموعة "بلا حدّ منشور" في /gpa-check -- data/admission_rules.md §32. */
export const PRIVATE_NO_PUBLISHED_MIN_GROUP_NOTE =
  "دليل الجامعات الأهلية لا ينشر حدّاً أدنى لهذه الأقسام. " + "ما نقدر نأكّد إذا معدّلك يوصلها — راجع الجامعة مباشرة.";

/**
 * أجر الدراسة (/cost، data/admission_rules.md §41): قسم أهلي حقيقي بلا رقم
 * أجر منشور في دليل الأجور الرسمي -- 92/1,356 قسماً أهلياً (٦.٨٪). لا يعني
 * "مجاني" ولا "غير معروف الوجود"، بل "غير منشور في مصدرنا تحديداً".
 */
export const TUITION_NOT_PUBLISHED = "الأجر غير منشور";

export const TUITION_NOT_PUBLISHED_HINT =
  "الدليل الرسمي لأجور الجامعات الأهلية لا ينشر أجراً لهذا القسم تحديداً — راجع الجامعة مباشرة.";

/**
 * القبول الحكومي مركزي/تنافسي بلا أجر دراسة مماثل للأهلي -- الغياب هنا
 * بنيوي مقصود (Department.tuitionFees تكون undefined دائماً للحكومية، انظر
 * buildPrivateDepartment في scripts/build-universities-data.js)، وليس نقصاً
 * في البيانات. لا خانة فارغة مربكة، بل تفسير صريح لماذا لا رقم للمقارنة هنا.
 */
export const GOVERNMENT_NO_COMPARABLE_FEE =
  "القبول الحكومي مركزي بلا رسوم دراسية مماثلة للأهلي — لا يوجد رقم للمقارنة هنا.";

/**
 * جامعات مستبعَدة من مقارنة الأجور تحديداً لعدم موثوقية بنيوية مكتشَفة في
 * استخراج بياناتها (لا نقص عادي، بل تكرار أقسام حقيقية بأرقام متضاربة يتعذّر
 * حسم أيها صحيح بلا رجوع للمصدر -- مثال: "ishtar"، راجع data/admission_rules.md §41).
 * قائمة يدوية صغيرة عمداً -- كل إضافة تحتاج تحقيقاً مباشراً موثَّقاً، لا تخميناً.
 */
export const TUITION_UNVERIFIED_UNIVERSITY_IDS: string[] = ["ishtar"];

export const TUITION_UNVERIFIED_SOURCE_NOTE =
  "بيانات أجور هذه الجامعة غير مستقرة في المصدر الرسمي (تكرار بأرقام متضاربة يحتاج تحققاً يدوياً) — استُبعدت من المقارنة مؤقتاً، راجع الجامعة مباشرة.";

/**
 * الفرع الدراسي (علمي/أدبي/فنون) لقسم -- الدليل الرسمي للجامعات الأهلية لا
 * يذكره إطلاقاً (تحقَّق مباشرةً، data/admission_rules.md §29). بدل إخفاء
 * القسم كلياً (يقول للطالب "لا يوجد" وهو غير صحيح)، يُعرَض في كل الفروع
 * موسوماً "الفرع غير محدَّد" (يقول "لا نعرف" -- الصادق وحده).
 */
export const BRANCH_UNKNOWN_BADGE = "الفرع غير محدَّد";

export const BRANCH_UNKNOWN_NOTE =
  "دليل الجامعات الأهلية لا يحدّد الفروع المقبولة لهذه الأقسام. " +
  "نعرضها لك في كل الفروع بدل إخفائها — راجع الجامعة للتأكّد من قبول فرعك.";

/**
 * حقيقة المسائي (data/admission_rules.md §31): المسائي في البيانات محصور
 * غالباً بنطاق أعلى من الصباحي (اليوم: 56-75% مقابل صباحي 50-101.4%) --
 * محسوب من data/homepage_stats.json (scripts/compute-homepage-stats.js)،
 * لا مصلَّباً هنا (رقم مصلَّب يتقادم صامتاً، نفس درس "81 تخصصاً" في §26).
 */
export const EVENING_MIN = (homepageStats as { eveningMin: number | null }).eveningMin;

export const eveningFloorNote = (min: number) =>
  `أدنى حدّ للدراسة المسائية في بياناتنا هو ${min}% — المسائي ليس دائماً أسهل من الصباحي.`;
