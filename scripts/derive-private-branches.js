#!/usr/bin/env node
/**
 * يورّث الفرع من الأقسام الحكومية إلى نظيراتها الأهلية بالاسم. لا يخمّن:
 * بلا نظير ⇒ يبقى فارغاً (branchSource: "unknown"). يعمل كجزء من خط البناء
 * (يُشغَّل مباشرة بعد build-universities-data.js عبر package.json) لا
 * كتعديل يدوي لمرّة واحدة -- وإلا ضاع مع أول إعادة بناء.
 * راجع data/admission_rules.md §29.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const filePath = path.join(ROOT, "data/universities.json");
const d = JSON.parse(fs.readFileSync(filePath, "utf8"));
const list = Array.isArray(d) ? d : d.universities || [];

/** يصلح أثر انعكاس رابطة "لا" أولاً (scripts/displayName.js)، ثم يطبّق
 *  *نفس* خوارزمية normalizeArabic المُختبَرة أصلاً في lib/majorMatcher.ts
 *  (مكرَّرة هنا بجافاسكربت خام بنفس نمط ازدواجية scripts/build-major-offerings.js
 *  القائم فعلاً -- لا استيراد .ts من سكربت CommonJS). حذف "ال" التعريف عند
 *  حدود الكلمات ثم كل ألف مجرد يحلّ فروقاً حقيقية بين تسمية الأهلي والحكومي
 *  لنفس القسم (مثال مؤكَّد: "ادارة اعمال" أهلي مقابل "إدارة الأعمال" حكومي). */
const { fixLamAlef } = require("./displayName");
const norm = (s = "") =>
  fixLamAlef(String(s))
    .replace(/^\s*(قسم|كلية)\s+/, "")
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/(^|\s)ال/g, "$1")
    .replace(/ا/g, "")
    .replace(/\s+/g, "");

/* ١) فهرس حكومي: اسم القسم -> مجموعة الفروع. الحكومي دائماً مستخرَج فعلياً
   (0/1749 بلا فرع، مؤكَّد) -- يُوسَم extracted بلا حاجة لأي اشتقاق. */
const govBranches = new Map();
for (const u of list) {
  if (u.type !== "حكومية") continue;
  for (const c of u.colleges || [])
    for (const p of c.departments || []) {
      p.branchSource = (p.branch || []).length ? "extracted" : "unknown";
      const k = norm(p.name);
      if (!k) continue;
      if (!govBranches.has(k)) govBranches.set(k, new Set());
      (p.branch || []).forEach((b) => govBranches.get(k).add(b));
    }
}

/* ٢) طابِق الأهلي */
let derived = 0,
  still = 0;
const unmatched = new Map();

for (const u of list) {
  if (u.type === "حكومية") continue;
  for (const c of u.colleges || [])
    for (const p of c.departments || []) {
      if (p.branch && p.branch.length) {
        p.branchSource = p.branchSource || "extracted";
        continue;
      }

      const set = govBranches.get(norm(p.name));
      if (set && set.size) {
        p.branch = [...set];
        p.branchSource = "derived-from-government-equivalent";
        derived++;
      } else {
        p.branch = [];
        p.branchSource = "unknown";
        still++;
        unmatched.set(p.name, (unmatched.get(p.name) || 0) + 1);
      }
    }
}

fs.writeFileSync(filePath, JSON.stringify(d, null, 2) + "\n", "utf8");

console.log(`مشتقّ: ${derived} · ما زال مجهولاً: ${still}`);
console.log("\nأكثر الأسماء بلا نظير حكومي:");
[...unmatched.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25)
  .forEach(([n, c]) => console.log(`  ${String(c).padStart(3)}  ${n}`));
