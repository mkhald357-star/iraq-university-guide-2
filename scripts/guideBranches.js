// مطابقة قسم المنصة بجدول «الفروع المقبولة» في الفصل 3 من الدليل (data/raw/chapter3_branches.json).
// مصدر واحد يستعمله البناء (scripts/build-universities-data.js) والتدقيق، بدل نسختين تتباعدان.
//
// النص المستخرَج من PDF مشوَّه بأنماط موثَّقة، والمطابقة تتسامح معها:
//  - حروف ساقطة/مفصولة: "اال كليزي"، "الفنو"، "الفر سي" -- تُسقط الألفات والنون والياء والهمزات.
//  - تبديل ه/ل: "اللندسة" = الهندسة، "المعلد" = المعهد -- تُطوى ه/ة/ل إلى حرف واحد.
//  - "اء" آخر الكلمة إلى "ام": "الكيميام" -- يُقابَل الاسم بصيغتيه.
//  - قلب ترتيب الكلمات: "العربي اللغ" = اللغة العربية، "الجميلة الفنو" = الفنون الجميلة.
//  - أسماء المنصة نفسها مشوَّهة أحياناً: "التاريد" = التاريخ.
// والتحفّظ: لا معلومة إلا بمطابقة داخل نفس الكلية وبمجموعة فروع واحدة لا لبس فيها.
const { toDisplayName } = require("./displayName");

const PLATFORM_NAME_FIXES = [[/ت[أا]?ريد/g, "تاريخ"]];
// "الشوووووووريعة"/"العربيننننننن": الكشيدة استُخرجت حروفاً مكرَّرة -- تُحذف التكرارات الثلاثية فأكثر
const fixName = (s) =>
  PLATFORM_NAME_FIXES.reduce((acc, [re, to]) => acc.replace(re, to), toDisplayName(s || "")).replace(
    /([ون])\1{2,}/g,
    ""
  );
const guideKey = (s) =>
  fixName(s)
    .replace(/^(قسم|فرع)\s+/, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[اءئؤنيى]/g, "")
    .replace(/[ةه]/g, "ل")
    .replace(/[\sـ()\-]/g, "");
const words = (s) =>
  fixName(s)
    .replace(/^(قسم|فرع)\s+/, "")
    .split(/[\s/]+/)
    .map((w) => guideKey(w.replace(/^و?ال(?=..)/, "")))
    .filter((w) => w.length >= 1);
// نوع المؤسسة رمزٌ يجب أن يتطابق ("الكلية التقنية الكوت" ≠ "المعهد التقني الكوت")، ويُتجاهَل حين
// لا يذكره الدليل أصلاً (خلايا كليات الجامعات تكتب "اآلداب" لا "كلية الآداب")
const typeToken = (w) => (/^(كلية|الكلية)$/.test(w) ? "#ك" : /^(معهد|المعهد|المعلد|معلد)$/.test(w) ? "#م" : null);
const collegeWords = (s, withCampus) =>
  (withCampus ? toDisplayName(s || "").replace("/", " ") : toDisplayName(s || "").split("/")[0])
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => typeToken(w) || guideKey(w))
    .filter((w) => w.length >= 2);
const isType = (w) => w.startsWith("#");
const wordEq = (a, b) => {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  const ok = min >= 3 || (min === 2 && Math.abs(a.length - b.length) <= 1);
  return ok && (a.startsWith(b) || b.startsWith(a));
};

const allIn = (a, b) => a.length > 0 && a.every((w) => b.some((x) => wordEq(w, x)));

// 3 = نفس كلمات الكلية، 2 = كلمات إحداهما ضمن الأخرى، 1 = كل كلمات كلية المنصة (مع حرمها) في نص الصف
function collegeLevel(platformCollege, g) {
  const b = collegeWords(g.college, false);
  const bHasType = b.some(isType);
  const a = collegeWords(platformCollege, false).filter((w) => bHasType || !isType(w));
  if (a.length && b.length) {
    const aInB = allIn(a, b);
    const bInA = allIn(b, a);
    if (aInB && bInA) return 3;
    // الاحتواء لا يُقبل إن اختلف نوع المؤسسة المذكور في الطرفين
    const typesClash = bHasType && a.some(isType) && !a.filter(isType).every((t) => b.includes(t));
    if (!typesClash && (aInB || bInA)) return 2;
  }
  const entryHasType = g.entryWords.some(isType);
  const withCampus = collegeWords(platformCollege, true).filter((w) => entryHasType || !isType(w));
  return allIn(withCampus, g.entryWords) ? 1 : 0;
}

