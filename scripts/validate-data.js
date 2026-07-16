// Validates data/universities.json and data/majors.json against the same
// shape lib/validation.ts (Zod v4) expects, so a corrupted or malformed
// data file fails fast (in CI or locally) instead of silently breaking
// `next build` the way data/universities.json did before this was added.
const { z } = require("zod");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const DepartmentCutoffSchema = z.object({
  branch: z.string(),
  gender: z.string(),
  averagePercent: z.number(),
  isQuota: z.boolean(),
});

const DepartmentSchema = z.object({
  name: z.string(),
  branch: z.array(z.string()),
  sessions: z.array(z.string()),
  cutoffs: z.array(DepartmentCutoffSchema),
  averageGrades: z.object({
    "صباحي": z.number().nullable(),
    "مسائي": z.number().nullable(),
  }),
  isDirectAdmission: z.boolean(),
  // أجور الدراسة السنوية (دينار عراقي) -- خاصة بالجامعات الأهلية فقط، مصدرها
  // الدليل الرسمي لأجور الجامعات والكليات الأهلية 2025-2026. اختيارية لأن
  // الجامعات الحكومية بلا أجور دراسة مركزية مماثلة (القبول تنافسي بلا رسوم).
  tuitionFees: z.object({
    "صباحي": z.number().nullable(),
    "مسائي": z.number().nullable(),
  }).optional(),
  admissionSuspended: z.boolean().optional(),
  note: z.string().nullable().optional(),
});

const UniversitySchema = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string().nullable().optional(),
  type: z.string(),
  province: z.string(),
  founded: z.number().int().nullable().optional(),
  website: z.string().nullable().optional(),
  ranking: z.number().int().nullable().optional(),
  colleges: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      nameEn: z.string().nullable().optional(),
      departments: z.array(DepartmentSchema),
    })
  ),
});

const UniversitiesFileSchema = z.object({
  meta: z.object({}).passthrough(),
  universities: z.array(UniversitySchema),
});

const MajorSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  marketMultiplier: z.number(),
});

const RIASEC_DIMENSIONS = ["R", "I", "A", "S", "E", "C"];
const DimensionsSchema = z.object(
  Object.fromEntries(RIASEC_DIMENSIONS.map((d) => [d, z.number().optional()]))
).strict();

const QuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  dimensions: DimensionsSchema,
});

const RiasecProfileSchema = z.object(
  Object.fromEntries(RIASEC_DIMENSIONS.map((d) => [d, z.number().min(0).max(10).optional()]))
).strict();

const ValidityQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  dimensions: z.object({}).strict(),
  validity: z.object({
    type: z.enum(["instructed", "reverse_twin", "lie_scale"]),
    expected: z.number().optional(),
    pairsWith: z.string().optional(),
  }),
});

const ContradictionPairSchema = z.object({
  a: z.string(),
  b: z.string(),
  message: z.string(),
});

let hasErrors = false;

