// يستخرج جدول الكليات/الأقسام/الأجور الكامل من دليل الجامعات والكليات
// الأهلية الرسمي (2411202502.pdf، 123 صفحة). النص المُستخرَج عبر pdf-parse
// يحتوي تجزئة الكلمات بحروف تمديد عربية (tatweel: ـ) مُدرَجة كفواصل تبويب
// (Tab) مستقلة لأغراض التبرير البصري (Justification) في المستند الأصلي —
// هذا سكربت إعادة بناء نص نظيف من هذا التفتيت، مبني على ملاحظة تجريبية:
// أي فاصل تبويب/سطر تتوسطه حروف تمديد بحتة هو استمرار داخل نفس الكلمة
// (بلا مسافة)، وأي فاصل تبويب/سطر خالٍ من حروف التمديد بينه وبين ما يليه
// هو فاصل كلمات حقيقي (بمسافة). تم التحقق يدوياً من هذه القاعدة على عدة
// أسطر معروفة (عنوان "جامعة التراث" وجداول أقسامها) قبل تعميمها.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RAW_PATH = path.join(ROOT, "data/raw/private_universities_guide_raw.txt");

function stripTatweel(s) {
  return s.replace(/ـ+/g, "");
}

// يعيد بناء نص صفحة واحدة (مقطوعة أصلاً بفواصل "-- N of 123 --") إلى سلسلة
// نظيفة واحدة، بعد حذف رقم الصفحة المطبوع (أول سطر منفرد يحوي رقماً فقط).
function reconstructPage(pageChunk) {
  let text = pageChunk.replace(/^\s*\d{1,4}\s*\n/, "");
  const tokens = text.split(/[\t\n]+/);
  let out = "";
  let pendingBridge = false;
  for (const raw of tokens) {
    const stripped = stripTatweel(raw);
    if (stripped.trim() === "") {
      if (raw.trim() !== "") pendingBridge = true; // كان توكن تمديد بحت
      continue;
    }
    if (out === "") {
      out = stripped;
    } else if (pendingBridge) {
      out += stripped;
    } else {
      out += " " + stripped;
    }
    pendingBridge = false;
  }
  return out;
}

function loadReconstructedTablesText() {
  const raw = fs.readFileSync(RAW_PATH, "utf8");
  const pages = raw.split(/-- \d+ of 123 --/);
  // pages[0] فارغ قبل أول فاصل. صفحات الفهرس (TOC) تنتهي، وصفحات الجداول
  // الفعلية تبدأ من أول صفحة تحوي "تأسســـت سنـــة" (عنوان جامعة #1) —
  // ونتوقف عند قسم "معلومات الجامعات والكليات الاهلية" (page ~107).
  const reconstructed = pages.map((p) => reconstructPage(p));
  let startIdx = -1;
  let endIdx = reconstructed.length;
  for (let i = 0; i < reconstructed.length; i++) {
    // "9,110,000" هو أجر دراسة طب الأسنان الحقيقي لجامعة التراث -- لا يظهر
    // إطلاقاً في صفحات الفهرس (TOC)، فيُستخدم كعلامة موثوقة لبداية الجداول.
    if (startIdx === -1 && reconstructed[i].includes("9,110,000")) {
      startIdx = i;
    }
    if (reconstructed[i].includes("الجامعة / الكلية المعلومات")) {
      endIdx = i;
      break;
    }
  }
  if (startIdx === -1) throw new Error("تعذّر تحديد بداية جداول الجامعات في النص المُعاد بناؤه");
  return reconstructed.slice(startIdx, endIdx).join("\n");
}

