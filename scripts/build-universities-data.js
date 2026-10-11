// Builds the canonical data/universities.json from the extracted cutoffs
// + evening-study raw data (data/raw/*.json), restricted to universities
// that are verifiably real and sourced from the official 2025-2026 guide,
// plus the existing curated data/private_universities.json.
//
// Run after scripts/extract-pdf-text.js, scripts/parse-cutoffs.js and
// scripts/parse-evening-study.js (or all at once via `npm run rebuild-data`).
const fs = require("fs");
const path = require("path");
const { toDisplayName, normalizeForDedupMatch } = require("./displayName");
const { parseStatedMinimum } = require("./departmentNameHealth");
const { normalizeDepartmentKey } = require("./departmentNormalizer");
const SOURCES = require("./admissionSources");
const { createGuideLookup } = require("./guideBranches");

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

function eveningMinGradeFor(collegeName) {
  const c = collegeName || "";
  if (/تمريض/.test(c)) return 70;
  if (/بيطري/.test(c)) return 65;
  if (/تقنيات طبية|تقنيات صحية|طبية والصحية|صحية والطبية/.test(c)) return 75;
  if (/هندسة|الهندسة/.test(c) && !/تقنيات هندسية|تقنية هندسية/.test(c)) return 65;
  if (/تقنيات هندسية|تقنية هندسية|كلية تقنية/.test(c)) return 60;
  if (/علوم|حاسوب|تكنولوجيا المعلومات/.test(c)) return 60;
  if (/قانون|حقوق/.test(c)) return 65;
  if (/سياسية|ادارة|اقتصاد|إدارة/.test(c)) return 60;
  if (/تربية البدنية|علوم الرياضة/.test(c)) return 56; // avg of 57(m)/55(f); refine per-gender in UI if needed
  return 58;
}

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
// نفس قائمة أسماء المدن/الأقضية المستخدمة في scripts/parse-cutoffs.js
// (يجب إبقاؤهما متطابقتين يدوياً -- لا استيراد مشترك بين السكربتين حالياً)
// + أسماء ظهرت إضافياً في مصدر الدراسة المسائية تحديداً. تُستخدَم هنا
// لمنع دمج كليتين لهما نفس الاسم لكن في فرعين/مدينتين مختلفتين فعلياً
// (اكتُشف بتحقق لاحق: "الكلية التقنية الصحية والطبية" اسم مُكرَّر شرعياً
// لعدة معاهد حقيقية مختلفة في مدن مختلفة -- دمجها كان سيُخفي حداً حقيقياً
// منفصلاً لكل فرع، عكس حالة "الكلية X/تخصصات فرعية" حيث اللاحقة تصف تخصصاً
// فرعياً لا موقعاً جغرافياً، فالدمج هناك صحيح).
const CAMPUS_QUALIFIERS = new Set([
  "بغداد",
  "البصرة",
  "الموصل",
  "بابل",
  "الكوفة",
  "نينوى",
  "هيت",
  "حديثة",
  "بلد",
  "القرنة",
  "الرصافة",
  "المسيب",
  "العزيزية",
  "الشرقاط",
  "الطارمية",
  "المقدادية",
  "سوق الشيوخ",
  "القائم",
  "طوزخورماتو",
  "الدواية",
  "بعقوبة",
  "جلولاء",
  "كربالء",
  "النجف",
  "كركوك",
  "الناصرية",
  "العمارة",
  "الحلة",
]);

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
      eveningMinGrade: null,
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
function resolveEveningCollege(uni, row) {
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
  const dept = getDept(college, resolvedDept, row.college);
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
  const grade = eveningMinGradeFor(row.college);
  if (dept.eveningMinGrade === null || grade < dept.eveningMinGrade) dept.eveningMinGrade = grade;
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
      d.sessions.add("صباحي");
    });
    college.departmentsMap.delete("__COLLEGE_LEVEL__");
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

