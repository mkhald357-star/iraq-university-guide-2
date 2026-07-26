/**
 * مخطّط الرغبات — يحاكي آلية "الاختيارات" الحقيقية في نظام القبول المركزي:
 * الطالب يرتّب رغباته (عروض جامعية حقيقية)، والأداة تصنّف كل رغبة بمقارنة
 * معدله بحدّها التنافسي الفعلي، وتُشخِّص أخطاء استراتيجية شائعة في القائمة
 * ذاتها (غياب شبكة أمان، تكرار مُهدِر، ترتيب معكوس).
 *
 * القيم الرقمية (هامش الأمان، الحد الأدنى للرغبات المريحة، عتبة التكرار)
 * ثابتة كما صُمِّمت الميزة أصلاً — لا اجتهاد فيها.
 *
 * ملاحظة تصميمية: لا حقل `cutoff` مفرد على العرض كما قد يُفترَض للوهلة
 * الأولى — البيانات الحقيقية (`UniversityOffering` في majorMatcher.ts) تفصل
 * صباحي/مسائي، وتميّز "قبول مباشر" (بلا حدّ تنافسي إطلاقاً) عن "بلا بيانات".
 * القسم المباشر يُصنَّف "مريح" دائماً — ليس "غير معروف" كما قد يُظَنّ لو
 * عُومِل الفراغ في averageGrades كحالة واحدة فقط.
 */

import type { UniversityOffering } from "./majorMatcher";

export type StudySession = "صباحي" | "مسائي";
export type Band = "safe" | "close" | "reach" | "unknown";

export interface WishOffering {
  majorId: string;
  majorName: string;
  session: StudySession;
  offering: UniversityOffering;
}

export interface ClassifiedWish extends WishOffering {
  band: Band;
  /** الحدّ التنافسي المستخدَم للمقارنة (null لقبول مباشر أو بيانات غائبة). */
  cutoff: number | null;
  /** معدل الطالب ناقص الحدّ (موجب = تجاوزه). null إن لم يوجد حدّ للمقارنة. */
  margin: number | null;
}

/** عتبة الأمان: نقاط فوق الحدّ الفعلي المنشور. */
export const SAFE_MARGIN = 5;

/** الحد الأدنى الموصى به من الرغبات المريحة في القائمة. */
export const MIN_SAFE_WISHES = 3;

/** عدد التكرارات (نفس التخصص + نفس المحافظة) الذي يُعتبَر إهداراً للقائمة. */
export const REDUNDANT_CLUSTER_THRESHOLD = 4;

export function classifyOffering(wish: WishOffering, gpa: number): ClassifiedWish {
  const { offering, session } = wish;

  if (offering.isDirectAdmission) {
    return { ...wish, band: "safe", cutoff: null, margin: null };
  }

  const cutoff = offering.averageGrades[session];
  if (cutoff === null) {
    return { ...wish, band: "unknown", cutoff: null, margin: null };
  }

  const margin = +(gpa - cutoff).toFixed(2);
  const band: Band = margin >= SAFE_MARGIN ? "safe" : margin >= 0 ? "close" : "reach";
  return { ...wish, band, cutoff, margin };
}

export interface Diagnostic {
  level: "danger" | "warning" | "info";
  code: string;
  message: string;
}

export interface PlanResult {
  wishes: ClassifiedWish[];
  counts: Record<Band, number>;
  diagnostics: Diagnostic[];
  suggestedSafe: ClassifiedWish[];
}

/** تخصص مؤهَّل (بفرع الطالب) مع عروضه الحقيقية — يُحسَب في الصفحة عبر
 * نفس نمط "أقرب البدائل" الموجود أصلاً في app/report/page.tsx، لا داخل
 * هذا الملف (فصل بين حساب الأهلية وحساب التصنيف). */
export interface AlternativeCandidate {
  majorId: string;
  majorName: string;
  offerings: UniversityOffering[];
}