// ────────────────────────────────────────────────────────────────────
// تجزئة الجداول: نص المستند يضع أحياناً عنوان الجامعة التالية في أعلى
// الصفحة قبل اكتمال جدول الجامعة السابقة (بقايا صفوف كليات تتجاوز فاصل
// الصفحة) -- لوحظ ذلك يدوياً في جامعة الرافدين/المأمون (صفحة 8-9 الأصلية:
// عنوان "4 - جامعة المأمون" يظهر قبل انتهاء صفوف كليات الرافدين 8-11).
// الحل: صف رأس الجدول "ت الكلية القسم اجور الدراسة..." هو العلامة
// الموثوقة الوحيدة لبداية جدول حقيقي جديد -- كل المحتوى بين رأسي جدولين
// متتاليين ملك للجامعة صاحبة الترويسة (N - الاسم / تأسست سنة) الأقرب
// التي تسبق رأس الجدول هذا تحديداً (وليس أقرب ترويسة تظهر أولاً في النص
// المسطّح، لأنها قد تكون ترويسة الجامعة التالية المُدرَجة مبكراً).
// سنة التأسيس عادةً بين قوسين "( 2013 )"، لكن حالة واحدة معروفة (كلية
// مزايا الجامعة، #35) وردت في المصدر بلا أقواس إطلاقاً -- الأقواس اختيارية.
const HEADER_RE = /(\d+)\s*-\s*(?!\s*[أ-ي]\s*:)([\s\S]{0,220}?)تأسس[\s\S]{0,10}?\(?\s*(\d{4})\s*\)?/g;
// بعض الجامعات (كالمنصور) تُدرج أقسامها كقائمة مسطّحة بلا عمود "الكلية"
// إطلاقاً -- فرأس الجدول عندها "ت القسم اجور الدراسة..." بلا "الكلية".
// الرأس الكامل سطران: "اجور الدراسة الصباحية" و"اجور الدراسـة المسائية"
// (يتكرر "اجور الدراسة" مرتين) -- يجب استهلاكهما معاً وإلا يتسرب نص
// "الصباحية اجور الدراسة المسائية" إلى بداية اسم أول قسم في كل جامعة.
//
// بعض التكرارات لهذا الرأس فيها مسافة عرضية زائدة داخل كلمة واحدة (أثر
// تفتيت الأحرف الأصلي، مثل "الدراس ة" بدل "الدراسة") -- رصدنا حالة حقيقية
// (رأس جدول كلية المنصور) فشل معها التطابق الصارم بصمت ودمج جدول الجامعة
// بأكمله في آخر كلية من الجامعة السابقة. الحل: مطابقة "فضفاضة" تسمح بأي
// عدد من الفراغات بين أي حرفين متتاليين في العبارة المستهدفة.
function loosePattern(phrase) {
  return phrase
    .split("")
    .map((ch) => (ch === " " ? "" : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("\\s*");
}
const TABLE_HEADER_RE = new RegExp(
  // "الكلية" أحياناً "االكلية" (ألف زائدة، أثر تفتيت أحرف عرضي آخر) --
  // "ا?" الإضافية تسمح بذلك دون كسر الحالة الطبيعية.
  `${loosePattern("ت")}\\s*(?:ا?${loosePattern("الكلية")}\\s*)?${loosePattern("القسم")}\\s*` +
    `${loosePattern("اجور الدراسة")}\\s*(?:${loosePattern("الصباحية")}\\s*)?` +
    `${loosePattern("اجور الدراسة")}\\s*(?:ال)?${loosePattern("مسائية").replace(/^ال/, "")}`,
  "g"
);

function findUniversityHeaders(text) {
  const headers = [];
  let m;
  HEADER_RE.lastIndex = 0;
  while ((m = HEADER_RE.exec(text))) {
    headers.push({ index: m.index, end: m.index + m[0].length, num: m[1], rawName: m[2], year: Number(m[3]) });
  }
  return headers;
}

function findTableStarts(text) {
  const starts = [];
  let m;
  TABLE_HEADER_RE.lastIndex = 0;
  while ((m = TABLE_HEADER_RE.exec(text))) starts.push({ index: m.index, end: m.index + m[0].length });
  return starts;
}

// يستخرج اسم الجامعة + المحافظة من النص الخام بين رقم الترويسة و"تأسست"
function parseHeaderNameProvince(rawName) {
  const cleaned = rawName.replace(/\s+/g, " ").trim();
  const provinceMatch = cleaned.match(/\(([^)]+)\)\s*\/?\s*$/);
  const province = provinceMatch ? provinceMatch[1].replace(/\s+/g, " ").trim() : null;
  let name = provinceMatch ? cleaned.slice(0, provinceMatch.index) : cleaned;
  name = name.replace(/\/\s*$/, "").trim();
  return { name, province };
}

function segmentTables(text) {
  const headers = findUniversityHeaders(text);
  const tableStarts = findTableStarts(text);
  const segments = [];
  // تخصيص "الأول يدخل أولاً يُخدَم أولاً" (FIFO) لا "أقرب ترويسة" (LIFO) --
  // فرق حاسم: قد تظهر ترويستا جامعتين متتاليتين بلا جدول بينهما إطلاقاً
  // (مثال حقيقي مؤكَّد: "42 - جامعة النسور" ثم مباشرة "43 - كلية الفقه
  // الجامعة" بلا أي جدول بينهما)، ثم يتبعهما جدولان: الجدول الأول (الأكبر،
  // ثماني كليات) ملك للترويسة الأولى (النسور، جامعة شاملة)، والجدول الثاني
  // (الأصغر، قسمان دينيان "الفقه وأصوله"/"علوم القرآن") ملك للثانية (كلية
  // الفقه، كلية دينية متخصصة صغيرة) -- "أقرب ترويسة" كانت تنسب كلا الجدولين
  // خطأً، فتُفقِد النسور بياناتها بالكامل وتُلصقها بالفقه. FIFO يحل الحالتين
  // معاً (هذه وحالة فاصل الصفحة الرافدين/المأمون الموثّقة سابقاً) بصواب.
  let headerIdx = 0;
  for (let i = 0; i < tableStarts.length; i++) {
    const start = tableStarts[i].end;
    const end = i + 1 < tableStarts.length ? tableStarts[i + 1].index : text.length;
    let owner = null;
    if (headerIdx < headers.length && headers[headerIdx].index <= tableStarts[i].index) {
      owner = headers[headerIdx];
      headerIdx++;
    }
    let body = text.slice(start, end);
    // احذف أي ترويسة جامعة "تالية" أُدرجت مبكراً داخل هذا المقطع (بقايا فاصل صفحة)
    body = body.replace(HEADER_RE, " ");
    segments.push({ owner, body: body.trim() });
  }
  return segments;
}

// ────────────────────────────────────────────────────────────────────
// تحليل صفوف الجدول: نمسح النص بحثاً عن "مراسي الأجور" (رقم مفصول
// بفواصل، أو عبارة "لا توجد دراسة مسائية"، أو "تعليق قبول") بالترتيب،
// والنص الواقع قبل كل مرسى هو اسم القسم (وقد يحوي بادئة اسم الكلية في
// أول صف من كل كلية، إذ لا فاصل صريح بينهما في النص المصدر).
// بعض الجامعات (اليرموك مثلاً) تستخدم النقطة بدل الفاصلة كفاصل آلاف
// (مثال: "2.500.000" بدل "2,500,000") -- كلا الرمزين مقبول.
const FEE_NUMBER_RE = /^\d{1,3}(?:[,.]\d{3})+$/;
// "دراسة" قد ترد "دراس ة" (مسافة عرضية زائدة، أثر تفتيت متكرر) -- \s* قبل
// الحرف الأخير يلتقط ذلك، وإلا يفشل التعرّف على المرسى بصمت فيتسرّب النص
// التالي بأكمله إلى اسم القسم الذي يليه (رُصد فعلياً في "الشرق الأوسط").
const NO_EVENING_RE = /^(ال|لا)?\s*ت?\s*وجد\s*دراس\s*[ةه]\s*مسائي[ةه]/;
const SUSPENDED_RE = /^تعليق\s*قبول/;
// شرط المعدل يرد بصيغتين مختلفتين على الأقل في المصدر: "معدل (٩٠)% فأكثر"
// و"معدل من ٨٥ الى ٨٩" (بلا قوس أو علامة نسبة) -- كلاهما مطلوب لتنظيف اسم
// القسم من رقم الشريحة، وإلا يبقى الرقم متسرباً فيُسقط الصف عبر شبكة الأمان
// (رُصد فعلياً في "الإسراء" و"كلية العمارة الجامعة").
const GRADE_NOTE_RE = /معدل\s*(?:من\s*)?\(?\s*[أقلاكثرفما\s]*\(?\s*\d{2,3}\s*\)?\s*%?\s*(?:الى|إلى|-)?\s*\d{0,3}\s*%?\s*(فأكثر|فما\s*فوق|فاكثر)?/;

function scanFeeAnchors(body) {
  // نمشط النص لالتقاط أي عبارة تشبه مرسى أجر (رقم بفواصل أو نقاط، أو نص
  // "بلا دراسة مسائية"، أو "تعليق قبول") مع الحفاظ على الترتيب والموقع.
  const tokenRe = /(\d{1,3}(?:[,.]\d{3})+|تعليق\s*قبول|(?:ال|لا)?\s*ت?\s*وجد\s*دراس\s*[ةه]\s*مسائي[ةه])/g;
  const anchors = [];
  let m;
  while ((m = tokenRe.exec(body))) {
    const raw = m[0].replace(/\s+/g, " ").trim();
    let type = "number";
    if (SUSPENDED_RE.test(raw)) type = "suspended";
    else if (NO_EVENING_RE.test(raw)) type = "noEvening";
    anchors.push({ index: m.index, end: m.index + m[0].length, raw, type });
  }
  return anchors;
}

function buildRows(body) {
  const anchors = scanFeeAnchors(body);
  const rows = [];
  let cursor = 0;
  let i = 0;
  while (i < anchors.length) {
    const a = anchors[i];
    const label = body.slice(cursor, a.index);
    if (a.type === "suspended") {
      rows.push({ label, morningFee: null, eveningFee: null, suspended: true, note: null });
      cursor = a.end;
      i += 1;
      continue;
    }
    // number أو noEvening: نتوقع زوجاً (صباحي ثم مسائي)
    const b = anchors[i + 1];
    if (!b || b.type === "suspended") {
      // زوج ناقص (نهاية جدول أو خلل) -- سجّله بأفضل تخمين متاح
      rows.push({
        label,
        morningFee: a.type === "number" ? Number(a.raw.replace(/[,.]/g, "")) : null,
        eveningFee: null,
        suspended: false,
        note: a.type === "noEvening" ? "لا توجد دراسة مسائية" : null,
      });
      cursor = a.end;
      i += 1;
      continue;
    }
    rows.push({
      label,
      morningFee: a.type === "number" ? Number(a.raw.replace(/[,.]/g, "")) : null,
      eveningFee: b.type === "number" ? Number(b.raw.replace(/[,.]/g, "")) : null,
      suspended: false,
      note: a.type === "noEvening" || b.type === "noEvening" ? "لا توجد دراسة مسائية" : null,
    });
    cursor = b.end;
    i += 2;
  }
  return rows;
}

// أسماء كليات شائعة معروفة (مبنية على الاطلاع المباشر على عشرات الجداول
// في هذا الدليل) -- تُستخدم فقط لتنظيف "اسم القسم" التجميلي في أول صف من
// كل كلية (الذي يحمل بادئة اسم الكلية ملتصقة به في النص المصدر بلا فاصل).
// عدم إيجاد تطابق هنا ليس خطأً: الصف يبقى صحيحاً، فقط اسمه أطول تجميلياً.
const KNOWN_COLLEGE_PREFIXES = [
  "الكلية التقنية الصحية و الطبية", "كلية التقنيات الصحية و الطبية",
  "الكلية التقنية الهندسية", "كلية طب االسنان", "كلية طب الاسنان",
  "كلية الصيدلة", "كلية التمريض", "كلية الهندسة", "كلية العلوم",
  "كلية القانون و العلوم السياسة", "كلية القانون", "كلية االدارة و االقتصاد",
  "كلية االدارة واالقتصاد", "كلية العلوم االدارية و المالية",
  "كلية العلوم االدارية والمالية", "كلية التربية االساسية", "كلية التربية البدنية و علوم الرياضة",
  "كلية التربية البدنية وعلوم الرياضة", "كلية التربية", "كلية االداب", "كلية االعالم",
  "كلية الفنون", "كلية اللغات", "كلية طب", "كلية العلوم السياسية",
];

// مقارنة متسامحة مع مسافات زائدة عرضية (أثر تفتيت الأحرف الأصلي، مثل
// "كلي ة التمريض" بدل "كلية التمريض") -- نقارن بعد حذف كل المسافات، ثم
// نُسقط بادئة القسم بعدد الأحرف غير الفراغية المطابقة من النص الأصلي.
function stripCollegePrefix(label) {
  const trimmed = label.replace(/^\s*\d{1,2}\s*/, "").trim();
  const trimmedNoSpace = trimmed.replace(/\s+/g, "");
  for (const prefix of KNOWN_COLLEGE_PREFIXES) {
    const prefixNoSpace = prefix.replace(/\s+/g, "");
    if (trimmedNoSpace.startsWith(prefixNoSpace)) {
      let consumed = 0;
      let i = 0;
      while (i < trimmed.length && consumed < prefixNoSpace.length) {
        if (!/\s/.test(trimmed[i])) consumed++;
        i++;
      }
      const dept = trimmed.slice(i).trim();
      return { college: prefix, dept: dept || prefix };
    }
  }
  return { college: null, dept: trimmed };
}

function parseUniversityBody(body) {
  const rawRows = buildRows(body);
  const departments = [];
  let currentCollege = null;
  for (const row of rawRows) {
    const label = row.label.replace(/\s+/g, " ").trim();
    if (!label) continue;
    const isNewGroup = /^\d{1,2}\s+\S/.test(label);
    let deptName = label;
    let gradeNote = null;
    const gm = label.match(GRADE_NOTE_RE);
    if (gm) {
      gradeNote = gm[0].replace(/\s+/g, " ").trim();
      deptName = label.replace(GRADE_NOTE_RE, " ").replace(/\s+/g, " ").trim();
    }
    if (isNewGroup) {
      const { college, dept } = stripCollegePrefix(deptName);
      if (college) currentCollege = college;
      deptName = dept;
    } else {
      deptName = deptName.replace(/^\s*\d{1,2}\s*/, "").trim();
    }
    if (!deptName) continue;
    departments.push({
      college: currentCollege,
      name: deptName,
      morningFee: row.morningFee,
      eveningFee: row.eveningFee,
      suspended: row.suspended,
      note: row.note,
      gradeNote,
    });
  }
  return departments;
}

function parseFullGuide() {
  const text = loadReconstructedTablesText();
  const segments = segmentTables(text);
  const universities = [];
  for (const seg of segments) {
    if (!seg.owner) continue;
    const { name, province } = parseHeaderNameProvince(seg.owner.rawName);
    const departments = parseUniversityBody(seg.body);
    universities.push({
      sourceNum: seg.owner.num,
      name,
      province,
      founded: seg.owner.year,
      departments,
    });
  }
  return universities;
}

if (require.main === module) {
  const text = loadReconstructedTablesText();
  fs.writeFileSync(path.join(ROOT, "data/raw/private_universities_guide_reconstructed.txt"), text, "utf8");
  const universities = parseFullGuide();
  fs.writeFileSync(
    path.join(ROOT, "data/raw/private_universities_guide_parsed.json"),
    JSON.stringify(universities, null, 2),
    "utf8"
  );
  const totalDepts = universities.reduce((s, u) => s + u.departments.length, 0);
  console.log(`تم تحليل ${universities.length} جامعة/كلية أهلية، بإجمالي ${totalDepts} صف قسم.`);
}

module.exports = { loadReconstructedTablesText, stripTatweel, parseFullGuide };
