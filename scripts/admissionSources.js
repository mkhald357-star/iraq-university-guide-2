// مصدر حقيقة واحد لسنة/ملف/اسم كل وثيقة خام تُبنى منها data/universities.json.
// يُستورَد من scripts/build-universities-data.js (يبني منه data/universities_meta.json)
// ومن scripts/validate-data.js (يتحقّق أن كل ملف موجود فعلاً وأن اسمه يطابق
// سنته المُعلَنة) معاً -- عمداً ملف واحد لا نسختان قد تتباعدان.
//
// ثلاث وثائق مختلفة فعلياً (لا وثيقة واحدة، رغم أنها تتشارك نفس السنة اليوم
// صدفةً لا بنيوياً -- انظر data/admission_rules.md §24):
//   - cutoffs: وثيقة الحدود الدنيا المستقلة (مصدر كل رقم averagePercent/
//     averageGrades المعروض فعلياً للطالب -- هذا تحديداً ما يخصّه تنويه
//     "القناة العامة").
//   - studentGuide: دليل الطالب (مصدر chapter3_additions.json وقواعد القبول
//     العامة والدراسة المسائية -- كلها تُستخرَج من dalel.full.txt نفسه).
//   - privateGuide: دليل الجامعات والكليات الأهلية وأجورها الدراسية.
module.exports = {
  cutoffs: {
    year: "2025-2026",
    file: "data/raw/cutoffs_2025_2026.json",
    document: "الحدود الدنيا للقبول المركزي — القناة العامة، للسنة الدراسية 2025-2026",
  },
  studentGuide: {
    year: "2025-2026",
    file: "data/raw/dalel.full.txt",
    document: "دليل الطالب للسنة الدراسية 2025-2026",
  },
  privateGuide: {
    year: "2025-2026",
    file: "data/raw/private_universities_departments.json",
    document: "دليل الجامعات والكليات الأهلية والأجور الدراسية 2025-2026",
  },
};
