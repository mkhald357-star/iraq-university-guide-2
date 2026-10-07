#!/usr/bin/env node
/**
 * يولّد public/og/cover.png (1200×630) بأرقام حقيقية من data/homepage_stats.json
 * -- لا تُكتب يدوياً (نفس درس "81 تخصصاً" في §26). يستعمل Playwright (يرسم
 * العربية بشكل صحيح، بخلاف next/og غير المتوافق مع output:'export').
 *
 * لا يُربَط بـprebuild عمداً -- البناء لا يجب أن يعتمد على متصفح (data/admission_rules.md §33).
 * الاستخدام: node scripts/generate-og-image.js (أو npm run og)
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "og");
const OUT = path.join(OUT_DIR, "cover.png");
const TEMPLATE = path.join(__dirname, "og-template.html");

// نفس نصوص lib/siteMeta.ts (SITE_TAGLINE/SITE_DESCRIPTION) -- مكرَّرة هنا
// عمداً لأن هذا سكربت CommonJS لا يستورد وحدات .ts مباشرة (نفس نمط ازدواجية
// normalizeArabic القائم فعلاً بين lib/majorMatcher.ts وscripts/build-major-offerings.js).
// حدِّثها يدوياً إن تغيّر النصّ في lib/siteMeta.ts.
const TITLE = "اختر تخصصك الجامعي بالأرقام الحقيقية";
const DESC = "منصّة عراقية مجانية: اختبار ميول علمي، ومطابقة بحدود القبول الرسمية لكل قسم في العراق. مجاناً وبلا حساب.";

(async () => {
  const stats = JSON.parse(fs.readFileSync(path.join(ROOT, "data/homepage_stats.json"), "utf8"));

  const CARDS = [
    { n: stats.totalMajors, l: "تخصصاً" },
    { n: stats.totalDepartments, l: "قسماً جامعياً" },
    { n: stats.totalUniversities, l: "جامعة" },
  ];

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  await page.goto("file://" + TEMPLATE);
  await page.evaluate(
    ({ title, desc, cards }) => {
      document.getElementById("title").textContent = title;
      document.getElementById("desc").textContent = desc;
      document.getElementById("stats").innerHTML = cards
        .map((c) => `<div><div class="n">${c.n.toLocaleString("ar-IQ")}</div><div class="l">${c.l}</div></div>`)
        .join("");
    },
    { title: TITLE, desc: DESC, cards: CARDS }
  );

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // ضمان رسم الخط بعد جهوزية document.fonts

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // clip صريح دفاعي -- عناصر الزخرفة (.orb) ذات الإزاحة السالبة كانت تُوسِّع
  // نطاق اللقطة التلقائي فعلياً (اكتُشف أثناء بناء هذا السكربت: النصّ خرج عن
  // الإطار). السبب الجذري الفعلي: overflow:hidden على body وحده لا يكفي --
  // <html> هو الصندوق القابل للتمرير الفعلي في هذا السياق (أُصلح في
  // og-template.html: html{overflow:hidden}). clip هنا حماية إضافية، لا الإصلاح
  // الوحيد. راجع data/admission_rules.md §33.
  await page.screenshot({ path: OUT, type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await browser.close();

  // ضغط تلقائي إن تجاوزت السقف (واتساب يتجاهل صوراً > 300KB) -- بلا هذا،
  // كل تغيير لاحق في الأرقام (وبالتالي عرض النصّ) قد يُعيد إنتاج المشكلة
  // بصمت ما لم يتذكّر أحد الضغط يدوياً.
  let kb = fs.statSync(OUT).size / 1024;
  if (kb > 300) {
    const buf = await sharp(OUT).png({ quality: 82, compressionLevel: 9 }).toBuffer();
    fs.writeFileSync(OUT, buf);
    kb = fs.statSync(OUT).size / 1024;
  }

  console.log(`✅ ${OUT} — ${kb.toFixed(0)} KB`);
  if (kb > 300) {
    console.error("❌ الصورة > 300KB حتى بعد الضغط التلقائي — راجع القالب (نصّ أطول من المتوقَّع؟).");
    process.exit(1);
  }
})();
