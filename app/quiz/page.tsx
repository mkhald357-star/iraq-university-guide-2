"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, AlertTriangle, AlertCircle, CheckCircle, Edit3, ClipboardList } from "lucide-react";
import questionsData from "../../data/questions.json";
import validityQuestionsData from "../../data/validity_questions.json";
import contradictionPairsData from "../../data/contradiction_pairs.json";
import tiebreakerQuestionsData from "../../data/tiebreaker_questions.json";
import majorsData from "../../data/majors.json";
import provincesData from "../../data/provinces.json";
import riasecProfilesData from "../../data/major_riasec_profiles.json";
import { UNCOVERED_PROVINCES, UNCOVERED_PROVINCES_REASON } from "../../lib/admissionDisclosure";
import {
  computeUserRiasecVector,
  computeCombinedRankingScore,
  topDimensions,
  RIASEC_LABELS,
  type RiasecDimension,
  type RiasecVector,
} from "../../lib/riasec";
import { computeValidityRiskScore, type ValidityCheckResult } from "../../lib/validity";
import { type SubjectGrades } from "../../lib/subjectAffinity";
import subjectAffinityWeightsData from "../../data/subject_affinity_weights.json";
import { IconBadge, Badge, Card, SelectField, InputField, Alert } from "../components/ui";
import {
  rankMajors,
  planTieBreak,
  type RankMajorsData,
  type RankedMajor,
} from "../../lib/recommendationEngine";

type AnswerState = Record<string, number>;
interface QuizItem {
  id: string;
  text: string;
  dimensions: RiasecVector;
  // لأسئلة المقارنة الصريحة ("تفضّل A على B؟") فقط -- تستبدل نصوص الأزرار
  // العامة بنص يوضّح صراحة أي طرف من المقارنة يختاره كل زر، فيزول غموض "لا،
  // إطلاقاً" (هل يعني رفض A لصالح B، أم رفض الاثنين معاً؟) دون أي تغيير على
  // dimensions أو آلية التسجيل نفسها. الأسئلة الأخرى بلا هذا الحقل تستخدم
  // الأزرار العامة كما هي (fallback). stronglyYes/stronglyNo اختياريان
  // (مقياس الخمس نقاط) -- لا سؤال حالياً يملؤهما، تُشتَق آلياً في
  // getAnswerLabels بدل إعادة كتابة الأربعين سؤالاً.
  answerLabels?: { yes: string; maybe: string; no: string; stronglyYes?: string; stronglyNo?: string };
}

interface FiveLevelLabels {
  stronglyYes: string;
  yes: string;
  maybe: string;
  no: string;
  stronglyNo: string;
}

const GENERIC_ANSWER_LABELS: FiveLevelLabels = {
  stronglyYes: "أوافق بشدة",
  yes: "أوافق",
  maybe: "محايد",
  no: "لا أوافق",
  stronglyNo: "لا أوافق إطلاقاً",
};

// ترقية من مقياس 3 نقاط (نعم/ربما/لا) إلى 5 (مع درجتَي شدّة) -- بلا إعادة
// كتابة الأسئلة الأربعين الحالية. أسئلة المقارنة الصريحة (answerLabels
// مخصَّصة) كُتبت أصلاً بصيغة "...بوضوح" في طرفيها (yes/no)، فتلائم درجتَي
// التطرّف الجديدتين تماماً بلا تعديل؛ الدرجتان الوسيطتان نص واجهة عام محايد
// عن مضمون السؤال (لا ادّعاء بيانات جديد)، ويُفهَمان من موضعهما بين الطرف
// القوي والمحايد.
function getAnswerLabels(q: QuizItem): FiveLevelLabels {
  if (!q.answerLabels) return GENERIC_ANSWER_LABELS;
  const { yes, maybe, no, stronglyYes, stronglyNo } = q.answerLabels;
  return {
    stronglyYes: stronglyYes ?? yes,
    yes: "أميل لهذا الجانب",
    maybe,
    no: "أميل للجانب الآخر",
    stronglyNo: stronglyNo ?? no,
  };
}

// قائمة المحافظات مولَّدة من بيانات الجامعات الفعلية عبر خط أنابيب
// الاستخراج (data/provinces.json، ملف صغير مشتق حتى لا نستورد كل بيانات
// الجامعات الضخمة هنا فقط لعرض قائمة منسدلة) — تبقى متزامنة تلقائياً مع
// أي توسعة مستقبلية للبيانات، بدل قائمة ثابتة قديمة.
const AVAILABLE_PROVINCES = provincesData as string[];

