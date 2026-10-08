// فحص حي بمتصفح حقيقي (Chromium عبر Playwright) على التصدير الثابت out/ -- يخدمه خادم محلي صغير.
// يتحقق: لا عبارة "قبول مباشر" على أي قسم حكومي، وحاشية "حدّ أدنى" للمسائي، و"لا حدّ منشور" للأقسام بلا رقم،
// ويلتقط لقطات شاشة إلى reports/admission-fix/screens/. يتطلب npm run build قبله.
// الاستخدام: node scripts/admission-fix/live-check.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "out");
const SHOTS = path.join(ROOT, "reports", "admission-fix", "screens");
fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 3200;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(OUT, p);
  if (!f.startsWith(OUT)) return res.writeHead(403).end();
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  if (!fs.existsSync(f)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(fs.existsSync(path.join(OUT, "404.html")) ? fs.readFileSync(path.join(OUT, "404.html")) : "404");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "[OK]  " : "[FAIL]"} ${name}${detail ? " -- " + detail : ""}`);
};

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-IQ" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  const body = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const go = async (url, shot, wait = 2500) => {
    await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(wait);
    if (shot) await page.screenshot({ path: path.join(SHOTS, shot), fullPage: true });
    return body();
  };

  // 1) التقرير: تخصص فيه رقم تنافسي + مسائي + أقسام بلا رقم
  for (const [major, shot] of [
    ["petroleum_engineering", "report-petroleum.png"],
    ["nursing", "report-nursing.png"],
    ["medicine", "report-medicine.png"],
    ["data_science", "report-data-science.png"],
  ]) {
    const t = await go(`/report?major=${major}`, shot, 3500);
    const hasTable = /الجامعة/.test(t) && /مسائي/.test(t);
    check(`/report?major=${major} يعرض جدول العروض`, hasTable);
    // عبارة "قبول مباشر" مسموحة فقط ضمن اسم برنامج رسمي، لا كحالة خلية
    check(
      `/report?major=${major} لا يعرض 'قبول مباشر' كحالة`,
      !/>\s*قبول مباشر\s*</.test(await page.content()) && !/\(مباشر\)/.test(t)
    );
    if (major === "petroleum_engineering") {
      check("المكامن النفطية/الموصل تظهر بـ90%", /المكامن النفطية/.test(t) && /90%/.test(t));
      check("حاشية المسائي 'حدّ أدنى' ظاهرة", /حدّ أدنى/.test(t));
    }
    if (major === "data_science")
      check("الأقسام بلا رقم تُعرض 'لا حدّ منشور'", /لا حدّ منشور/.test(t) || /غير متوفّر/.test(t));
  }

  // 2) صفحات عامة: لا ادّعاء قبول مباشر حكومي
  for (const [url, shot] of [
    ["/", "home.png"],
    ["/compare", "compare.png"],
    ["/explorer", "explorer.png"],
    ["/wishlist", "wishlist.png"],
    ["/gpa-check", "gpa-check.png"],
    ["/cost", "cost.png"],
  ]) {
    const t = await go(url, shot, 2000);
    check(`${url} يُحمَّل`, t.length > 200);
    check(
      `${url} لا يدّعي وجود قبول مباشر حكومي`,
      !/يوجد قبول مباشر|\(مباشر\)|القبول المباشر/.test(t),
      (t.match(/.{30}قبول مباشر.{30}/) || [])[0]
    );
  }

  // 3) الصفحة الرئيسية: لا عدّاد "قبول مباشر" غير صفري
  const home = await go("/", null, 1500);
  check("الرئيسية تنص أنه لا قبول مباشر حكومياً", /لا يوجد أي قبول مباشر في الجامعات الحكومية/.test(home));

  // 4) الأسئلة الشائعة: نص "لا حدّ منشور" الجديد لا التعريف القديم
  check("الأسئلة الشائعة بالنص الجديد", /لا حدّ منشور/.test(home) && !/دون منافسة على المعدل/.test(home));

  check("لا أخطاء JS غير ملتقطة", errors.length === 0, errors.slice(0, 2).join(" | "));
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(ROOT, "reports", "admission-fix", "live-check.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} نجح`);
  process.exit(failed ? 1 : 0);
})();
