// Parses the evening-study (الدراسة المسائية) section of
// data/raw/dalel.full.txt into structured JSON: which colleges/
// departments offer evening study, per government/technical university.
//
// The section boundaries and the ordered university list below were
// verified by hand against the 2025-2026 guide's table of contents (same
// numbering, same order as the "الكليات والمعاهد..." listing in chapter
// 3). If next year's guide reorders or adds/removes universities in this
// section, ORDERED_UNIVERSITIES and the boundary-detection regexes below
// need a one-time manual review -- this is a semi-automated yearly
// refresh, not a fully unattended pipeline.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data", "raw", "dalel.full.txt");
const OUT = path.join(ROOT, "data", "raw", "evening_study_2025_2026.json");

const ORDERED_UNIVERSITIES = [
  "جامعة بغداد", "الجامعة المستنصرية", "جامعة البصرة", "جامعة الموصل",
  "الجامعة التكنولوجية", "جامعة الكوفة", "جامعة تكريت", "جامعة القادسية",
  "جامعة الأنبار", "الجامعة العراقية", "جامعة بابل", "جامعة النهرين",
  "جامعة ديالى", "جامعة كربلاء", "جامعة ذي قار", "جامعة كركوك",
  "جامعة واسط", "جامعة ميسان", "جامعة المثنى", "جامعة سامراء",
  "جامعة سومر", "جامعة القاسم الخضراء", "جامعة نينوى", "جامعة الفلوجة",
  "جامعة جابر بن حيان للعلوم الطبية والصيدلانية", "جامعة تلعفر",
  "جامعة البصرة للنفط والغاز", "جامعة الحمدانية", "جامعة الكرخ للعلوم",
  "جامعة تكنولوجيا المعلومات والاتصالات", "جامعة الشطرة",
  "الجامعة التقنية الشمالية", "جامعة الفرات الأوسط التقنية",
  "الجامعة التقنية الوسطى", "الجامعة التقنية الجنوبية",
];

const allLines = fs.readFileSync(SRC, "utf8").split("\n");

// Find the section start by content (not a hardcoded line number). The
// body heading is matched loosely because this exact phrase is affected
// by the PDF's known text-extraction corruption (e.g. "فيها" -> "فيلا");
// taking the LAST match skips the earlier, differently-formatted table-
// of-contents mention of the same chapter title.
const startMarker = /الجامعات والكليات التي في.ا[\s\t]*دراس/;
let startIdx = -1;
for (let i = 0; i < allLines.length; i++) {
  if (startMarker.test(allLines[i])) startIdx = i;
}
if (startIdx === -1) {
  console.error("Could not locate the evening-study section heading -- guide layout may have changed.");
  process.exit(1);
}

// The section end is NOT detected by matching chapter 5's heading text
// (unreliable -- it's split across tab-separated tokens and also affected
// by the same corruption). Instead: stop as soon as we've consumed exactly
// ORDERED_UNIVERSITIES.length university sections, i.e. the moment a
// (ORDERED_UNIVERSITIES.length + 1)-th "N - university name :" header
// line would appear, which is where chapter 5 (Kurdistan-region
// universities, a separate admission system, out of scope here) begins.
const lines = allLines.slice(startIdx);
const pageMarkerRe = /^-- \d+ of \d+ --$/;

let uniIndex = -1;
let currentUni = null;
const results = [];
let skipped = 0;

