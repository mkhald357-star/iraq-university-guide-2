#!/usr/bin/env node
/**
 * يولّد PROJECT-SNAPSHOT.md — لقطة كاملة للمشروع مشتقّة من الكود.
 * تشخيص فقط. لا يعدّل أي ملف عدا المخرَج.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "PROJECT-SNAPSHOT.md");
const SKIP = new Set(["node_modules", ".next", "out", ".git", "dist", "coverage", "reports"]);

const L = [];
const w = (s = "") => L.push(s);
const h = (n, s) => {
  w("");
  w("#".repeat(n) + " " + s);
  w("");
};
const code = (lang, s) => {
  w("```" + lang);
  w(s);
  w("```");
};
const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};
const readJSON = (p) => safe(() => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")));
const kb = (p) => safe(() => (fs.statSync(path.join(ROOT, p)).size / 1024).toFixed(1) + " KB", "—");

/** يقصّ القيم الطويلة والمصفوفات الكبيرة داخل عيّنة */
function trim(v, depth = 0) {
  if (depth > 4) return "…";
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 120) + "…" : v;
  if (Array.isArray(v)) {
    const head = v.slice(0, 2).map((x) => trim(x, depth + 1));
    return v.length > 2 ? [...head, `…(${v.length} عنصراً)`] : head;
  }
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = trim(val, depth + 1);
    return o;
  }
  return v;
}

/* ═══ ١) الشجرة ═══ */
function tree(dir, prefix = "", depth = 0) {
  if (depth > 3) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries = entries
    .filter((e) => !SKIP.has(e.name) && !e.name.startsWith("."))
    .sort((a, b) => b.isDirectory() - a.isDirectory() || a.name.localeCompare(b.name));
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      w(`${prefix}${e.name}/`);
      tree(full, prefix + "  ", depth + 1);
    } else {
      const size = safe(() => (fs.statSync(full).size / 1024).toFixed(0) + "K", "");
      w(`${prefix}${e.name}${size ? "  (" + size + ")" : ""}`);
    }
  }
}

h(1, "لقطة المشروع");
w(`مولَّدة آلياً: ${new Date().toISOString().slice(0, 10)}`);
w("");
w("> كل ما في هذا الملف مشتقّ من الكود الفعلي. لا تفترض شيئاً خارجه.");

h(2, "١) شجرة الملفات");
code(
  "",
  (() => {
    const s = L.length;
    tree(ROOT);
    return L.splice(s).join("\n");
  })()
);

/* ═══ ٢) package.json ═══ */
h(2, "٢) الأوامر والتبعيات");
const pkg = readJSON("package.json") || {};
code(
  "json",
  JSON.stringify(
    {
      scripts: pkg.scripts,
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies,
    },
    null,
    2
  )
);

/* ═══ ٣) الإعدادات ═══ */
h(2, "٣) ملفات الإعداد");
for (const f of [
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "tailwind.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "vitest.config.ts",
  ".eslintrc.js",
  ".eslintrc.json",
]) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  h(3, f);
  code("", fs.readFileSync(p, "utf8").slice(0, 2500));
}

/* ═══ ٤) ملفات البيانات: الشكل + عيّنة حقيقية ═══ */
h(2, "٤) ملفات البيانات — الشكل وعيّنة حقيقية");
const dataDir = path.join(ROOT, "data");
if (fs.existsSync(dataDir)) {
  for (const f of fs
    .readdirSync(dataDir)
    .filter((x) => x.endsWith(".json"))
    .sort()) {
    const rel = `data/${f}`;
    const j = readJSON(rel);
    h(3, `${rel}  —  ${kb(rel)}`);
    if (j === null) {
      w("*تعذّرت القراءة*");
      continue;
    }

    if (Array.isArray(j)) {
      w(`مصفوفة، ${j.length} عنصراً. عيّنة العنصر الأول:`);
      code("json", JSON.stringify(trim(j[0]), null, 1));
    } else {
      w(`كائن. المفاتيح العليا: \`${Object.keys(j).join("`, `")}\``);
      const firstArrayKey = Object.keys(j).find((k) => Array.isArray(j[k]));
      if (firstArrayKey) {
        w(`\`${firstArrayKey}\`: ${j[firstArrayKey].length} عنصراً. عيّنة:`);
        code("json", JSON.stringify(trim(j[firstArrayKey][0]), null, 1));
      } else {
        code("json", JSON.stringify(trim(j), null, 1));
      }
    }
  }
}

