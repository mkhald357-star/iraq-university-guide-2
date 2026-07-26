// Parses data/raw/hodod.full.txt (raw pdf-parse text of the official
// "الحدود الدنيا للقبول المركزي - القناة العامة" PDF) into structured
// JSON rows: one row per (university, college, department, branch,
// gender, quota-variant) that reached a competitive admission cutoff.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data", "raw", "hodod.full.txt");
const OUT = path.join(ROOT, "data", "raw", "cutoffs_2025_2026.json");

const raw = fs.readFileSync(SRC, "utf8");
const lines = raw.split("\n");

const BRANCHES = new Set(["علمي", "ادبي", "أدبي", "فنون"]);
const GENDERS = new Set(["مختلط", "ذكر", "انثى", "أنثى"]);

// أسماء مدن/أقضية تُستخدم في المصدر كمؤهِّل فرع جغرافي للكلية ("كلية X /
// المدينة")، لا كاسم قسم أكاديمي حقيقي. حين تكون هذه هي الشريحة الوحيدة
// بعد اسم الكلية (بلا قسم حقيقي بعدها)، كان الكود يضعها خطأً في حقل
// department فتظهر للطالب "تخصصك: بلد" أو "تخصصك: القرنة" -- مثال مؤكَّد:
// "جامعة سامراء / كلية الزراعة / بلد" (سطر واحد بلا قسم بعد اسم المدينة).
// القائمة يدوية (لا نمط لغوي عام يميّز اسم مدينة عن اسم قسم) بعد فحص كل
// حالات هذا العطل فعلياً في data/raw/hodod.full.txt.
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
]);

const rows = [];

for (const line of lines) {
  if (!line.includes("\t")) continue;
  const tokens = line
    .split("\t")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length < 6) continue;

  const last = tokens[tokens.length - 1];
  const branch = tokens[tokens.length - 2];
  const rankStr = tokens[tokens.length - 3];
  const avgStr = tokens[tokens.length - 4];
  const totalStr = tokens[tokens.length - 5];

  if (!GENDERS.has(last)) continue;
  if (!BRANCHES.has(branch)) continue;
  if (!/^\d+$/.test(rankStr)) continue;
  if (!/^\d+(\.\d+)?$/.test(avgStr)) continue;
  if (!/^\d+(\.\d+)?$/.test(totalStr)) continue;

  const pathTokens = tokens.slice(0, tokens.length - 5);
  if (pathTokens.length === 0) continue;

  const university = pathTokens[0];
  const rest = pathTokens.slice(1); // alternating delimiter, name, delimiter, name...
  const segments = [];
  for (let i = 0; i < rest.length; i += 2) {
    const delim = rest[i];
    const name = rest[i + 1];
    if (!name) continue;
    segments.push({ delim, name });
  }

  const college = segments.length > 0 ? segments[0].name : null;
  const extras = segments.slice(1); // sub-college/track/department/quota chain

  let department = null;
  let qualifiers = [];
  if (extras.length > 0) {
    const lastExtra = extras[extras.length - 1];
    department = lastExtra.name;
    qualifiers = extras.slice(0, -1).map((e) => e.name);
  }

  // آخر حصة بعد اسم الكلية اسم مدينة/فرع جغرافي (وليس قسماً أكاديمياً
  // حقيقياً) -- يحدث هذا سواء كانت حصة جغرافية واحدة ("كلية X / بلد") أو
  // سلسلة مدينة+حي ("كلية X / بغداد - الرصافة"). الحد المذكور يخص الكلية
  // كاملة في ذلك الفرع، لا "قسماً" باسم المدينة. نُفرغ department فيسري
  // عليه لاحقاً في build-universities-data.js نفس منطق "حد على مستوى
  // الكلية" المُثبَت أصلاً لحالات مشابهة.
  if (department && CAMPUS_QUALIFIERS.has(department)) {
    qualifiers = [...qualifiers, department];
    department = null;
  }

  const isQuota =
    qualifiers.some((q) => /ابناء|شهداء|متميز|اوائل/.test(q)) ||
    Boolean(department && /ابناء|شهداء|متميز|اوائل/.test(department));

  rows.push({
    university,
    college,
    department,
    qualifiers,
    isQuota,
    branch: branch === "ادبي" ? "أدبي" : branch,
    gender: last === "انثى" ? "أنثى" : last,
    totalScore: parseFloat(totalStr),
    averagePercent: parseFloat(avgStr),
    rank: parseInt(rankStr, 10),
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rows, null, 2), "utf8");
console.log("Parsed rows:", rows.length);
console.log("Unique universities:", new Set(rows.map((r) => r.university)).size);
console.log(
  "Quota rows:",
  rows.filter((r) => r.isQuota).length,
  "| Non-quota rows:",
  rows.filter((r) => !r.isQuota).length
);
