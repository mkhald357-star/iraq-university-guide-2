#!/usr/bin/env node
/**
 * يكشف نمط "تسرّب التجاور": سجلات جامعة مُسنَدة لجارتها في تسلسل الدليل.
 * تشخيص فقط -- لا يعدّل شيئاً.
 *
 * بنية data/raw/chapter3_additions.json الفعلية (قِيست، لا افتُرِضت):
 * مصفوفة مسطَّحة، كل عنصر { university, college, department, branch[] } --
 * الأسماء العربية الخام هي المفتاح الوحيد (لا universityId/departmentName
 * منفصلَين).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/raw/chapter3_additions.json'), 'utf8'));

const UNI = (r) => r.university;
const COL = (r) => r.college;
const DEPT = (r) => r.department;

/** تطبيع خفيف لأغراض المقارنة النصّية -- يوحّد صيغ الهمزة/التاء المربوطة/الألف
 * المقصورة والتشكيل، بلا إسقاط أحرف كاملة (بخلاف normalizeArabic في
 * lib/majorMatcher.ts المخصَّصة لمطابقة التخصصات الفضفاضة -- هنا نريد تمييزاً
 * أدق لتفادي تضخيم نسب التقاطع بين كليات/أقسام مختلفة فعلياً). */
const norm = (s = '') => String(s)
  .replace(/[ً-ْـ]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/\s+/g, ' ').trim();

/* ── ١) بصمة كل جامعة: مجموعة (كلية|قسم) ── */
const fp = new Map();
for (const r of records) {
  const u = UNI(r);
  if (!fp.has(u)) fp.set(u, new Set());
  fp.get(u).add(`${norm(COL(r))}|${norm(DEPT(r))}`);
}

/* ── ٢) تقاطع البصمات بين كل زوج ── */
const unis = [...fp.keys()];
const overlaps = [];
for (let i = 0; i < unis.length; i++) {
  for (let j = i + 1; j < unis.length; j++) {
    const a = fp.get(unis[i]), b = fp.get(unis[j]);
    const shared = [...a].filter((x) => b.has(x));
    if (!shared.length) continue;
    const ratio = shared.length / Math.min(a.size, b.size);
    overlaps.push({ a: unis[i], b: unis[j], shared: shared.length,
                    aSize: a.size, bSize: b.size, ratio, items: shared.slice(0, 8) });
  }
}
overlaps.sort((x, y) => y.ratio - x.ratio);

console.log('═══ تقاطع بصمات الجامعات ═══');
console.log('تطابق كامل أو شبه كامل = مؤشّر قوي على تسرّب التجاور\n');
if (!overlaps.length) console.log('(لا تقاطع بين أي زوج جامعتين)');
for (const o of overlaps) {
  const flag = o.ratio === 1 ? '🔴 تطابق كامل' : o.ratio >= 0.6 ? '⚠️  تطابق عالٍ' : '·';
  console.log(`${flag}  ${o.a}  ↔  ${o.b}`);
  console.log(`     مشترك ${o.shared} من (${o.aSize} / ${o.bSize}) — نسبة ${(o.ratio * 100).toFixed(0)}%`);
  o.items.forEach((it) => console.log(`       - ${it.replace('|', ' / ')}`));
  console.log('');
}

/* ── ٣) جامعات كل سجلاتها من هذا الملف (لا وجود لها في جدول الحدود) ── */
const uniData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/universities.json'), 'utf8'));
const list = Array.isArray(uniData) ? uniData : uniData.universities || [];

console.log('═══ جامعات تعتمد كلياً على chapter3_additions ═══');
console.log('(صفر قسم من جدول الحدود المدقَّق = صفر تحقّق مستقل)\n');
let none = true;
for (const u of list) {
  const depts = (u.colleges || []).flatMap((c) => c.departments || []);
  if (!depts.length) continue;
  const competitive = depts.filter((d) => (d.cutoffs || []).length > 0).length;
  if (competitive === 0 && fp.has(u.name)) {
    console.log(`🔴 ${u.id} (${u.name}) — ${depts.length} قسماً، صفر منها له حدّ تنافسي`);
    none = false;
  }
}
if (none) console.log('(لا جامعة بهذه الحالة)');
