#!/usr/bin/env node
/**
 * يمسح كل مسار حقل عبر الـ88 تخصصاً في data/major_profiles_detailed.json
 * ويبلّغ عن أي مسار تختلف أنواع قيمه بين التخصصات -- مؤشّر عطل عرض محتمل
 * (كما حدث فعلياً في licensingRequirement.required/postgradNeededForPractice:
 * boolean في 87 تخصصاً، سلسلة "جزئياً" في تخصص واحد).
 * تشخيص فقط. لا يعدّل أي بيانات.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const profiles = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'major_profiles_detailed.json'), 'utf8'),
);

const paths = new Map(); // مسار → Map<نوع, {count, samples:Set}>

function kind(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function walk(obj, prefix, majorId) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return;
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    const t = kind(v);
    if (!paths.has(p)) paths.set(p, new Map());
    const byType = paths.get(p);
    if (!byType.has(t)) byType.set(t, { count: 0, samples: new Set() });
    const rec = byType.get(t);
    rec.count += 1;
    if (rec.samples.size < 4) {
      rec.samples.add(`${majorId}=${t === 'string' ? JSON.stringify(String(v).slice(0, 40)) : JSON.stringify(v)}`);
    }
    if (t === 'object') walk(v, p, majorId);
  }
}

for (const m of profiles) walk(m, '', m.id);

const mixed = [];
for (const [p, byType] of paths) {
  const types = [...byType.keys()];
  const nonNull = types.filter((t) => t !== 'null');
  if (nonNull.length > 1) mixed.push({ path: p, byType });
}

console.log(`مسارات مفحوصة: ${paths.size} · مختلطة الأنواع: ${mixed.length}\n`);
for (const { path: p, byType } of mixed) {
  console.log(`⚠️  ${p}`);
  for (const [t, rec] of byType) {
    console.log(`     ${t.padEnd(8)} ×${String(rec.count).padStart(3)}   ${[...rec.samples].join(' | ')}`);
  }
  console.log('');
}

/* مسارات ذات null جزئي -- "غير متوفّر" يجب أن يُعرَض لا أن يُخفى */
console.log('\n── مسارات بها null جزئي (تحقّق أنها تُعرض «غير متوفّر») ──');
for (const [p, byType] of paths) {
  if (byType.has('null') && byType.size > 1) {
    console.log(`  ${p}  —  null ×${byType.get('null').count} من ${profiles.length}`);
  }
}
