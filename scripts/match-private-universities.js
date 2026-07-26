// يطابق الجامعات المُستخرَجة من دليل الجامعات الأهلية الرسمي (2411202502.pdf)
// مع قائمة data/private_universities.json الموثوقة (76 مؤسسة، مصدرها دليل
// وزارة التعليم العالي الرسمي المباشر mohesr.gov.iq)، لإنتاج ملف أقسام/أجور
// جاهز للدمج في data/universities.json عبر build-universities-data.js.
const fs = require("fs");
const path = require("path");
const { parseFullGuide } = require("./parse-private-universities-guide");

const ROOT = path.join(__dirname, "..");

function normalizeName(s) {
  return s
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, "")
    .replace(/(الاهليه|اهليه|الجامعه|جامعه|الكليه|كليه|معهد|المعهد)/g, "")
    .trim();
}

// تصحيحات يدوية لأخطاء تفتيت نص طفيفة (حرف واحد مفقود/مبدَّل) أعجزت
// المطابقة التلقائية عن حل الفروقات، مبنية على مراجعة يدوية لقائمة عدم
// التطابق مقابل فهرس الدليل الرسمي الكامل (رقم الجامعة في الدليل -> id).
const MANUAL_OVERRIDES = {
  // اسمها الرسمي الحالي في الدليل "جامعة العلوم العراقية"، مذكور صراحة كاسم
  // سابق لها "كلية بغداد للعلوم الاقتصادية" (id الحالي في قاعدة بياناتنا)
  8: "baghdad_economics",
  12: "islamic_najaf",
  35: "mazaya", // الدليل: "مزايا"، قاعدة بياناتنا: "المزايا" (أل تعريف فقط)
  14: "salam",
  17: "tusi",
  18: "sadiq",
  28: "usul_aldeen",
  29: "esraa",
  44: "bilad_alrafidain",
  51: "warith_alanbiya",
  52: "alameen",
  62: "auib",
  67: "sawa",
  68: "amal_medical",
  72: "nibras",
  46: "amal_college", // اكتُشف بعد إصلاح تخصيص FIFO للجداول (كان يبدو بلا جدول خطأً)
  57: "middle_east_college", // نفس السبب
};

// مؤسسات موجودة فعلياً في فهرس الدليل الرسمي (84 مؤسسة) لكنها غائبة عن
// data/private_universities.json (76 مؤسسة) -- اكتُشفت أثناء هذه المطابقة،
// تُضاف الآن بأسمائها/محافظاتها/سنة تأسيسها كما وردت في الدليل نفسه.
const MISSING_INSTITUTIONS = {
  26: { id: "hadara", name: "كلية الحضارة الجامعة", website: null },
  47: { id: "farqadain", name: "جامعة الفرقدين", website: null },
  59: { id: "idrisi", name: "كلية الإدريسي الجامعة", website: null },
  76: { id: "furqan", name: "جامعة الفرقان", website: null },
  80: { id: "multaqa_alnahrain", name: "كلية ملتقى النهرين", website: null },
  82: { id: "warka", name: "كلية الوركاء", website: null },
  74: { id: "somo", name: "جامعة سومو", website: null },
  75: { id: "baba_gurgur", name: "جامعة بابا كركر", website: null },
};

