// محرك محاكاة مشترك يستدعي منطق المنصة الحقيقي مباشرة (lib/riasec.ts،
// lib/majorMatcher.ts، lib/validity.ts) بلا أي إعادة تنفيذ موازية قد
// تنحرف عن الكود الفعلي — كل عميل محاكاة (20 عميلاً × 30 محاكاة) يستورد
// هذا الملف بدل إعادة كتابة الخوارزميات بنفسه، لضمان أن كل النتائج تقيس
// السلوك الحقيقي للمنصة كما يراه الطالب فعلياً في المتصفح.
//
// للتشغيل: يحتاج tsx (غير مثبَّت بشكل دائم في package.json عمداً، بنفس
// نهج Playwright السابق في هذا المشروع) — ثبّته مؤقتاً بـ
// `npm install --no-save tsx` ثم شغّل أي سكربت `persona_XX_*.mts` عبر
// `npx tsx scripts/persona_XX_....mts`. انظر التقرير المنشور لملخص كل
// شخصية ونتائجها الكاملة (600 محاكاة، 5 أخطاء حقيقية اكتُشفت وأُصلحت).
import questionsData from "../data/questions.json" with { type: "json" };
import validityQuestionsData from "../data/validity_questions.json" with { type: "json" };
import contradictionPairsData from "../data/contradiction_pairs.json" with { type: "json" };
import majorsData from "../data/majors.json" with { type: "json" };
import provincesData from "../data/provinces.json" with { type: "json" };
import riasecProfilesData from "../data/major_riasec_profiles.json" with { type: "json" };
import universitiesData from "../data/universities.json" with { type: "json" };
import majorMappingsData from "../data/major_department_mapping.json" with { type: "json" };

import {
  computeUserRiasecVector,
  computeMajorFit,
  computeCombinedRankingScore,
  topDimensions,
  RIASEC_LABELS,
  type RiasecDimension,
} from "../../lib/riasec.ts";
import { computeValidityRiskScore, type ValidityCheckResult } from "../../lib/validity.ts";
import { findUniversitiesForMajor, rankUniversityOfferings, type University } from "../../lib/majorMatcher.ts";
import { computeSubjectAffinityVector, computeSubjectAffinityFit } from "../../lib/subjectAffinity.ts";
import subjectAffinityWeightsData from "../../data/subject_affinity_weights.json" with { type: "json" };
import { BRANCH_CATEGORY_MAP } from "../../lib/branchEligibility.ts";

export const AVAILABLE_PROVINCES = provincesData as string[];
export const ALL_QUESTIONS = [...questionsData, ...validityQuestionsData];
const VALIDITY_IDS = new Set(validityQuestionsData.map((q) => q.id));

// مصدر وحيد الآن: lib/branchEligibility.ts. هذه النسخة المحلية كانت منحرفة
// فعلياً -- ناقصة "تقنيات طبية مساندة" (9 تخصصات)، ما جعل كل الـ600 محاكاة
// المؤرشفة سابقاً تتعامل مع 58 تخصصاً علمياً لا 67. أُصلح بالاستيراد المباشر
// بدل نسخ الخريطة، فلا يتكرر هذا الانحراف مستقبلاً.
export const BRANCH_MAP: Record<string, string[]> = BRANCH_CATEGORY_MAP as Record<string, string[]>;
export const BRANCHES = Object.keys(BRANCH_MAP);
const SUBJECT_AFFINITY_BLEND_WEIGHT = 0.3; // مطابق لـapp/quiz/page.tsx:519 -- كان غائباً هنا سابقاً

export interface FilterSettings {
  province: string;
  branch: string;
  gradeType: "expected" | "actual";
  grade: number;
  /** اختياري -- محور القرابة الدراسية (lib/subjectAffinity.ts)، مطابقاً لنموذج quiz/page.tsx. */
  subjectGrades?: Record<string, number>;
}

export type AnswerFn = (question: { id: string; text: string; dimensions: Record<string, number> }, rng: () => number) => -1 | 0 | 1;

export interface SimulationResult {
  filters: FilterSettings;
  answers: Record<string, number>;
  userVector: Record<RiasecDimension, number>;
  topUserDimensions: { dimension: RiasecDimension; score: number }[];
  warnings: string[];
  vrs: ValidityCheckResult;
  eligibleMajorCount: number;
  top3: { id: string; name: string; category: string; fitPercent: number; combinedScore: number }[];
  topMajorOfferings: {
    majorId: string;
    majorName: string;
    publicCount: number;
    privateCount: number;
    bestPublicOffering: { universityName: string; province: string; collegeName: string; departmentName: string; morningGrade: number | null } | null;
    bestPrivateOffering: { universityName: string; province: string; collegeName: string; departmentName: string } | null;
    gradeQualifiesForBestPublic: boolean | null;
  } | null;
}

