// فحص الموقع الحي (SECURITY-PLAN.md س4). يُشغَّل من .github/workflows/monitor.yml ويمكن تشغيله يدوياً.
//
//   node scripts/security/check-live.mjs headers     ← الموقع يعمل، وترويسات الأمان كلها حاضرة، وsecurity.txt صالح
//   node scripts/security/check-live.mjs integrity   ← كل ملف منشور يطابق بايتاً ببايت إعادة بناء الـcommit المنشور
//                                                     (يتطلب out/integrity.json من بناء ذلك الـcommit)
//
// أي فشل ⇒ رمز خروج 1، فيُرسل GitHub إشعار فشل لمالك المستودع.
import fs from "node:fs";
import crypto from "node:crypto";

const SITE = (process.env.SITE_URL || "https://iraqmajors.com").replace(/\/$/, "");
const mode = process.argv[2];
const failures = [];
const fail = (m) => failures.push(m);

async function get(path, opts = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(SITE + path, { redirect: "follow", cache: "no-store", ...opts });
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

if (mode === "headers") {
  const PAGES = ["/", "/explorer", "/gpa-check", "/quiz", "/privacy"];
  const REQUIRED = {
    "strict-transport-security": /max-age=\d{8,}/,
    "content-security-policy": /script-src 'self'.*frame-ancestors 'none'/,
    "x-frame-options": /^DENY$/i,
    "x-content-type-options": /^nosniff$/i,
    "referrer-policy": /strict-origin-when-cross-origin/,
    "permissions-policy": /camera=\(\)/,
  };
  for (const p of PAGES) {
    const r = await get(p);
    if (r.status !== 200) fail(`${p}: الحالة ${r.status}`);
    for (const [h, re] of Object.entries(REQUIRED)) {
      const v = r.headers.get(h);
      if (!v || !re.test(v)) fail(`${p}: ترويسة ${h} مفقودة أو غير صحيحة (${v ?? "—"})`);
    }
    if (r.headers.get("access-control-allow-origin") === "*") fail(`${p}: Access-Control-Allow-Origin: * عاد`);
    const html = await r.text();
    if (!html.includes("منصة")) fail(`${p}: المحتوى لا يشبه الموقع (تشويه؟)`);
    if (/<script[^>]+src=["']https?:\/\//.test(html)) fail(`${p}: سكربت خارجي ظهر في الصفحة`);
    // كل سكربت مضمَّن يجب أن يكون هاشه في CSP الصفحة، وإلا يمنعه المتصفح فتتعطل الصفحة بصمت.
    // يكشف أيضاً ميزات Cloudflare التي تحقن سكربتات أو تعدّلها (Rocket Loader، Email Obfuscation، Web Analytics، Zaraz).
    const csp = r.headers.get("content-security-policy") || "";
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      const h = crypto.createHash("sha256").update(m[1], "utf8").digest("base64");
      if (!csp.includes(`'sha256-${h}'`)) {
        fail(`${p}: سكربت مضمَّن ليس في CSP (سيُمنع): ${m[1].slice(0, 60)}`);
        break;
      }
    }
  }
  const st = await get("/.well-known/security.txt");
  const body = st.status === 200 ? await st.text() : "";
  const exp = body.match(/^Expires:\s*(\S+)/m);
  if (!exp) fail("security.txt مفقود أو بلا Expires");
  else if (new Date(exp[1]) - Date.now() < 30 * 864e5)
    fail(`security.txt ينتهي خلال أقل من 30 يوماً (${exp[1]}): جدّده`);
  const data = await get("/data/by-branch/unknown.json", { method: "HEAD" });
  if (data.status !== 200) fail(`/data/by-branch/unknown.json (بيانات فاحص المعدل): الحالة ${data.status}`);
} else if (mode === "integrity") {
  const local = JSON.parse(fs.readFileSync("out/integrity.json", "utf8"));
  const liveVersion = await (await get("/version.json")).json();
  if (liveVersion.commit !== local.commit)
    fail(`الـcommit المنشور ${liveVersion.commit} ≠ المُعاد بناؤه ${local.commit}`);
  const entries = Object.entries(local.files);
  let checked = 0;
  const queue = [...entries];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const [file, hash] = queue.shift();
        const r = await get(file);
        if (r.status !== 200 && !file.endsWith("404.html")) {
          fail(`${file}: الحالة ${r.status}`);
          continue;
        }
        const got = crypto
          .createHash("sha256")
          .update(Buffer.from(await r.arrayBuffer()))
          .digest("hex");
        if (got !== hash) fail(`${file}: المحتوى الحي لا يطابق البناء من المصدر`);
        checked++;
      }
    })
  );
  console.log(`[integrity] فُحص ${checked}/${entries.length} ملفاً`);
} else {
  console.error("الاستعمال: check-live.mjs headers|integrity");
  process.exit(2);
}

// exitCode لا exit(): الخروج الفوري مع اتصالات fetch مفتوحة يُسقط Node على Windows.
if (failures.length) {
  console.error(`[${mode}] ✗ ${failures.length} مشكلة:\n  ` + failures.slice(0, 50).join("\n  "));
  process.exitCode = 1;
} else {
  console.log(`[${mode}] ✓ ${SITE} سليم`);
}