// أسئلة تحقق/جدّية (VRS) لا تُحسب ضمن أبعاد RIASEC — dimensions فارغة عمداً،
// ما يجعل computeUserRiasecVector يتجاهلها تلقائياً دون أي تعديل إضافي فيه.
// نُدرجها بمواضع ثابتة داخل تسلسل الأسئلة: سؤال الانتباه الموجَّه في المنتصف
// تقريباً، وتوأم "مساعدة الآخرين" المعكوس + مقياس الصدق قرب النهاية (كما
// أوصى تقرير كشف التحيز — كي لا يُلاحظ الطالب نمطها بسهولة).
const SCORED_QUESTIONS = questionsData as QuizItem[];
const VALIDITY_QUESTIONS = validityQuestionsData as QuizItem[];
const [ATTENTION_CHECK, HELP_OTHERS_REVERSE, LIE_SCALE] = VALIDITY_QUESTIONS;
const ATTENTION_CHECK_POSITION = 18;
const ALL_QUIZ_QUESTIONS: QuizItem[] = [
  ...SCORED_QUESTIONS.slice(0, ATTENTION_CHECK_POSITION),
  ATTENTION_CHECK,
  ...SCORED_QUESTIONS.slice(ATTENTION_CHECK_POSITION),
  HELP_OTHERS_REVERSE,
  LIE_SCALE,
];
const VALIDITY_QUESTION_IDS = new Set(VALIDITY_QUESTIONS.map((q) => q.id));