// جامعة مدينة العلم (#16): ترويستها في المصدر مضغوطة جداً ("مدينه العلم
// بغداد" بلا "N - .. / تأسست سنة") فلا يلتقطها HEADER_RE إطلاقاً -- نُقلت
// يدوياً من نص خام أرسله المستخدم مباشرة من نفس الدليل الرسمي (تحقق مقابل
// النص: صفحة 26، بعد جدول جامعة الشيخ الطوسي مباشرة).
const MANUAL_DEPARTMENT_SUPPLEMENTS = {
  madinat_alilm: [
    {
      collegeName: "الكلية التقنية الطبية و الصحية",
      departments: [
        {
          name: "تقنيات التجميل والليزر",
          morningFee: 1400000,
          eveningFee: 1500000,
          suspended: false,
          note: null,
          gradeNote: null,
        },
        {
          name: "تقنيات الأشعة",
          morningFee: 1750000,
          eveningFee: null,
          suspended: false,
          note: "لا توجد دراسة مسائية",
          gradeNote: null,
        },
        {
          name: "تقنيات التخدير",
          morningFee: 1750000,
          eveningFee: null,
          suspended: false,
          note: "لا توجد دراسة مسائية",
          gradeNote: null,
        },
      ],
    },
    {
      collegeName: "الكلية التقنية الهندسية",
      departments: [
        {
          name: "هندسة تقنيات الحاسبات",
          morningFee: 1750000,
          eveningFee: 1800000,
          suspended: false,
          note: null,
          gradeNote: null,
        },
        {
          name: "تقنيات الهندسة الكهربائية",
          morningFee: 1750000,
          eveningFee: null,
          suspended: false,
          note: "لا توجد دراسة مسائية",
          gradeNote: null,
        },
        {
          name: "هندسة تقنيات الأمن السيبراني",
          morningFee: 1750000,
          eveningFee: null,
          suspended: false,
          note: "لا توجد دراسة مسائية",
          gradeNote: null,
        },
      ],
    },
    {
      collegeName: "كلية القانون",
      departments: [
        { name: "القانون", morningFee: 1400000, eveningFee: 1400000, suspended: false, note: null, gradeNote: null },
      ],
    },
    {
      collegeName: "كلية العلوم الإدارية و المالية",
      departments: [
        {
          name: "إدارة الأعمال",
          morningFee: 1500000,
          eveningFee: 1500000,
          suspended: false,
          note: null,
          gradeNote: null,
        },
        {
          name: "المحاسبة",
          morningFee: 1500000,
          eveningFee: null,
          suspended: false,
          note: "لا توجد دراسة مسائية",
          gradeNote: null,
        },
      ],
    },
    {
      collegeName: "كلية التربية",
      departments: [
        {
          name: "التربية البدنية و علوم الرياضة",
          morningFee: 1250000,
          eveningFee: 1250000,
          suspended: false,
          note: null,
          gradeNote: null,
        },
        {
          name: "اللغة الانكليزية",
          morningFee: 1600000,
          eveningFee: 1750000,
          suspended: false,
          note: null,
          gradeNote: null,
        },
        {
          name: "علوم القرآن والتربية الاسلامية",
          morningFee: 1400000,
          eveningFee: 1400000,
          suspended: false,
          note: null,
          gradeNote: null,
        },
        {
          name: "التربية الفنية",
          morningFee: 1250000,
          eveningFee: null,
          suspended: false,
          note: "لا توجد دراسة مسائية",
          gradeNote: null,
        },
      ],
    },
    {
      collegeName: "كلية الآداب",
      departments: [
        {
          name: "علم النفس السريري",
          morningFee: 1600000,
          eveningFee: 1750000,
          suspended: false,
          note: null,
          gradeNote: null,
        },
      ],
    },
  ],
};