function wishKey(offering: UniversityOffering, session: StudySession): string {
  return `${offering.universityId}|${offering.collegeId}|${offering.departmentName}|${session}`;
}

export function analyzeWishlist(
  ordered: WishOffering[],
  gpa: number,
  alternativeCandidates: AlternativeCandidate[] = []
): PlanResult {
  const wishes = ordered.map((w) => classifyOffering(w, gpa));

  const counts: Record<Band, number> = { safe: 0, close: 0, reach: 0, unknown: 0 };
  wishes.forEach((w) => {
    counts[w.band] += 1;
  });

  const diagnostics: Diagnostic[] = [];

  /* ── ١) غياب شبكة الأمان — أخطر خطأ ── */
  if (wishes.length > 0 && counts.safe < MIN_SAFE_WISHES) {
    diagnostics.push({
      level: "danger",
      code: "NO_SAFETY_NET",
      message:
        `لديك ${counts.safe} رغبة مريحة فقط من أصل ${wishes.length}. ` +
        `هذا يعرّضك للخروج بلا قبول. أضِف رغباتٍ معدّلك يفوق حدّها بوضوح.`,
    });
  }

  /* ── ٢) تكرار مُهدِر: نفس التخصص ونفس المحافظة ── */
  const clusters = new Map<string, { count: number; majorName: string; province: string }>();
  wishes.forEach((w) => {
    const key = `${w.majorId}|${w.offering.province}`;
    const existing = clusters.get(key);
    if (existing) existing.count += 1;
    else clusters.set(key, { count: 1, majorName: w.majorName, province: w.offering.province });
  });
  clusters.forEach(({ count, majorName, province }) => {
    if (count >= REDUNDANT_CLUSTER_THRESHOLD) {
      diagnostics.push({
        level: "warning",
        code: "REDUNDANT_CLUSTER",
        message:
          `${count} رغبات في نفس التخصص (${majorName}) ونفس المحافظة (${province}). ` +
          `وسّع خياراتك بدل إهدار مقاعد قائمتك.`,
      });
    }
  });

  /* ── ٣) ترتيب معكوس: رغبة لاحقة أسهل من سابقة بفارق كبير ── */
  for (let i = 1; i < wishes.length; i++) {
    const prev = wishes[i - 1];
    const cur = wishes[i];
    if (prev.cutoff !== null && cur.cutoff !== null && cur.cutoff > prev.cutoff + 5) {
      diagnostics.push({
        level: "info",
        code: "ORDER_INVERSION",
        message:
          `الرغبة ${i + 1} حدّها (${cur.cutoff}%) أعلى من الرغبة ${i} ` +
          `(${prev.cutoff}%). تأكّد أن الترتيب يعكس رغبتك الحقيقية لا الأسهل.`,
      });
      break; // تحذير واحد يكفي — لا تُغرِق الطالب
    }
  }

  /* ── ٤) القائمة فارغة ── */
  if (wishes.length === 0) {
    diagnostics.push({
      level: "info",
      code: "EMPTY",
      message: "ابدأ بإضافة رغباتك من القائمة المتاحة أدناه.",
    });
  }

  /* ── اقتراح بدائل مريحة من التخصصات المؤهَّل لها فعلاً ── */
  const chosenKeys = new Set(ordered.map((w) => wishKey(w.offering, w.session)));
  const suggestedSafe: ClassifiedWish[] = [];
  for (const cand of alternativeCandidates) {
    for (const offering of cand.offerings) {
      for (const session of offering.sessions as StudySession[]) {
        if (chosenKeys.has(wishKey(offering, session))) continue;
        const classified = classifyOffering(
          { majorId: cand.majorId, majorName: cand.majorName, session, offering },
          gpa
        );
        if (classified.band === "safe") suggestedSafe.push(classified);
      }
    }
  }
  suggestedSafe.sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0)); // الأقرب لمعدل الطالب أولاً

  return { wishes, counts, diagnostics, suggestedSafe: suggestedSafe.slice(0, 5) };
}
