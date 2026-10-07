// فهرس واقعية القبول لكل تخصص (الإصدار 2، المسار C-D) → data/major_admission_index.json
//
// يُبنى من public/data/major-offerings/<id>.json -- نفس الملفات التي يعرضها
// /report، فلا يمكن أن يختلف الفهرس عمّا يراه الطالب. يعمل بعد
// build-major-offerings في predev وprebuild.
//
// قواعد من data/admission_rules.md لا تُكسر:
// - **الحدّ التنافسي = الصباحي الحكومي غير المباشر فقط.** (§8 بند 1، §24)
// - **المسائي لا يُقرأ أبداً**: أرضية ثابتة حسب نوع الكلية، لا نتيجة تنافس
//   (§5، §31). يُفحَص أن قيمه ضمن الجدول الثابت، وأي قيمة جديدة تُفشل البناء
//   لأنها تعني أن الافتراض تغيّر.
// - **الأهلي لا يساهم بحدّ أبداً**، ولا حتى من يحمل statedMinimumGrade: شرط
//   معلَن مسبقاً ليس نتيجة تنافس (§28). يُعَدّ فقط كي تُفصح الواجهة عن التغطية.
//   الأهلي "مجهول" لا "سهل" (§32).
// - **لا قصّ للحدود**: الطب 101.41 حقيقي (درجات إضافية موزونة).
// - القسم الموقوف قبوله (admissionSuspended) لا يُحتسب باباً.
// - الأرقام نتيجة العام الماضي بأثر رجعي لا ضمان -- تقولها الواجهة صراحةً.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "public/data/major-offerings");
const OUT = path.join(ROOT, "data/major_admission_index.json");
const EVENING_FLOORS = new Set([55, 56, 58, 60, 65, 70, 75]); // جدول §5 الثابت

const majors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/majors.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "data/universities_meta.json"), "utf8"));
const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return +(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)).toFixed(2);
};

const index = {};
const newEvening = new Set();
for (const major of majors) {
  const file = path.join(DIR, `${major.id}.json`);
  const offerings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  const cutoffs = [];
  let directAdmissionOfferings = 0;
  let privateOfferings = 0;
  let statedPrivateMinCount = 0;
  let unknownOfferings = 0;
  let suspended = 0;
  for (const o of offerings) {
    const evening = o.averageGrades?.["مسائي"];
    if (evening != null && !EVENING_FLOORS.has(evening)) newEvening.add(evening);
    if (o.admissionSuspended) {
      suspended++;
      continue;
    }
    if (o.universityType === "أهلية") {
      privateOfferings++;
      if (o.statedMinimumGrade?.value != null) statedPrivateMinCount++;
      continue;
    }
    if (o.isDirectAdmission) {
      directAdmissionOfferings++;
      continue;
    }
    const morning = o.averageGrades?.["صباحي"];
    if (morning == null) unknownOfferings++;
    else cutoffs.push(morning);
  }
  cutoffs.sort((a, b) => a - b);
  const governmentTotal = cutoffs.length + directAdmissionOfferings + unknownOfferings;
  const coverage = governmentTotal ? +(cutoffs.length / governmentTotal).toFixed(3) : 0;
  const confidence =
    cutoffs.length >= 5 && coverage >= 0.5
      ? "high"
      : cutoffs.length >= 2
        ? "medium"
        : cutoffs.length === 1
          ? "low"
          : "none";
  index[major.id] = {
    competitiveOfferings: cutoffs.length,
    directAdmissionOfferings,
    privateOfferings,
    statedPrivateMinCount,
    unknownOfferings,
    suspendedOfferings: suspended,
    cutoffMin: cutoffs.length ? cutoffs[0] : null,
    cutoffP25: quantile(cutoffs, 0.25),
    cutoffMedian: quantile(cutoffs, 0.5),
    cutoffMax: cutoffs.length ? cutoffs[cutoffs.length - 1] : null,
    coverage,
    confidence,
  };
}

if (newEvening.size) {
  console.error(
    `[FAIL] قيم مسائية خارج جدول الأرضيات الثابت: ${[...newEvening].join(", ")} -- افتراض "المسائي أرضية ثابتة لا حدّ تنافسي" تغيّر؛ راجِع data/admission_rules.md §5 قبل البناء.`
  );
  process.exit(1);
}

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      _meta: {
        generatedFrom: "public/data/major-offerings/*.json",
        cutoffsSourceYear: meta.cutoffsSourceYear ?? null,
        rules:
          "حكومي تنافسي صباحي فقط؛ المسائي أرضية ثابتة مُستبعَدة؛ الأهلي مجهول لا سهل؛ الموقوف مُستبعَد؛ بلا قصّ للحدود. أرقام نتيجة العام الماضي بأثر رجعي لا ضمان.",
      },
      majors: index,
    },
    null,
    2
  ) + "\n"
);
const byConf = {};
Object.values(index).forEach((e) => (byConf[e.confidence] = (byConf[e.confidence] || 0) + 1));
const none = Object.entries(index)
  .filter(([, e]) => e.confidence === "none")
  .map(([id]) => id);
console.log(
  `major_admission_index.json: ${Object.keys(index).length} تخصصاً`,
  JSON.stringify(byConf),
  none.length ? `| بلا حدّ: ${none.join("، ")}` : ""
);