/* ═══ ٥) universities.json بالتفصيل ═══ */
h(2, "٥) universities.json — البنية المتداخلة والقيم الفعلية");
const uni = readJSON("data/universities.json");
if (uni) {
  const list = Array.isArray(uni) ? uni : uni.universities || [];
  const colleges = list.flatMap((u) => u.colleges || []);
  const depts = colleges.flatMap((c) => c.departments || []);

  w(`- جامعات: **${list.length}**`);
  w(`- كليات: **${colleges.length}**`);
  w(`- أقسام: **${depts.length}**`);

  h(3, "سلسلة حقيقية كاملة: جامعة ← كلية ← قسم");
  const u0 = list[0];
  code(
    "json",
    JSON.stringify(
      trim({
        ...u0,
        colleges: [{ ...(u0.colleges?.[0] || {}), departments: [u0.colleges?.[0]?.departments?.[0]] }],
      }),
      null,
      1
    )
  );

  h(3, "القيم الفعلية للحقول المحدودة");
  const distinct = (arr, n = 25) => [...new Set(arr.filter((x) => x !== undefined && x !== null))].slice(0, n);
  w("```");
  w("universityType: " + JSON.stringify(distinct(list.map((u) => u.type))));
  w("province:       " + JSON.stringify(distinct(list.map((u) => u.province))));
  w("branch:         " + JSON.stringify(distinct(depts.flatMap((d) => d.branch || []))));
  w("sessions:       " + JSON.stringify(distinct(depts.flatMap((d) => d.sessions || []))));
  w(
    "cutoff keys:    " +
      JSON.stringify(distinct(depts.flatMap((d) => (d.cutoffs || []).flatMap((c) => Object.keys(c)))))
  );
  w("cutoff.gender:  " + JSON.stringify(distinct(depts.flatMap((d) => (d.cutoffs || []).map((c) => c.gender)))));
  w("```");

  h(3, "نطاقات القيم الرقمية الحقيقية");
  const nums = depts
    .flatMap((d) => (d.cutoffs || []).map((c) => c.averagePercent))
    .filter((n) => typeof n === "number");
  const morning = depts.map((d) => d.averageGrades?.["صباحي"]).filter((n) => typeof n === "number");
  const evening = depts.map((d) => d.averageGrades?.["مسائي"]).filter((n) => typeof n === "number");
  const rng = (a) => (a.length ? `min ${Math.min(...a)} · max ${Math.max(...a)} · عدد ${a.length}` : "لا قيم");
  w("```");
  w("cutoffs[].averagePercent : " + rng(nums));
  w("averageGrades.صباحي      : " + rng(morning));
  w("averageGrades.مسائي      : " + rng(evening));
  w("isDirectAdmission=true   : " + depts.filter((d) => d.isDirectAdmission).length);
  w("isQuota=true (صفوف)      : " + depts.flatMap((d) => d.cutoffs || []).filter((c) => c.isQuota).length);
  w("displayName موجود        : " + depts.filter((d) => d.displayName).length + " / " + depts.length);
  w("```");
  w("> **مهم:** أي قاعدة تحقّق يجب أن تحترم هذه النطاقات الفعلية — لا نطاقاً مفترضاً.");
}