function validate(label, filePath, schema) {
  const raw = fs.readFileSync(filePath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`[FAIL] ${label}: invalid JSON -- ${e.message}`);
    hasErrors = true;
    return;
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[FAIL] ${label}: schema validation failed`);
    for (const issue of result.error.issues.slice(0, 20)) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    hasErrors = true;
    return;
  }
  console.log(`[OK] ${label}`);
}

validate("data/universities.json", path.join(ROOT, "data/universities.json"), UniversitiesFileSchema);
validate("data/majors.json", path.join(ROOT, "data/majors.json"), z.array(MajorSchema));
validate("data/questions.json", path.join(ROOT, "data/questions.json"), z.array(QuestionSchema));
validate("data/validity_questions.json", path.join(ROOT, "data/validity_questions.json"), z.array(ValidityQuestionSchema));
validate("data/contradiction_pairs.json", path.join(ROOT, "data/contradiction_pairs.json"), z.array(ContradictionPairSchema));

const majors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/majors.json"), "utf8"));
const majorIds = new Set(majors.map((m) => m.id));

// Must have exactly 42 questions (7 per RIASEC dimension, after the 2026-07
// psychometric refinement pass -- the algorithm assumes a fixed, curated
// question bank -- a silent drop/duplication would skew every dimension).
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/questions.json"), "utf8"));
if (questions.length !== 42) {
  console.error(`[FAIL] data/questions.json: expected exactly 42 questions, found ${questions.length}`);
  hasErrors = true;
} else {
  console.log("[OK] data/questions.json has exactly 42 questions");
}
const questionIds = questions.map((q) => q.id);
const dupQuestionIds = questionIds.filter((id, i) => questionIds.indexOf(id) !== i);
if (dupQuestionIds.length) {
  console.error("[FAIL] data/questions.json has duplicate question ids:", [...new Set(dupQuestionIds)]);
  hasErrors = true;
}

// Must have exactly 3 validity-check items (attention check, reverse-scored
// twin, lie scale), each with fully empty `dimensions` (they must never
// silently leak into the RIASEC vector) and no id collision with questions.json.
const validityQuestions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/validity_questions.json"), "utf8"));
if (validityQuestions.length !== 3) {
  console.error(`[FAIL] data/validity_questions.json: expected exactly 3 items, found ${validityQuestions.length}`);
  hasErrors = true;
} else {
  console.log("[OK] data/validity_questions.json has exactly 3 items");
}
const validityIds = new Set(validityQuestions.map((q) => q.id));
const idCollisions = [...validityIds].filter((id) => questionIds.includes(id));
if (idCollisions.length) {
  console.error("[FAIL] data/validity_questions.json ids collide with data/questions.json:", idCollisions);
  hasErrors = true;
}

// Every contradiction pair must reference two distinct, real question ids.
const contradictionPairs = JSON.parse(fs.readFileSync(path.join(ROOT, "data/contradiction_pairs.json"), "utf8"));
const allKnownIds = new Set([...questionIds, ...validityIds]);
const badPairs = contradictionPairs.filter((p) => p.a === p.b || !allKnownIds.has(p.a) || !allKnownIds.has(p.b));
if (badPairs.length) {
  console.error("[FAIL] data/contradiction_pairs.json has pairs referencing unknown/identical ids:", badPairs);
  hasErrors = true;
} else {
  console.log("[OK] data/contradiction_pairs.json pair references");
}

// Every major must have a RIASEC profile, and every profile must map to a real major.
const riasecFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_riasec_profiles.json"), "utf8"));
const profileResult = z.record(z.string(), RiasecProfileSchema).safeParse(riasecFile.profiles);
if (!profileResult.success) {
  console.error("[FAIL] data/major_riasec_profiles.json: schema validation failed");
  for (const issue of profileResult.error.issues.slice(0, 20)) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  hasErrors = true;
} else {
  console.log("[OK] data/major_riasec_profiles.json");
}
const profileIds = new Set(Object.keys(riasecFile.profiles || {}));
const majorsMissingProfile = majors.map((m) => m.id).filter((id) => !profileIds.has(id));
const profilesWithoutMajor = [...profileIds].filter((id) => !majorIds.has(id));
if (majorsMissingProfile.length) {
  console.error("[FAIL] majors missing a RIASEC profile:", majorsMissingProfile);
  hasErrors = true;
}
if (profilesWithoutMajor.length) {
  console.error("[FAIL] RIASEC profiles reference unknown major ids:", profilesWithoutMajor);
  hasErrors = true;
}
if (!majorsMissingProfile.length && !profilesWithoutMajor.length) {
  console.log("[OK] every major has exactly one RIASEC profile");
}

const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major_department_mapping.json"), "utf8"));
const unknownInMapping = mapping.mappings.filter((m) => !majorIds.has(m.majorId)).map((m) => m.majorId);
if (unknownInMapping.length) {
  console.error("[FAIL] data/major_department_mapping.json references unknown major ids:", unknownInMapping);
  hasErrors = true;
} else {
  console.log("[OK] data/major_department_mapping.json major-id references");
}

if (hasErrors) {
  console.error("\nData validation FAILED.");
  process.exit(1);
} else {
  console.log("\nAll data files valid.");
}