function deptMatches(name, g) {
  const variants = [...new Set([name, name.replace(/اء(?=\s|$)/g, "ام")])];
  for (const v of variants) {
    const dk = guideKey(v);
    if (dk.length < 3) continue;
    // (1) الاسم كاملاً = عنصر (أو عنصران/ثلاثة متجاورة) بعد التطبيع، أو بادئة قريبة الطول
    if (
      g.cands.some(
        (c) =>
          c === dk ||
          (Math.min(dk.length, c.length) >= 5 &&
            Math.min(dk.length, c.length) / Math.max(dk.length, c.length) >= 0.75 &&
            (c.startsWith(dk) || dk.startsWith(c)))
      )
    )
      return true;
    // (2) نفس الكلمات بلا ترتيب داخل عنصر أو عنصرين متجاورين (اسم من كلمتين فأكثر فقط)
    const w = words(v).filter((x) => x.length >= 2);
    if (w.length >= 2 && g.windows.some((win) => allIn(w, win) && win.length <= w.length + 1)) return true;
  }
  return false;
}

function createGuideLookup(groups) {
  const byWebsite = new Map();
  for (const raw of groups || []) {
    const its = raw.items.map(guideKey);
    const cands = [...its];
    for (let i = 0; i + 1 < its.length; i++) cands.push(its[i] + its[i + 1]);
    for (let i = 0; i + 2 < its.length; i++) cands.push(its[i] + its[i + 1] + its[i + 2]);
    const itemWords = raw.items.map(words);
    const windows = [...itemWords];
    for (let i = 0; i + 1 < itemWords.length; i++) windows.push([...itemWords[i], ...itemWords[i + 1]]);
    const entryWords = (raw.entry || raw.items)
      .flatMap((t) => t.split(/\s+/).map((w) => typeToken(w) || guideKey(w.replace(/^و?ال(?=..)/, ""))))
      .filter((w) => w.length >= 2);
    const g = { ...raw, cands, windows, entryWords };
    (byWebsite.get(raw.website) || byWebsite.set(raw.website, []).get(raw.website)).push(g);
  }
  /** فروع القسم المقبولة بحسب الدليل (Set)، أو null حين لا مطابقة موثوقة. */
  function guideBranchesFor(uni, collegeName, deptName) {
    const list = byWebsite.get((uni.website || "").replace(/^www\./, ""));
    if (!list) return null;
    // قسم "عام" = برنامج الكلية نفسها (يُطابَق باسم الكلية)
    const name = /^عام$/.test((deptName || "").trim())
      ? (collegeName || "").split("/")[0].replace(/^(كلية|الكلية|معهد|المعهد)\s+/, "")
      : deptName;
    const withDept = list.filter((g) => deptMatches(name || "", g));
    if (!withDept.length) return null;
    const scored = withDept.map((g) => ({ g, level: collegeLevel(collegeName, g) })).filter((x) => x.level > 0);
    if (!scored.length) return null;
    const best = Math.max(...scored.map((x) => x.level));
    const hits = scored.filter((x) => x.level === best).map((x) => x.g);
    const sets = new Set(hits.map((g) => [...g.branches].sort().join("+")));
    if (sets.size !== 1) return null;
    return new Set(hits[0].branches);
  }
  /** كل الفروع التي يقبلها أي قسم في هذه الكلية بحسب الدليل (Set)، أو null بلا مطابقة كلية واضحة. */
  guideBranchesFor.collegeBranches = function (uni, collegeName) {
    const list = byWebsite.get((uni.website || "").replace(/^www\./, ""));
    if (!list) return null;
    const scored = list.map((g) => ({ g, level: collegeLevel(collegeName, g) })).filter((x) => x.level >= 2);
    if (!scored.length) return null;
    const best = Math.max(...scored.map((x) => x.level));
    return new Set(scored.filter((x) => x.level === best).flatMap((x) => x.g.branches));
  };
  return guideBranchesFor;
}

module.exports = {
  createGuideLookup,
  _internals: { guideKey, words, collegeWords, collegeLevel, deptMatches, fixName },
};
