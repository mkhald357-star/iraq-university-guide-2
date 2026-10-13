// تثبيت إعدادات GitHub الأمنية آلياً (SECURITY-PLAN.md س3، RUNBOOK.md §7 قسم GitHub).
//
//   $env:GITHUB_TOKEN = "<رمز>"                     ← PowerShell، في طرفيتك أنت (لا تلصقه في أي محادثة)
//   node scripts/security/apply-github.mjs          ← معاينة فقط
//   node scripts/security/apply-github.mjs --apply  ← ينفّذ
//
// الرمز: Fine-grained token على المستودع وحده، صلاحية Repository → Administration: Read and write.
// لا يمسّ حماية الفرع ولا الأسرار ولا المحتوى. يمكن تكراره بأمان.
// لا يطمس إعداداً قائماً بصمت: قائمة الإجراءات المسموحة الحالية (patterns_allowed) تُحفَظ، وما يُغيَّر يُبلَّغ به.
// بعد كل كتابة يُعاد القراءة للتحقق: «فُعِّل» لا تُطبع إلا إن أكّد GitHub القيمة.
// رمز الخروج: 0 سليم، 1 فشل/تحقق يدوي مطلوب، 2 خطأ استعمال أو وصول.
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO || "mkhald357-star/iraq-university-guide";
const API = process.env.GITHUB_API_BASE || "https://api.github.com";
const APPLY = process.argv.includes("--apply");

if (!TOKEN) {
  console.error("GITHUB_TOKEN غير مضبوط. أنشئ رمزاً مقيّداً (انظر رأس الملف) واضبطه في طرفيتك فقط.");
  process.exit(2);
}

// رمز حقيقي: أحرف ASCII مرئية فقط وطول معقول. يلتقط ترك النص النائب («الصق_الرمز_هنا») قبل أي طلب.
if (!/^[!-~]{20,}$/.test(TOKEN)) {
  console.error(
    "قيمة GITHUB_TOKEN ليست رمزاً صالحاً (يبدو أنها النص النائب أو فيها مسافات/حروف عربية). ضع رمز GitHub (يبدأ بـ github_pat_)."
  );
  process.exit(2);
}

