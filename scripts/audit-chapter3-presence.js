#!/usr/bin/env node
/**
 * يبحث عن كل سجل من data/raw/chapter3_additions.json في النصّ الخام للدليل
 * (data/raw/dalel.full.txt). يجمع كل مواضع ظهور اسم الجامعة (لا الأول فقط)
 * -- تصحيح المحاولة الآلية السابقة التي أنتجت 168/178 نتيجة كاذبة باعتمادها
 * أول ظهور وحده. يُعلّم "يحتاج مراجعة" فقط -- القرار بشري دائماً.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const RAW_TXT = path.join(ROOT, 'data/raw/dalel.full.txt');
const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/raw/chapter3_additions.json'), 'utf8'));

const norm = (s = '') => String(s)
  .replace(/[ً-ْـ]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/\s+/g, ' ').trim();

const lines = fs.readFileSync(RAW_TXT, 'utf8').split('\n').map(norm);

const UNI = (r) => r.university;
const DEPT = (r) => r.department;

const WINDOW = 120; // أسطر بعد كل ظهور لعنوان الجامعة

const out = [];
for (const r of records) {
  const uniNorm = norm(UNI(r));
  const deptNorm = norm(DEPT(r));

  const anchors = [];
  lines.forEach((l, i) => { if (uniNorm && l.includes(uniNorm)) anchors.push(i); });

  let found = false, foundAt = null;
  for (const a of anchors) {
    for (let i = a; i < Math.min(a + WINDOW, lines.length); i++) {
      if (deptNorm && lines[i].includes(deptNorm)) { found = true; foundAt = i + 1; break; }
    }
    if (found) break;
  }

  const anywhere = [];
  if (!found && deptNorm) {
    lines.forEach((l, i) => { if (l.includes(deptNorm)) anywhere.push(i + 1); });
  }

  out.push({
    university: UNI(r),
    college: r.college,
    department: DEPT(r),
    anchorsFound: anchors.length,
    status: anchors.length === 0 ? 'عنوان الجامعة غير موجود'
          : found ? 'موجود'
          : anywhere.length ? 'موجود لكن في موضع بعيد — إسناد مشبوه'
          : 'غير موجود',
    line: foundAt ?? '',
    elsewhere: anywhere.slice(0, 5).join(' '),
  });
}

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'reports/chapter3-presence.csv'),
  '﻿' + ['university,college,department,anchors,status,line,elsewhere',
    ...out.map((o) => [o.university, o.college, o.department, o.anchorsFound, o.status, o.line, o.elsewhere].map(esc).join(','))
  ].join('\n'),
);

const tally = out.reduce((a, o) => ((a[o.status] = (a[o.status] || 0) + 1), a), {});
console.table(tally);
console.log('\n⚠️  "غير موجود" تعني "يحتاج مراجعة بشرية" — لا "مؤكَّد خاطئ".');
