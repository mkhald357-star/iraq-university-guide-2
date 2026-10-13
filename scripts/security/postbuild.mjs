// ما بعد البناء (SECURITY-PLAN.md س1-5، س1-6، س2-ب). يعمل تلقائياً بعد `npm run build` (postbuild).
//
// 1) يفحص out/ ويُفشل البناء إن وجد: خرائط مصدر (.map)، أو سكربتاً خارجياً من أصل غير الموقع، أو قيمة نائبة
//    (REPLACE_BEFORE_LAUNCH)، أو ملفات لا يجوز نشرها (.env، مفاتيح، ملفات مصدر الوثائق).
// 2) يولّد out/_headers لـCloudflare Pages: ترويسات أمان عامة، وCSP لكل صفحة بـsha256 لسكربتاتها المضمَّنة
//    (موقع ثابت ⇒ لا nonces)، وسياسة كاش (البيانات تُعاد التحقق منها، والأصول المجزَّأة ثابتة).
// 3) يولّد out/integrity.json (SHA-256 لكل ملف منشور) وout/version.json (الـcommit) لمراقبة سلامة المحتوى.
//
// CSP_REPORT_ONLY=1 ⇒ تُرسَل السياسة بترويسة Content-Security-Policy-Report-Only (مرحلة التجربة).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, "out");
if (!fs.existsSync(OUT)) {
  console.error("[security] out/ غير موجود: شغّل البناء أولاً");
  process.exit(1);
}

const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const rel = (f) => path.relative(OUT, f).split(path.sep).join("/");
const files = walk(OUT).filter((f) => !["_headers", "integrity.json", "version.json"].includes(rel(f)));

// ── 1) فحوص المنع ──
const problems = [];
const ALLOWED_SCRIPT_ORIGINS = []; // لا سكربت خارجي إطلاقاً
for (const f of files) {
  const r = rel(f);
  if (/\.map$/.test(r)) problems.push(`خريطة مصدر منشورة: ${r}`);
  if (/(^|\/)\.env|\.pem$|\.key$|id_rsa|\.pdf$/i.test(r)) problems.push(`ملف لا يجوز نشره: ${r}`);
  if (/\.(html|js|txt)$/.test(r)) {
    const s = fs.readFileSync(f, "utf8");
    if (s.includes("REPLACE_BEFORE_LAUNCH")) problems.push(`قيمة نائبة في ${r}`);
    if (r.endsWith(".html")) {
      for (const m of s.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/g)) {
        const src = m[1];
        if (/^https?:\/\//.test(src) && !ALLOWED_SCRIPT_ORIGINS.some((o) => src.startsWith(o)))
          problems.push(`سكربت خارجي في ${r}: ${src}`);
      }
    }
  }
}
if (problems.length) {
  console.error("[security] فشل فحص المخرجات:\n  " + problems.join("\n  "));
  process.exit(1);
}

// ── 2) الترويسات ──
const sha = (s) => "'sha256-" + crypto.createHash("sha256").update(s, "utf8").digest("base64") + "'";
const pageCsp = (html) => {
  const hashes = new Set();
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) hashes.add(sha(m[1]));
  return [
    "default-src 'self'",
    `script-src 'self' ${[...hashes].join(" ")}`,
    "style-src 'self' 'unsafe-inline'", // سمات style من React/Tailwind
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
};
const cspHeader = process.env.CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

const lines = [];
const add = (route, headers) => {
  lines.push(route);
  for (const [k, v] of headers) lines.push(`  ${k}: ${v}`);
  lines.push("");
};
// عامة لكل المسارات (بلا CSP: تعدّد ترويسات CSP يتقاطع فيكسر الصفحات)
add("/*", [
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  [
    "Permissions-Policy",
    "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  ],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Resource-Policy", "same-origin"],
  ["X-Permitted-Cross-Domain-Policies", "none"],
  ["! Access-Control-Allow-Origin", ""], // Cloudflare Pages يضيف «*» افتراضياً: لا مشاركة لبيانات الموقع عبر الأصول
]);
add("/_next/static/*", [["Cache-Control", "public, max-age=31536000, immutable"]]);
add("/data/*", [["Cache-Control", "public, max-age=0, must-revalidate"]]);
add("/.well-known/security.txt", [["Content-Type", "text/plain; charset=utf-8"]]);

let pages = 0;
for (const f of files.filter((x) => x.endsWith(".html"))) {
  const r = rel(f);
  if (r === "404.html") continue;
  const csp = pageCsp(fs.readFileSync(f, "utf8"));
  const route = r === "index.html" ? "/" : "/" + r.replace(/\.html$/, "");
  const routes = r === "index.html" ? ["/", "/index.html"] : [route, route + ".html"];
  for (const rt of routes) {
    if (`  ${cspHeader}: ${csp}`.length > 1950) {
      console.error(`[security] سطر CSP أطول من حد Cloudflare (2000) في ${rt}`);
      process.exit(1);
    }
    add(rt, [[cspHeader, csp]]);
  }
  pages++;
}
// قاعدة «!» لإزالة ترويسة: الصيغة في Cloudflare Pages هي «! اسم-الترويسة» بلا قيمة
const headersText = lines
  .join("\n")
  .replace(/  ! Access-Control-Allow-Origin: \n/, "  ! Access-Control-Allow-Origin\n");
fs.writeFileSync(path.join(OUT, "_headers"), headersText, "utf8");

// ── 3) السلامة والإصدار ──
const manifest = {};
for (const f of files.sort())
  manifest["/" + rel(f)] = crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
let commit = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || "";
if (!commit) {
  try {
    commit = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
  } catch {
    commit = "unknown";
  }
}
fs.writeFileSync(path.join(OUT, "integrity.json"), JSON.stringify({ commit, files: manifest }) + "\n", "utf8");
fs.writeFileSync(path.join(OUT, "version.json"), JSON.stringify({ commit }) + "\n", "utf8");

console.log(
  `[security] out/ نظيف؛ _headers: ${pages} صفحة بـCSP (${cspHeader})؛ integrity.json: ${Object.keys(manifest).length} ملفاً؛ commit ${commit.slice(0, 7)}`
);
