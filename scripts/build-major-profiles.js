// يبني ملفاً صغيراً منفصلاً لكل تخصص (public/data/major-profiles/<majorId>.json)
// من data/major_profiles_detailed.json، بدل استيراد الملف الكامل (لكل الـ88
// تخصصاً، ~530 كيلوبايت خاماً) مباشرة داخل حزمة العميل في كل صفحة تحتاج
// تفصيل تخصص واحد فقط (report/destinations/income). نفس سبب ونمط
// scripts/build-major-offerings.js بالضبط -- راجع تشخيص_المشاكل_وخطة_الإصلاح_الشاملة.md
// وتعليق أعلى build-major-offerings.js للسياق الكامل لهذا النمط في المشروع.
//
// الاستخدام: node scripts/build-major-profiles.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/data/major-profiles");

const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_profiles_detailed.json"), "utf8"));

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith(".json")) fs.unlinkSync(path.join(OUT_DIR, f));
}

let totalBytes = 0;
for (const profile of profiles) {
  const json = JSON.stringify(profile);
  fs.writeFileSync(path.join(OUT_DIR, `${profile.id}.json`), json, "utf8");
  totalBytes += json.length;
}

console.log(`Wrote ${profiles.length} per-major profile files to ${OUT_DIR}`);
console.log(
  `Total size: ${(totalBytes / 1024).toFixed(0)} KB (avg ${(totalBytes / profiles.length / 1024).toFixed(1)} KB/file)`
);
