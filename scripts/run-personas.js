// يشغّل كل ملفات محاكاة الشخصيات (scripts/persona/persona_*.mts) عبر tsx،
// واحداً تلو الآخر -- بديل عابر للمنصات (يعمل على Windows/macOS/Linux) عن
// حلقة bash `for` التي لا تعمل تحت cmd.exe الذي يستخدمه npm افتراضياً على
// Windows.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "persona");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("persona_") && f.endsWith(".mts"))
  .sort();

if (files.length === 0) {
  console.error("لا ملفات شخصيات موجودة في scripts/persona/");
  process.exit(1);
}

// استدعاء تنفيذي tsx المحلي مباشرة (لا npx، لا shell:true) -- يتفادى تحذير
// Node الأمني حول تمرير وسائط لعملية فرعية عبر shell.
const tsxBin = path.join(
  __dirname,
  "..",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx"
);

let failed = 0;
for (const file of files) {
  const full = path.join(dir, file);
  console.log(`\n=== ${file} ===`);
  try {
    execFileSync(tsxBin, [full], { stdio: "inherit" });
  } catch {
    failed++;
    console.error(`فشل تشغيل ${file}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} شخصية اكتملت بنجاح.`);
if (failed > 0) process.exit(1);
