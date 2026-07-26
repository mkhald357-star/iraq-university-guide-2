// Extracts raw per-page text from the two official Ministry of Higher
// Education PDFs (student guide + minimum-admission-cutoffs) into
// data/raw/*.full.txt, as plain pdf-parse text output.
//
// Note: this PDF's embedded font has a known ToUnicode CMap issue in some
// tables -- ه sometimes extracts as ل and ء sometimes extracts as م, and
// the "لا" ligature is occasionally extracted in reversed ("ال") order.
// This is a genuine defect in the source PDF's text layer (confirmed by
// cross-checking against pdfplumber, which reproduces the same swap), not
// a bug in this extraction step. lib/majorMatcher.ts's normalizeArabic()
// strips bare alef characters before matching so this doesn't break
// department/major matching; department *display* names may still show
// the swapped spelling in a minority of entries. See data/admission_rules.md.
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const ROOT = path.join(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");

function findPdf(mustInclude) {
  const files = fs.readdirSync(ROOT).filter((f) => f.toLowerCase().endsWith(".pdf"));
  const match = files.find((f) => f.includes(mustInclude));
  if (!match)
    throw new Error(`Could not find a PDF containing "${mustInclude}" in ${ROOT}. Files seen: ${files.join(", ")}`);
  return path.join(ROOT, match);
}

async function extract(pdfPath, outBase) {
  const data = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data });
  const info = await parser.getInfo();
  const result = await parser.getText();
  await parser.destroy();
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(path.join(RAW_DIR, `${outBase}.full.txt`), result.text, "utf8");
  console.log(`${path.basename(pdfPath)} -> ${outBase}.full.txt (${info.total} pages, ${result.text.length} chars)`);
}

(async () => {
  const dalelPdf = findPdf("dalel");
  const hododPdf = findPdf("الحدود");
  await extract(dalelPdf, "dalel");
  await extract(hododPdf, "hodod");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
