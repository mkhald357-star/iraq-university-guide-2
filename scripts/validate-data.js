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

// Cross-check: every majorId referenced in data/questions.json weights and
// data/major_department_mapping.json must exist in data/majors.json.
const majors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/majors.json"), "utf8"));
const majorIds = new Set(majors.map((m) => m.id));

const questions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/questions.json"), "utf8"));
const unknownInQuestions = new Set();
questions.forEach((q) => Object.keys(q.weights || {}).forEach((id) => { if (!majorIds.has(id)) unknownInQuestions.add(id); }));
if (unknownInQuestions.size) {
  console.error("[FAIL] data/questions.json references unknown major ids:", [...unknownInQuestions]);
  hasErrors = true;
} else {
  console.log("[OK] data/questions.json major-id references");
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