/* ═══ ٦) مخرجات public/data ═══ */
h(2, "٦) public/data — ما يصل للمتصفح فعلاً");
const pub = path.join(ROOT, "public", "data");
if (fs.existsSync(pub)) {
  const walk = (d, rel = "") => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        const n = safe(() => fs.readdirSync(full).length, 0);
        w(`- \`public/data/${rel}${e.name}/\` — ${n} ملفاً`);
        const first = safe(() => fs.readdirSync(full)[0]);
        if (first) {
          const j = safe(() => JSON.parse(fs.readFileSync(path.join(full, first), "utf8")));
          if (j) {
            w(`  عيّنة من \`${first}\`:`);
            code("json", JSON.stringify(trim(Array.isArray(j) ? j[0] : j), null, 1));
          }
        }
      } else if (e.name.endsWith(".json")) {
        const j = safe(() => JSON.parse(fs.readFileSync(full, "utf8")));
        w(
          `- \`public/data/${rel}${e.name}\` — ${(fs.statSync(full).size / 1024).toFixed(0)} KB، ${Array.isArray(j) ? j.length + " سجلاً" : "كائن"}`
        );
        if (Array.isArray(j) && j[0]) code("json", JSON.stringify(trim(j[0]), null, 1));
      }
    }
  };
  walk(pub);
}

/* ═══ ٧) lib — الصادرات ═══ */
h(2, "٧) lib/ — الدوال والأنواع المصدَّرة");
const libDir = path.join(ROOT, "lib");
if (fs.existsSync(libDir)) {
  for (const f of fs
    .readdirSync(libDir)
    .filter((x) => /\.tsx?$/.test(x) && !/\.test\./.test(x))
    .sort()) {
    const src = fs.readFileSync(path.join(libDir, f), "utf8");
    const lines = src.split("\n");
    const exports = lines
      .map((l, i) => ({ l: l.trim(), i: i + 1 }))
      .filter(({ l }) => /^export\s+(async\s+)?(function|const|type|interface|class|enum)/.test(l))
      .map(({ l, i }) => `  ${String(i).padStart(4)}  ${l.replace(/\s*\{$/, "").slice(0, 160)}`);
    h(3, `lib/${f}  (${lines.length} سطراً)`);
    code("ts", exports.join("\n") || "(لا صادرات مطابقة)");
  }
}

