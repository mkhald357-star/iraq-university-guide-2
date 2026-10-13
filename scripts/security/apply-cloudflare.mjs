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
// لا يُضعف إعداداً أشدّ من المطلوب (TLS 1.3 يبقى 1.3، وstrict يبقى strict). لا يمسّ سجلات A/CNAME.
// يمكن تكراره بأمان (idempotent). رمز الخروج: 0 سليم، 1 تعارض/فشل بند، 2 خطأ استعمال أو وصول.
// ملاحظة: المعاينة تخرج بـ0 حتى مع تغييرات معلّقة (لا تصلح كبوابة CI؛ للتحقق الآلي استعمل check-owner-checklist).
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DOMAIN = (process.env.SITE_HOST || "iraqmajors.com").toLowerCase();
const APPLY = process.argv.includes("--apply");
// --skip=ssl,dnssec : يستثني بنوداً. الصيغتان --skip=a,b و--skip a,b مقبولتان وغير حسّاستين لحالة الأحرف.
// الأسماء: dns، dnssec، أو معرّف أي إعداد (ssl، always_use_https، min_tls_version، automatic_https_rewrites،
// rocket_loader، email_obfuscation). اسم غير معروف = خطأ استعمال (لا يُتجاهل بصمت).
const SKIP_IDS = [
  "dns",
  "dnssec",
  "ssl",
  "always_use_https",
  "min_tls_version",
  "automatic_https_rewrites",
  "rocket_loader",
  "email_obfuscation",
];
function parseSkip(argv) {
  const out = [];
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a.startsWith("--skip=")) out.push(...a.slice(7).split(","));
    else if (a === "--skip") out.push(...(argv[++k] || "").split(","));
  }
  return out.map((x) => x.trim().toLowerCase()).filter(Boolean);
}
const SKIP_LIST = parseSkip(process.argv.slice(2));
const badSkip = SKIP_LIST.filter((x) => !SKIP_IDS.includes(x));
if (badSkip.length) {
  console.error(`--skip: اسم غير معروف (${badSkip.join(", ")}). المسموح: ${SKIP_IDS.join(", ")}`);
  process.exit(2);
}
const SKIP = new Set(SKIP_LIST);
const API = process.env.CLOUDFLARE_API_BASE || "https://api.cloudflare.com/client/v4";

if (!TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN غير مضبوط. أنشئ رمزاً مقيّداً (انظر رأس الملف) واضبطه في طرفيتك فقط.");
  process.exit(2);
}

// رمز حقيقي: أحرف ASCII مرئية فقط وطول معقول. يلتقط ترك النص النائب («الصق_الرمز_هنا») قبل أي طلب.
if (!/^[!-~]{20,}$/.test(TOKEN)) {
  console.error(
    "قيمة CLOUDFLARE_API_TOKEN ليست رمزاً صالحاً (يبدو أنها النص النائب أو فيها مسافات/حروف عربية). ضع رمز Cloudflare (حوالي 40 حرفاً لاتينياً)."
  );
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

async function main() {
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
      same: (r) =>
        r.type === "CAA" && r.name === DOMAIN && r.data?.tag === "issue" && r.data?.value === "letsencrypt.org",
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
    if (SKIP.has("dns")) break;
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
    if (APPLY) {
      try {
        await cf("POST", `/zones/${zone.id}/dns_records`, d.body);
        pending++;
        log("＋", `${d.note} — أُضيف`);
      } catch (e) {
        conflicts++;
        log("!", `${d.note} — فشل الإضافة: ${e.message}`);
      }
    } else {
      pending++;
      log("＋", `${d.note} — سيُضاف`);
    }
  }

  // ── إعدادات المنطقة ────────────────────────────────────────────────────
  // قيمة حالية أشدّ من المطلوب لا تُخفَّض: TLS 1.3 أشدّ من 1.2، وstrict/strict_origin_pull أشدّ من full
  const satisfied = (id, cur, want) => {
    if (cur === want) return true;
    if (id === "min_tls_version") return parseFloat(cur) >= parseFloat(want);
    if (id === "ssl") return cur === "strict" || cur === "origin_pull";
    return false;
  };
  const SETTINGS = [
    ["ssl", "strict", "SSL/TLS: Full (strict)"],
    ["always_use_https", "on", "Always Use HTTPS"],
    ["min_tls_version", "1.2", "Minimum TLS 1.2"],
    ["automatic_https_rewrites", "on", "Automatic HTTPS Rewrites"],
    ["rocket_loader", "off", "Rocket Loader معطّل (يحقن سكربتات فيكسر CSP)"],
    ["email_obfuscation", "off", "Email Address Obfuscation معطّل (يحقن سكربتاً)"],
  ];
  for (const [id, want, label] of SETTINGS) {
    if (SKIP.has(id)) {
      log("↷", `${label} — مستثنى (--skip)`);
      continue;
    }
    let cur;
    try {
      cur = (await cf("GET", `/zones/${zone.id}/settings/${id}`)).value;
    } catch (e) {
      log("?", `${label} — تعذّرت القراءة (${e.message})`);
      continue;
    }
    if (satisfied(id, cur, want)) {
      log("✓", `${label} — ${cur === want ? "مفعّل" : `القيمة الحالية (${cur}) أشدّ من المطلوب، تُركت`}`);
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
  if (SKIP.has("dnssec")) {
    log("↷", "DNSSEC — مستثنى (--skip)");
  } else
    try {
      let dnssec = await cf("GET", `/zones/${zone.id}/dnssec`);
      if (dnssec.status === "active") {
        log("✓", "DNSSEC — مفعّل");
      } else if (dnssec.status === "pending") {
        // مفعَّل عند Cloudflare وينتظر انتشار DS عند المسجِّل/السجل: لا طلب جديد (يبقى ✗ في الفاحص الخارجي حتى يظهر DS)
        log("…", "DNSSEC — معلَّق (pending): بانتظار ظهور DS في سجل النطاق، لا إجراء مطلوب الآن");
      } else if (dnssec.status === "disabled") {
        pending++;
        if (APPLY) {
          dnssec = await cf("PATCH", `/zones/${zone.id}/dnssec`, { status: "active" });
          log("＋", `DNSSEC — فُعِّل (الحالة: ${dnssec.status})`);
        } else {
          log("＋", `DNSSEC — سيُفعَّل (الحالة الآن: ${dnssec.status})`);
        }
      } else {
        conflicts++;
        log("!", `DNSSEC — حالة غير متوقعة (${dnssec.status}): راجعها في اللوحة`);
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
  return conflicts ? 1 : 0;
}

// لا process.exit بعد fetch: يكسر Node على ويندوز أثناء إغلاق المقابض، فنضبط exitCode فقط
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(`فشل: ${e && e.message ? e.message : e}`);
    process.exitCode = 2;
  });