// بيانات محرك الترتيب (lib/recommendationEngine.ts) -- تُحسَب مرة واحدة هنا
// بدل إعادة بنائها في كل استدعاء لـrunRecommendationEngine.
const ENGINE_DATA: RankMajorsData = {
  majors: majorsData,
  riasecProfiles: riasecProfilesData.profiles as RankMajorsData["riasecProfiles"],
  subjectWeights: subjectAffinityWeightsData.weights as RankMajorsData["subjectWeights"],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// مكوّن شاشة المراجعة قبل الإرسال
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ReviewScreen({
  questions,
  answers,
  onEdit,
  onSubmit,
  onBack,
}: {
  questions: QuizItem[];
  answers: AnswerState;
  onEdit: (index: number) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const defaultLabelMap: Record<number, string> = { 1: "نعم، بالتأكيد", 0: "ربما / أحياناً", [-1]: "لا، إطلاقاً" };
  const answerLabelFor = (q: QuizItem, val: number): string => {
    if (q.answerLabels) {
      if (val === 1) return q.answerLabels.yes;
      if (val === 0) return q.answerLabels.maybe;
      if (val === -1) return q.answerLabels.no;
    }
    return defaultLabelMap[val] ?? String(val);
  };
  const colorMap: Record<number, string> = {
    1: "text-primary-text font-bold",
    0: "text-primary-text font-bold opacity-70",
    [-1]: "text-ink-muted font-bold",
  };

  const unanswered = questions.filter((q) => answers[q.id] === undefined);

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-6 a-fade">
      {/* العنوان */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-band-safe-bg">
          <CheckCircle className="h-8 w-8 text-band-safe" />
        </div>
        <h1 className="text-3xl font-black text-ink">مراجعة إجاباتك</h1>
        <p className="text-ink-muted">راجع إجاباتك قبل إرسال الاختبار — يمكنك تعديل أي إجابة</p>
      </div>

      {/* تحذير إجابات فائتة */}
      {unanswered.length > 0 && (
        <Alert tone="close" icon={AlertTriangle}>
          لم تُجب على <strong>{unanswered.length} سؤال</strong>. يُفضَّل الإجابة على جميع الأسئلة للحصول على توصية
          دقيقة.
        </Alert>
      )}

      {/* قائمة الإجابات */}
      <Card variant="surface" radius="rounded-3xl" className="max-h-[420px] space-y-3 overflow-y-auto">
        {questions.map((q, i) => {
          const val = answers[q.id];
          const answered = val !== undefined;
          return (
            <div
              key={q.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                answered ? "bg-surface border-line" : "bg-band-close-bg border-band-close/30"
              }`}
            >
              {/* رقم */}
              <span className="shrink-0 w-7 h-7 rounded-full bg-surface-muted flex items-center justify-center text-xs font-bold text-ink-muted">
                {i + 1}
              </span>

              {/* النص والإجابة */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-muted truncate">{q.text}</p>
                <p
                  className={`text-sm mt-0.5 ${answered ? (colorMap[val] ?? "text-ink") : "text-band-close font-bold"}`}
                >
                  {answered ? answerLabelFor(q, val) : "لم يتم الإجابة"}
                </p>
              </div>

              {/* زر التعديل */}
              <button
                onClick={() => onEdit(i)}
                className="shrink-0 flex items-center gap-1 text-xs text-primary-text hover:text-primary-800 font-bold transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                تعديل
              </button>
            </div>
          );
        })}
      </Card>

      {/* أزرار الإجراء */}
      <div className="space-y-3">
        <button
          onClick={onSubmit}
          className="w-full bg-primary-solid text-white py-4 rounded-2xl font-black text-lg hover:bg-primary-solid-hover transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-primary/20"
        >
          إرسال الاختبار وعرض التوصية ✨
        </button>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors mx-auto text-sm"
        >
          <ChevronRight className="w-4 h-4" />
          الرجوع للسؤال الأخير
        </button>
      </div>
    </div>
  );
}

// حقل درجة مادة واحدة ضمن نموذج القرابة الدراسية الاختياري -- فارغ افتراضياً
// (undefined لا صفراً)، كي lib/subjectAffinity.ts يتجاهل أي محور لم يُدخِله
// الطالب بدل معاقبته على غيابه.
function SubjectGradeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <InputField
      compact
      label={label}
      type="number"
      min={0}
      max={100}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      placeholder="اختياري"
    />
  );
}

// مؤشر طلب السوق -- معروض دائماً منفصلاً بصرياً عن نسبة التوافق الشخصي (لا
// مدموجاً فيها كرقم واحد)، لأن السؤالين مختلفان تماماً: "أيّ تخصص يشبهك؟"
// مقابل "ما فرص هذا التخصص؟" (انظر تحليل_الثغرات_وخطة_التطوير.md §3.2).
function getDemandLevel(multiplier: number): { text: string; tone: "safe" | "primary" | "close" | "reach" } {
  if (multiplier >= 1.4) return { text: "مرتفع جداً", tone: "safe" };
  if (multiplier >= 1.2) return { text: "مرتفع", tone: "primary" };
  if (multiplier >= 1.0) return { text: "متوسط", tone: "close" };
  return { text: "منخفض/متشبع", tone: "reach" };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// المكوّن الرئيسي
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function Quiz() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [isFinished, setIsFinished] = useState(false);
  const [showReview, setShowReview] = useState(false);
  // كل التخصصات الصالحة لفرع الطالب (لا أفضل 3 فقط) بنسبة توافقها الخام --
  // تُخزَّن كاملة عند إنهاء الاختبار لتُتيح إعادة الترتيب فوراً وتفاعلياً عند
  // تحريك منزلق "أهمية السوق" بلا حاجة لإعادة حساب الاختبار من الصفر
  // (انظر §3.2 من تحليل الثغرات: السوق مفصول عن الترتيب افتراضياً، بيد الطالب فقط).
  const [allValidMajors, setAllValidMajors] = useState<RankedMajor[]>([]);
  const [marketWeight, setMarketWeight] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [topUserDimensions, setTopUserDimensions] = useState<{ dimension: RiasecDimension; score: number }[]>([]);
  const [vrsResult, setVrsResult] = useState<ValidityCheckResult | null>(null);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [questionShownAt, setQuestionShownAt] = useState<number>(() => Date.now());

  // ---- خوارزمية تتكيّف متعددة الجولات (تحليل_الثغرات_وخطة_التطوير.md §5.2):
  // عند تقارب أول تخصصين بعد الأسئلة الأربعين الأساسية، تُضاف أسئلة ترجيح
  // إضافية مستهدفة (data/tiebreaker_questions.json) بدل حسم التعادل بمعامل
  // السوق وحده. إن بقي التعادل، تُطرَح جولة تالية (بأسئلة مختلفة عن كل
  // الجولات السابقة) قبل الحسم النهائي إجبارياً -- حد أقصى 3 جولات (رُفع من
  // 2 بطلب صريح: "إذا استمر التقارب") لتفادي إرهاق الطالب بلا نهاية، ويتوقف
  // تلقائياً أبكر من ذلك إن نفدت الأسئلة المميِّزة المتبقية لنفس البُعدين
  // (بنك 18 سؤالاً، 3 لكل بُعد RIASEC — يكفي بالضبط لثلاث جولات كحد أقصى
  // لكل بُعد). tieBreakQuestions فارغة افتراضياً فلا يتغيّر سلوك الاختبار
  // إطلاقاً للحالة الشائعة (نتيجة واضحة من الجولة الأولى). الثابت نفسه صار
  // مُصدَّراً من lib/recommendationEngine.ts (MAX_TIEBREAK_ROUNDS) -- مصدر
  // وحيد بدل رقم مكرَّر هنا وهناك.
  const [tieBreakQuestions, setTieBreakQuestions] = useState<QuizItem[]>([]);
  const [tieBreakPending, setTieBreakPending] = useState(false);
  const [tieBreakRound, setTieBreakRound] = useState(0);
  const [tieBreakInfo, setTieBreakInfo] = useState<{ a: string; b: string } | null>(null);

  const [filterSettings, setFilterSettings] = useState<null | {
    province: string;
    branch: string;
    gradeType: "expected" | "actual";
    grade: number;
  }>(null);

  // ---- محور القرابة الدراسية (اختياري) -- درجات مواد فعلية، لا اهتماماً
  // ذاتياً، انظر تحليل_الثغرات_وخطة_التطوير.md §1.2 ----
  const [formBranch, setFormBranch] = useState(""); // نسخة متحكَّم بها من حقل الفرع لعرض حقول المواد المناسبة قبل الإرسال
  const [subjectGrades, setSubjectGrades] = useState<SubjectGrades>({});

  // إعادة ترتيب فورية عند تحريك منزلق "أهمية السوق" -- بلا إعادة حساب
  // الاختبار كاملاً، فقط إعادة فرز القائمة المخزَّنة أصلاً حسب الوزن الحالي.
  const rankedMajors = useMemo(() => {
    return [...allValidMajors]
      .map((m) => ({
        ...m,
        combinedScore: computeCombinedRankingScore(m.fitPercent, m.marketMultiplier, marketWeight),
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 3);
  }, [allValidMajors, marketWeight]);

  // Clear session on mount
  useEffect(() => {
    // في التصفح الخاص القديم أو عند تعطيل التخزين المحلي من إعدادات
    // الخصوصية، قد يرمي الوصول إلى localStorage نفسه SecurityError — بلا
    // try/catch هنا تنهار صفحة الاختبار بأكملها فوراً قبل ظهور أي سؤال.
    try {
      localStorage.removeItem("quizResults");
      localStorage.removeItem("userAnswers");
      localStorage.removeItem("filterSettings");
    } catch {
      // تجاهل — الاختبار يعمل بلا حفظ محلي، أفضل من انهيار كامل.
    }
  }, []);

  // إعادة ضبط "توقيت بداية السؤال" عند كل انتقال — يغذّي مكوّن الزمن في VRS
  useEffect(() => {
    setQuestionShownAt(Date.now());
  }, [currentQuestionIndex]);

  // Persist filterSettings
  useEffect(() => {
    if (filterSettings) {
      try {
        localStorage.setItem("filterSettings", JSON.stringify(filterSettings));
      } catch {
        // تجاهل (حصة تخزين ممتلئة أو وصول مرفوض) — الحالة تبقى في الذاكرة.
      }
    }
  }, [filterSettings]);

  // ---- Pre-filter UI ----
  if (!filterSettings) {
    return (
      <div
        className="relative -mx-4 overflow-hidden px-4 py-12 md:-mx-8 md:px-8"
        style={{ background: "var(--g-surface)" }}
      >
        {/* أيقونة خلفية كبيرة زخرفية -- كسر التسطّح الأبيض الذي كان يجعل هذه
            أول صفحة يراها الزائر فعلياً بلا أي شخصية بصرية (data/admission_rules.md
            ملاحظات layout-craft). ثابتة بلا حركة هنا (لا Hero) -- التركيز
            على النموذج نفسه. */}
        <ClipboardList
          aria-hidden="true"
          className="pointer-events-none absolute -end-10 -top-10 h-64 w-64 text-primary-100 md:h-80 md:w-80"
          strokeWidth={1}
        />

        <div className="relative mx-auto max-w-xl space-y-8">
          <div className="text-center">
            <IconBadge icon={ClipboardList} size="lg" />
            <h1 className="mt-4 text-3xl font-bold text-primary-text">٤ معلومات سريعة قبل نبدأ</h1>
            <p className="mt-2 text-ink-soft">
              نحتاجها لنطابق ميولك بحدود القبول الحقيقية لفرعك ومحافظتك — بلا حفظ، وبلا حساب.
            </p>
          </div>
        <form
          className="glass p-8 rounded-3xl space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const province = (form.elements.namedItem("province") as HTMLSelectElement).value;
            const branch = (form.elements.namedItem("branch") as HTMLSelectElement).value;
            const gradeType = (form.elements.namedItem("gradeType") as HTMLSelectElement).value as
              "expected" | "actual";
            const grade = Number((form.elements.namedItem("grade") as HTMLInputElement).value);
            // بلا هذا، يبقى توقيت "بداية السؤال" عند وقت تحميل الصفحة (قبل
            // ملء نموذج الفلترة أصلاً)، فيُحتسب زمن ملء النموذج بأكمله
            // خطأً كجزء من "زمن الإجابة على السؤال الأول" في مؤشر الجدّية.
            setQuestionShownAt(Date.now());
            setFilterSettings({ province, branch, gradeType, grade });
          }}
        >
          <SelectField label="المحافظة" id="province" name="province" hint={`ملاحظة: ${UNCOVERED_PROVINCES_REASON}`} required>
            <option value="">اختر المحافظة</option>
            {AVAILABLE_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            {UNCOVERED_PROVINCES.map((p) => (
              <option key={p} value={p} disabled>
                {p} (غير مغطّاة)
              </option>
            ))}
          </SelectField>
          <SelectField
            label="الفرع الدراسي"
            id="branch"
            name="branch"
            value={formBranch}
            onChange={(e) => setFormBranch(e.target.value)}
            hint="الفروع الرسمية الثلاثة فقط في نظام القبول المركزي. تخصصات الإدارة والتسويق والمحاسبة مقبولة من فرعي العلمي والأدبي، وستظهر تلقائياً ضمن توصياتك أياً كان فرعك."
            required
          >
            <option value="">اختر الفرع</option>
            <option value="علمي">علمي (إحيائي / تطبيقي)</option>
            <option value="أدبي">أدبي</option>
            <option value="فنون">فنون / إبداع</option>
          </SelectField>
          <SelectField label="نوع المعدل" id="gradeType" name="gradeType" required>
            <option value="expected">معدل متوقع</option>
            <option value="actual">معدل حصل (حقيقي)</option>
          </SelectField>
          <InputField label="المعدل (٪)" id="grade" type="number" name="grade" min="0" max="100" placeholder="مثال: 78" required />
          {formBranch && (
            <div className="border-t border-line pt-5 space-y-3">
              <div>
                <h3 className="font-bold text-ink">درجات موادك (اختياري)</h3>
                <p className="text-xs text-ink-muted mt-1">
                  يرفع دقة التوصية عبر ربطها بنقاط قوّتك الدراسية الفعلية (لا رأيك الشخصي فقط) — تخصصان متقاربان شخصياً
                  قد يفرّقهما تفوّقك النسبي في مادة عن أخرى. اترك أي حقل فارغاً إن لم ترغب.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {formBranch === "علمي" ? (
                  <>
                    <SubjectGradeInput
                      label="الرياضيات"
                      value={subjectGrades.math}
                      onChange={(v) => setSubjectGrades((s) => ({ ...s, math: v }))}
                    />
                    <SubjectGradeInput
                      label="الفيزياء"
                      value={subjectGrades.physics}
                      onChange={(v) => setSubjectGrades((s) => ({ ...s, physics: v }))}
                    />
                    <SubjectGradeInput
                      label="الكيمياء"
                      value={subjectGrades.chemistry}
                      onChange={(v) => setSubjectGrades((s) => ({ ...s, chemistry: v }))}
                    />
                    <SubjectGradeInput
                      label="الأحياء"
                      value={subjectGrades.biology}
                      onChange={(v) => setSubjectGrades((s) => ({ ...s, biology: v }))}
                    />
                    <SubjectGradeInput
                      label="اللغة العربية"
                      value={subjectGrades.arabic}
                      onChange={(v) => setSubjectGrades((s) => ({ ...s, arabic: v }))}
                    />
                    <SubjectGradeInput
                      label="اللغة الإنجليزية"
                      value={subjectGrades.english}
                      onChange={(v) => setSubjectGrades((s) => ({ ...s, english: v }))}
                    />
                  </>
                ) : (
                  <>
                    <SubjectGradeInput
                      label="اللغة العربية"
                      value={subjectGrades.arabic}
                      onChange={(v) => setSubjectGrades((s) => ({ ...s, arabic: v }))}
                    />
                    <SubjectGradeInput
                      label="اللغة الإنجليزية"
                      value={subjectGrades.english}
                      onChange={(v) => setSubjectGrades((s) => ({ ...s, english: v }))}
                    />
                    <SubjectGradeInput
                      label="التاريخ"
                      value={subjectGrades.history}
                      onChange={(v) => setSubjectGrades((s) => ({ ...s, history: v }))}
                    />
                    <SubjectGradeInput
                      label="الجغرافية"
                      value={subjectGrades.geography}
                      onChange={(v) => setSubjectGrades((s) => ({ ...s, geography: v }))}
                    />
                  </>
                )}
              </div>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-primary-solid text-white py-3 rounded-xl font-bold hover:bg-primary-solid-hover transition-colors"
          >
            بدء الاختبار
          </button>
        </form>
        </div>
      </div>
    );
  }

  // كل الأسئلة (المُسجَّلة على أبعاد RIASEC + أسئلة التحقق الثلاثة) تُعرض
  // للجميع بصرف النظر عن الفرع، لأنها تقيس سمات شخصية عامة لا تفضيلاً
  // مباشراً لتخصص بعينه. أسئلة الترجيح (tieBreakQuestions) تُلحَق في آخر
  // القائمة فقط حين تُفعَّل فعلياً (فارغة في الحالة الشائعة، فلا يتغيّر طول
  // الاختبار أو سلوكه إطلاقاً عندما تكون النتيجة واضحة أصلاً).
  const displayedQuestions = [...ALL_QUIZ_QUESTIONS, ...tieBreakQuestions];

  // ---- محرك التوصية القائم على RIASEC + نظام كشف الجدّية (VRS) ----
  // roundNumber = عدد جولات الترجيح المُنجَزة فعلياً حتى الآن (0 = الجولة
  // الأولى بعد الأسئلة الأربعين مباشرة) -- يُحدّ بـMAX_TIEBREAK_ROUNDS لمنع
  // إرهاق الطالب بأسئلة ترجيح لا نهائية إن ظلّ التعادل قائماً.
  const runRecommendationEngine = (finalAnswers: AnswerState, opts?: { roundNumber?: number }) => {
    // فصل إجابات الأسئلة المُسجَّلة فعلياً على RIASEC عن إجابات أسئلة التحقق
    // الثلاثة (dimensions فارغة، لا تدخل حساب المتجه الشخصي إطلاقاً).
    const scoredAnswers: AnswerState = {};
    const validityAnswers: AnswerState = {};
    Object.entries(finalAnswers).forEach(([id, val]) => {
      if (VALIDITY_QUESTION_IDS.has(id)) validityAnswers[id] = val;
      else scoredAnswers[id] = val;
    });

    // جدول تناقضات منطقية قابل للتوسعة (data/contradiction_pairs.json) بدل
    // زوج واحد مبرمَج يدوياً — كل زوج "نعم+نعم" منطقياً متعارض يُضاف كتنبيه.
    const finalWarnings: string[] = contradictionPairsData
      .filter((pair) => (scoredAnswers[pair.a] ?? 0) > 0 && (scoredAnswers[pair.b] ?? 0) > 0)
      .map((pair) => pair.message);

    // نطاق التطبيع (min/max) يجب أن يشمل أسئلة الترجيح المعروضة فعلياً وإلا
    // تُحسَب مساهمتها بمقياس خاطئ -- questionsData وحدها تكفي في الجولة
    // الأولى (tieBreakQuestions فارغة بعد).
    const questionPoolForVector = [...(questionsData as QuizItem[]), ...tieBreakQuestions];
    const userVector = computeUserRiasecVector(scoredAnswers, questionPoolForVector);

    // محرك الترتيب الكامل (فرع + بوابة المعدل + RIASEC + مزيج القرابة
    // الدراسية) صار في lib/recommendationEngine.ts -- مصدر وحيد، قابل
    // للاختبار مستقلاً (lib/recommendationEngine.characterization.test.ts).
    const ranked = rankMajors(
      {
        scoredAnswers,
        questionPool: questionPoolForVector,
        branch: filterSettings.branch,
        grade: filterSettings.grade,
        subjectGrades,
      },
      ENGINE_DATA
    );
    const top3 = ranked.slice(0, 3);

    // ---- نقطة التكيّف متعددة الجولات: نتيجة متقاربة بين أول تخصصين → أسئلة
    // ترجيح إضافية، بحد أقصى MAX_TIEBREAK_ROUNDS جولات (§5.2) ----
    const currentRound = opts?.roundNumber ?? 0;
    const alreadyAskedIds = new Set(tieBreakQuestions.map((q) => q.id));
    const decision = planTieBreak(
      ranked,
      currentRound,
      alreadyAskedIds,
      tiebreakerQuestionsData as QuizItem[],
      ENGINE_DATA.riasecProfiles
    );

    if (decision.candidates.length > 0) {
      const startIndex = ALL_QUIZ_QUESTIONS.length + tieBreakQuestions.length;
      setTieBreakQuestions((prev) => [...prev, ...decision.candidates]); // تراكمي عبر الجولات، لا استبدال
      setTieBreakInfo(decision.tieBreakInfo);
      setTieBreakPending(true);
      setTieBreakRound(currentRound + 1);
      setCurrentQuestionIndex(startIndex);
      setShowReview(false);
      return; // لا نُنهي الاختبار بعد -- ننتظر إجابات جولة الترجيح هذه
    }

    setTieBreakPending(false);
    const userTopDimensions = topDimensions(userVector, 2);

    const vrs = computeValidityRiskScore(
      scoredAnswers,
      validityAnswers,
      timings,
      contradictionPairsData,
      questionsData
    );

    setWarnings(finalWarnings);
    setAllValidMajors(ranked);
    setTopUserDimensions(userTopDimensions);
    setVrsResult(vrs);
    setIsFinished(true);
    try {
      localStorage.setItem("quizResults", JSON.stringify(top3));
      localStorage.setItem("userAnswers", JSON.stringify(scoredAnswers));
      localStorage.setItem("needsReview", JSON.stringify(vrs.band !== "low"));
    } catch {
      // تجاهل — النتيجة تُعرض من الحالة في الذاكرة بغضّ النظر؛ فقط لن
      // تُستعاد لاحقاً في صفحة /report إذا أُعيد فتحها في تبويب جديد.
    }
  };

  // ---- معالجة الإجابة ----
  const handleAnswer = (answerWeight: number) => {
    const question = displayedQuestions[currentQuestionIndex];
    const newAnswers = { ...answers, [question.id]: answerWeight };
    setAnswers(newAnswers);
    setTimings((prev) => ({ ...prev, [question.id]: Date.now() - questionShownAt }));

    // آخر سؤال → انتقل لشاشة المراجعة، أو أنهِ مباشرة إن كان هذا آخر سؤال
    // ترجيح إضافي (لا داعي لمراجعة ثانية على 3-4 أسئلة فقط أُضيفت لتوّها).
    if (currentQuestionIndex >= displayedQuestions.length - 1) {
      if (tieBreakPending) {
        setTimeout(() => runRecommendationEngine(newAnswers, { roundNumber: tieBreakRound }), 150);
      } else {
        setTimeout(() => setShowReview(true), 150);
      }
    } else {
      setTimeout(() => setCurrentQuestionIndex((prev) => prev + 1), 150);
    }
  };

  // ---- شاشة النتيجة ----
  if (isFinished) {
    return (
      <div className="py-12 space-y-8 a-rise">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black text-primary-text">نتيجتك جاهزة!</h1>
          <p className="text-lg text-ink-soft">
            بناءً على تحليل شخصيتك المهنية عبر أسئلة الاختبار ونموذج RIASEC العالمي، هذه هي أفضل التخصصات لك:
          </p>
          {topUserDimensions.length > 0 && (
            <p className="text-sm text-ink-muted">
              أبرز سماتك:{" "}
              <span className="font-bold text-primary-text">
                {topUserDimensions.map((d) => RIASEC_LABELS[d.dimension]).join(" و")}
              </span>
            </p>
          )}
        </div>
        <Alert tone="info" icon={AlertCircle}>
          هذه توصية استرشادية إحصائية مبنية على نموذج شخصية مهنية، وليست قراراً رسمياً للقبول. الجهة الرسمية الوحيدة
          المعتمدة للتقديم والقبول الجامعي هي{" "}
          <a
            href="https://cap.mohesr.gov.iq"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary-text hover:underline"
          >
            القبول المركزي التابع لوزارة التعليم العالي والبحث العلمي
          </a>
          — راجعها دائماً قبل اتخاذ قرارك النهائي.
        </Alert>
        {warnings.length > 0 && (
          <Alert tone="close" icon={AlertTriangle} title="ملاحظة الخوارزمية:">
            <ul className="mt-1 list-inside list-disc space-y-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </Alert>
        )}
        {vrsResult && vrsResult.band !== "low" && (
          <Alert
            tone={vrsResult.band === "high" ? "reach" : "close"}
            icon={AlertTriangle}
            title={vrsResult.band === "high" ? "ننصح بمراجعة إجاباتك" : "قد تحتاج نتيجتك مراجعة إضافية"}
          >
            <p className="mt-1">
              لاحظ نظام التحقق نمطاً في إجاباتك قد يقلل من دقة التوصية (مثل إجابات متسرعة جداً أو متناقضة أو غير
              متمايزة). النتيجة أدناه لا تزال معروضة، لكن ننصحك بإعادة الاختبار بتركيز أكبر إن لم تكن التوصية منطقية
              بالنسبة لك.
            </p>
          </Alert>
        )}
        <Card variant="surface" radius="rounded-2xl" padding="p-5" className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="marketWeight" className="font-bold text-ink text-sm">
              كم يهمّك طلب السوق عند الترتيب؟
            </label>
            <span className="text-sm font-bold text-primary-text">
              {marketWeight === 0 ? "تجاهله كلياً" : `${Math.round(marketWeight * 100)}٪`}
            </span>
          </div>
          <input
            id="marketWeight"
            type="range"
            min={0}
            max={100}
            step={10}
            value={marketWeight * 100}
            onChange={(e) => setMarketWeight(Number(e.target.value) / 100)}
            className="w-full accent-primary"
          />
          <p className="text-xs text-ink-muted">
            الترتيب الافتراضي (0٪) يعتمد على توافق شخصيتك فقط. حرّك المنزلق يميناً إن أردت ترجيح التخصصات الأعلى طلباً
            في السوق ضمن الترتيب أيضاً — القرار بيدك أنت، لا خوارزمية خفية.
          </p>
        </Card>
        <div className="grid gap-6 mt-8">
          {rankedMajors.map((major, index) => {
            const demand = getDemandLevel(major.marketMultiplier);
            return (
              <Card
                key={major.id}
                variant="surface"
                radius="rounded-2xl"
                className="flex flex-wrap items-center justify-between gap-4 border-r-4 border-r-primary"
              >
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold text-ink break-words">
                    {index + 1}. {major.name}
                  </h2>
                  <p className="text-ink-muted">{major.category}</p>
                  <Badge tone={demand.tone} className="mt-1">
                    طلب السوق: {demand.text}
                  </Badge>
                </div>
                <div className="text-left shrink-0">
                  <div className="text-3xl font-black text-primary-text">{Math.round(major.fitPercent)}%</div>
                  <div className="text-sm text-ink-muted">نسبة التوافق الشخصي</div>
                </div>
              </Card>
            );
          })}
        </div>
        {rankedMajors.length > 0 ? (
          <Card
            variant="surface"
            radius="rounded-2xl"
            padding="p-8"
            className="border-primary/20 bg-primary/5 mt-8 space-y-4 text-center"
          >
            <h2 className="text-xl font-bold text-ink">احصل على تحليل الفجوة والجامعات الحكومية</h2>
            <p className="text-ink-soft">
              يحتوي التقرير على الكليات والأقسام الدقيقة في الجامعات الحكومية والأهلية، مع تحليل لأسباب اختيار هذا
              التخصص لك.
            </p>
            <Link
              href={`/report?major=${rankedMajors[0].id}`}
              className="inline-flex items-center gap-2 bg-primary-solid text-white px-8 py-4 rounded-full font-bold shadow-lg hover:bg-primary-solid-hover transition-all hover:-translate-y-1"
            >
              <span>فتح التقرير الشامل والمفصل</span>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Card>
        ) : (
          <Card variant="surface" radius="rounded-2xl" padding="p-8" className="mt-8 space-y-2 text-center">
            <p className="text-ink-soft font-bold">لم نجد تخصصات مطابقة لفرعك الدراسي ضمن بيانات المنصة الحالية.</p>
            <p className="text-ink-muted text-sm">جرّب إعادة الاختبار، أو تواصل معنا إن استمرت المشكلة.</p>
          </Card>
        )}
      </div>
    );
  }

  // ---- شاشة المراجعة ----
  if (showReview) {
    return (
      <ReviewScreen
        questions={displayedQuestions}
        answers={answers}
        onEdit={(index) => {
          setShowReview(false);
          setCurrentQuestionIndex(index);
        }}
        onSubmit={() => runRecommendationEngine({ ...answers })}
        onBack={() => {
          setShowReview(false);
          setCurrentQuestionIndex(displayedQuestions.length - 1);
        }}
      />
    );
  }

  // ---- شاشة الأسئلة ----
  const question = displayedQuestions[currentQuestionIndex];
  const progress = (currentQuestionIndex / displayedQuestions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-8">
      {/* شريط التقدم */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm font-bold text-ink-soft">
          <span>
            السؤال {currentQuestionIndex + 1} من {displayedQuestions.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-line h-3 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* نقاط الخطوات — اضغط على نقطة سابقة للرجوع إليها */}
        <div className="flex gap-1.5 mt-1">
          {displayedQuestions.map((_, i) => (
            <button
              key={i}
              onClick={() => i < currentQuestionIndex && setCurrentQuestionIndex(i)}
              disabled={i >= currentQuestionIndex}
              aria-label={`الانتقال لسؤال ${i + 1}`}
              className={`h-2.5 flex-1 rounded-full transition-all duration-300 ${
                i < currentQuestionIndex
                  ? "bg-primary cursor-pointer hover:bg-primary-solid"
                  : i === currentQuestionIndex
                    ? "bg-primary/60"
                    : "bg-line cursor-default"
              }`}
            />
          ))}
        </div>
      </div>

      {/* تنبيه أسئلة الترجيح التكيفية */}
      {currentQuestionIndex >= ALL_QUIZ_QUESTIONS.length && tieBreakInfo && (
        <Alert tone="primary">
          <strong>
            نتيجتك متقاربة جداً بين &quot;{tieBreakInfo.a}&quot; و&quot;{tieBreakInfo.b}&quot;
          </strong>{" "}
          — بضعة أسئلة إضافية لحسم الدقة بينهما بدل ترك الفارق لمعامل السوق وحده.
        </Alert>
      )}

      {/* بطاقة السؤال */}
      <Card
        variant="surface"
        radius="rounded-3xl"
        padding="p-8 md:p-12"
        className="a-fade flex min-h-[350px] flex-col justify-center space-y-12 text-center"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-ink leading-relaxed">{question.text}</h1>
        <div className="flex flex-col gap-4 mt-auto">
          <button
            onClick={() => handleAnswer(1)}
            className="bg-primary-solid text-white p-4 rounded-xl font-bold text-lg hover:bg-primary-solid-hover transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {question.answerLabels?.yes ?? "نعم، بالتأكيد"}
          </button>
          <button
            onClick={() => handleAnswer(0)}
            className="bg-primary-50 text-primary-text border border-primary-200 p-4 rounded-xl font-bold text-lg hover:bg-primary-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {question.answerLabels?.maybe ?? "ربما / أحياناً"}
          </button>
          <button
            onClick={() => handleAnswer(-1)}
            className="bg-surface-muted text-ink-soft border border-line p-4 rounded-xl font-bold text-lg hover:border-line-strong transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {question.answerLabels?.no ?? "لا، إطلاقاً"}
          </button>
        </div>
      </Card>

      {/* زر الرجوع */}
      {currentQuestionIndex > 0 && (
        <button
          onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
          className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors mx-auto"
        >
          <ChevronRight className="w-4 h-4" />
          السؤال السابق
        </button>
      )}
    </div>
  );
}
