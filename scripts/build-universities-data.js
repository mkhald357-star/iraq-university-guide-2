// Builds the canonical data/universities.json from the extracted cutoffs
// + evening-study raw data (data/raw/*.json), restricted to universities
// that are verifiably real and sourced from the official 2025-2026 guide,
// plus the existing curated data/private_universities.json.
//
// Run after scripts/extract-pdf-text.js, scripts/parse-cutoffs.js and
// scripts/parse-evening-study.js (or all at once via `npm run rebuild-data`).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { toDisplayName, normalizeForDedupMatch } = require("./displayName");
const { parseStatedMinimum } = require("./departmentNameHealth");
const { normalizeDepartmentKey } = require("./departmentNormalizer");
const SOURCES = require("./admissionSources");
const { createGuideLookup } = require("./guideBranches");
const { resolveEvening } = require("./eveningRules");

const ROOT = path.join(__dirname, "..");
const cutoffs = require(path.join(ROOT, "data/raw/cutoffs_2025_2026.json"));
const evening = require(path.join(ROOT, "data/raw/evening_study_2025_2026.json"));
const chapter3Additions = require(path.join(ROOT, "data/raw/chapter3_additions.json"));
const privateUnis = require(path.join(ROOT, "data/private_universities.json"));
// خرائط أقسام/أجور دراسية حقيقية مستخرجة من الدليل الرسمي الكامل للجامعات
// والكليات الأهلية (2411202502.pdf) عبر scripts/parse-private-universities-guide.js
// + scripts/match-private-universities.js -- تغطي 55+ مؤسسة (من أصل 81) بكليات
// وأقسام وأجور دراسية حقيقية، بدل قائمة "majors" المسطّحة المحدودة سابقاً لـ6 فقط.
let privateDepartmentsGuide = {};
try {
  privateDepartmentsGuide = require(path.join(ROOT, "data/raw/private_universities_departments.json"));
} catch (e) {
  console.warn(
    "[تنبيه] data/raw/private_universities_departments.json غير موجود -- شغّل scripts/match-private-universities.js أولاً. سيُستخدم fallback بقائمة majors المسطّحة."
  );
}

// Verified by hand against the table of contents (dalel PDF, chapter 3
// heading list) -- the authoritative list of universities covered by the
// federal القبول المركزي system. Kurdistan-region universities (chapter 5
// of the guide) are deliberately NOT included: that chapter uses a
// separate regional admission system and its PDF text layer is too
// corrupted to extract reliably as of this pass -- see
// data/admission_rules.md for the known-gaps note.
const UNIVERSITIES = [
  { name: "جامعة بغداد", founded: 1958, website: "www.uobaghdad.edu.iq", province: "بغداد" },
  { name: "الجامعة المستنصرية", founded: 1963, website: "www.uomustansiriyah.edu.iq", province: "بغداد" },
  { name: "جامعة البصرة", founded: 1967, website: "www.uobasrah.edu.iq", province: "البصرة" },
  { name: "جامعة الموصل", founded: 1967, website: "www.uomosul.edu.iq", province: "نينوى" },
  { name: "الجامعة التكنولوجية", founded: 1975, website: "www.uotechnology.edu.iq", province: "بغداد" },
  { name: "جامعة النهرين", founded: 1987, website: "www.nahrainuniv.edu.iq", province: "بغداد" },
  { name: "جامعة الكوفة", founded: 1987, website: "www.uokufa.edu.iq", province: "النجف" },
  { name: "جامعة تكريت", founded: 1987, website: "www.tu.edu.iq", province: "صلاح الدين" },
  { name: "جامعة القادسية", founded: 1987, website: "www.qu.edu.iq", province: "الديوانية" },
  { name: "جامعة الأنبار", founded: 1987, website: "www.uoanbar.edu.iq", province: "الأنبار" },
  { name: "الجامعة العراقية", founded: 1989, website: "www.aliraqia.edu.iq", province: "بغداد" },
  { name: "جامعة بابل", founded: 1991, website: "www.uobabylon.edu.iq", province: "بابل" },
  { name: "جامعة ديالى", founded: 1998, website: "www.uodiyala.edu.iq", province: "ديالى" },
  { name: "جامعة كربلاء", founded: 2002, website: "www.uokerbala.edu.iq", province: "كربلاء" },
  { name: "جامعة ذي قار", founded: 2002, website: "www.utq.edu.iq", province: "ذي قار" },
  { name: "جامعة كركوك", founded: 2003, website: "www.uokirkuk.edu.iq", province: "كركوك" },
  { name: "جامعة واسط", founded: 2003, website: "www.uowasit.edu.iq", province: "واسط" },
  { name: "جامعة ميسان", founded: 2007, website: "www.uomisan.edu.iq", province: "ميسان" },
  { name: "جامعة المثنى", founded: 2007, website: "www.mu.edu.iq", province: "المثنى" },
  { name: "جامعة سامراء", founded: 2014, website: "www.uosamarra.edu.iq", province: "صلاح الدين" },
  { name: "جامعة سومر", founded: 2014, website: "www.uos.edu.iq", province: "ذي قار" },
  { name: "جامعة القاسم الخضراء", founded: 2014, website: "www.uoqasim.edu.iq", province: "بابل" },
  { name: "جامعة نينوى", founded: 2014, website: "www.uoninevah.edu.iq", province: "نينوى" },
  { name: "جامعة الفلوجة", founded: 2014, website: "www.uofallujah.edu.iq", province: "الأنبار" },
  { name: "جامعة جابر بن حيان للعلوم الطبية والصيدلانية", founded: 2014, website: "www.jmu.edu.iq", province: "النجف" },
  { name: "جامعة تلعفر", founded: 2014, website: "www.uotelafer.edu.iq", province: "نينوى" },
  { name: "جامعة البصرة للنفط والغاز", founded: 2014, website: "www.buog.edu.iq", province: "البصرة" },
  { name: "جامعة الحمدانية", founded: 2014, website: "www.uohamdaniya.edu.iq", province: "نينوى" },
  { name: "جامعة تكنولوجيا المعلومات والاتصالات", founded: 2014, website: "www.uoitc.edu.iq", province: "بغداد" },
  { name: "جامعة الكرخ للعلوم", founded: 2014, website: "www.kus.edu.iq", province: "بغداد" },
  { name: "جامعة ابن سينا للعلوم الطبية والصيدلانية", founded: 2014, website: "www.ibnsina.edu.iq", province: "بغداد" },
  { name: "جامعة الشطرة", founded: 2023, website: "shu.edu.iq", province: "ذي قار" },
  { name: "الجامعة التقنية الشمالية", founded: 2014, website: "www.fte.edu.iq", province: "نينوى" },
  { name: "جامعة الفرات الأوسط التقنية", founded: 2014, website: "www.atu.edu.iq", province: "بابل" },
  { name: "الجامعة التقنية الجنوبية", founded: 2014, website: "www.stu.edu.iq", province: "البصرة" },
  { name: "الجامعة التقنية الوسطى", founded: 2014, website: "www.mtu.edu.iq", province: "بغداد" },
];

const ID_OVERRIDES = {
  "جامعة بغداد": "baghdad",
  "الجامعة المستنصرية": "mustansiriyah",
  "جامعة البصرة": "basrah",
  "جامعة الموصل": "mosul",
  "الجامعة التكنولوجية": "technology",
  "جامعة النهرين": "nahrain",
  "جامعة الكوفة": "kufa",
  "جامعة تكريت": "tikrit",
  "جامعة القادسية": "qadisiyah",
  "جامعة الأنبار": "anbar",
  "الجامعة العراقية": "iraqia",
  "جامعة بابل": "babil",
  "جامعة ديالى": "diyala",
  "جامعة كربلاء": "karbala",
  "جامعة ذي قار": "dhiqar",
  "جامعة كركوك": "kirkuk",
  "جامعة واسط": "wasit",
  "جامعة ميسان": "maysan",
  "جامعة المثنى": "muthanna",
  "جامعة سامراء": "samarra",
  "جامعة سومر": "sumer",
  "جامعة القاسم الخضراء": "alqasim_alkhadraa",
  "جامعة نينوى": "ninevah",
  "جامعة الفلوجة": "fallujah",
  "جامعة جابر بن حيان للعلوم الطبية والصيدلانية": "jaber_ibn_hayyan",
  "جامعة تلعفر": "telafer",
  "جامعة البصرة للنفط والغاز": "basrah_oil_gas",
  "جامعة الحمدانية": "hamdaniya",
  "جامعة تكنولوجيا المعلومات والاتصالات": "uoitc",
  "جامعة الكرخ للعلوم": "karkh",
  "جامعة ابن سينا للعلوم الطبية والصيدلانية": "ibn_sina",
  "جامعة الشطرة": "shatrah",
  "الجامعة التقنية الشمالية": "northern_technical",
  "جامعة الفرات الأوسط التقنية": "middle_euphrates_technical",
  "الجامعة التقنية الجنوبية": "southern_technical",
  "الجامعة التقنية الوسطى": "middle_technical",
};