async function gh(method, path, body) {
  const res = await fetch(`${API}/repos/${REPO}${path}`, {
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
const fail = (msg) => {
  failures++;
  log("!", msg);
};

// بند منطقي: read() يعيد { state: "on" | "off" | "unreadable", detail }، write() يعيد { ok, status, message }
async function ensure(label, read, write) {
  const before = await read();
  if (before.state === "on") return log("✓", `${label} — مفعّل`);
  if (before.state === "unreadable")
    return fail(`${label} — تعذّرت القراءة (${before.detail}): تحقّق من صلاحيات الرمز`);
  if (!APPLY) {
    pending++;
    return log("＋", `${label} — سيُفعَّل`);
  }
  const r = await write();
  if (!r.ok) return fail(`${label} — فشل (${r.status}): ${r.message ?? ""}`);
  const after = await read();
  if (after.state === "on") {
    pending++;
    return log("＋", `${label} — فُعِّل (وتحقّقنا بإعادة القراءة)`);
  }
  fail(`${label} — أُرسل الطلب لكن GitHub لم يؤكّد التفعيل بعد إعادة القراءة: فعّله يدوياً وتحقّق`);
}

async function main() {
  const repo = await gh("GET", "");
  if (repo.status !== 200) {
    console.error(`تعذّر الوصول إلى ${REPO} (${repo.status}): ${repo.json?.message ?? ""}`);
    return 2;
  }
  console.log(`${REPO}  (${repo.json.private ? "خاص" : "عام"})  — ${APPLY ? "تنفيذ" : "معاينة فقط"}\n`);

  await ensure(
    "Dependabot alerts",
    async () => {
      const r = await gh("GET", "/vulnerability-alerts");
      if (r.status === 204) return { state: "on" };
      if (r.status === 404) return { state: "off" };
      return { state: "unreadable", detail: `${r.status}` };
    },
    async () => {
      const r = await gh("PUT", "/vulnerability-alerts");
      return { ok: r.status === 204, status: r.status, message: r.json?.message };
    }
  );

  await ensure(
    "Dependabot security updates",
    async () => {
      const r = await gh("GET", "/automated-security-fixes");
      if (r.status === 200) return { state: r.json?.enabled === true ? "on" : "off" };
      if (r.status === 404) return { state: "off" };
      return { state: "unreadable", detail: `${r.status}` };
    },
    async () => {
      const r = await gh("PUT", "/automated-security-fixes");
      return { ok: r.status === 204, status: r.status, message: r.json?.message };
    }
  );

  // Actions: إجراءات GitHub وحدها، وتثبيت كامل بالـSHA (سير CI والمراقبة يستعملان actions/* مثبّتة بالـSHA)
  const readPerms = async () => {
    const r = await gh("GET", "/actions/permissions");
    if (r.status !== 200) return { unreadable: `${r.status}` };
    return { allowed: r.json?.allowed_actions, sha: r.json?.sha_pinning_required === true };
  };
  const perms = await readPerms();
  if (perms.unreadable) {
    fail(`Actions — تعذّرت القراءة (${perms.unreadable}): تحقّق من صلاحيات الرمز`);
  } else {
    // قائمة السماح الحالية: تُقرأ لتُحفَظ لا لتُطمَس
    const selected = await gh("GET", "/actions/permissions/selected-actions");
    const cur =
      selected.status === 200
        ? selected.json
        : { github_owned_allowed: false, verified_allowed: false, patterns_allowed: [] };
    const allowedOk = perms.allowed === "selected" && cur.github_owned_allowed === true;
    if (allowedOk && perms.sha) {
      log("✓", "Actions: إجراءات محدّدة + تثبيت بالـSHA — مفعّل");
    } else if (!APPLY) {
      pending++;
      log(
        "＋",
        `Actions: سيُضبط (allowed=${perms.allowed}, github_owned=${cur.github_owned_allowed}, sha_pinning=${perms.sha})`
      );
    } else {
      const manual = [];
      let r = await gh("PUT", "/actions/permissions", {
        enabled: true,
        allowed_actions: "selected",
        sha_pinning_required: true,
      });
      if (r.status === 422) {
        r = await gh("PUT", "/actions/permissions", { enabled: true, allowed_actions: "selected" });
      }
      if (r.status !== 204) {
        fail(`Actions — فشل (${r.status}): ${r.json?.message ?? ""}`);
      } else {
        // يُحفظ كل ما هو قائم (verified/patterns) ويُضاف السماح لإجراءات GitHub فقط
        const keep = {
          github_owned_allowed: true,
          verified_allowed: cur.verified_allowed === true,
          patterns_allowed: Array.isArray(cur.patterns_allowed) ? cur.patterns_allowed : [],
        };
        const s = await gh("PUT", "/actions/permissions/selected-actions", keep);
        if (s.status !== 204) {
          fail(`Actions (selected-actions) — فشل (${s.status}): ${s.json?.message ?? ""}`);
        } else {
          if (keep.verified_allowed || keep.patterns_allowed.length) {
            manual.push(
              `سماح إضافي قائم تُرك كما هو (verified=${keep.verified_allowed}, patterns=${JSON.stringify(keep.patterns_allowed)}): راجعه إن أردت «إجراءات GitHub فقط»`
            );
          }
          const after = await readPerms();
          if (after.unreadable || after.allowed !== "selected") {
            fail("Actions — لم يؤكّد GitHub وضع «إجراءات محدّدة» بعد إعادة القراءة: افحصه يدوياً");
          } else if (!after.sha) {
            fail(
              "Actions — تثبيت الإجراءات بالـSHA لم يتفعّل (لم يؤكّده GitHub): فعّله يدوياً من Settings ← Actions ← General"
            );
          } else {
            pending++;
            log("＋", "Actions: إجراءات محدّدة + تثبيت بالـSHA — فُعِّل (وتحقّقنا بإعادة القراءة)");
          }
          for (const m of manual) log("ⓘ", m);
        }
      }
    }
  }

  console.log(`\n${APPLY ? "نُفِّذ" : "سيتغيّر"}: ${pending} بنداً${failures ? `، ${failures} تحتاج مراجعة` : ""}.`);
  if (!APPLY && pending) console.log("للتنفيذ: أعد التشغيل مع --apply");
  console.log("\nيدوي لا يغطيه الـAPI: المصادقة الثنائية، وإشعارات فشل Actions في إعداداتك الشخصية.");
  return failures ? 1 : 0;
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
