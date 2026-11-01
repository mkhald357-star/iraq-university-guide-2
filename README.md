# منصة التوجيه الجامعي العراقي

منصة ويب عربية (RTL) لمساعدة خريجي الإعدادية في العراق على اختيار التخصص والجامعة: اختبار ميول (RIASEC) مع بيانات القبول الرسمية المستخرجة من وثائق وزارة التعليم العالي والبحث العلمي.

الموقع: <https://iraqmajors.com>

## الصفحات
`/quiz` اختبار الميول · `/report` تقرير التخصص · `/gpa-check` فاحص المعدل · `/explorer` مستكشف الجامعات · `/hierarchy` الحدود الدنيا بالتسلسل · `/wishlist` مرتِّب الرغبات · `/compare` الموازنة · `/decider` حسم الحيرة · `/cost` كلفة الأهلي · `/skills` · `/destinations` · `/income` · `/projects` · `/privacy`

## التقنيات
Next.js 15 (App Router، تصدير ثابت) · React 19 · TypeScript · Tailwind CSS · Zod · Vitest · Playwright · Node.js (خط البيانات) · Python (استخراج نص PDF) · GitHub Actions · Cloudflare Pages.

## التشغيل
```
npm install
npm run dev          # http://localhost:3000
npm test             # الاختبارات الآلية
npm run build        # بناء الموقع الثابت + ترويسات الأمان (out/)
npm run rebuild-data # إعادة بناء البيانات من وثائق الوزارة
```

## بنية المستودع
```
app/           الصفحات والمكونات
lib/           المنطق (المحرك، المطابقة، الأهلية، التحقق) واختباراته
data/          قاعدة المعرفة: الجامعات، التخصصات، الأسئلة، ملفات RIASEC
data/raw/      نواتج وسيطة من الاستخراج
data/sources/  الوثائق الرسمية المصدر مع بصماتها (SOURCES.md)
public/data/   ملفات البيانات المخدومة للواجهة
scripts/       خط البيانات، والتحقق، والتدقيق، والأمن، والتقييم
reports/       نتائج التدقيق والتقييم
docs/          دليل التشغيل
.github/       الفحص الآلي ومراقبة الموقع
```

## مراجع
- [دليل التشغيل والطوارئ](docs/operations.md)
- [الوثائق المصدر وبصماتها](data/sources/SOURCES.md)
- [تقرير الاختبارات الآلي](reports/test-report.md) (يُولَّد بالأمر `node scripts/generate-test-report.mjs`)
- [تدقيق استخراج بيانات القبول](reports/admission-fix/) · [شخصيات التقييم](reports/personas/)

## حالة المشروع
يعمل على الإنتاج. أرقام القبول مرجعها «الحدود الدنيا 2025-2026»، وهي مؤشر لا وعد.