function slugify(name) {
  return name
    .replace(/^(جامعة|الجامعة)\s+/, "")
    .replace(/[إأآا]/g, "a")
    .replace(/ة/g, "h")
    .replace(/ى/g, "a")
    .replace(/[^a-zA-Z0-9؀-ۿ]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// PDF text extraction sometimes reorders the "لا" ligature (extracts as
// "ال" instead of "لا") and drops hamza diacritics. Stripping all bare
// alef characters collapses both spellings to the same key -- mirrors
// lib/majorMatcher.ts's normalizeArabic().
function normKey(s) {
  return (s || "").replace(/[أإآ]/g, "ا").replace(/ا/g, "").replace(/\s+/g, "").trim();
}

// حد التقديم المسائي وسقف أجوره: data/evening-rules.json عبر scripts/eveningRules.js (حل محل
// تصنيف بالتعابير النمطية على اسم الكلية كان يفشل مع الأسماء المشوّهة ويحمل قيمة مختلَقة 56).

function stripCollegePrefix(name) {
  return (name || "").replace(/^(كلية|كليات|معهد|المعهد)\s+/, "").trim() || name;
}

const universities = UNIVERSITIES.map((u) => ({
  id: ID_OVERRIDES[u.name] || slugify(u.name),
  name: u.name,
  nameEn: null,
  type: "حكومية",
  province: u.province,
  founded: u.founded,
  website: u.website,
  ranking: null,
  _collegesMap: new Map(),
}));

const byName = new Map(universities.map((u) => [normKey(u.name), u]));

// إصلاح فجوة بيانات مرتبطة (2026-07-18): اسم كلية واحد التفّ عبر خليتي جدول
// PDF متتاليتين بشكل غير متّسق بين صفّين مختلفين من نفس المصدر -- "كلية
// التحسس النائي والجيوفيزياء" (جامعة الكرخ للعلوم) ظهرت في صفّ الدراسة
// المسائية الأول مبتورة كـ"كلية التحسس النائي" (مع بقية الاسم "والجيوفيزياء"
// منزلقة إلى حقل campusOrTrack)، وفي صفّ آخر باسمها الكامل الصحيح -- فأنشأ
// ذلك كليتين منفصلتين لكيان واحد حقيقي. تحقّقنا يدوياً من هذا عبر مطابقة
// data/raw/dalel.full.txt (القسم "6 - علوم الطاقة والبيئة... 5 - التحسس
// النائي والجيوفيزياء: التحسس النائي / الجيوفيزياء") قبل الدمج -- ليست
// قاعدة عامة (اختبرنا تعميمها على كل الجامعات فوجدناه يُنتج نتائج كاذبة
// كثيرة، كـ"كلية الطب" و"كلية الطب البيطري" كليتان حقيقيتان مختلفتان لا
// كلية واحدة مبتورة)، بل تصحيح موضعي واحد مُتحقَّق منه بعينه.
const COLLEGE_NAME_ALIASES = {
  "جامعة الكرخ للعلوم": { "كلية التحسس النائي": "كلية التحسس النائي والجيوفيزياء" },
  // نفس نمط الالتفاف عبر خليتي جدول، لكن الجزء الضائع هنا كلمة كاملة لا
  // حرفاً واحداً ("الهندسية"/"الطبي")، ولا يحمل فاصل "/" يلتقطه الإصلاح
  // العام أعلاه لأن الكلمة الضائعة سبقت الفاصل لا تلته. تحقّقنا يدوياً من
  // كليهما في data/raw/dalel.full.txt (السطر 5139: "الكلية التقنية
  // االقسام" + "الهندسية" منفصلتين بخلية عن هذا القسم بالضبط؛ السطر 5156:
  // "المعهد التقني" + "الطبي" لنفس النمط) قبل الإضافة، بنفس منهج الحالة
  // الموثَّقة أعلاه -- تصحيح موضعي، لا قاعدة عامة.
  "الجامعة التقنية الجنوبية": {
    "الكلية التقنية االقسام": "الكلية التقنية االقسام الهندسية",
    "المعهد التقني": "المعهد التقني الطبي",
  },
  // هنا نفس عطل الكلمة الضائعة أنتج مفتاحاً مبتوراً واحداً ("كلية العلوم")
  // يخصّ فعلياً كليتين حقيقيتين مختلفتين كلياً (التطبيقية والإسلامية) --
  // القسم المرافق وحده يميّز أيّهما، فلا يكفي هنا استبدال بسيط بنص واحد؛
  // انظر منطق الحل الخاص بالقسم أسفل getCollege.
  "جامعة سامراء": {
    "كلية التربية": "كلية التربية للعلوم الصرفة",
  },
  // نفس نمط "كلمة كاملة ضائعة من اسم الكلية بلا فاصل '/'" (السطر 4291:
  // "كلية اقتصاديات" + "االعمال" في خليتين منفصلتين لصف حصة "اقتصاديات
  // ادارة االستثمار واالعمال" فقط، بينما صفّا "اقتصاديات ادارة المصارف"
  // و"الرقابة المحاسبية والمالية" المجاوران يحملان الاسم الكامل الصحيح
  // "كلية اقتصاديات االعمال" بلا انقسام).
  "جامعة النهرين": {
    "كلية اقتصاديات": "كلية اقتصاديات االعمال",
  },
  "الجامعة التكنولوجية": {
    "كلية هندسة االنتاج والمعادن": "كلية هندسة الإنتاج والمعادن",
  },
  "جامعة المثنى": {
    "كلية التربية": "كلية التربية للعلوم االنسانية",
  },
  // كلية الآثار (جامعة الموصل): الفصل 3 يكتبها بهمزة ممدودة ("كلية الآثار") بينما
  // ملف الحدود والمسائي يكتبانها "كلية االثار" -- كيان واحد حقيقي (دليل ص: 42 "االثار"
  // في الفصل 3 والبند 56 في المسائي)، فكان يُنتج كليتين: واحدة بحدّها الرسمي
  // وأخرى بأقسامها الثلاثة بلا حد. تصحيح موضعي مُتحقَّق منه (2026-10-11).
  "جامعة الموصل": {
    "كلية الآثار": "كلية االثار",
  },
};

const DEPARTMENT_NAME_ALIASES = {
  "جامعة المثنى": {
    "كلية التربية للعلوم االنسانية": {
      "قسم اللغة الإنكليزية": "قسم اللغة االنكليزية",
    },
  },
  "جامعة الفلوجة": {
    "كلية التربية": {
      "قسم اللغة اإلنكليزية": "قسم اللغة االنكليزية",
    },
  },
};

// حالات نادرة إضافية حيث المفتاح المبتور نفسه يخصّ أكثر من كلية حقيقية،
// فيلزم النظر في اسم القسم المرافق لا اسم الكلية وحده للتمييز بينها
// (تحقّقنا يدوياً من كليهما في data/raw/dalel.full.txt: السطر 4612 "كلية
// العلوم / التطبيقية / قسم التقانات الاحيائية" والسطر 4637 "كلية العلوم /
// االسالمية / قسم العقيدة والفكر االسالمي" -- نفس المفتاح المبتور "كلية
// العلوم" لكليتين مختلفتين فعلاً).
const COLLEGE_NAME_ALIASES_BY_DEPT = {
  "جامعة سامراء": [
    { collegeKey: "كلية العلوم", deptContains: "التقانات االحيائية", target: "كلية العلوم التطبيقية" },
    { collegeKey: "كلية العلوم", deptContains: "العقيدة", target: "كلية العلوم االسالمية" },
  ],
};

// إصلاح فجوة بيانات مرتبطة أوسع (اكتُشفت بتدقيق شامل لاحق، 2026-07-21):
// نفس الكلية الحقيقية تُكتب أحياناً باسمها المجرَّد في مصدر الحدود الدنيا
// ("الكلية التقنية الشطرة") وباسم يحمل لاحقة "/فرع-أو-تخصص-فرعي" في مصدر
// الدراسة المسائية ("الكلية التقنية الشطرة/الاقسام الهندسية") -- فتُنشئ
// كليتين منفصلتين لكيان واحد، والأخطر أن معدلها المسائي يعلَق في الكلية
// المكرَّرة بلا أقسام حقيقية بدل أن يصل قسمها الحقيقي. خلافاً لمحاولة
// تعميم مطابقة البادئات المجرَّدة (رُفضت أعلاه لأنها تُنتج نتائج كاذبة بين
// كليات مختلفة فعلاً مثل "الطب"/"الطب البيطري")، الفاصل "/" هنا إشارة
// صريحة ومتعمَّدة من المصدر نفسه لعلاقة "نفس الكيان + مؤهِّل فرعي"، لا
// تشابه بادئة عرضي -- فتعميمها آمن.
// قائمة أسماء المدن/الأقضية في data/campus-qualifiers.json (مصدر واحد مشترك مع scripts/parse-cutoffs.js)
// + أسماء ظهرت إضافياً في مصدر الدراسة المسائية تحديداً. تُستخدَم هنا
// لمنع دمج كليتين لهما نفس الاسم لكن في فرعين/مدينتين مختلفتين فعلياً
// (اكتُشف بتحقق لاحق: "الكلية التقنية الصحية والطبية" اسم مُكرَّر شرعياً
// لعدة معاهد حقيقية مختلفة في مدن مختلفة -- دمجها كان سيُخفي حداً حقيقياً
// منفصلاً لكل فرع، عكس حالة "الكلية X/تخصصات فرعية" حيث اللاحقة تصف تخصصاً
// فرعياً لا موقعاً جغرافياً، فالدمج هناك صحيح).
const { CAMPUS_QUALIFIERS, QUALIFIER_PROVINCE, NAMED_CAMPUS_PROVINCE } = require("./campusQualifiers");

function getCollege(uni, collegeName, deptNameForDisambiguation) {
  let resolvedName = collegeName;
  const byDeptRules = COLLEGE_NAME_ALIASES_BY_DEPT[uni.name];
  const byDeptRule =
    byDeptRules &&
    deptNameForDisambiguation &&
    byDeptRules.find((r) => r.collegeKey === collegeName.trim() && deptNameForDisambiguation.includes(r.deptContains));
  if (byDeptRule) {
    resolvedName = byDeptRule.target;
  } else {
    const alias = COLLEGE_NAME_ALIASES[uni.name];
    resolvedName = (alias && alias[collegeName.trim()]) || collegeName;
  }
  let key = resolvedName.trim();
  // إن كانت اللاحقة بعد "/" مؤهِّلاً تخصصياً/فرعياً لا اسم مدينة (مثال:
  // "كلية البوليتكنك بغداد/التخصصات الهندسية")، الهوية الكنسية للكلية هي
  // الجزء السابق دائماً -- بصرف النظر عن ترتيب وصول الصفوف. الاعتماد على
  // وجود مسبَق للاسم المجرَّد في الخريطة (كما في نسخة سابقة من هذا الإصلاح)
  // فشل عملياً حين لا يظهر الاسم المجرَّد بلا أي لاحقة في المصدر إطلاقاً
  // (حالات "بوليتكنك بغداد" الأربع تظهر كلها بلاحقة مختلفة، فلا نسخة
  // مجرَّدة أصلاً لتُنشأ أولاً ويُدمَج البقية فيها) -- فنطبِّع دائماً بدل
  // الدمج الشرطي.
  if (key.includes("/") && !CAMPUS_QUALIFIERS.has(key.split("/")[1]?.trim())) {
    key = key.split("/")[0].trim();
  }
  if (!uni._collegesMap.has(key)) uni._collegesMap.set(key, { name: key, departmentsMap: new Map() });
  return uni._collegesMap.get(key);
}

function getDept(college, deptName, collegeNameForFallback) {
  const effectiveName = deptName && deptName.trim() ? deptName.trim() : null;
  const key = effectiveName || "__COLLEGE_LEVEL__";
  if (!college.departmentsMap.has(key)) {
    college.departmentsMap.set(key, {
      name: effectiveName || stripCollegePrefix(collegeNameForFallback),
      isCollegeLevelProgram: !effectiveName,
      sessions: new Set(),
      cutoffs: [],
      hasEvening: false,
      directBranches: new Set(),
    });
  }
  return college.departmentsMap.get(key);
}

// إصلاح تعدّد الأحرم (2026-10-11، تدقيق صفحات 15-24 من «الحدود الدنيا» صفاً بصف).
// الدليل يذكر الحرم لكل حد ("الكلية التقنية الهندسية / الموصل" و"/ كركوك") لكن
// getCollege كان يستلم اسم الكلية وحده فيُدمج الحرمان في سجل واحد: يُخزَّن الحدّان
// معاً ويُعرض الأدنى (مثال: هندسة تقنيات الأجهزة الطبية: الموصل 84.57 وكركوك 81.57
// فيظهر 81.57 للحرمين)، والأسوأ أن أقسام الحرم في مصدر المسائي (اسم الكلية بلاحقة
// "/الحرم") كانت تُنشأ كلية موازية بلا حد صباحي.
// القاعدتان:
//  (1) كليات مقسَّمة بالأحرم -- قائمة موضعية مُتحقَّقة (الدليل نفسه يذكر حدّين
//      لنفس القسم/الفرع/الجنس بحسب الحرم): يُلحَق الحرم باسم الكلية. القيمة هي
//      الحرم الذي يبقى بلا لاحقة (السجل الأصلي في مصدر المسائي)، وnull = كل الأحرم بلاحقة.
//  (2) وإلا: إن وُجد في مصدر المسائي سجل كلية بنفس الاسم + "/" + نفس الحرم فتُسنَد إليه
//      الحدود (كيان واحد بمصدرين) بدل إنشاء كلية موازية بأقسام بلا حد.
const CAMPUS_SPLIT_COLLEGES = {
  [normKey("الجامعة التقنية الشمالية")]: {
    [normKey("الكلية التقنية الهندسية")]: null,
    [normKey("الكلية التقنية الهندسية للحاسوب والذكاء االصطناعي")]: null,
    [normKey("المعهد التقني الطبي")]: null,
  },
  [normKey("جامعة الفرات الأوسط التقنية")]: {
    [normKey("الكلية التقنية الصحية والطبية")]: "الكوفة",
  },
  // الدليل (الفصل 3) يعدّد أقسام حرم القرنة والشرقاط لإدارة واقتصاد البصرة وتكريت (حدّا الكلية
  // مختلفان: البصرة علمي 70 / القرنة 68.29، تكريت علمي 60 / الشرقاط 61.14) فتُفصل في سجلّين.
  [normKey("جامعة البصرة")]: {
    [normKey("كلية االدارة واالقتصاد")]: null,
  },
  [normKey("جامعة تكريت")]: {
    [normKey("كلية االدارة واالقتصاد")]: null,
  },
};
const eveningSuffixed = new Map(); // جامعة|كلية|حرم -> اسم الكلية كما كُتب في مصدر المسائي
for (const r of evening) {
  const parts = (r.college || "").split("/");
  if (parts.length === 2 && CAMPUS_QUALIFIERS.has(parts[1].trim())) {
    eveningSuffixed.set([normKey(r.university), normKey(parts[0]), normKey(parts[1])].join("|"), r.college);
  }
}
function campusCollegeName(uni, college, campus) {
  const split = CAMPUS_SPLIT_COLLEGES[normKey(uni.name)];
  const key = normKey(college);
  if (split && Object.prototype.hasOwnProperty.call(split, key)) {
    const unsuffixed = split[key];
    return unsuffixed && normKey(unsuffixed) === normKey(campus) ? college : `${college}/${campus}`;
  }
  return null;
}
function resolveCutoffCollege(uni, row) {
  const campus = (row.qualifiers || []).find((q) => CAMPUS_QUALIFIERS.has(q));
  if (!campus) return row.college;
  return (
    campusCollegeName(uni, row.college, campus) ||
    eveningSuffixed.get([normKey(uni.name), normKey(row.college), normKey(campus)].join("|")) ||
    row.college
  );
}
// اسم كلية التفّ في جدول المسائي عبر خليتين: «كلية علوم» + campusOrTrack «الحاسوب وتكنولوجيا المعلومات»
// (والقيمة الثانية ليست اسم حرم). يُعاد الاسم الكامل **فقط** حين يطابق المجموع كليةً واحدة قائمة في
// الجامعة نفسها بعد التطبيع (PLAN-ADMISSION-COMPLETION.md): بلا مطابقة وحيدة يبقى السلوك السابق.
function wrappedEveningCollege(uni, row) {
  const raw = (row.campusOrTrack || "").trim();
  if (!raw || !row.college || row.college.includes("/")) return null;
  if (CAMPUS_QUALIFIERS.has(raw)) return null;
  // «الهندسية الكهربائية / بغداد» ← تتمّة الاسم ثم الحرم؛ «بعقوبة /التخصصات الهندسية» ← الحرم ثم المسار
  const pieces = raw
    .replace(/[()]/g, " ")
    .split("/")
    .map((x) => x.trim())
    .filter((x) => x && !/^التخصصات/.test(x) && !/^صالح الدين$/.test(x));
  const base = normalizeForDedupMatch(row.college);
  const keys = [...uni._collegesMap.keys()].filter((k) => !k.includes("/"));
  const hits = new Set();
  for (const piece of pieces.slice(0, 2)) {
    const want = normalizeForDedupMatch(`${row.college} ${piece}`);
    if (!want || want === base) continue;
    for (const k of keys) if (normalizeForDedupMatch(k) === want) hits.add(k);
    if (hits.size) break;
  }
  return hits.size === 1 ? [...hits][0] : null;
}
function resolveEveningCollege(uni, row) {
  const wrapped = wrappedEveningCollege(uni, row);
  if (wrapped) return wrapped;
  const campus = (row.campusOrTrack || "").trim();
  if (!campus || !CAMPUS_QUALIFIERS.has(campus) || (row.college || "").includes("/")) return row.college;
  // مصدر المسائي نفسه يكتب أحياناً الحرم كلاحقة ("كلية التربية /الدواية") وأحياناً كحقل منفصل
  // (campusOrTrack) لنفس الكلية والحرم -- نوحّدهما في سجل واحد.
  return (
    campusCollegeName(uni, row.college, campus) ||
    eveningSuffixed.get([normKey(uni.name), normKey(row.college), normKey(campus)].join("|")) ||
    row.college
  );
}

// جدول «الفروع المقبولة» من الفصل 3 للدليل (scripts/parse-chapter3-branches.js)، يُطابَق عبر
// scripts/guideBranches.js بتحفّظ: نفس الكلية ومجموعة فروع واحدة لا لبس فيها؛ غير ذلك = لا
// معلومة (يبقى السلوك السابق).
let chapter3Branches = [];
try {
  chapter3Branches = require(path.join(ROOT, "data/raw/chapter3_branches.json"));
} catch (e) {
  console.warn("[تنبيه] data/raw/chapter3_branches.json غير موجود -- شغّل scripts/parse-chapter3-branches.js");
}
const guideBranchesFor = createGuideLookup(chapter3Branches);
const GUIDE_CONFLICTS = [];
// أقسام لها حدود خاصة لبعض الفروع فقط وأُلحق بها حد الكلية لفرع آخر (م5، قرار 2026-10-12)
const COLLEGE_PARTIAL_ASSIGNMENTS = [];

// أسماء أحرم قرأها parse-cutoffs قسماً («ابن الهيثم»، «الحي»، «بغداد باب المعظم»): الصف حد كلية/معهد لا قسم
const CAMPUS_LABEL_DEPTS = new Set(
  (() => {
    try {
      return require(path.join(ROOT, "data/campus-label-departments.json")).map(
        (r) => normKey(r.university) + "|" + normKey(r.college) + "|" + normKey(r.label)
      );
    } catch (e) {
      return [];
    }
  })()
);
// ربط الأقسام التقنية بمساراتها (scripts/admission-fix/build-institute-tracks.js): مصدر صريح لكل ربط
const { umbrellaTrack, TRACK_LABEL } = require("./instituteTracks");
// SKIP_TRACKS=1: بناء بلا توزيع حد المسار (المظلات باقية) ليُولَّد data/institute-tracks.json منه
const TRACK_INDEX = new Map(
  (() => {
    if (process.env.SKIP_TRACKS) return [];
    try {
      return require(path.join(ROOT, "data/institute-tracks.json")).map((t) => [
        `${t.university}|${t.college}|${t.department}`,
        t.track,
      ]);
    } catch (e) {
      return [];
    }
  })()
);
const TRACK_ASSIGNMENTS = [];
// كليات التقديم المباشر: قبول من الكلية نفسها بلا حد مركزي (أو بحد أدنى معلَن في الدليل)
const DIRECT_APPLY_RULES = (() => {
  try {
    return require(path.join(ROOT, "data/direct-apply-colleges.json")).rules;
  } catch (e) {
    return [];
  }
})();
function directApplyFor(uni, collegeName) {
  const n = normKey(collegeName.split("/")[0]);
  for (const r of DIRECT_APPLY_RULES) {
    const m = r.match;
    const hit = m.collegeNameMatches
      ? new RegExp(m.collegeNameMatches).test(toDisplayName(collegeName))
      : normKey(m.university) === normKey(uni.name) && m.colleges.some((c) => normKey(c) === n);
    if (hit)
      return {
        kind: r.kind,
        ...(r.minimumAverage != null ? { minimumAverage: r.minimumAverage } : {}),
        note: r.note,
        source: r.source,
      };
  }
  return null;
}

let unmatchedUni = new Set();

for (const row of cutoffs) {
  const uni = byName.get(normKey(row.university));
  if (!uni) {
    unmatchedUni.add(row.university);
    continue;
  }
  const college = getCollege(uni, resolveCutoffCollege(uni, row), row.department);
  const resolvedDept =
    DEPARTMENT_NAME_ALIASES[uni.name]?.[college.name]?.[row.department] ||
    DEPARTMENT_NAME_ALIASES[uni.name]?.[row.college]?.[row.department] ||
    row.department;
  const isCampusLabel = CAMPUS_LABEL_DEPTS.has(
    normKey(uni.name) + "|" + normKey(college.name) + "|" + normKey(resolvedDept || "")
  );
  const dept = getDept(college, isCampusLabel ? "" : resolvedDept, row.college);
  dept.sessions.add("صباحي");
  dept.cutoffs.push({
    branch: row.branch,
    gender: row.gender,
    averagePercent: row.averagePercent,
    isQuota: row.isQuota,
  });
}

for (const row of evening) {
  const uni = byName.get(normKey(row.university));
  if (!uni) {
    unmatchedUni.add(row.university);
    continue;
  }
  const college = getCollege(uni, resolveEveningCollege(uni, row), row.department);
  const resolvedDept =
    DEPARTMENT_NAME_ALIASES[uni.name]?.[college.name]?.[row.department] ||
    DEPARTMENT_NAME_ALIASES[uni.name]?.[row.college]?.[row.department] ||
    row.department;
  const dept = getDept(college, resolvedDept, row.college);
  dept.sessions.add("مسائي");
  dept.hasEvening = true;
}

// Chapter 3 (college/department/branch-eligibility table) additions:
// colleges/departments verified present in the official guide but absent
// from both the competitive cutoffs and evening-study data (i.e. they
// never filled via competition and aren't offered evening either --
// genuinely direct-admission-only programs). See data/admission_rules.md
// for how these were found and cross-checked against the existing dataset
// before being added, to avoid duplicating anything already covered.
for (const row of chapter3Additions) {
  const uni = byName.get(normKey(row.university));
  if (!uni) {
    unmatchedUni.add(row.university);
    continue;
  }
  const college = getCollege(uni, row.college);
  const resolvedDept =
    DEPARTMENT_NAME_ALIASES[uni.name]?.[college.name]?.[row.department] ||
    DEPARTMENT_NAME_ALIASES[uni.name]?.[row.college]?.[row.department] ||
    row.department;
  const dept = getDept(college, resolvedDept, row.college);
  dept.sessions.add("صباحي");
  (row.branch || []).forEach((b) => dept.directBranches.add(b));
}

if (unmatchedUni.size) {
  console.error("Unmatched university names (should be empty):", [...unmatchedUni]);
  process.exit(1);
}

// إصلاح فجوة بيانات حقيقية (2026-07): 488 من أصل 1222 صفاً في جدول الحدود
// الدنيا (~40%) لا تذكر اسم قسم محدد -- الحد الأدنى فيها مُعلَن على مستوى
// الكلية كاملة (شائع لكليات الإدارة والاقتصاد: معدل تنافسي موحّد واحد لكل
// أقسامها: المحاسبة، إدارة الأعمال، الاقتصاد...). getDept أعلاه كانت تضع
// هذا الحد في "قسم" اصطناعي بلا اسم حقيقي (يحمل اسم الكلية نفسها)، بينما
// الأقسام الحقيقية (المضافة غالباً من الفصل 3) تبقى بلا أي حد أدنى خاص
// بها فتظهر خطأً كـ"قبول مباشر" -- رغم أن قسم المحاسبة في جامعة بغداد مثلاً
// تنافسي فعلياً بنفس حد الكلية (~62-68%)، وليس قبولاً مباشراً إطلاقاً.
// الحل: نُلحق حدود الكلية المشتركة بكل قسم حقيقي فيها بلا حد خاص، ثم نحذف
// السجل الاصطناعي (بلا فائدة بعد الإلحاق، وكان يظهر باسم غير مفهوم للطالب).
for (const u of universities) {
  for (const college of u._collegesMap.values()) {
    const collegeLevel = college.departmentsMap.get("__COLLEGE_LEVEL__");
    if (!collegeLevel || collegeLevel.cutoffs.length === 0) continue;
    const realDeptsWithoutCutoffs = [...college.departmentsMap.entries()].filter(
      ([key, d]) => key !== "__COLLEGE_LEVEL__" && d.cutoffs.length === 0
    );
    if (realDeptsWithoutCutoffs.length === 0) continue; // لا قسم حقيقي آخر يحتاج الحد -- أبقِ الكلية بلا تغيير
    // فروع كل قسم المقبولة: الفصل 3 المضاف يدوياً أولاً، ثم جدول فروع الدليل المفكَّك.
    const allowedOf = (d) => (d.directBranches.size ? d.directBranches : guideBranchesFor(u, college.name, d.name));
    // حد كلية لفرع لا يقبله أي من أقسامها في المنصة بحسب الدليل:
    //  (أ) الدليل يذكر في الكلية قسماً يقبل هذا الفرع لكنه غير موجود في المنصة (مثال: آداب البصرة/
    //      الفلسفة تقبل الفنون) ⇒ الحد يخص ذلك القسم الغائب، فلا يُنسب لأقسام لا تقبل الفرع.
    //  (ب) لا قسم في الكلية يقبله بحسب الدليل أصلاً ⇒ تعارض بين الوثيقتين الرسميتين (جدول الحدود
    //      يثبت قبولاً فعلياً) ⇒ لا يُسقط الرقم الرسمي: يُوزَّع كما كان.
    // كلاهما يُسجَّل للمراجعة في reports/admission-fix/guide-cutoff-conflicts.json.
    const guideCollege = guideBranchesFor.collegeBranches(u, college.name);
    const orphan = new Set();
    collegeLevel.cutoffs
      .filter((c) =>
        realDeptsWithoutCutoffs.every(([, d]) => {
          const a = allowedOf(d);
          return a && !a.has(c.branch);
        })
      )
      .forEach((c) => {
        const missingDept = !!(guideCollege && guideCollege.has(c.branch));
        if (!missingDept) orphan.add(c.branch);
        GUIDE_CONFLICTS.push({
          type: missingDept ? "قسم يقبل الفرع في الدليل غير موجود في المنصة" : "تعارض بين جدول الحدود ودليل الفروع",
          university: u.name,
          college: college.name,
          branch: c.branch,
          averagePercent: c.averagePercent,
          kept: !missingDept,
          departments: realDeptsWithoutCutoffs.map(([, d]) => d.name),
        });
      });
    realDeptsWithoutCutoffs.forEach(([, d]) => {
      // قسم لا يستقبل حد الكلية إلا لفروعه المقبولة (الفصل 3 / جدول فروع الدليل):
      // مثال: تربية القادسية/الرياضيات علمي فقط فلا يُنسب له حد "أدبي" الكلية، وكلية
      // الآثار/الموصل: "الحفاظ على الآثار" علمي/أدبي وحد "فنون" لـ"آثار قديمة" وحدها.
      const allowed = allowedOf(d);
      const applicable = allowed
        ? collegeLevel.cutoffs.filter((c) => allowed.has(c.branch) || orphan.has(c.branch))
        : collegeLevel.cutoffs;
      if (!applicable.length) return;
      d.cutoffs.push(...applicable);
      // فروع حدّها معلَن للكلية كلها لا لهذا القسم وحده (م5): تُوسَم «حد الكلية» في الواجهة
      d.collegeScopeBranches = new Set([...(d.collegeScopeBranches || []), ...applicable.map((c) => c.branch)]);
      d.sessions.add("صباحي");
    });

    // قسم له حدود خاصة لبعض الفروع فقط (قرار 2026-10-12، PLAN-ADMISSION-COMPLETION.md المرحلة أ):
    // حد الكلية هو الأرضية لكل قسم لا صف خاص به لذلك الفرع/الجنس (والصف الخاص يعلوه دائماً: 107 حالة
    // موثَّقة في audit-cutoffs). فيُلحَق به حد الكلية لفرع يقبله بحسب الدليل ولا صف خاصاً له فيه، بالشرط
    // نفسه الذي يفحصه التدقيق: لا يُنسب لقسم لا يقبل الفرع، ولا لقسم حدوده كلها جنس واحد مع حد «مختلط».
    // يُوسَم «حد الكلية» لذلك الفرع وحده (cutoffScope = mixed + collegeScopeBranches).
    for (const [key, d] of college.departmentsMap.entries()) {
      if (key === "__COLLEGE_LEVEL__" || d.cutoffs.length === 0 || d.collegeScopeBranches) continue;
      const accepted = new Set([...d.cutoffs.map((x) => x.branch), ...(allowedOf(d) || [])]);
      const ownGenders = new Set(d.cutoffs.map((x) => x.gender));
      const extra = collegeLevel.cutoffs.filter(
        (c) =>
          !c.isQuota &&
          accepted.has(c.branch) &&
          !d.cutoffs.some((x) => x.branch === c.branch && x.gender === c.gender) &&
          !(ownGenders.size && !ownGenders.has("مختلط") && c.gender === "مختلط")
      );
      if (!extra.length) continue;
      d.cutoffs.push(...extra);
      d.collegeScopeBranches = new Set(extra.map((c) => c.branch));
      COLLEGE_PARTIAL_ASSIGNMENTS.push({
        university: u.name,
        college: college.name,
        department: d.name,
        branches: [...d.collegeScopeBranches],
      });
    }
    college.departmentsMap.delete("__COLLEGE_LEVEL__");
  }
}

// برنامج الكلية الواحد يُكتب في المصدرين مرة «عام» (المسائي) ومرة باسم الكلية («التربية البدنية وعلوم الرياضة»):
// قسمان لكيان واحد فيُدمجان في القسم المسمّى (جلساته وحدوده وفروعه)
for (const u of universities) {
  for (const college of u._collegesMap.values()) {
    const generic = college.departmentsMap.get("عام");
    if (!generic) continue;
    const base = normKey(stripCollegePrefix(college.name.split("/")[0]));
    const twin = [...college.departmentsMap.entries()].find(
      ([k, d]) => k !== "عام" && k !== "__COLLEGE_LEVEL__" && normKey(k.replace(/^قسمs+/, "")) === base
    );
    if (!twin) continue;
    const [, t] = twin;
    generic.sessions.forEach((x) => t.sessions.add(x));
    t.hasEvening = t.hasEvening || generic.hasEvening;
    t.cutoffs.push(...generic.cutoffs);
    generic.directBranches.forEach((x) => t.directBranches.add(x));
    college.departmentsMap.delete("عام");
  }
}

// حد المسار (PLAN-MORNING-CUTOFFS.md): الجدول الرسمي ينشر للمعهد/الكلية التقنية حداً لكل مسار
// («المعهد التقني بابل / التخصصات الطبية»)، فيصل إلى كل قسم **مربوط بذلك المسار بمصدر صريح** ولا صف خاصاً له
// لذلك الفرع/الجنس ويقبل الفرع (شرط حد الكلية نفسه). لا يُربط قسم بمساره بالاسم أو بالتخمين.
// قسم المظلة (المحمّل بحد المسار) يُحذف فقط إذا وصل كل حدّ من حدوده إلى قسم واحد على الأقل (لا يضيع رقم رسمي).
for (const u of universities) {
  for (const college of u._collegesMap.values()) {
    const umbrellas = new Map(); // مسار ← [مفتاح، قسم المظلة]
    for (const [key, d] of college.departmentsMap.entries()) {
      const t = umbrellaTrack(d.name);
      if (t && d.cutoffs.length) umbrellas.set(t, [key, d]);
    }
    if (!umbrellas.size) continue;
    const consumed = new Map(); // مسار ← مفاتيح حدود وصلت (فرع|جنس)
    for (const [key, d] of college.departmentsMap.entries()) {
      if (umbrellaTrack(d.name) || key === "__COLLEGE_LEVEL__") continue;
      const track = TRACK_INDEX.get(`${u.name}|${college.name}|${d.name}`);
      if (!track || !umbrellas.has(track)) continue;
      const [, um] = umbrellas.get(track);
      const accepted = d.directBranches.size
        ? d.directBranches
        : guideBranchesFor(u, college.name, d.name) || new Set(d.cutoffs.map((x) => x.branch));
      const ownGenders = new Set(d.cutoffs.map((x) => x.gender));
      const extra = um.cutoffs.filter(
        (c) =>
          !c.isQuota &&
          (accepted.size === 0 || accepted.has(c.branch)) &&
          !d.cutoffs.some((x) => x.branch === c.branch && x.gender === c.gender) &&
          !(ownGenders.size && !ownGenders.has("مختلط") && c.gender === "مختلط")
      );
      if (!extra.length) continue;
      d.cutoffs.push(...extra);
      d.trackScopeBranches = new Set([...(d.trackScopeBranches || []), ...extra.map((c) => c.branch)]);
      d.trackLabel = TRACK_LABEL[track] || track;
      d.sessions.add("صباحي");
      const set = consumed.get(track) || consumed.set(track, new Set()).get(track);
      extra.forEach((c) => set.add(c.branch + "|" + c.gender));
      TRACK_ASSIGNMENTS.push({
        university: u.name,
        college: college.name,
        department: d.name,
        track,
        branches: [...d.trackScopeBranches],
      });
    }
    for (const [track, [key, um]] of umbrellas) {
      const got = consumed.get(track) || new Set();
      if (um.cutoffs.every((c) => c.isQuota || got.has(c.branch + "|" + c.gender))) college.departmentsMap.delete(key);
    }
  }
}

// إصلاح فجوة بيانات مرتبطة (2026-07): 5 صفوف حصص ("ابناء المحافظة") في
// كليات القبول أحادية القسم (طب/طب أسنان/صيدلة) لا تذكر اسم قسم قبل اسم
// الحصة في المصدر (مثال: "جامعة المثنى / كلية الطب / ابناء المحافظة")،
// فيضعها getDept أعلاه خطأً في قسم مستقل باسمه هو اسم الحصة نفسها، فيبقى
// بلا averageGrades أبداً (bestMorning يستبعد صفوف isQuota عمداً) رغم أن
// القسم الحقيقي الشقيق (المعدّل من صفّ "القناة العامة" العادي لنفس الكلية)
// موجود فعلاً. الحل: نُلحق حدود الحصة بالقسم الحقيقي الشقيق كسجلّ حصة إضافي
// ضمن cutoffs (لا يُحتسب في averageGrades، تماماً كمعاملة أي qualifier حصة
// أخرى)، ونحذف القسم الاصطناعي. نتجاهل الحالات الغامضة (أكثر من قسم حقيقي
// شقيق واحد) عمداً لتفادي إسناد حصة لقسم خاطئ بلا يقين.
const QUOTA_LABEL_RE = /ابناء|شهداء|متميز|اوائل/;
for (const u of universities) {
  for (const college of u._collegesMap.values()) {
    const entries = [...college.departmentsMap.entries()];
    const quotaOnlyDepts = entries.filter(([key]) => key !== "__COLLEGE_LEVEL__" && QUOTA_LABEL_RE.test(key));
    if (quotaOnlyDepts.length === 0) continue;
    // القسم "الحقيقي" الشقيق قد يبقى مفتاحه "__COLLEGE_LEVEL__" هنا (كلية
    // أحادية القسم بلا اسم قسم صريح في المصدر غير الحصة) -- خطوة التطعيم
    // أعلاه لا تُفرغه لأن "ابناء المحافظة" كان يملك cutoffs.length > 0 بالفعل
    // فلم يُعتبر "بلا حد" فيُستثنى من تلك الخطوة. لذا نعامله هنا كقسم حقيقي.
    const realDepts = entries.filter(([key]) => !QUOTA_LABEL_RE.test(key));
    if (realDepts.length !== 1) continue;
    const [, target] = realDepts[0];
    quotaOnlyDepts.forEach(([key, d]) => {
      target.cutoffs.push(...d.cutoffs);
      college.departmentsMap.delete(key);
    });
  }
}

// أقسام بلا حد منشور ولا فرع من الحدود الرسمية أو الفصل 3 (مسائي فقط غالباً): فرعها من جدول فروع
// الدليل (scripts/guideBranches.js) وحده. ما لا نصّ له يبقى **بلا فرع معروف** (branch: [] و
// branchBasis: "unknown") فيظهر موسوماً «الفرع غير معروف» في by-branch/unknown.json ولا يُعدّ
// مؤهِّلاً بتخمين. كان هنا تصنيف استدلالي من اسم القسم وأشقاء الكلية (12 قسماً)؛ أُلغي (م5، 2026-10-11)
// وفق قاعدة الخطة: لا رقم ولا فرع بلا مصدر رسمي.
for (const u of universities) {
  for (const college of u._collegesMap.values()) {
    const entries = [...college.departmentsMap.entries()];
    const gapDepts = entries.filter(
      ([key, d]) => key !== "__COLLEGE_LEVEL__" && d.cutoffs.length === 0 && d.directBranches.size === 0
    );
    if (gapDepts.length === 0) continue;
    gapDepts.forEach(([, d]) => {
      const guide = guideBranchesFor(u, college.name, d.name);
      d.branchBasis = guide ? "guide" : "unknown";
      if (guide) guide.forEach((b) => d.directBranches.add(b));
    });
  }
}

// دمج وحذف الأقسام المكررة والمشوَّهة في الجامعات الحكومية (انظر PLAN-ADMISSION-FIX.md §5 1-أ و1-ب)
const DEDUPLICATIONS = [
  {
    uni: "جامعة الموصل",
    college: "كلية هندسة النفط والتعدين",
    remove: "قسم هندسة المكامن النفطية",
    keep: "قسم المكامن النفطية",
  },
  { uni: "جامعة الموصل", college: "كلية هندسة النفط والتعدين", remove: "قسم هندسة التعدين", keep: "قسم التعدين" },
  {
    uni: "الجامعة التقنية الشمالية",
    college: "الكلية التقنية الهندسية",
    remove: "قسم هندسة تقنيات األجهزة الطبية",
    keep: "قسم هندسة تقنيات االجهزة الطبية",
  },
  {
    uni: "الجامعة التقنية الشمالية",
    college: "المعهد التقني الحويجة",
    remove: "قسم تقنيات األدلة الجنائية",
    keep: "قسم تقنيات االدلة الجنائية",
  },
  {
    uni: "الجامعة التكنولوجية",
    college: "كلية هندسة الحاسوب",
    remove: "واالمن السيبراني",
    keep: "قسم الشبكات واالمن السيبراني",
  },
  {
    uni: "جامعة الأنبار",
    college: "كلية الهندسة",
    remove: "قسم الهندسة الكيمياوية",
    keep: "قسم الكيميائية والبتروكيميائية",
  },
  { uni: "جامعة بابل", college: "كلية الهندسة", remove: "قسم الكهربائية", keep: "قسم الكهرباء" },
  {
    uni: "جامعة ذي قار",
    college: "كلية الهندسة",
    remove: "قسم الكهرباء والإلكترونيك",
    keep: "قسم الكهربائية وااللكترونية",
  },
  {
    uni: "جامعة ميسان",
    college: "كلية الهندسة",
    remove: "قسم الميكانيك (ميكانيك عام والتصميم والتصنيع)",
    keep: "قسم الميكانيكية",
  },
  { uni: "جامعة الفلوجة", college: "كلية التربية", remove: "قسم اللغة اإلنكليزية", keep: "قسم اللغة االنكليزية" },
  // كلية الآثار/الموصل: "قسم االثار القديمة" (المسائي، دليل بند 56) هو نفسه "آثار قديمة" (الفصل 3،
  // دليل بند 42، فروعه علمي/أدبي/فنون = فروع حدود الكلية الثلاثة الرسمية). تصحيح مُتحقَّق (2026-10-11).
  { uni: "جامعة الموصل", college: "كلية االثار", remove: "قسم االثار القديمة", keep: "آثار قديمة" },
];

for (const { uni: uName, college: cName, remove, keep } of DEDUPLICATIONS) {
  const uni = universities.find((u) => u.name === uName);
  if (!uni) continue;
  // الكلية نفسها، أو سجلاتها المقسَّمة بالأحرم ("الكلية/الموصل"، "الكلية/كركوك")
  const colleges = [...uni._collegesMap.entries()]
    .filter(([key]) => key === cName || key.startsWith(cName + "/"))
    .map(([, c]) => c);
  for (const college of colleges) {
    const remDept = college.departmentsMap.get(remove);
    const keepDept = college.departmentsMap.get(keep);
    if (remDept && keepDept) {
      for (const s of remDept.sessions) keepDept.sessions.add(s);
      for (const b of remDept.directBranches) keepDept.directBranches.add(b);
      for (const c of remDept.cutoffs) {
        // لا تكرار لنفس الحد بعد الدمج (حدّ الكلية قد وصل إلى القسمين معاً قبل الدمج)
        const dup = keepDept.cutoffs.some(
          (k) =>
            k.branch === c.branch &&
            k.gender === c.gender &&
            k.averagePercent === c.averagePercent &&
            k.isQuota === c.isQuota
        );
        if (!dup) keepDept.cutoffs.push(c);
      }
      keepDept.hasEvening = keepDept.hasEvening || remDept.hasEvening;
      college.departmentsMap.delete(remove);
    }
  }
}

// معرّف كلية حتمي من (جامعة + اسم مطبَّع بما فيه لاحقة الحرم) بدل الترتيب الموضعي `_col_N` الذي
// كان يتحرك كلما أُضيفت كلية في المنتصف فيُفسد الرغبات المحفوظة. الاسم نفسه مفتاح الكلية في البناء.
function stableCollegeId(uniId, collegeName, taken) {
  const h = crypto
    .createHash("sha1")
    .update(`${uniId}|${normKey(collegeName)}`)
    .digest("hex")
    .slice(0, 8);
  let id = `${uniId}_c_${h}`;
  for (let n = 2; taken.has(id); n++) id = `${uniId}_c_${h}_${n}`;
  taken.add(id);
  return id;
}

// الحرم صريحاً ومحافظته: من لاحقة «/الحرم»، أو حرم بلا لاحقة تمثّله كلية مفصولة بالدليل
// (CAMPUS_SPLIT_COLLEGES)، أو مدينة في آخر اسم كلية/معهد في جامعة تقنية متعددة المحافظات.
// فلتر المحافظة يستعمل campusProvince لا محافظة مقر الجامعة.
function campusOfCollege(uni, collegeName) {
  const name = (collegeName || "").trim();
  const slash = name.indexOf("/");
  if (slash > 0) {
    const q = name.slice(slash + 1).trim();
    if (CAMPUS_QUALIFIERS.has(q)) return { campus: q, campusProvince: QUALIFIER_PROVINCE[q] };
  }
  const split = CAMPUS_SPLIT_COLLEGES[normKey(uni.name)];
  const unsuffixed = split && split[normKey(name)];
  if (unsuffixed) return { campus: unsuffixed, campusProvince: QUALIFIER_PROVINCE[unsuffixed] };
  if (slash < 0 && /التقنية/.test(uni.name)) {
    const last = name.split(/\s+/).pop();
    if (Object.prototype.hasOwnProperty.call(NAMED_CAMPUS_PROVINCE, last)) {
      return { campus: last, campusProvince: NAMED_CAMPUS_PROVINCE[last] };
    }
  }
  return null;
}

// college = كل حدوده حد كلية، track = كلها حد مسار، department = كلها صفوف باسم القسم،
// mixed = خليط (collegeScopeBranches للفروع بحد كلية، trackScopeBranches للفروع بحد مسار)
function cutoffScopeOf(d, nonQuotaCutoffs) {
  const col = d.collegeScopeBranches ? [...d.collegeScopeBranches] : [];
  const trk = d.trackScopeBranches ? [...d.trackScopeBranches] : [];
  if (!col.length && !trk.length) return { cutoffScope: "department" };
  const scoped = new Set([...col, ...trk]);
  const hasOwn = nonQuotaCutoffs.some((x) => !scoped.has(x.branch));
  if (!hasOwn && !trk.length) return { cutoffScope: "college" };
  if (!hasOwn && !col.length) return { cutoffScope: "track", trackName: d.trackLabel };
  return {
    cutoffScope: "mixed",
    ...(col.length ? { collegeScopeBranches: col } : {}),
    ...(trk.length ? { trackScopeBranches: trk, trackName: d.trackLabel } : {}),
  };
}

const finalUniversities = universities.map((u) => {
  const takenCollegeIds = new Set();
  const colleges = [...u._collegesMap.values()].map((c) => {
    const departments = [...c.departmentsMap.values()].map((d) => {
      const nonQuotaCutoffs = d.cutoffs.filter((x) => !x.isQuota);
      const bestMorning = nonQuotaCutoffs.length ? Math.min(...nonQuotaCutoffs.map((x) => x.averagePercent)) : null;
      // الفروع المقبولة: فروع الحدود الرسمية + الفصل 3 المضاف + جدول فروع الدليل (فرع يقبله
      // الدليل بلا حد منشور له يظهر للطالب "بلا حد منشور" بدل أن يُخفى عنه القسم).
      const guide = d.directBranches.size ? null : guideBranchesFor(u, c.name, d.name);
      const branches = [...new Set([...d.cutoffs.map((x) => x.branch), ...d.directBranches, ...(guide || [])])];
      // الحد الصباحي لكل فرع على حدة (أدنى حد غير حصة لذلك الفرع، على كل الأجناس):
      // averageGrades.صباحي هو الأدنى بين كل الفروع، فلا يصلح لعرض حد فرع الطالب.
      const morningByBranch = Object.fromEntries(
        branches.map((b) => {
          const v = nonQuotaCutoffs.filter((x) => x.branch === b).map((x) => x.averagePercent);
          return [b, v.length ? Math.min(...v) : null];
        })
      );

      // المسائي: حد التقديم لكل فرع يقبله القسم + سقف الأجور، من جدول السنة الحالية (أو الاحتياط)
      const ev = d.hasEvening ? resolveEvening(c.name, d.name, branches) : null;
      const eveningValues = ev ? Object.values(ev.byBranch).filter((v) => v != null) : [];
      const bestEvening = eveningValues.length ? Math.min(...eveningValues) : null;

      // الجنس: يُذكر لقسم محدَّد فقط -- (أ) قسم لجنس واحد بحسب الحدود الرسمية (كل حدوده أنثى فقط أو ذكر فقط)،
      // (ب) قسم بحدّين مختلفين للذكور والإناث (تمريض…). بقية الأقسام (مختلط) لا يُذكر لها جنس إطلاقاً.
      const genderSet = new Set(nonQuotaCutoffs.map((x) => x.gender));
      const genderRestriction = genderSet.size === 1 && !genderSet.has("مختلط") ? [...genderSet][0] : null;
      const genderByBranch = {};
      for (const b of branches) {
        const m = nonQuotaCutoffs.filter((x) => x.branch === b && x.gender === "ذكر").map((x) => x.averagePercent);
        const f = nonQuotaCutoffs.filter((x) => x.branch === b && x.gender === "أنثى").map((x) => x.averagePercent);
        if (m.length && f.length && Math.min(...m) !== Math.min(...f)) {
          genderByBranch[b] = { ذكر: Math.min(...m), أنثى: Math.min(...f) };
        }
      }

      // مصدر قائمة الفروع المقبولة: cutoffs = من صفوف الحدود الرسمية، chapter3 = الفصل 3 المضاف يدوياً،
      // guide = جدول فروع الدليل، unknown = لا نصّ رسمي (branch: [])؛ لا استدلال بعد الآن.
      const branchBasis =
        d.branchBasis || (d.cutoffs.length ? "cutoffs" : d.directBranches.size ? "chapter3" : guide ? "guide" : "none");

      const hasAnyCutoff = bestMorning !== null || bestEvening !== null;
      const admissionStatus = hasAnyCutoff ? "published" : "noPublishedCutoff";

      return {
        name: d.name,
        displayName: toDisplayName(d.name),
        branch: branches,
        branchBasis,
        sessions: [...d.sessions],
        cutoffs: d.cutoffs,
        // مستوى الحد الصباحي: college = حد معلَن للكلية كلها وأُلحق بالقسم (لا يملك القسم صفاً باسمه)،
        // department = صفوف باسم القسم نفسه. قسم له صفوف خاصة لا يُلحَق به حد الكلية أبداً (يبقى بلا حد
        // منشور لفرع لا صف له): الخيار المحافظ، ويُوثَّق استثناء في audit-cutoffs.
        ...(d.cutoffs.length ? cutoffScopeOf(d, nonQuotaCutoffs) : {}),
        averageGrades: { صباحي: bestMorning, مسائي: bestEvening },
        ...(bestMorning === null && directApplyFor(u, c.name) ? { directApply: directApplyFor(u, c.name) } : {}),
        morningByBranch,
        ...(genderRestriction ? { genderRestriction } : {}),
        ...(Object.keys(genderByBranch).length ? { genderByBranch } : {}),
        ...(ev
          ? {
              // قسم بلا فرع معروف: حدّ المسائي لكل فرع تسمح به قاعدة الكلية (لا يُفترض قبوله، يُعرض موسوماً)
              eveningByBranch: branches.length
                ? Object.fromEntries(branches.map((b) => [b, ev.byBranch[b] ?? null]))
                : Object.fromEntries(Object.entries(ev.byBranch).filter(([, v]) => v != null)),
              evening: {
                year: ev.year,
                status: ev.status,
                ruleId: ev.ruleId,
                basis: ev.basis,
                note: ev.note,
                ...(ev.genderFloors ? { genderFloors: ev.genderFloors } : {}),
                feeCap: ev.fee.cap,
                feeYear: ev.fee.year,
                feeRuleId: ev.fee.ruleId,
              },
            }
          : {}),
        isDirectAdmission: false, // لا يوجد قبول مباشر في أي قسم حكومي إطلاقاً
        admissionStatus,
      };
    });
    const campusInfo = campusOfCollege(u, c.name);
    return {
      id: stableCollegeId(u.id, c.name, takenCollegeIds),
      name: c.name,
      displayName: toDisplayName(c.name),
      nameEn: null,
      ...(campusInfo ? campusInfo : {}),
      departments,
    };
  });
  const { _collegesMap, ...rest } = u;
  return { ...rest, colleges };
});

function buildPrivateDepartment(d) {
  const sessions = [];
  if (!d.suspended) {
    sessions.push("صباحي");
    if (typeof d.eveningFee === "number") sessions.push("مسائي");
  }
  // شرط معلن مسبقاً (لا نتيجة قبول بأثر رجعي) -- عمداً منفصل عن cutoffs/
  // averageGrades، ولا يُغيّر isDirectAdmission. راجع data/admission_rules.md §28.
  const parsedMinimum = parseStatedMinimum(d.gradeNote);
  const statedMinimumGrade = parsedMinimum
    ? {
        value: parsedMinimum.value,
        raw: parsedMinimum.raw,
        source: SOURCES.privateGuide.document,
        sourceYear: SOURCES.privateGuide.year,
      }
    : null;
  return {
    name: d.name,
    displayName: toDisplayName(d.name),
    branch: [],
    sessions,
    cutoffs: [],
    averageGrades: { صباحي: null, مسائي: null },
    isDirectAdmission: true,
    admissionStatus: statedMinimumGrade ? "published" : "noPublishedCutoff",
    statedMinimumGrade,
    tuitionFees: {
      صباحي: typeof d.morningFee === "number" ? d.morningFee : null,
      مسائي: typeof d.eveningFee === "number" ? d.eveningFee : null,
    },
    admissionSuspended: !!d.suspended,
    note: d.gradeNote || d.note || null,
  };
}

function makeManualDepartment(m) {
  return {
    name: m,
    displayName: toDisplayName(m),
    branch: [],
    sessions: ["صباحي"],
    cutoffs: [],
    averageGrades: { صباحي: null, مسائي: null },
    isDirectAdmission: true,
    admissionStatus: "noPublishedCutoff",
    statedMinimumGrade: null,
    tuitionFees: { صباحي: null, مسائي: null },
    admissionSuspended: false,
    note: null,
  };
}

const privateFinal = privateUnis.map((p) => {
  const guideColleges = privateDepartmentsGuide[p.id];
  const takenPrivateIds = new Set();
  const colleges =
    guideColleges && guideColleges.length
      ? guideColleges.map((c) => ({
          id: stableCollegeId(p.id, c.collegeName, takenPrivateIds),
          name: c.collegeName,
          displayName: toDisplayName(c.collegeName),
          nameEn: null,
          departments: c.departments.map(buildPrivateDepartment),
        }))
      : [];

  // بعض الأسطر في دليل الأجور تعذّر تحليلها بأمان (أُسقطت عمداً بدل عرضها
  // مشوَّهة، انظر scripts/match-private-universities.js) -- فقد يكون بعض
  // الجامعات الموثَّقة يدوياً سابقاً بقائمة "majors" أغنى مما استخرجه
  // الدليل آلياً لها. ندمج أي تخصص يدوي غير مذكور اسمياً في نتيجة الدليل،
  // بدل استبدال البيانات الأدق بأخرى أفقر عرضاً عرضياً.
  // مطابقة مُطبَّعة (لا نصّية ساذجة) -- المقارنة السابقة (.replace(/\s+/g,""))
  // كانت تفوّت تكرارات حقيقية بسبب فساد "لام-ألف" الشائع في نص الدليل
  // المُستخرَج (مثال حقيقي: "طب االسنان" في جدول الدليل لا تُطابَق "طب
  // الأسنان" في data/private_universities.json نصّياً رغم كونهما نفس القسم)،
  // فيُضاف القسم مرتين: مرة بأجر حقيقي (اسم مشوَّه من الدليل)، ومرة بأجر
  // فارغ بالكامل (اسم صحيح من القائمة اليدوية الاحتياطية). راجع
  // data/admission_rules.md §41 للتوثيق الكامل والحالات المؤكَّدة (12 صفاً
  // عبر 6 جامعات) التي أصلحها هذا التغيير تحديداً.
  const guideDeptNames = new Set(
    colleges.flatMap((c) => c.departments.map((d) => normalizeForDedupMatch(d.displayName ?? d.name)))
  );
  const extraManualMajors = (p.majors || []).filter((m) => !guideDeptNames.has(normalizeForDedupMatch(m)));
  if (extraManualMajors.length) {
    colleges.push({
      id: `${p.id}_col_manual`,
      name: "برامج القبول المباشر",
      nameEn: null,
      departments: extraManualMajors.map(makeManualDepartment),
    });
  }
  if (!colleges.length) {
    colleges.push({
      id: `${p.id}_col_1`,
      name: "برامج القبول المباشر",
      nameEn: null,
      departments: [],
    });
  }
  return {
    id: p.id,
    name: p.name,
    nameEn: null,
    type: "أهلية",
    province: p.province || null,
    founded: p.founded || null,
    website: p.website || null,
    ranking: null,
    colleges,
  };
});

const privateWithDepts = privateFinal.filter((u) =>
  u.colleges.some((c) => c.name !== "برامج القبول المباشر" || c.departments.length > 0)
).length;

const out = {
  meta: {
    lastUpdated: new Date().toISOString().slice(0, 10),
    source:
      "دليل الطالب للسنة الدراسية 2025-2026 + الحدود الدنيا للقبول المركزي (القناة العامة) + دليل الجامعات والكليات الأهلية والأجور الدراسية 2025-2026 - وزارة التعليم العالي والبحث العلمي العراقية",
    sourceFiles: [
      "dalel_2025_22026.pdf",
      "الحدودالدنياالقبول-المركزي-القناةالعامة__للسنة_الدراسية_2025-2026.pdf",
      "2411202502.pdf (دليل الجامعات والكليات الأهلية والأجور الدراسية)",
    ],
    // يمثّل دليل الطالب صراحةً (أقرب معانيه الأصلية) -- مُشتقّ من SOURCES لا
    // مُصلَّب هنا، كي لا يتباعد عن سنة الوثيقة الفعلية المُتحقَّق منها في
    // scripts/admissionSources.js (انظر data/admission_rules.md §24).
    academicYear: SOURCES.studentGuide.year,
    // سنة/وثيقة الحدود الدنيا تحديداً -- هذا وحده ما يجب أن يستنِد إليه أي
    // عرض لرقم averagePercent/averageGrades (lib/admissionDisclosure.ts)،
    // منفصل عمداً عن academicYear (دليل الطالب) لأنهما وثيقتان مختلفتان قد
    // لا تحملان نفس السنة مستقبلاً حتى لو تطابقتا اليوم.
    cutoffsSourceYear: SOURCES.cutoffs.year,
    cutoffsSourceDocument: SOURCES.cutoffs.document,
    // قواعد المسائي (data/evening-rules.json): السنة المعروضة وحالتها ونص التنبيه للطالب
    eveningRules: (() => {
      const r = require(path.join(ROOT, "data/evening-rules.json"));
      const y = r.years[r._meta.currentYear];
      return {
        year: r._meta.currentYear,
        status: y.status,
        label: y.statusLabel,
        note: y.statusNote,
        fallbackYear: r._meta.fallbackYear,
      };
    })(),
    version: "4.0.0",
    notes: `يغطي الجامعات الحكومية والتقنية المشمولة بالقبول المركزي (36 جامعة، مع أقسام إضافية من الفصل 3 لبرامج القبول المباشر غير التنافسي) + ${privateFinal.length} جامعة وكلية أهلية معتمدة رسمياً (كليات/أقسام/أجور دراسية حقيقية متاحة لـ${privateWithDepts} منها، مستخرجة من دليل الوزارة الرسمي لأجور الجامعات الأهلية 2025-2026؛ الباقي بلا تفاصيل أقسام بعد). لا يشمل: (أ) جامعات إقليم كردستان (نظام قبول إقليمي منفصل تماماً، الفصل الخامس من الدليل تالف النص بشدة)، (ب) معاهد خريجي الفروع المهنية (الفصل 3، القسم ج-2 -- يشترط شهادات مهنية سابقة، فئة طلاب مختلفة عن نطاق هذه المنصة). التفاصيل الكاملة والمصادر في data/admission_rules.md.`,
  },
  universities: [...finalUniversities, ...privateFinal],
};

const OUT = path.join(ROOT, "data/universities.json");
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

// تعارضات «حد كلية بفرع لا يقبله أي قسم فيها بحسب جدول فروع الدليل» -- للمراجعة البشرية
fs.mkdirSync(path.join(ROOT, "reports/admission-fix"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "reports/admission-fix/guide-cutoff-conflicts.json"),
  JSON.stringify(GUIDE_CONFLICTS, null, 2) + "\n",
  "utf8"
);
console.log("Guide/cutoff branch conflicts (kept, flagged):", GUIDE_CONFLICTS.length);
fs.writeFileSync(
  path.join(ROOT, "reports/admission-fix/completion/track-assignments.json"),
  JSON.stringify(TRACK_ASSIGNMENTS, null, 1) + "\n",
  "utf8"
);
console.log("Departments given a track cutoff:", TRACK_ASSIGNMENTS.length);
fs.writeFileSync(
  path.join(ROOT, "reports/admission-fix/college-cutoff-partial-assignments.json"),
  JSON.stringify(COLLEGE_PARTIAL_ASSIGNMENTS, null, 2) + "\n",
  "utf8"
);
console.log("Departments given a college cutoff for a branch without own cutoff:", COLLEGE_PARTIAL_ASSIGNMENTS.length);

// Small derived file (province names only) so client components that just
// need a province dropdown (e.g. app/quiz/page.tsx) don't have to import
// the entire multi-megabyte universities.json into their JS bundle.
const provinces = Array.from(new Set(out.universities.map((u) => u.province))).sort((a, b) => a.localeCompare(b, "ar"));
fs.writeFileSync(path.join(ROOT, "data/provinces.json"), JSON.stringify(provinces, null, 2) + "\n", "utf8");

const totalColleges = finalUniversities.reduce((s, u) => s + u.colleges.length, 0);
const totalDepts = finalUniversities.reduce(
  (s, u) => s + u.colleges.reduce((s2, c) => s2 + c.departments.length, 0),
  0
);
console.log("Wrote", OUT);
console.log(
  "Government/technical universities:",
  finalUniversities.length,
  "| colleges:",
  totalColleges,
  "| departments:",
  totalDepts
);
console.log("Private universities:", privateFinal.length);
