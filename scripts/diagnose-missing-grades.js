#!/usr/bin/env node
// تشخيص فقط -- لا يعدّل بيانات. يطابق كل ظهور لكلمة "معدل" في النص الخام
// مع ما التُقط فعلاً في gradeNote، ويطبع سياق كل ظهور غير مُلتقَط.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const rawText = fs.readFileSync(path.join(ROOT, 'data/raw/private_universities_guide_raw.txt'), 'utf8');
const lines = rawText.split('\n');
const extracted = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/raw/private_universities_departments.json'), 'utf8'));

const captured = new Set();
for (const colleges of Object.values(extracted)) {
  for (const col of colleges) {
    for (const d of col.departments) {
      if (d.gradeNote) captured.add(String(d.gradeNote).replace(/\s+/g, ' ').trim());
    }
  }
}

let n = 0;
let missed = 0;
lines.forEach((l, i) => {
  if (!/معدل/.test(l)) return;
  n++;
  const norm = l.replace(/\s+/g, ' ').trim();
  const hit = [...captured].some((c) => c.includes(norm) || norm.includes(c));
  if (hit) return;
  missed++;
  console.log(`\n── ضائع #${missed} (معدل رقم ${n}) — سطر ${i + 1} ──`);
  for (let k = Math.max(0, i - 3); k <= Math.min(lines.length - 1, i + 3); k++) {
    console.log(`${k === i ? '>>' : '  '} ${k + 1}: ${lines[k]}`);
  }
});
console.log(`\nإجمالي ظهورات "معدل": ${n} | مُلتقَط: ${n - missed} | ضائع: ${missed}`);
