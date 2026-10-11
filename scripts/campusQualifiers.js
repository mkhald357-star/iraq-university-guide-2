// قائمة الأحرم المشتركة (data/campus-qualifiers.json): مصدر واحد يقرؤه parse-cutoffs وbuild-universities-data.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "campus-qualifiers.json");
const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));

/** مؤهلات الحرم التي تُعامَل لاحقةً لا قسماً: اسم -> محافظة. */
const QUALIFIER_PROVINCE = raw.qualifiers;
const CAMPUS_QUALIFIERS = new Set(Object.keys(QUALIFIER_PROVINCE));

/** مدن تُذكر في آخر اسم كلية/معهد بلا «/»: اسم -> محافظة. */
const NAMED_CAMPUS_PROVINCE = Object.fromEntries(Object.entries(raw.namedCampuses).filter(([k]) => !k.startsWith("_")));

module.exports = { CAMPUS_QUALIFIERS, QUALIFIER_PROVINCE, NAMED_CAMPUS_PROVINCE, FILE };
