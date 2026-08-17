// يبني ملفاً صغيراً منفصلاً لكل تخصص (public/data/major-projects/<majorId>.json)
// من data/major_projects.json، بدل استيراد الملف الكامل (لكل الـ88 تخصصاً،
// 4,400 فكرة) مباشرة داخل حزمة العميل في صفحة /projects. نفس سبب ونمط
// scripts/build-major-skills.js بالضبط.
//
// الاستخدام: node scripts/build-major-projects.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/data/major-projects");

const projects = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_projects.json"), "utf8"));

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith(".json")) fs.unlinkSync(path.join(OUT_DIR, f));
}

let totalBytes = 0;
for (const entry of projects) {
  const json = JSON.stringify(entry);
  fs.writeFileSync(path.join(OUT_DIR, `${entry.id}.json`), json, "utf8");
  totalBytes += json.length;
}

console.log(`Wrote ${projects.length} per-major project files to ${OUT_DIR}`);
console.log(`Total size: ${(totalBytes / 1024).toFixed(0)} KB (avg ${(totalBytes / projects.length / 1024).toFixed(1)} KB/file)`);
