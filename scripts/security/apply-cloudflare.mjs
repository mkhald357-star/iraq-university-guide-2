// تثبيت إعدادات Cloudflare الأمنية آلياً (SECURITY-PLAN.md س3، RUNBOOK.md §7).
//
//   $env:CLOUDFLARE_API_TOKEN = "<رمز>"            ← PowerShell، في طرفيتك أنت (لا تلصقه في أي محادثة)
//   node scripts/security/apply-cloudflare.mjs            ← يعرض ما سيتغيّر فقط (بلا أي كتابة)
//   node scripts/security/apply-cloudflare.mjs --apply    ← ينفّذ
//
// صلاحيات الرمز (Custom Token) على النطاق iraqmajors.com وحده:
//   Zone: Read · DNS: Edit · DNSSEC: Edit · Zone Settings: Edit
//
// مبادئ: لا يطبع الرمز ولا يحفظه. لا يعدّل سجلاً موجوداً بقيمة مختلفة (يُبلغ بالتعارض فقط).
// لا يمسّ سجلات A/CNAME ولا إعدادات الاستضافة. يمكن تكراره بأمان (idempotent).
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DOMAIN = (process.env.SITE_HOST || "iraqmajors.com").toLowerCase();
const APPLY = process.argv.includes("--apply");
const API = process.env.CLOUDFLARE_API_BASE || "https://api.cloudflare.com/client/v4";

if (!TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN غير مضبوط. أنشئ رمزاً مقيّداً (انظر رأس الملف) واضبطه في طرفيتك فقط.");
  process.exit(2);
}

async function cf(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`${method} ${path}: رد غير JSON (${res.status})`);
  }
  if (!json.success) {
    const msg = (json.errors || []).map((e) => `${e.code}: ${e.message}`).join("; ") || `HTTP ${res.status}`;
    throw new Error(`${method} ${path}: ${msg}`);
  }
  return json.result;
}

const log = (sym, msg) => console.log(`${sym} ${msg}`);
let pending = 0;
let conflicts = 0;

// ── النطاق ─────────────────────────────────────────────────────────────
const zones = await cf("GET", `/zones?name=${encodeURIComponent(DOMAIN)}`);
if (!zones.length) {
  console.error(`لا يوجد نطاق ${DOMAIN} في هذا الحساب/الرمز.`);
  process.exit(2);
}
const zone = zones[0];
console.log(`${DOMAIN}  (zone ${zone.id}, ${zone.status})  — ${APPLY ? "تنفيذ" : "معاينة فقط"}\n`);

// ── سجلات DNS ──────────────────────────────────────────────────────────
const existing = await cf("GET", `/zones/${zone.id}/dns_records?per_page=500`);
const fqdn = (n) => (n === "@" ? DOMAIN : `${n}.${DOMAIN}`);

const DESIRED = [
  {
    type: "CAA",
    name: "@",
    note: "CAA: يحصر الإصدار بـ letsencrypt.org (Cloudflare يضيف جهاته لشهادة Universal SSL تلقائياً)",
    body: { type: "CAA", name: DOMAIN, ttl: 1, data: { flags: 0, tag: "issue", value: "letsencrypt.org" } },
    same: (r) => r.type === "CAA" && r.data?.tag === "issue" && r.data?.value === "letsencrypt.org",
    anyOfType: (r) => r.type === "CAA" && r.name === DOMAIN && r.data?.tag === "issue",
  },
  {
    type: "TXT",
    name: "@",
    note: "SPF: لا بريد على النطاق",
    body: { type: "TXT", name: DOMAIN, ttl: 1, content: "v=spf1 -all" },
    same: (r) => r.type === "TXT" && r.name === DOMAIN && /^"?v=spf1\s+-all"?$/i.test(r.content.trim()),
    anyOfType: (r) => r.type === "TXT" && r.name === DOMAIN && /^"?v=spf1/i.test(r.content.trim()),
  },
  {
    type: "TXT",
    name: "_dmarc",
    note: "DMARC: p=reject",
    body: {
      type: "TXT",
      name: fqdn("_dmarc"),
      ttl: 1,
      content: "v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s",
    },
    same: (r) => r.type === "TXT" && r.name === fqdn("_dmarc") && /\bp=reject\b/i.test(r.content),
    anyOfType: (r) => r.type === "TXT" && r.name === fqdn("_dmarc"),
  },
  {
    type: "TXT",
    name: "*._domainkey",
    note: "DKIM فارغ: لا مفتاح يوقّع بريداً باسم النطاق",
    body: { type: "TXT", name: fqdn("*._domainkey"), ttl: 1, content: "v=DKIM1; p=" },
    same: (r) => r.type === "TXT" && r.name === fqdn("*._domainkey") && /v=DKIM1;\s*p=\s*"?$/i.test(r.content.trim()),
    anyOfType: (r) => r.type === "TXT" && r.name === fqdn("*._domainkey"),
  },
];

