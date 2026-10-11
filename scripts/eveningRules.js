// حدود التقديم وسقوف الأجور للدراسة المسائية الحكومية: يربط كل قسم بصفّه في data/evening-rules.json.
// مصدر واحد يستعمله البناء (build-universities-data.js) والتدقيق (admission-fix/audit-evening.js).
//
// الترتيب: صف السنة الحالية (2026-2027) لنوع الكلية، وإلا قاعدة دليل 2025-2026 (basis=official-2025).
// المعاهد وكليات البوليتكنك والكليات التقنية متعددة المسارات تُصنَّف بمسار القسم (طبي/هندسي-تكنولوجي/
// إداري/زراعي/فنون تطبيقية) لأن جدول الوزارة يحدّد الحد بالمسار. البوليتكنك يأخذ صف المعاهد لمساره
// (basis=inferred-polytechnic): الدليل يُلحق سنتيه الأوليين بالمعاهد في الأجور (dalel.full.txt:3563).
const fs = require("fs");
const path = require("path");
const { fixLamAlef } = require("./displayName");

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "evening-rules.json"), "utf8"));
const CURRENT = RULES._meta.currentYear;
const FALLBACK = RULES._meta.fallbackYear;
const BRANCHES = ["علمي", "أدبي", "فنون"];

// الهمزات تُطبَّع أولاً ثم يُصلح انعكاس "لا" ("األساسية" → "االساسية" → "الاساسية"، "اآلداب" → "الاداب")
const norm = (s) =>
  fixLamAlef((s || "").replace(/[أإآ]/g, "ا"))
    .replace(/([ون])\1{2,}/g, "")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();

// مسار القسم من اسمه (للمعاهد والبوليتكنك والكليات التقنية العامة)
function trackOf(deptName) {
  const d = norm(deptName);
  if (/فنون التطبيقية|فنون تطبيقية|تصميم|خزف|صياغة|ديكور|ازياء|اقمشة|اعلان|زخرفة|تزيين/.test(d)) return "applied_arts";
  if (/زراع|انتاج النباتي|انتاج الحيواني|انتاج نباتي|انتاج حيواني|اراضي|بستنة|وقاية النبات|مكننة|غابات|ري /.test(d))
    return "agri";
  if (
    /تمريض|مختبرات|صيدل|تخدير|اشعة|اسنان|بصر|بصريات|طوارئ|اسعاف|علاج|تاهيل|صحة|صحي|صحية|طبي|ادلة|جنائي|سمع|اطراف|تغذية|الكلية الصناعية|كلى|مساند/.test(
      d
    )
  )
    return "medical";
  if (/محاسب|ادار|مالي|مصرف|تامين|سياح|فندق|تسويق|مكتب|اقتصاد|قانون|اعمال|احصاء|مواد/.test(d)) return "admin";
  return "tech";
}

