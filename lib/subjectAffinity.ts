/**
 * محور "القرابة الدراسية" (Subject Affinity) — تحليل_الثغرات_وخطة_التطوير.md
 * §1.2: RIASEC يقيس *الاهتمام* الشخصي فقط، لا *القدرة* الفعلية. طالب اهتمامه
 * هندسي عالٍ لكن درجاته في الرياضيات والفيزياء ضعيفة نسبياً سيتعثّر فعلياً،
 * وRIASEC وحده لا يلتقط هذا. هذا المحور يشتق إشارة موضوعية إضافية من درجات
 * الطالب الفعلية في مواد محددة (لا تقديره الذاتي)، مستقلة تماماً عن RIASEC،
 * وتُدمَج معه كمحور ترتيب ثانٍ.
 *
 * مهم: هذا محور *نسبي* لا مطلق -- يقيس في أي مادة يتفوّق الطالب نسبياً مقارنة
 * بمعدله العام، لا مستوى تفوّقه المطلق (الذي تقيسه بوابة المعدل العام
 * المنفصلة تماماً في quiz/page.tsx). طالب معدله العام مرتفع في كل شيء يظهر
 * محايداً (50) على كل المحاور، لا مرتفعاً على الجميع -- وإلا فقد المحور قدرته
 * التمييزية بين التخصصات لأصحاب المعدلات المرتفعة تحديداً، وهم الأكثر حاجة
 * فعلية لهذا التمييز (يمكنهم عملياً دخول أي تخصص تقريباً).
 */

export type SubjectAffinityAxis = "quantitative" | "physicalScience" | "bioMedical" | "verbal" | "socialHumanities";

export const SUBJECT_AFFINITY_AXES: SubjectAffinityAxis[] = [
  "quantitative",
  "physicalScience",
  "bioMedical",
  "verbal",
  "socialHumanities",
];

export const SUBJECT_AFFINITY_LABELS: Record<SubjectAffinityAxis, string> = {
  quantitative: "كمي-رياضي",
  physicalScience: "علوم طبيعية-فيزيائية",
  bioMedical: "أحيائي-طبي",
  verbal: "لغوي-لفظي",
  socialHumanities: "اجتماعي-إنساني",
};

/** درجات المواد التي نجمعها من الطالب، حسب فرعه (بعضها قد لا يُدخِله الطالب). */
export interface SubjectGrades {
  math?: number;
  physics?: number;
  chemistry?: number;
  biology?: number;
  arabic?: number;
  english?: number;
  history?: number;
  geography?: number;
}

/** أي مادة تُغذّي أي محور -- مادة واحدة قد تُغذّي أكثر من محور (مثال: الأحياء تُغذّي bioMedical بثقل كامل). */
const AXIS_SOURCE_SUBJECTS: Record<SubjectAffinityAxis, (keyof SubjectGrades)[]> = {
  quantitative: ["math"],
  physicalScience: ["physics", "chemistry"],
  bioMedical: ["biology"],
  verbal: ["arabic", "english"],
  socialHumanities: ["history", "geography"],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * يحسب متجه القرابة الدراسية (0-100 لكل محور) من درجات المواد الفعلية
 * ومعدل الطالب العام. محاور بلا أي مادة مصدر مُدخَلة تبقى `undefined` (لا
 * صفراً ولا 50) كي يتجاهلها computeSubjectAffinityFit تماماً بدل معاقبة
 * الطالب على مادة لم تُطلَب منه أصلاً (فروع مختلفة تُدخِل مواد مختلفة).
 */
export function computeSubjectAffinityVector(
  grades: SubjectGrades,
  overallGrade: number
): Partial<Record<SubjectAffinityAxis, number>> {
  const vector: Partial<Record<SubjectAffinityAxis, number>> = {};

  SUBJECT_AFFINITY_AXES.forEach((axis) => {
    const sourceSubjects = AXIS_SOURCE_SUBJECTS[axis];
    const values = sourceSubjects.map((s) => grades[s]).filter((v): v is number => typeof v === "number");
    if (values.length === 0) return; // لم يُدخِل الطالب أي مادة تخص هذا المحور

    const avgSubjectGrade = values.reduce((a, b) => a + b, 0) / values.length;
    // الفارق النسبي عن المعدل العام: طالب متفوّق في مادة هذا المحور أكثر من
    // معدله العام يحصل على قيمة أعلى من 50 (المنتصف المحايد)، لا العكس.
    const relativeDiff = avgSubjectGrade - overallGrade;
    // ±20 نقطة فارقاً نسبياً تُعتبر أقصى تمايز واقعي ممكن (نادراً ما يتجاوزه
    // طالب حقيقي فارق مادة عن معدله العام) وتُطابَق مع طرفي المدى 0-100.
    vector[axis] = clamp(50 + (relativeDiff / 20) * 50, 0, 100);
  });

  return vector;
}

/**
 * نسبة توافق دراسي بين متجه الطالب (قد يكون جزئياً -- محاور غير مُدخَلة) وبين
 * أوزان التخصص، عبر نفس منهج RMSE المستخدم في computeMajorFit لـRIASEC
 * (اتساق التفسير للطالب: كلا الرقمين "100 - جذر متوسط مربعات الفروق").
 * يُهمِل تماماً أي محور لم يُدخِل الطالب مادته المصدر (بدل افتراض 50 له، ما
 * كان سيُنتج فارقاً كاذباً مع أوزان تخصصات تعتمد ذلك المحور بثقل عالٍ).
 * يُرجِع `null` إن لم يُدخِل الطالب أي درجة مادة إطلاقاً (تجاهل المحور كاملاً
 * في الترتيب، لا معاقبة كل التخصصات بالتساوي بقيمة عشوائية).
 */
export function computeSubjectAffinityFit(
  studentVector: Partial<Record<SubjectAffinityAxis, number>>,
  majorWeights: Partial<Record<SubjectAffinityAxis, number>>
): number | null {
  const availableAxes = SUBJECT_AFFINITY_AXES.filter((axis) => typeof studentVector[axis] === "number");
  if (availableAxes.length === 0) return null;

  let sumSquares = 0;
  availableAxes.forEach((axis) => {
    const s = studentVector[axis] as number;
    const m = (majorWeights[axis] ?? 0) * 10; // أوزان التخصص بمقياس 0-10
    sumSquares += (s - m) ** 2;
  });
  const rmse = Math.sqrt(sumSquares / availableAxes.length);
  return clamp(100 - rmse, 0, 100);
}
