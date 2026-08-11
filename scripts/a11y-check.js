#!/usr/bin/env node
/**
 * فحص إمكانية وصول آلي عبر axe-core لكل صفحات المنصة الحية (next dev محلياً،
 * لا موقع منشور). يطبع تقريراً مجمَّعاً حسب الخطورة، ويفشل (exit 1) فقط عند
 * وجود مخالفات critical/serious -- moderate/minor تُطبَع للاطلاع بلا إفشال
 * البناء (data/admission_rules.md §39: لا خط أساس تاريخي لعدد المخالفات بعد،
 * فالتشديد لحاجب صارم يحتاج تشغيلاً أول لمعرفته أولاً).
 *
 * الاستخدام: node scripts/a11y-check.js (أو npm run a11y-check)
 */
const { spawn, execFileSync } = require("child_process");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const ROOT = path.join(__dirname, "..");
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/** على Windows، server.kill() يقتل غلاف shell:true فقط، لا عملية next dev
 *  الحفيدة الفعلية الماسكة للمنفذ فعلياً -- تُترَك يتيمة تحجز المنفذ لأي
 *  تشغيل تالٍ (اكتُشف فعلياً 2026-08-11: فشل تشغيل ثانٍ بخطأ ERR_ABORTED
 *  بسبب خادم يتيم من تشغيل سابق لم يُقتَل فعلياً). taskkill /T يقتل شجرة
 *  العمليات كاملة. */
function killServerTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" });
    } catch {
      // العملية قد تكون انتهت فعلاً -- لا حاجة للإبلاغ عن هذا كخطأ
    }
  } else {
    child.kill();
  }
}

const ROUTES = [
  "/",
  "/quiz",
  "/explorer",
  "/gpa-check",
  "/wishlist",
  "/destinations",
  "/income",
  "/compare",
  "/report",
  "/decider",
];

const FAIL_ON_IMPACT = new Set(["critical", "serious"]);

function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error("انتهت مهلة انتظار خادم next dev"));
          else setTimeout(check, 1000);
        });
    };
    check();
  });
}

(async () => {
  console.log("⏳ تشغيل next dev...");
  // shell:true مع أمر نصّي واحد (لا مصفوفة args) -- يتفادى كلاً من عطل Windows
  // EINVAL عند spawn المباشر لـ npx.cmd، وتحذير عدم إفلات المعطيات الذي يظهر
  // فقط عند الجمع بين shell:true ومصفوفة args (اكتُشف فعلياً، 2026-08-11).
  const server = spawn(`npx next dev -p ${PORT}`, {
    cwd: ROOT,
    stdio: "ignore",
    shell: true,
  });

  let hadFailure = false;
  try {
    await waitForServer(BASE_URL);
    console.log("✅ الخادم جاهز — بدء الفحص\n");

    const browser = await chromium.launch();
    // AxeBuilder يشترط صفحة من context صريح -- browser.newPage() المختصرة
    // (تُنشئ context ضمنياً) تُرفَض بخطأ "Please use browser.newContext()"
    // رغم أنها Page صالحة فنياً (اكتُشف فعلياً عند أول تشغيل، 2026-08-11).
    const context = await browser.newContext();
    const page = await context.newPage();

    // إحماء: أول زيارة فعلية لأي مسار بعد تشغيل next dev طازجاً تُحفِّز
    // تجميعاً عند الطلب (on-demand compilation) قد يستغرق ثوانٍ -- waitForServer
    // أعلاه يتأكد فقط من استجابة HTTP، لا من اكتمال أول تصيير كامل. بلا هذا
    // الإحماء، أول مسار في القائمة (/) أنتج مخالفات وهمية عابرة (document-title/
    // html-has-lang غائبين وقتياً) في نصف عمليات التشغيل الفعلية -- لا تكرّرت
    // بعد إعادة المحاولة، مؤكِّدة أنها عطل توقيت لا عطل حقيقي (اكتُشف 2026-08-11).
    await page.goto(BASE_URL + "/", { waitUntil: "networkidle" });

    /** @type {Record<string, Record<string, number>>} */
    const tally = {};

    for (const route of ROUTES) {
      await page.goto(BASE_URL + route, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).analyze();

      const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      for (const v of results.violations) {
        const impact = v.impact || "minor";
        byImpact[impact] = (byImpact[impact] || 0) + v.nodes.length;
      }
      tally[route] = byImpact;

      const total = Object.values(byImpact).reduce((a, b) => a + b, 0);
      const flag = results.violations.some((v) => FAIL_ON_IMPACT.has(v.impact || "")) ? "❌" : total > 0 ? "⚠️ " : "✅";
      console.log(
        `${flag} ${route.padEnd(12)} critical=${byImpact.critical} serious=${byImpact.serious} moderate=${byImpact.moderate} minor=${byImpact.minor}`
      );

      for (const v of results.violations) {
        if (FAIL_ON_IMPACT.has(v.impact || "")) {
          hadFailure = true;
          console.log(`   [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} عنصراً)`);
        }
      }
    }

    await browser.close();

    console.log("\n" + (hadFailure ? "❌ توجد مخالفات critical/serious يجب إصلاحها." : "✅ لا مخالفات critical/serious."));
  } finally {
    killServerTree(server);
  }

  process.exit(hadFailure ? 1 : 0);
})();