// نوع الكلية ← معرّف صف جدول 2026-2027 (أو null حين يُحسم بالمسار)
function collegeKind(collegeName, deptName) {
  const c = norm((collegeName || "").split("/")[0]);
  const has = (re) => re.test(c);
  const isInstitute = has(/(^|\s)(معهد|المعهد)(\s|$)/);
  if (isInstitute) {
    if (has(/اعداد المدربين/)) return { kind: "trainers_inst" };
    if (has(/الطبي|الطبية/)) return { kind: "inst_medical" };
    if (has(/الادارة|الاداري/)) return { kind: "inst_admin" };
    if (has(/الفنون التطبيقية/)) return { kind: "inst_applied_arts" };
    if (has(/التكنلوجيا|التكنولوجيا|التكنولوجي|التكنلوجي/)) return { kind: "inst_tech" };
    const t = trackOf(deptName);
    return {
      kind: {
        medical: "inst_medical",
        admin: "inst_admin",
        agri: "inst_agri",
        applied_arts: "inst_applied_arts",
        tech: "inst_tech",
      }[t],
    };
  }
  if (has(/بوليتكنك/)) {
    const t = trackOf(deptName);
    return {
      kind: {
        medical: "inst_medical",
        admin: "inst_admin",
        agri: "inst_agri",
        applied_arts: "inst_applied_arts",
        tech: "inst_tech",
      }[t],
      basis: "inferred-polytechnic",
    };
  }
  // "كلية التقنيات الاحيائية" كلية علمية (صف علوم الحاسوب… / التقنيات الأحيائية) لا كلية تقنية
  if (has(/التقنيات الاحيائية/)) return { kind: "cs_it" };
  // الكليات التقنية
  if (has(/الصحية والطبية|الطبية والصحية|التقنيات الصحية|الاقسام الطبية|التاهيل الطبي/)) return { kind: "tech_health" };
  if (has(/الكلية التقنية الهندسية|الاقسام الهندسية|هندسة تقنيات/)) return { kind: "tech_eng" };
  if (has(/الكلية التقنية الزراعية|الاقسام الزراعية/)) return { kind: "tech_agri" };
  if (has(/الكلية التقنية الادارية|الاقسام الادارية/)) return { kind: "tech_admin" };
  if (has(/الفنون التطبيقية/)) return { kind: "applied_arts_college" };
  if (has(/الكلية التقنية|كلية التقنيات/)) {
    const t = trackOf(deptName);
    return {
      kind: {
        medical: "tech_health",
        admin: "tech_admin",
        agri: "tech_agri",
        applied_arts: "applied_arts_college",
        tech: "tech_eng",
      }[t],
    };
  }
  // الكليات غير التقنية
  if (has(/الادارة الصناعية للنفط/)) return { kind: "oil_gas_admin" };
  if (has(/تمريض/)) return { kind: "nursing" };
  if (has(/بيطري/)) return { kind: "vet" };
  if (has(/علوم الهندسة الزراعية|الزراعة|النباتات الطبية/)) return { kind: "agriculture" };
  if (has(/(^|\s)(ال)?هندسة(\s|$)/)) return { kind: "engineering" };
  if (has(/قانون|القانون|حقوق|الحقوق/))
    return has(/سياسية/) ? { kind: "law", basis: "inferred-combined" } : { kind: "law" };
  if (has(/العلوم السياسية/)) return { kind: "political" };
  if (has(/معلوماتية|علوم الحاسوب|الحاسوب|تكنولوجيا المعلومات|التقنيات الاحيائية/)) return { kind: "cs_it" };
  if (has(/الادارة والاقتصاد|اقتصاديات|(^|\s)(كلية )?الادارة$/)) return { kind: "admin_econ" };
  if (has(/التقانات الاحيائية/)) return { kind: "biotech" };
  if (has(/علوم البحار/)) return { kind: "marine" };
  if (has(/علوم الاغذية/)) return { kind: "food_science" };
  if (has(/التحسس النائي/)) return { kind: "remote_sensing" };
  if (has(/التخطيط العمراني/)) return { kind: "urban_planning" };
  if (has(/العلوم البيئية|علوم البيئة|علوم الطاقة والبيئة/)) return { kind: "env_science" };
  if (has(/التربية البدنية|علوم الرياضة/)) return { kind: "physical_education" }; // غير موجود في جدول 2026-2027
  if (has(/التربية الاساسية/)) return { kind: "basic_education" };
  if (has(/(^|\s)(كلية )?التربية/)) return { kind: "education" };
  if (has(/اللغات/)) return { kind: "languages" };
  if (has(/الاداب/)) return { kind: "arts" };
  if (has(/السياحية/)) return { kind: "tourism" };
  if (has(/الاثار/)) return { kind: "archaeology" };
  if (has(/الاسلامية|الاسالمية|الفقه|اصول الدين|الدراسات الاسلامية/)) return { kind: "islamic" };
  if (has(/الاعلام|الاعالم/)) return { kind: "media" };
  if (has(/الفنون/)) return { kind: "fine_arts" };
  if (has(/(^|\s)(كلية )?(ال)?علوم/)) return { kind: "science" };
  return { kind: null };
}

// نوع الكلية ← فئة دليل 2025-2026 (احتياط)
const FALLBACK_OF = {
  nursing: "nursing",
  vet: "vet",
  tech_health: "tech_health",
  inst_medical: null,
  engineering: "engineering",
  tech_eng: "tech_eng",
  science: "science_cs",
  cs_it: "science_cs",
  env_science: "science_cs",
  biotech: "science_cs",
  marine: "science_cs",
  food_science: "science_cs",
  remote_sensing: "science_cs",
  law: "law",
  political: "political_admin",
  admin_econ: "political_admin",
  oil_gas_admin: "political_admin",
  physical_education: "physical_education",
};