function main() {
  const privateUnis = require(path.join(ROOT, "data/private_universities.json"));
  const parsed = parseFullGuide();

  const newInstitutions = [];
  for (const [srcNum, info] of Object.entries(MISSING_INSTITUTIONS)) {
    const src = parsed.find((u) => u.sourceNum === srcNum);
    if (!src) continue;
    newInstitutions.push({
      id: info.id,
      name: info.name,
      province: (src.province || "").replace(/\s+/g, " ").trim() || null,
      founded: src.founded || null,
      website: info.website,
      majors: [],
    });
  }
  if (newInstitutions.length) {
    fs.writeFileSync(
      path.join(ROOT, "data/raw/private_universities_new_entries.json"),
      JSON.stringify(newInstitutions, null, 2),
      "utf8"
    );
    console.log(`مؤسسات جديدة اكتُشفت وغير موجودة في private_universities.json (${newInstitutions.length}):`);
    newInstitutions.forEach((n) => console.log(`  ${n.id}: ${n.name} (${n.province}, ${n.founded})`));
  }

  const allKnown = [...privateUnis, ...newInstitutions];
  const byId = new Map(allKnown.map((p) => [p.id, p]));
  const byNorm = new Map();
  for (const p of allKnown) {
    const n = normalizeName(p.name);
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n).push(p);
  }

  const merged = {}; // id -> { collegesMap: Map<collegeName, departments[]> }
  const unmatched = [];

  for (const u of parsed) {
    let match = MANUAL_OVERRIDES[u.sourceNum] ? byId.get(MANUAL_OVERRIDES[u.sourceNum]) : null;
    if (!match) match = byId.get(MISSING_INSTITUTIONS[u.sourceNum]?.id);
    if (!match) {
      const norm = normalizeName(u.name);
      match = byNorm.get(norm)?.[0];
      if (!match) {
        // مطابقة جزئية: بادئة مشتركة بعد التطبيع (يلتقط فروقاً بسيطة مثل
        // "جامعة العين" مقابل "جامعة العين العراقية"). قصداً "بادئة" لا
        // "احتواء في أي موضع" -- الاحتواء العام كان يُطابق خطأً أسماء
        // قصيرة عامة الصياغة (مثال: "العراق" داخل "العينالعراقية" طابقت
        // خطأً "كلية العراق الجامعة" بدل "جامعة العين العراقية" الصحيحة).
        for (const [key, list] of byNorm) {
          if (key.length >= 4 && (norm.startsWith(key) || key.startsWith(norm))) {
            match = list[0];
            break;
          }
        }
      }
    }
    if (!match) {
      unmatched.push({ sourceNum: u.sourceNum, name: u.name, province: u.province });
      continue;
    }
    if (!merged[match.id]) merged[match.id] = { collegesMap: new Map(), matchedNames: [], seenRows: new Set() };
    merged[match.id].matchedNames.push(u.name);
    for (const d of u.departments) {
      // بعض الجامعات (سومو مثلاً) يتكرر جدولها بالكامل حرفياً مرتين في
      // المستند المصدر نفسه (خلل طباعة في الدليل الرسمي، وليس خطأ استخراج)
      // -- نُسقط أي صف مطابق تماماً (كلية+قسم+الأجرين) ظهر من قبل لنفس الجامعة.
      const dedupeKey = `${d.college || ""}|${d.name}|${d.morningFee}|${d.eveningFee}|${d.suspended}`;
      if (merged[match.id].seenRows.has(dedupeKey)) continue;
      merged[match.id].seenRows.add(dedupeKey);

      // شبكة أمان: صف بلا مرسى أجر واضح (مقاطع نص غير مُحلَّلة تسربت
      // كاسم قسم) يُسقَط بدل عرضه للطالب مشوَّهاً -- علامتاه: اسم طويل
      // بشكل غير طبيعي، أو احتواؤه أرقاماً (أرقام صفوف/أجور لم تُميَّز).
      if (d.name.length > 45 || /\d/.test(d.name)) continue;

      const collegeName = d.college || "برامج القبول المباشر";
      if (!merged[match.id].collegesMap.has(collegeName)) {
        merged[match.id].collegesMap.set(collegeName, []);
      }
      merged[match.id].collegesMap.get(collegeName).push({
        name: d.name,
        morningFee: d.morningFee,
        eveningFee: d.eveningFee,
        suspended: d.suspended,
        note: d.note,
        gradeNote: d.gradeNote,
      });
    }
  }

  const out = {};
  for (const [id, data] of Object.entries(merged)) {
    out[id] = [...data.collegesMap.entries()].map(([collegeName, departments]) => ({
      collegeName,
      departments,
    }));
  }
  // ملحقات يدوية لمؤسسات تعذّر التقاط ترويستها آلياً (صيغة غير معتادة في
  // المصدر) -- نُقلت يدوياً من نص خام تحقّق منه المستخدم مباشرة مقابل نفس
  // الدليل الرسمي. تُدمَج هنا كي تبقى بعد أي إعادة تشغيل للمحلّل الآلي.
  for (const [id, colleges] of Object.entries(MANUAL_DEPARTMENT_SUPPLEMENTS)) {
    if (!out[id] || !out[id].length) out[id] = colleges;
  }

  fs.writeFileSync(
    path.join(ROOT, "data/raw/private_universities_departments.json"),
    JSON.stringify(out, null, 2),
    "utf8"
  );

  const totalDepts = Object.values(out).reduce(
    (s, cols) => s + cols.reduce((s2, c) => s2 + c.departments.length, 0),
    0
  );
  console.log(
    `تمت مطابقة ${Object.keys(out).length} جامعة من أصل ${privateUnis.length} (${totalDepts} صف قسم إجمالاً).`
  );
  console.log(`غير مُطابق (${unmatched.length}):`);
  unmatched.forEach((u) => console.log(`  #${u.sourceNum} ${u.name} (${u.province})`));
}

if (require.main === module) main();
module.exports = { normalizeName };