// إصلاح فجوة بيانات حقيقية (اكتُشفت بتدقيق اكتمال شامل، 2026-07-22): 202 قسم
// (من أصل 1838) لا يُسند لها أي فرع (branch: []) لأنها تُقرأ حصراً من جدول
// الدراسة المسائية (الفصل الرابع، قائمة أهلية بلا عمود فرع إطلاقاً) بلا أي
// صف حدود دنيا صباحي أو إضافة فصل 3 يرافقها لتزويدها بفرع. القاعدة الرسمية
// (انظر §5 أدناه في admission_rules.md): "تسري عليها نفس التخصصات المعتمدة
// مركزياً في نفس الكلية" -- فنستدل الفرع بأولوية:
// (أ) اتفاق تام بين كل الأقسام الشقيقة الحقيقية (بيانات صباحي فعلية) في نفس
//     الكلية -- استدلال مباشر من بيانات رسمية حقيقية لنفس المؤسسة، لا تخمين.
// (ب) تصنيف عام حسب نوع القسم/الكلية عند غياب/تعارض بيانات الأشقاء، مبني على
//     نمط الأقسام الشقيقة المُتحقَّق منه فعلياً عبر عشرات الكليات المشابهة
//     (المعاهد/الكليات التقنية تقبل علمي حصراً إلا مسارات الإدارة/المحاسبة/
//     القانون/التسويق/التأمين التقنية التي تقبل أدبي أيضاً؛ التربية البدنية
//     تقبل الفروع الثلاثة؛ الفنون/التصميم تقبل فنون+أدبي+علمي؛ العلوم
//     التربوية/الإنسانية في كليات التربية تقبل أدبي+علمي).
// هذه قاعدة استدلالية موثَّقة صراحة (كجدول حدود المسائي نفسه)، وليست بيانات
// مستخرجة حرفياً -- إن ظهر لاحقاً نص رسمي يخصّ فرعاً بعينه لقسم معيّن هنا
// فهو الأولوية ويجب أن يُصحِّح هذا التخمين.
function classifyFallbackBranch(collegeName, deptName) {
  const s = `${collegeName} ${deptName}`;
  if (/فنون|تصميم|خزف|صياغة والمجوهرات/.test(s)) return ["فنون", "أدبي", "علمي"];
  if (/تربية البدنية|علوم الرياضة/.test(collegeName)) return ["علمي", "أدبي", "فنون"];
  if (
    /ادارة|محاسبة|قانونية|مالية والمصرفية|تسويق|تأمين|ادارة المكتب|ادارة المواد|ادارة الاعمال|ادارة المستشفيات|الادارة الصحية/.test(
      deptName
    )
  )
    return ["علمي", "أدبي"];
  if (
    /تاريخ|تاريد|علوم القران|التربية االسالمية|ارشاد نفسي|تربوية والنفسية|تربوية ونفسية|اللغة التركية|اللغة االنكليزية|اللغة الانكليزية/.test(
      deptName
    )
  )
    return ["أدبي", "علمي"];
  return ["علمي"];
}
for (const u of universities) {
  for (const college of u._collegesMap.values()) {
    const entries = [...college.departmentsMap.entries()];
    const gapDepts = entries.filter(
      ([key, d]) => key !== "__COLLEGE_LEVEL__" && d.cutoffs.length === 0 && d.directBranches.size === 0
    );
    if (gapDepts.length === 0) continue;
    const siblingBranchSets = new Set(
      entries
        .filter(([key, d]) => key !== "__COLLEGE_LEVEL__" && (d.cutoffs.length > 0 || d.directBranches.size > 0))
        .map(([, d]) => [...new Set([...d.cutoffs.map((c) => c.branch), ...d.directBranches])].sort().join(","))
    );
    gapDepts.forEach(([, d]) => {
      // جدول فروع الدليل الرسمي أولاً (نص صريح)، ثم الاستدلال من الأشقاء، ثم التصنيف العام
      // (مثال: بوليتكنك بغداد/التصميم الداخلي: الدليل علمي/أدبي، والتصنيف العام كان يضيف فنون).
      const guide = guideBranchesFor(u, college.name, d.name);
      const inferred = guide
        ? [...guide]
        : siblingBranchSets.size === 1
          ? [...siblingBranchSets][0].split(",")
          : classifyFallbackBranch(college.name, d.name);
      inferred.forEach((b) => d.directBranches.add(b));
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
      if (
        remDept.eveningMinGrade !== null &&
        (keepDept.eveningMinGrade === null || remDept.eveningMinGrade < keepDept.eveningMinGrade)
      ) {
        keepDept.eveningMinGrade = remDept.eveningMinGrade;
      }
      college.departmentsMap.delete(remove);
    }
  }
}

const finalUniversities = universities.map((u) => {
  const colleges = [...u._collegesMap.values()].map((c, cIdx) => {
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

      const hasAnyCutoff = bestMorning !== null || d.eveningMinGrade !== null;
      const admissionStatus = hasAnyCutoff ? "published" : "noPublishedCutoff";

      return {
        name: d.name,
        displayName: toDisplayName(d.name),
        branch: branches,
        sessions: [...d.sessions],
        cutoffs: d.cutoffs,
        averageGrades: { صباحي: bestMorning, مسائي: d.eveningMinGrade },
        morningByBranch,
        isDirectAdmission: false, // لا يوجد قبول مباشر في أي قسم حكومي إطلاقاً
        admissionStatus,
      };
    });
    return {
      id: `${u.id}_col_${cIdx + 1}`,
      name: c.name,
      displayName: toDisplayName(c.name),
      nameEn: null,
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
  const colleges =
    guideColleges && guideColleges.length
      ? guideColleges.map((c, cIdx) => ({
          id: `${p.id}_col_${cIdx + 1}`,
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