// نوع الكلية ← سقف الأجور
function feeRowId(kind, collegeName, deptName) {
  const c = norm(collegeName);
  const d = norm(deptName);
  switch (kind) {
    case "engineering":
      return /نفط|معمار|العمارة|الطب الحياتي|طب حياتي/.test(`${c} ${d}`) ? "eng_special" : "eng_other";
    case "nursing":
      return "nursing";
    case "inst_medical":
      return "inst_medical";
    case "tech_health":
      return "tech_health_and_lab";
    case "tech_eng":
      return "tech_eng";
    case "science":
      return /تحليلات مرضية|التحليلات المرضية|احياء مجهرية|علوم الحياة/.test(d) || /الطبية التطبيقية/.test(c)
        ? "tech_health_and_lab"
        : "science";
    case "cs_it":
    case "env_science":
    case "biotech":
    case "marine":
    case "food_science":
    case "remote_sensing":
    case "urban_planning":
    case "agriculture":
    case "tech_agri":
      return "science";
    case "vet":
      return "vet"; // غير مذكور في جدول 2026-2027 ⇒ احتياط 2025-2026
    case "law":
    case "admin_econ":
    case "tech_admin":
    case "tourism":
    case "oil_gas_admin":
      return "law_admin_tourism";
    case "inst_tech":
    case "trainers_inst":
      return kind === "inst_tech" ? "inst_tech" : "inst_rest";
    case "inst_admin":
    case "inst_agri":
    case "inst_applied_arts":
      return "inst_rest";
    default:
      return "humanities"; // آداب، تربية، تربية أساسية، إعلام، فنون، آثار، علوم إسلامية، لغات، سياسية، بدنية
  }
}

function floorsFromRow(row) {
  return Object.fromEntries(BRANCHES.map((b) => [b, row.floors[b] ?? null]));
}

/**
 * حد التقديم المسائي وسقف الأجور لقسم حكومي.
 * @returns {{ year, status, kind, ruleId, basis, byBranch: Record<string, number|null>, note: string|null,
 *            fee: { cap: number, year: string, ruleId: string, basis: string } | null }}
 */
function resolveEvening(collegeName, deptName, deptBranches) {
  const { kind, basis: kindBasis } = collegeKind(collegeName, deptName);
  const cur = RULES.years[CURRENT];
  const fb = RULES.years[FALLBACK];
  const accepted = deptBranches && deptBranches.length ? new Set(deptBranches) : null;
  const restrict = (byBranch) =>
    accepted ? Object.fromEntries(BRANCHES.map((b) => [b, accepted.has(b) ? byBranch[b] : null])) : byBranch;

  let out;
  const row = kind && cur.floors.find((r) => r.id === kind);
  if (row) {
    out = {
      year: CURRENT,
      status: cur.status,
      kind,
      ruleId: row.id,
      basis: kindBasis || "table",
      byBranch: restrict(floorsFromRow(row)),
      note: null,
    };
  } else {
    // احتياط: قاعدة دليل 2025-2026 (رقم واحد لكل الفروع التي يقبلها القسم)
    const fbId = (kind && FALLBACK_OF[kind]) || "rest";
    const fr = fb.floors.find((r) => r.id === fbId);
    const value = fr.floor ?? Math.min(fr.floorMale, fr.floorFemale);
    const byBranch = Object.fromEntries(BRANCHES.map((b) => [b, !accepted || accepted.has(b) ? value : null]));
    out = {
      year: FALLBACK,
      status: fb.status,
      kind: kind || "unclassified",
      ruleId: fr.id,
      basis: kind ? "official-2025" : "official-2025-unclassified",
      byBranch,
      note: fr.floorMale != null ? `${fr.floorMale}% للذكور و${fr.floorFemale}% للإناث` : null,
    };
  }

  const feeId = feeRowId(kind, collegeName, deptName);
  const curFee = cur.fees.find((f) => f.id === feeId);
  const fbFee = fb.fees.find((f) => f.id === feeId) || fb.fees.find((f) => f.id === "humanities");
  out.fee = curFee
    ? { cap: curFee.cap, year: CURRENT, ruleId: curFee.id, basis: kind ? "table" : "unclassified" }
    : { cap: fbFee.cap, year: FALLBACK, ruleId: fbFee.id, basis: "official-2025" };
  return out;
}

module.exports = { resolveEvening, collegeKind, trackOf, RULES, CURRENT_EVENING_YEAR: CURRENT };