for (const rawLine of lines) {
  const line = rawLine.replace(/\r$/, "");
  if (!line.trim()) continue;
  if (pageMarkerRe.test(line.trim())) continue;
  if (/^\d+$/.test(line.trim())) continue; // bare page-number line

  const tokens = line.split("\t").map((t) => t.trim()).filter((t) => t.length > 0);
  if (tokens.length === 0) continue;

  // Chapter 5 (Kurdistan-region universities, out of scope -- separate
  // regional admission system) headers use a single-letter sub-chapter
  // prefix ("و - 1 - جامعة السليمانية") instead of a bare leading number,
  // so the numeric-header check below never recognizes them as a new
  // section boundary. Without this check, every subsequent chapter-5 row
  // (real Kurdistan colleges/departments) kept silently accumulating
  // under whatever government university happened to be currentUni last
  // (الجامعة التقنية الجنوبية, the final ORDERED_UNIVERSITIES entry --
  // confirmed by cross-referencing dalel.full.txt line 5242 against the
  // built output, e.g. a bogus "المعهد التقني في كويه" [Koya, Kurdistan]
  // college showing up under a Basra-based technical university). Any
  // single-letter-prefixed header ("<one Arabic letter> - ...") marks
  // this same out-of-scope boundary -- verified against the raw text
  // that no such header legitimately occurs before it.
  if (uniIndex >= 0 && tokens.length >= 2 && tokens[1] === "-" && /^[ء-ي]$/.test(tokens[0])) {
    break;
  }

  // header row: starts with a number, second token is a literal '-'
  if (/^\d+$/.test(tokens[0]) && tokens[1] === "-") {
    if (uniIndex + 1 >= ORDERED_UNIVERSITIES.length) {
      // We've consumed all known universities; this next header belongs
      // to chapter 5 (Kurdistan-region universities) -- stop here.
      break;
    }
    uniIndex++;
    currentUni = ORDERED_UNIVERSITIES[uniIndex];
    continue;
  }

  if (tokens[0] === "ت") continue; // table header row "ت الكلية القسم"
  if (!/^\d+$/.test(tokens[0])) continue; // must start with a row number
  if (!currentUni) { skipped++; continue; }

  // Tabs already delimit columns/hierarchy levels; a lone "/" or "-" token
  // is just a visual joiner between two adjacent columns, not a signal to
  // merge them into one string, so: drop delimiter tokens, keep every
  // other tab-cell as its own segment.
  let segs = tokens.slice(1).filter((t) => t !== "/" && t !== "-");
  if (segs.length === 0) { skipped++; continue; }

  // A long college/department name sometimes wraps across multiple PDF
  // table cells, which pdf-parse then emits as separate tab-tokens -- even
  // splitting a bare "ال" (definite article) from the noun that follows
  // it. A fragment that's just a prefix word ("كلية"/"معهد"/"قسم"/...) or
  // 2 characters or less can never legitimately be a complete college or
  // department name on its own, so merge it forward into the next
  // fragment until nothing short is left dangling.
  const NEVER_STANDALONE = new Set(["كلية", "كليات", "معهد", "المعهد", "الكلية", "قسم", "اقسام"]);
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < segs.length - 1; i++) {
      if (NEVER_STANDALONE.has(segs[i]) || segs[i].length <= 2) {
        segs = [...segs.slice(0, i), `${segs[i]} ${segs[i + 1]}`, ...segs.slice(i + 2)];
        merged = true;
        break;
      }
    }
  }

  // The loop above only merges a short segment INTO the one that follows
  // it, so a single stray letter at the very END of the row (the last
  // segment is never a merge trigger, only a merge target) slips through
  // uncaught -- e.g. "المحاسبة" wrapped across cells as "قسم تقنيات
  // المحاسب" + "ة". A lone trailing 1-character segment is never a real
  // standalone department/college name in Arabic, so it's always this
  // same word-split artifact: reattach it (no space -- it's a word
  // continuation, not a separate word) to the segment before it.
  if (segs.length > 1 && segs[segs.length - 1].length === 1) {
    segs = [...segs.slice(0, -2), segs[segs.length - 2] + segs[segs.length - 1]];
  }

  // Safety net: a genuine single-segment (department-less) row should be a
  // real college name, which always starts with كلية/معهد/الكلية/المعهد in
  // this document. A bare orphan fragment (e.g. a province name with
  // nothing else -- seen in a handful of densely-tabled rows, mostly in
  // الجامعة التقنية الجنوبية) means the row's real content was lost to a
  // table-wrapping edge case upstream; skip it rather than store noise.
  if (segs.length === 1 && !/^(كلية|كليات|معهد|المعهد|الكلية)/.test(segs[0])) {
    skipped++;
    continue;
  }

  results.push({
    university: currentUni,
    college: segs[0],
    campusOrTrack: segs.length > 2 ? segs.slice(1, -1).join(" / ") : null,
    department: segs.length > 1 ? segs[segs.length - 1] : null,
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(results, null, 2), "utf8");
console.log("Parsed evening-study rows:", results.length, "| skipped:", skipped, "| universities seen:", uniIndex + 1);
if (uniIndex + 1 !== ORDERED_UNIVERSITIES.length) {
  console.warn(`WARNING: expected ${ORDERED_UNIVERSITIES.length} universities, found ${uniIndex + 1} -- review ORDERED_UNIVERSITIES against this year's guide.`);
}