/* ═══ ٨) app — المسارات ═══ */
h(2, "٨) app/ — الصفحات والمكوّنات");
const appDir = path.join(ROOT, "app");
if (fs.existsSync(appDir)) {
  const routes = [];
  const walk = (d, rel = "") => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name), `${rel}/${e.name}`);
      else if (/^page\.tsx?$/.test(e.name)) {
        const src = fs.readFileSync(path.join(d, e.name), "utf8");
        const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)]
          .map((m) => m[1])
          .filter((s) => s.startsWith("@/") || s.startsWith("."));
        const fetches = [...src.matchAll(/fetch\w*\(['"`]([^'"`]+)/g)].map((m) => m[1]);
        routes.push({
          route: rel || "/",
          file: `app${rel}/${e.name}`,
          lines: src.split("\n").length,
          imports: [...new Set(imports)].slice(0, 12),
          fetches: [...new Set(fetches)],
        });
      }
    }
  };
  walk(appDir);
  for (const r of routes) {
    w(`- **\`${r.route}\`** — \`${r.file}\` (${r.lines} سطراً)`);
    if (r.imports.length) w(`  - يستورد: ${r.imports.map((i) => "`" + i + "`").join(", ")}`);
    if (r.fetches.length) w(`  - يجلب: ${r.fetches.map((i) => "`" + i + "`").join(", ")}`);
  }

  const comp = path.join(appDir, "components");
  if (fs.existsSync(comp)) {
    h(3, "المكوّنات");
    for (const f of fs
      .readdirSync(comp)
      .filter((x) => /\.tsx?$/.test(x) && !/\.test\./.test(x))
      .sort()) {
      const src = fs.readFileSync(path.join(comp, f), "utf8");
      const props = src.match(/(?:interface|type)\s+\w*Props[^{]*\{[\s\S]{0,400}?\n\}/);
      w(`- \`${f}\` (${src.split("\n").length} سطراً)`);
      if (props) code("ts", props[0]);
    }
  }
}

/* ═══ ٩) scripts ═══ */
h(2, "٩) scripts/ — خط الأنابيب");
const scDir = path.join(ROOT, "scripts");
if (fs.existsSync(scDir)) {
  for (const f of fs
    .readdirSync(scDir)
    .filter((x) => /\.(js|mjs|cjs|ts)$/.test(x) && !/\.test\./.test(x))
    .sort()) {
    const src = fs.readFileSync(path.join(scDir, f), "utf8");
    const doc = (src.match(/\/\*\*([\s\S]*?)\*\//) || [, ""])[1]
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" — ");
    const writes = [...new Set([...src.matchAll(/writeFileSync\([^,]*?['"`]([^'"`]+)/g)].map((m) => m[1]))];
    w(`- \`scripts/${f}\` (${src.split("\n").length} سطراً) — ${doc || "بلا وصف"}`);
    if (writes.length) w(`  - يكتب: ${writes.map((x) => "`" + x + "`").join(", ")}`);
  }
}

/* ═══ ١٠) الاختبارات ═══ */
h(2, "١٠) الاختبارات");
const tests = [];
const findTests = (d) => {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(d, e.name);
    if (e.isDirectory()) findTests(full);
    else if (/\.(test|spec)\.(ts|tsx|js)$/.test(e.name)) {
      const src = fs.readFileSync(full, "utf8");
      tests.push({
        file: path.relative(ROOT, full).replace(/\\/g, "/"),
        count: (src.match(/\bit\(|\btest\(/g) || []).length,
      });
    }
  }
};
findTests(ROOT);
w(`إجمالي ملفات الاختبار: **${tests.length}** · إجمالي الحالات: **${tests.reduce((a, t) => a + t.count, 0)}**`);
w("");
w("> **الاتفاقية المهمة:** لاحظ موضع ملفات الاختبار (مجاورة للمصدر أم في مجلد منفصل) — التزم بها.");
w("");
for (const t of tests) w(`- \`${t.file}\` — ${t.count} حالة`);

/* ═══ ١١) فهرس admission_rules.md ═══ */
h(2, "١١) data/admission_rules.md — فهرس الأقسام");
const rules = safe(() => fs.readFileSync(path.join(ROOT, "data", "admission_rules.md"), "utf8"));
if (rules) {
  w(`الحجم: ${kb("data/admission_rules.md")} · ${rules.split("\n").length} سطراً`);
  w("");
  for (const l of rules.split("\n")) if (/^#{1,3}\s/.test(l)) w(`- ${l.replace(/^#+\s*/, "")}`);
  w("");
  w("> **هذا سجلّ قرارات المشروع.** أي مواصفة تخالف قراراً موثّقاً هنا مرفوضة.");
}

/* ═══ ١٢) حالة الخدمات ═══ */
h(2, "١٢) حالة الخدمات المعروضة");
const svc = safe(() => fs.readFileSync(path.join(ROOT, "data", "services.ts"), "utf8"));
if (svc) code("ts", svc.slice(0, 6000));

const out = L.join("\n");
fs.writeFileSync(OUT, out, "utf8");
// ملاحظة: L.length ليس عدد الأسطر الفعلي -- كتل code() تدفع سطراً واحداً في
// المصفوفة يحوي فواصل أسطر داخلية متعددة (مثال: شجرة الملفات كاملة أو عيّنة
// JSON متعددة الأسطر)، فيُقلَّل العدد الحقيقي كثيراً لو اعتُمد L.length وحده
// لفرض سقف الـ5000 سطر. العدّ الصحيح دائماً على النص النهائي بعد الدمج.
const lineCount = out.split("\n").length;
console.log(
  `✅ ${path.relative(ROOT, OUT)} — ${lineCount} سطراً فعلياً، ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`
);
if (lineCount > 5000) {
  console.warn(`⚠️ تجاوز سقف 5000 سطر (${lineCount}) -- قلّل العيّنات في الأقسام الكبيرة (٤/٦) لا الأقسام نفسها.`);
}
