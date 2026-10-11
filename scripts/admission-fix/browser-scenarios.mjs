// سيناريوهات المتصفح الستة لفاحص المعدل (PLAN-ADMISSION-ACCURACY.md م0). تتطلّب خادماً قيد التشغيل:
//   npx next dev -p 3100   ثم   BASE_URL=http://localhost:3100 node scripts/admission-fix/browser-scenarios.mjs
// ولا تُحكم تلقائياً: تطبع الصفوف الظاهرة فعلاً للطالب ويُقارنها المراجِع بالمتوقَّع في كل عنوان.
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3100";
const browser = await chromium.launch();
const results = [];

async function run({ branch, grade, province, session }) {
  const ctx = await browser.newContext({ locale: "ar" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/gpa-check`, { waitUntil: "networkidle" });
  await page.selectOption("#branch", branch);
  await page.fill("#grade", String(grade));
  if (province) await page.selectOption("#province", province);
  if (session) await page.getByRole("button", { name: session, exact: true }).click();
  await page.getByRole("button", { name: "افحص" }).click();
  await page.waitForTimeout(2500);
  for (let i = 0; i < 40; i++) {
    const more = page.getByRole("button", { name: /عرض المزيد/ });
    if (!(await more.count())) break;
    for (const b of await more.all()) {
      try {
        await b.click({ timeout: 1000 });
      } catch {}
    }
    await page.waitForTimeout(200);
  }
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("tr")]
      .map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent.trim()).join(" | "))
      .filter(Boolean)
  );
  const text = await page.evaluate(() => document.body.innerText);
  await ctx.close();
  return { rows, text };
}
const pick = (rows, re) => rows.filter((r) => re.test(r));
const show = (title, lines) => {
  console.log(`\n### ${title}`);
  if (!lines.length) console.log("   (لا صف مطابق)");
  lines.slice(0, 8).forEach((l) => console.log("   ", l));
};

// S1: طالب علمي 85 في بغداد: علم النفس/آداب بغداد
let r = await run({ branch: "علمي", grade: 85, province: "بغداد" });
console.log("rows in result:", r.rows.length);
show("S1 علمي 85 بغداد: علم النفس (متوقع: حد 81.71 لا 60)", pick(r.rows, /جامعة بغداد.*(اآلداب|الآداب).*علم النفس/));

// S2: أدبي 70 في الديوانية: رياضيات تربية القادسية (متوقع: لا تظهر)
r = await run({ branch: "أدبي", grade: 70, province: "الديوانية" });
console.log("rows in result:", r.rows.length);
show("S2 أدبي 70 الديوانية: رياضيات القادسية (متوقع: لا صف)", pick(r.rows, /القادسية.*الرياضيات/));

// S3: فنون 70 في بغداد: فلسفة المستنصرية (متوقع: تظهر بلا حد منشور)
r = await run({ branch: "فنون", grade: 70, province: "بغداد" });
console.log("rows in result:", r.rows.length);
show("S3 فنون 70 بغداد: فلسفة المستنصرية (متوقع: ظاهرة، بلا حد منشور)", pick(r.rows, /المستنصرية.*الفلسفة/));

// S4: علمي 95 في كركوك: تمريض المعهد الطبي/الشمالية (متوقع: كركوك 87.71 أو 88 لا 90.14)
r = await run({ branch: "علمي", grade: 95, province: "نينوى" });
console.log("rows in result:", r.rows.length);
show(
  "S4a علمي 95 نينوى: تمريض المعهد الطبي/الشمالية (متوقع: سجل الموصل 90.14 فقط)",
  pick(r.rows, /الشمالية.*المعهد التقني الطبي.*التمريض/)
);
r = await run({ branch: "علمي", grade: 95, province: "كركوك" });
console.log("rows in result:", r.rows.length);
show(
  "S4b علمي 95 كركوك: هل يظهر حرم كركوك للجامعة التقنية الشمالية؟ (متوقع: نعم 87.71 — الحرم في كركوك)",
  pick(r.rows, /الشمالية/)
);

// S5: علمي 69 في البصرة: إدارة واقتصاد (حالة ذهبية: الرئيسي 70 لا 68.29)
r = await run({ branch: "علمي", grade: 69, province: "البصرة" });
console.log("rows in result:", r.rows.length);
show(
  "S5 علمي 69 البصرة: إدارة الأعمال (متوقع بعد م3: لا يظهر مريحاً بحد 70)",
  pick(r.rows, /البصرة.*(االدارة|الادارة).*(ادارة االعمال|ادارة الاعمال)/)
);

// S6: مسائي: علمي 59 في البصرة: إدارة واقتصاد المسائي (حالة ذهبية: 60 لا 58)
r = await run({ branch: "علمي", grade: 75, province: "البصرة", session: "مسائي" });
console.log("rows in result:", r.rows.length);
show(
  "S6 مسائي علمي 75 البصرة: إدارة واقتصاد (الحد المسائي الرسمي 60 لا 58)",
  pick(r.rows, /جامعة البصرة.*كلية الادارة والاقتصاد/)
);

await browser.close();