export function simpleRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function runOneSimulation(
  filters: FilterSettings,
  answerFn: AnswerFn,
  rng: () => number
): SimulationResult {
  const answers: Record<string, number> = {};
  ALL_QUESTIONS.forEach((q) => {
    answers[q.id] = answerFn(q as any, rng);
  });

  const scoredAnswers: Record<string, number> = {};
  const validityAnswers: Record<string, number> = {};
  Object.entries(answers).forEach(([id, val]) => {
    if (VALIDITY_IDS.has(id)) validityAnswers[id] = val;
    else scoredAnswers[id] = val;
  });

  const warnings = contradictionPairsData
    .filter((p) => (scoredAnswers[p.a] ?? 0) > 0 && (scoredAnswers[p.b] ?? 0) > 0)
    .map((p) => p.message);

  const userVector = computeUserRiasecVector(scoredAnswers, questionsData as any);
  const allowedCats = BRANCH_MAP[filters.branch] || [];
  const gradeIsHigh = filters.grade >= 85;
  const subjectVector = computeSubjectAffinityVector(filters.subjectGrades ?? {}, filters.grade);

  const processed = majorsData
    .map((m) => {
      const profile = (riasecProfilesData.profiles as Record<string, any>)[m.id] ?? {};
      const riasecFitPercent = computeMajorFit(userVector, profile);
      const majorSubjectWeights = (subjectAffinityWeightsData.weights as Record<string, any>)[m.id] ?? {};
      const subjectFitPercent = computeSubjectAffinityFit(subjectVector, majorSubjectWeights);
      const fitPercent =
        subjectFitPercent === null
          ? riasecFitPercent
          : riasecFitPercent * (1 - SUBJECT_AFFINITY_BLEND_WEIGHT) + subjectFitPercent * SUBJECT_AFFINITY_BLEND_WEIGHT;
      let valid = allowedCats.includes(m.category);
      if (!gradeIsHigh && m.category === "طبي") valid = false;
      const combinedScore = computeCombinedRankingScore(fitPercent, m.marketMultiplier);
      return { ...m, fitPercent, riasecFitPercent, subjectFitPercent, combinedScore, valid };
    })
    .filter((m) => m.valid);

  processed.sort((a, b) => b.combinedScore - a.combinedScore);
  const top3 = processed.slice(0, 3).map((m) => ({
    id: m.id, name: m.name, category: m.category, fitPercent: m.fitPercent, combinedScore: m.combinedScore,
  }));

  const vrs = computeValidityRiskScore(scoredAnswers, validityAnswers, {}, contradictionPairsData, questionsData as any);
  const topUserDimensions = topDimensions(userVector, 2);

  // نفس منطق صفحة التقرير: البحث عن جامعات حقيقية للتخصص الأول الموصى به
  let topMajorOfferings: SimulationResult["topMajorOfferings"] = null;
  if (top3.length > 0) {
    const topMajorFull = majorsData.find((m) => m.id === top3[0].id)!;
    const offerings = findUniversitiesForMajor(
      topMajorFull as any,
      universitiesData.universities as unknown as University[],
      majorMappingsData.mappings as any,
      { province: filters.province }
    );
    const ranked = rankUniversityOfferings(offerings);
    const pub = ranked.filter((o) => o.universityType === "حكومية");
    const priv = ranked.filter((o) => o.universityType === "أهلية");
    const bestPublic = pub[0] ?? null;
    topMajorOfferings = {
      majorId: top3[0].id,
      majorName: top3[0].name,
      publicCount: pub.length,
      privateCount: priv.length,
      bestPublicOffering: bestPublic
        ? {
            universityName: bestPublic.universityName,
            province: bestPublic.province,
            collegeName: bestPublic.collegeName,
            departmentName: bestPublic.departmentName,
            morningGrade: bestPublic.averageGrades["صباحي"],
          }
        : null,
      bestPrivateOffering: priv[0]
        ? { universityName: priv[0].universityName, province: priv[0].province, collegeName: priv[0].collegeName, departmentName: priv[0].departmentName }
        : null,
      gradeQualifiesForBestPublic:
        bestPublic && bestPublic.averageGrades["صباحي"] !== null ? filters.grade >= bestPublic.averageGrades["صباحي"]! : null,
    };
  }

  return {
    filters,
    answers,
    userVector,
    topUserDimensions,
    warnings,
    vrs,
    eligibleMajorCount: processed.length,
    top3,
    topMajorOfferings,
  };
}

export function randomFilters(rng: () => number, opts?: Partial<FilterSettings>): FilterSettings {
  const province = opts?.province ?? AVAILABLE_PROVINCES[Math.floor(rng() * AVAILABLE_PROVINCES.length)];
  const branch = opts?.branch ?? BRANCHES[Math.floor(rng() * BRANCHES.length)];
  const gradeType = opts?.gradeType ?? (rng() < 0.5 ? "expected" : "actual");
  const grade = opts?.grade ?? Math.round(50 + rng() * 50);
  return { province, branch, gradeType, grade };
}
