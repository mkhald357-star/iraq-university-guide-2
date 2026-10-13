// فحص البنود الخارجية من قائمة المالك (RUNBOOK.md §7) بقراءة عامة فقط، بلا حساب ولا مفتاح:
// DNS عبر DNS-over-HTTPS (dns.google)، وTLS وHTTP مباشرة على النطاق.
//
//   node scripts/security/check-owner-checklist.mjs            ← الجدول، ورمز خروج 1 إن بقي بند مفتوح
//   SITE_HOST=example.com node scripts/security/check-owner-checklist.mjs
//
// يُشغَّل بعد كل تغيير في لوحة Cloudflare أو المسجِّل ليصير «تم» دليلاً لا ادّعاءً.
// لا يغطي ما لا يُرى من الخارج: المصادقة الثنائية، قفل النقل، إعدادات GitHub.
import tls from "node:tls";

const HOST = (process.env.SITE_HOST || "iraqmajors.com").toLowerCase();
const results = [];
// ok: true | false | null (null = لا يمكن الحكم من هذا الجهاز، لا يُحسب نجاحاً ولا فشلاً)
const check = (area, item, ok, detail) => results.push({ area, item, ok, detail });

async function doh(name, type) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(15000) });
      const j = await r.json();
      return {
        status: j.Status,
        ad: !!j.AD,
        data: (j.Answer || []).filter((a) => a.type !== 5).map((a) => String(a.data)),
      };
    } catch (e) {
      if (attempt >= 3) return { status: -1, ad: false, data: [], error: String(e.message || e) };
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

const unquote = (s) => s.replace(/^"|"$/g, "").replace(/" "/g, "");

// ── DNS ────────────────────────────────────────────────────────────────
const ns = await doh(HOST, "NS");
check(
  "DNS",
  "الخوادم الاسمية على Cloudflare",
  ns.data.some((d) => /\.ns\.cloudflare\.com\.?$/i.test(d)),
  ns.data.join(", ") || "لا إجابة"
);

const caa = await doh(HOST, "CAA");
check(
  "DNS",
  'سجل CAA يحصر الإصدار (issue "letsencrypt.org")',
  caa.data.some((d) => /\bissue\b.*letsencrypt\.org/i.test(d)),
  caa.data.join(" | ") || "لا سجل CAA"
);

const txt = await doh(HOST, "TXT");
check(
  "DNS",
  "SPF: v=spf1 -all (لا بريد على النطاق)",
  txt.data.some((d) => /^v=spf1\s+-all$/i.test(unquote(d).trim())),
  txt.data.map(unquote).join(" | ") || "لا سجل TXT"
);

const dmarc = await doh(`_dmarc.${HOST}`, "TXT");
check(
  "DNS",
  "DMARC: p=reject",
  dmarc.data.some((d) => /\bp=reject\b/i.test(unquote(d))),
  dmarc.data.map(unquote).join(" | ") || "لا سجل _dmarc"
);

const dkim = await doh(`check._domainkey.${HOST}`, "TXT");
check(
  "DNS",
  "DKIM الفارغ (*._domainkey)",
  dkim.data.some((d) => /v=DKIM1;\s*p=\s*$/i.test(unquote(d).trim())),
  dkim.data.map(unquote).join(" | ") || "لا سجل"
);

const ds = await doh(HOST, "DS");
const a = await doh(HOST, "A");
check(
  "DNS",
  "DNSSEC: سجل DS عند الأب + تحقق ناجح (AD)",
  ds.data.length > 0 && a.ad,
  `DS=${ds.data.length ? "موجود" : "لا يوجد"}، AD=${a.ad}`
);

// ── HTTP/TLS ───────────────────────────────────────────────────────────
try {
  const r = await fetch(`http://${HOST}/`, { redirect: "manual", signal: AbortSignal.timeout(15000) });
  const loc = r.headers.get("location") || "";
  check(
    "TLS",
    "HTTP يُحوَّل إلى HTTPS",
    r.status >= 300 && r.status < 400 && loc.startsWith(`https://${HOST}`),
    `${r.status} → ${loc || "لا تحويل"}`
  );
} catch (e) {
  check("TLS", "HTTP يُحوَّل إلى HTTPS", false, String(e.message || e));
}

const tlsProbe = (version) =>
  new Promise((resolve) => {
    const sock = tls.connect(
      { host: HOST, port: 443, servername: HOST, minVersion: version, maxVersion: version, timeout: 10000 },
      () => {
        const v = sock.getProtocol();
        sock.end();
        resolve({ accepted: true, v });
      }
    );
    sock.on("error", (e) => resolve({ accepted: false, v: e.code || e.message }));
    sock.on("timeout", () => {
      sock.destroy();
      resolve({ accepted: false, v: "timeout" });
    });
  });
const t11 = await tlsProbe("TLSv1.1");
const t12 = await tlsProbe("TLSv1.2");
const t13 = await tlsProbe("TLSv1.3");
// OpenSSL الحديث يرفض TLS 1.1 محلياً قبل أي اتصال، فلا يدلّ ذلك على سلوك الخادم: غير حاسم لا نجاح
const localBlock =
  !t11.accepted &&
  /NO_PROTOCOLS_AVAILABLE|UNSUPPORTED_PROTOCOL|WRONG_SSL_VERSION|INVALID_(MIN|MAX)/i.test(String(t11.v));
check(
  "TLS",
  "TLS 1.0/1.1 مرفوض من الخادم",
  localBlock ? null : !t11.accepted,
  t11.accepted
    ? `قُبل ${t11.v}`
    : localBlock
      ? `غير قابل للفحص من هذا الجهاز (${t11.v}): تحقّق عبر https://www.ssllabs.com/ssltest/analyze.html?d=${HOST}`
      : `رُفض (${t11.v})`
);
check("TLS", "TLS 1.2 و1.3 مقبولان", t12.accepted && t13.accepted, `1.2=${t12.accepted}، 1.3=${t13.accepted}`);

// ── الإخراج ────────────────────────────────────────────────────────────
console.log(`فحص قائمة المالك الخارجي لـ ${HOST}  (${new Date().toISOString().slice(0, 10)})\n`);
for (const r of results)
  console.log(`${r.ok === null ? "?" : r.ok ? "✓" : "✗"} [${r.area}] ${r.item}
    ${r.detail}`);
const open = results.filter((r) => r.ok === false);
const unknown = results.filter((r) => r.ok === null);
console.log(
  `
${results.filter((r) => r.ok === true).length}/${results.length} مستوفاة` +
    (open.length ? `، ${open.length} مفتوحة` : "") +
    (unknown.length ? `، ${unknown.length} غير حاسمة (تحقّق خارجي)` : "")
);
process.exit(open.length ? 1 : 0);
