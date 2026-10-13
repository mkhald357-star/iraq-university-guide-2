// تثبيت إعدادات GitHub الأمنية آلياً (SECURITY-PLAN.md س3، RUNBOOK.md §7 قسم GitHub).
//
//   $env:GITHUB_TOKEN = "<رمز>"                     ← PowerShell، في طرفيتك أنت (لا تلصقه في أي محادثة)
//   node scripts/security/apply-github.mjs          ← معاينة فقط
//   node scripts/security/apply-github.mjs --apply  ← ينفّذ
//
// الرمز: Fine-grained token على المستودع وحده، صلاحية Repository → Administration: Read and write.
// لا يمسّ حماية الفرع ولا الأسرار ولا المحتوى. يمكن تكراره بأمان.
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO || "mkhald357-star/iraq-university-guide";
const APPLY = process.argv.includes("--apply");

if (!TOKEN) {
  console.error("GITHUB_TOKEN غير مضبوط. أنشئ رمزاً مقيّداً (انظر رأس الملف) واضبطه في طرفيتك فقط.");
  process.exit(2);
}

async function gh(method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  let json = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text.slice(0, 200) };
    }
  }
  return { status: res.status, json };
}

const log = (sym, msg) => console.log(`${sym} ${msg}`);
let pending = 0;
let failures = 0;
async function ensure(label, readOk, write) {
  if (await readOk()) return log("✓", `${label} — مفعّل`);
  pending++;
  if (!APPLY) return log("＋", `${label} — سيُفعَّل`);
  const r = await write();
  if (r.ok) return log("＋", `${label} — فُعِّل`);
  pending--;
  failures++;
  log("!", `${label} — فشل (${r.status}): ${r.message}`);
}

const repo = await gh("GET", "");
if (repo.status !== 200) {
  console.error(`تعذّر الوصول إلى ${REPO} (${repo.status}): ${repo.json?.message ?? ""}`);
  process.exit(2);
}
console.log(`${REPO}  (${repo.json.private ? "خاص" : "عام"})  — ${APPLY ? "تنفيذ" : "معاينة فقط"}\n`);

await ensure(
  "Dependabot alerts",
  async () => (await gh("GET", "/vulnerability-alerts")).status === 204,
  async () => {
    const r = await gh("PUT", "/vulnerability-alerts");
    return { ok: r.status === 204, status: r.status, message: r.json?.message };
  }
);

await ensure(
  "Dependabot security updates",
  async () => (await gh("GET", "/automated-security-fixes")).json?.enabled === true,
  async () => {
    const r = await gh("PUT", "/automated-security-fixes");
    return { ok: r.status === 204, status: r.status, message: r.json?.message };
  }
);

// Actions: إجراءات GitHub وحدها، وتثبيت كامل بالـSHA (سير CI والمراقبة يستعملان actions/* مثبّتة بالـSHA)
const perms = await gh("GET", "/actions/permissions");
const allowedOk = perms.json?.allowed_actions === "selected";
const shaOk = perms.json?.sha_pinning_required === true;
if (allowedOk && shaOk) {
  log("✓", "Actions: إجراءات GitHub فقط + تثبيت بالـSHA — مفعّل");
} else {
  pending++;
  if (!APPLY) {
    log(
      "＋",
      `Actions: سيُضبط (allowed=${perms.json?.allowed_actions}, sha_pinning=${perms.json?.sha_pinning_required})`
    );
  } else {
    let r = await gh("PUT", "/actions/permissions", {
      enabled: true,
      allowed_actions: "selected",
      sha_pinning_required: true,
    });
    if (r.status === 422) {
      // المستودع/الخطة لا تدعم الحقل: نضبط ما يمكن ونبلغ بما بقي يدوياً
      r = await gh("PUT", "/actions/permissions", { enabled: true, allowed_actions: "selected" });
      if (r.status === 204)
        log("!", "تثبيت الإجراءات بالـSHA غير مدعوم عبر الـAPI هنا: فعّله يدوياً (Settings ← Actions ← General)");
    }
    if (r.status === 204) {
      const s = await gh("PUT", "/actions/permissions/selected-actions", {
        github_owned_allowed: true,
        verified_allowed: false,
        patterns_allowed: [],
      });
      if (s.status === 204) log("＋", "Actions: إجراءات GitHub فقط — فُعِّل");
      else {
        pending--;
        failures++;
        log("!", `Actions (selected-actions) — فشل (${s.status}): ${s.json?.message}`);
      }
    } else {
      pending--;
      failures++;
      log("!", `Actions — فشل (${r.status}): ${r.json?.message}`);
    }
  }
}

console.log(`\n${APPLY ? "نُفِّذ" : "سيتغيّر"}: ${pending} بنداً${failures ? `، ${failures} فشلت` : ""}.`);
if (!APPLY && pending) console.log("للتنفيذ: أعد التشغيل مع --apply");
console.log("\nيدوي لا يغطيه الـAPI: المصادقة الثنائية، وإشعارات فشل Actions في إعداداتك الشخصية.");
process.exitCode = failures ? 1 : 0;