for (const d of DESIRED) {
  if (existing.some(d.same)) {
    log("✓", `${d.note} — موجود`);
    continue;
  }
  const other = existing.find(d.anyOfType);
  if (other) {
    conflicts++;
    log(
      "!",
      `${d.note} — تعارض: يوجد سجل بقيمة مختلفة (${other.content ?? JSON.stringify(other.data)}). لم يُعدَّل، راجعه يدوياً`
    );
    continue;
  }
  pending++;
  if (APPLY) {
    await cf("POST", `/zones/${zone.id}/dns_records`, d.body);
    log("＋", `${d.note} — أُضيف`);
  } else {
    log("＋", `${d.note} — سيُضاف`);
  }
}

// ── إعدادات المنطقة ────────────────────────────────────────────────────
const SETTINGS = [
  ["ssl", "strict", "SSL/TLS: Full (strict)"],
  ["always_use_https", "on", "Always Use HTTPS"],
  ["min_tls_version", "1.2", "Minimum TLS 1.2"],
  ["automatic_https_rewrites", "on", "Automatic HTTPS Rewrites"],
  ["rocket_loader", "off", "Rocket Loader معطّل (يحقن سكربتات فيكسر CSP)"],
  ["email_obfuscation", "off", "Email Address Obfuscation معطّل (يحقن سكربتاً)"],
];
for (const [id, want, label] of SETTINGS) {
  let cur;
  try {
    cur = (await cf("GET", `/zones/${zone.id}/settings/${id}`)).value;
  } catch (e) {
    log("?", `${label} — تعذّرت القراءة (${e.message})`);
    continue;
  }
  if (cur === want) {
    log("✓", `${label} — مفعّل`);
    continue;
  }
  pending++;
  if (APPLY) {
    try {
      await cf("PATCH", `/zones/${zone.id}/settings/${id}`, { value: want });
      log("＋", `${label} — ضُبط (كان ${cur})`);
    } catch (e) {
      pending--;
      conflicts++;
      log("!", `${label} — فشل الضبط: ${e.message}`);
    }
  } else {
    log("＋", `${label} — سيُضبط (الآن ${cur})`);
  }
}

// ── DNSSEC ─────────────────────────────────────────────────────────────
try {
  let dnssec = await cf("GET", `/zones/${zone.id}/dnssec`);
  if (dnssec.status !== "active") {
    pending++;
    if (APPLY) {
      dnssec = await cf("PATCH", `/zones/${zone.id}/dnssec`, { status: "active" });
      log("＋", `DNSSEC — فُعِّل (الحالة: ${dnssec.status})`);
    } else {
      log("＋", `DNSSEC — سيُفعَّل (الحالة الآن: ${dnssec.status})`);
    }
  } else {
    log("✓", "DNSSEC — مفعّل عند Cloudflare");
  }
  if (dnssec.ds) {
    console.log("\nسجل DS: أضفه عند المسجِّل (من لوحته، قسم DNSSEC) إن لم يكن Cloudflare مسجِّلك:");
    console.log(`  DS        : ${dnssec.ds}`);
    console.log(
      `  Key tag   : ${dnssec.key_tag}   Algorithm: ${dnssec.algorithm} ${dnssec.algorithm_name ? `(${dnssec.algorithm_name})` : ""}`
    );
    console.log(
      `  Digest    : ${dnssec.digest}   Type: ${dnssec.digest_type} ${dnssec.digest_algorithm ? `(${dnssec.digest_algorithm})` : ""}`
    );
  }
} catch (e) {
  conflicts++;
  log("!", `DNSSEC — ${e.message}`);
}

// ── الخلاصة ────────────────────────────────────────────────────────────
console.log(
  `\n${APPLY ? "نُفِّذ" : "سيتغيّر"}: ${pending} بنداً${conflicts ? `، ${conflicts} تحتاج مراجعة يدوية` : ""}.`
);
if (!APPLY && pending) console.log("للتنفيذ: أعد التشغيل مع --apply");
console.log("\nالتحقق من الخارج بعد دقائق (انتشار DNS): node scripts/security/check-owner-checklist.mjs");
console.log(
  "يدوي لا يغطيه الـAPI: تعطيل Web Analytics التلقائي وZaraz (على مستوى الحساب)، المصادقة الثنائية، قفل النقل عند المسجِّل."
);
process.exitCode = conflicts ? 1 : 0; // لا process.exit: يكسر Node على ويندوز أثناء إغلاق مقابض fetch
