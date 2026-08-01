#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { checkName } = require('./departmentNameHealth');

const ROOT = path.join(__dirname, '..');
const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/universities.json'), 'utf8'));
const list = Array.isArray(d) ? d : d.universities || [];

const bad = [];
for (const u of list)
  for (const c of (u.colleges || []))
    for (const p of (c.departments || [])) {
      const issues = checkName(p.name);
      const colIssues = checkName(c.name);
      if (issues.length) bad.push({ uni: u.name, type: u.type, col: c.name, dept: p.name, level: 'قسم', issues });
      if (colIssues.length) bad.push({ uni: u.name, type: u.type, col: c.name, dept: '—', level: 'كلية', issues: colIssues });
    }

console.log(`أسماء معطوبة: ${bad.length}\n`);
for (const b of bad) {
  console.log(`[${b.level}] ${b.uni} (${b.type})`);
  console.log(`   ${b.col} / ${b.dept}`);
  console.log(`   ${b.issues.map((i) => i.id + ': ' + i.why).join(' · ')}\n`);
}

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'reports/bad-department-names.csv'),
  '﻿' + ['level,university,type,college,department,issues',
    ...bad.map((b) => [b.level, b.uni, b.type, b.col, b.dept, b.issues.map((i) => i.id).join(' ')].map(esc).join(','))
  ].join('\n'),
);
