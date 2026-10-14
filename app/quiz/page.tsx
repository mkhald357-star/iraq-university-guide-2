"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useId } from "react";
import { applyGradeInput, gradeRangeMessage } from "../../lib/gradeInput";
import Link from "next/link";
import { ArrowLeft, ChevronRight, AlertTriangle, AlertCircle, CheckCircle, Edit3, ClipboardList } from "lucide-react";
import questionsData from "../../data/questions.json";
import validityQuestionsData from "../../data/validity_questions.json";
import contradictionPairsData from "../../data/contradiction_pairs.json";
import tiebreakerQuestionsData from "../../data/tiebreaker_questions.json";
import reserveQuestionsData from "../../data/reserve_questions.json";
import majorsData from "../../data/majors.json";
import provincesData from "../../data/provinces.json";
import riasecProfilesData from "../../data/major_riasec_profiles.json";
import { CUTOFFS_YEAR, UNCOVERED_PROVINCES, UNCOVERED_PROVINCES_REASON } from "../../lib/admissionDisclosure";
import {
  computeCombinedRankingScore,
  applyAdmissionWeight,
  RIASEC_LABELS,
  type RiasecDimension,
  type RiasecVector,
} from "../../lib/riasec";
import { type ValidityCheckResult } from "../../lib/validity";
import { type SubjectGrades } from "../../lib/subjectAffinity";
import subjectAffinityWeightsData from "../../data/subject_affinity_weights.json";
import majorContextIndexData from "../../data/major_context_index.json";
import { type ContextVector } from "../../lib/contextAxisMap";
import { IconBadge, Badge, Card, SelectField, InputField, Alert } from "../components/ui";
import {
  PRODUCT_FIT_STRATEGY,
  PRODUCT_MIN_LOADING_SHARE,
  type RankMajorsData,
  type RankedMajor,
} from "../../lib/recommendationEngine";
import { evaluateQuizStep, type QuizEngineData, type RoundMode } from "../../lib/quizEngine";
import { DEFAULT_RESERVE_ROUND_CONFIG, type ReserveTrigger } from "../../lib/adaptiveRound";
import { groupScreens, pickAnswers, type ItemFormat, type QuizScreen } from "../../lib/itemFormats";
import { ArrowScale } from "../components/quiz/ArrowScale";
import { GridScreen } from "../components/quiz/GridScreen";
import { PickScreen } from "../components/quiz/PickScreen";
import { QuizProgress } from "../components/quiz/QuizProgress";
import { PilotPanel } from "../components/quiz/PilotPanel";
import { PilotIntake, type PilotIntakeResult } from "../components/quiz/PilotIntake";
import { bankFingerprint } from "../../lib/pilotCode";
import { getAnswerLabels, labelFor, type ScaleValue } from "../components/quiz/answerLabels";
import { MAJOR_FAMILIES } from "../../lib/majorFamilies";
import { selectFamilyRecommendations } from "../../lib/familyRecommendation";
import { ADMISSION_INDEX, computeFeasibilityPercent, feasibilityNote } from "../../lib/admissionFeasibility";

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
  // getAnswerLabels (app/components/quiz/answerLabels.ts) بدل إعادة كتابة البنك.
  answerLabels?: { yes: string; maybe: string; no: string; stronglyYes?: string; stronglyNo?: string };
  // شكل الشاشة (lib/itemFormats.ts): صفّ موقف grid أو خيار أقرب/أبعد pick.
  format?: ItemFormat;
  screenId?: string;
  lead?: string;
}
type Screen = QuizScreen<QuizItem>;

// قائمة المحافظات مولَّدة من بيانات الجامعات الفعلية عبر خط أنابيب
// الاستخراج (data/provinces.json، ملف صغير مشتق حتى لا نستورد كل بيانات
// الجامعات الضخمة هنا فقط لعرض قائمة منسدلة) — تبقى متزامنة تلقائياً مع
// أي توسعة مستقبلية للبيانات، بدل قائمة ثابتة قديمة.
const AVAILABLE_PROVINCES = provincesData as string[];

// أسئلة تحقق/جدّية (VRS) لا تُحسب ضمن أبعاد RIASEC — dimensions فارغة عمداً،
// ما يجعل computeUserRiasecVector يتجاهلها تلقائياً دون أي تعديل إضافي فيه.
// نُدرجها بمواضع ثابتة داخل تسلسل الشاشات: سؤال الانتباه الموجَّه في المنتصف
// تقريباً، وتوأم "مساعدة الآخرين" المعكوس + مقياس الصدق قرب النهاية (كما
// أوصى تقرير كشف التحيز — كي لا يُلاحظ الطالب نمطها بسهولة).
// البنك عبارات مسطّحة تُجمَع في 22 شاشة محتوى (مقارنة طرفية / موقف / أقرب-أبعد).
const SCORED_QUESTIONS = questionsData as QuizItem[];
const VALIDITY_QUESTIONS = validityQuestionsData as QuizItem[];
const [ATTENTION_CHECK, HELP_OTHERS_REVERSE, LIE_SCALE] = VALIDITY_QUESTIONS;
const ATTENTION_CHECK_SCREEN = 11;
const singleScreen = (q: QuizItem): Screen => ({ id: q.id, format: "single", items: [q] });
const CORE_SCREENS = groupScreens(SCORED_QUESTIONS);
const ALL_QUIZ_SCREENS: Screen[] = [
  ...CORE_SCREENS.slice(0, ATTENTION_CHECK_SCREEN),
  singleScreen(ATTENTION_CHECK),
  ...CORE_SCREENS.slice(ATTENTION_CHECK_SCREEN),
  singleScreen(HELP_OTHERS_REVERSE),
  singleScreen(LIE_SCALE),
];
type PickState = Record<string, { most: string | null; least: string | null }>;
const VALIDITY_QUESTION_IDS = new Set(VALIDITY_QUESTIONS.map((q) => q.id));

// بيانات محرك الترتيب (lib/recommendationEngine.ts) -- تُحسَب مرة واحدة هنا
// بدل إعادة بنائها في كل استدعاء لـrunRecommendationEngine.
const ENGINE_DATA: RankMajorsData = {
  fitStrategy: PRODUCT_FIT_STRATEGY,
  minLoadingShare: PRODUCT_MIN_LOADING_SHARE,
  majors: majorsData,
  riasecProfiles: riasecProfilesData.profiles as RankMajorsData["riasecProfiles"],
  subjectWeights: subjectAffinityWeightsData.weights as RankMajorsData["subjectWeights"],
};

// بصمة السياق (المرحلة 3، lib/contextAxisMap.ts) -- تُستخدم حصراً داخل
// applyContextTieBreak لترجيح أزواج التوأمين ضمن نطاق الغموض، لا لتعديل
// الترتيب الأساسي (rankMajors) إطلاقاً.
const CONTEXT_INDEX = majorContextIndexData.contexts as Record<string, ContextVector>;

// وضع الجولات الإضافية: "reserve" = جولة فكّ حيرة واحدة (3-5 عبارات حسب الحاجة) عند تقارب
// أفضل التخصصات أو ضعف قياس بُعد (lib/adaptiveRound.ts) -- حلّت محلّ جولات
// الترجيح الثلاث القديمة التي كانت تستسلم صامتة في ~75% من الجلسات حين ينفد
// بنك البُعدين (انظر QA-REPORT-ALGORITHM.md).
const QUIZ_ROUND_MODE: RoundMode = "reserve";

// مصدر وحيد لمنطق التقييم: نفس الدالة التي تقيسها أداة المحاكاة (lib/eval).
const QUIZ_ENGINE_DATA: QuizEngineData = {
  ...ENGINE_DATA,
  coreQuestions: SCORED_QUESTIONS,
  tiebreakerPool: tiebreakerQuestionsData as QuizItem[],
  // بنك الاحتياط المُراجَع (data/reserve_questions.json) -- لا بنك /decider
  // القديم الذي حكمت المراجعة النفسية بحذف 9 من بنوده الـ18 أو إعادة صياغتها.
  reservePool: reserveQuestionsData as QuizItem[],
  reserveConfig: DEFAULT_RESERVE_ROUND_CONFIG,
  roundMode: QUIZ_ROUND_MODE,
  contextTieBreak: false,
  validityIds: VALIDITY_QUESTION_IDS,
  contextIndex: CONTEXT_INDEX,
  contradictionPairs: contradictionPairsData,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// مكوّن شاشة المراجعة قبل الإرسال
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ReviewScreen({
  screens,
  answers,
  picks,
  onEdit,
  onSubmit,
  onBack,
}: {
  screens: Screen[];
  answers: AnswerState;
  picks: PickState;
  onEdit: (index: number) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const answerLabelFor = (q: QuizItem, val: number): string => labelFor(getAnswerLabels(q), val as ScaleValue);
  const colorMap: Record<number, string> = {
    1: "text-primary-text font-bold",
    0.5: "text-primary-text font-bold opacity-85",
    0: "text-primary-text font-bold opacity-70",
    [-0.5]: "text-ink-muted font-bold opacity-85",
    [-1]: "text-ink-muted font-bold",
  };
  const isComplete = (s: Screen) =>
    s.format === "pick"
      ? Boolean(picks[s.id]?.most && picks[s.id]?.least)
      : s.items.every((q) => answers[q.id] !== undefined);
  const unanswered = screens.filter((s) => !isComplete(s));

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
          لم تُكمل <strong>{unanswered.length} شاشة</strong>. يُفضَّل الإجابة على جميع الأسئلة للحصول على توصية دقيقة.
        </Alert>
      )}

      {/* قائمة الإجابات */}
      <Card variant="surface" radius="rounded-3xl" className="max-h-[420px] space-y-3 overflow-y-auto">
        {screens.map((s, i) => {
          const answered = isComplete(s);
          const pick = picks[s.id];
          const rows: { key: string; text: string; value: string; tone: string }[] =
            s.format === "pick"
              ? [
                  {
                    key: "most",
                    text: "الأقرب لي",
                    value: s.items.find((q) => q.id === pick?.most)?.text ?? "لم يتم الاختيار",
                    tone: pick?.most ? "text-primary-text font-bold" : "text-band-close font-bold",
                  },
                  {
                    key: "least",
                    text: "الأبعد عني",
                    value: s.items.find((q) => q.id === pick?.least)?.text ?? "لم يتم الاختيار",
                    tone: pick?.least ? "text-ink-muted font-bold" : "text-band-close font-bold",
                  },
                ]
              : s.items.map((q) => ({
                  key: q.id,
                  text: q.text,
                  value: answers[q.id] !== undefined ? answerLabelFor(q, answers[q.id]) : "لم يتم الإجابة",
                  tone:
                    answers[q.id] !== undefined ? (colorMap[answers[q.id]] ?? "text-ink") : "text-band-close font-bold",
                }));
          return (
            <div
              key={s.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                answered ? "bg-surface border-line" : "bg-band-close-bg border-band-close/30"
              }`}
            >
              {/* رقم */}
              <span className="shrink-0 w-7 h-7 rounded-full bg-surface-muted flex items-center justify-center text-xs font-bold text-ink-muted">
                {i + 1}
              </span>

              {/* النص والإجابة */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {s.lead && <p className="text-xs font-bold text-ink-soft truncate">{s.lead}</p>}
                {rows.map((r) => (
                  <div key={r.key}>
                    <p className="text-xs text-ink-muted truncate">{r.text}</p>
                    <p className={`text-sm mt-0.5 ${r.tone}`}>{r.value}</p>
                  </div>
                ))}
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
  // نص محلي: «7.» و«78.5» تُكتب مرحلياً، والقيمة الرقمية تُرفع للأب. لا <input type="number">
  // (يتغيّر بعجلة التمرير) -- lib/gradeInput.ts.
  const id = useId(); // يربط التسمية بالحقل (كان بلا id فلا يقرأ قارئ الشاشة اسم الحقل)
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    // تصفير خارجي (تغيير الفرع) يُزامَن، دون الكتابة فوق ما يُكتب الآن
    setText((t) => (value === undefined ? (t === "" || t === "." ? t : "") : Number(t) === value ? t : String(value)));
  }, [value]);
  return (
    <InputField
      compact
      id={id}
      label={label}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const clean = applyGradeInput(e.currentTarget, 100);
        setText(clean);
        onChange(clean === "" || clean === "." || gradeRangeMessage(clean, 100) ? undefined : Number(clean));
      }}
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
  // موضع الطالب بالشاشات (لا بالعبارات) -- شاشة الموقف أو الأقرب/الأبعد تضم عدة عبارات.
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [picks, setPicks] = useState<PickState>({});
  const answersRef = useRef<AnswerState>(answers);
  answersRef.current = answers;
  const [isFinished, setIsFinished] = useState(false);
  const [showReview, setShowReview] = useState(false);
  // كل التخصصات الصالحة لفرع الطالب (لا أفضل 3 فقط) بنسبة توافقها الخام --
  // تُخزَّن كاملة عند إنهاء الاختبار لتُتيح إعادة الترتيب فوراً وتفاعلياً عند
  // تحريك منزلق "أهمية السوق" بلا حاجة لإعادة حساب الاختبار من الصفر
  // (انظر §3.2 من تحليل الثغرات: السوق مفصول عن الترتيب افتراضياً، بيد الطالب فقط).
  const [allValidMajors, setAllValidMajors] = useState<RankedMajor[]>([]);
  const [marketWeight, setMarketWeight] = useState(0);
  // منزلق واقعية القبول (الإصدار 2، C-D) -- مطفأ افتراضياً بقرار المالك.
  const [admissionWeight, setAdmissionWeight] = useState(0);
  // رابط التجربة الميدانية (/quiz?pilot=1) -- لوحة الرمز لا تظهر لغيره.
  // يُقرأ من العنوان بعد التحميل لا عبر useSearchParams: التصدير الثابت يتطلّب
  // معه حدّ Suspense يؤخّر عرض الصفحة كلها.
  const [isPilot, setIsPilot] = useState(false);
  useEffect(() => {
    setIsPilot(new URLSearchParams(window.location.search).get("pilot") === "1");
  }, []);
  const [pilotIntake, setPilotIntake] = useState<PilotIntakeResult | null>(null);
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
  // سبب جولة الاحتياط (تقارب أفضل التخصصات / ضعف قياس بُعد / الاثنان) -- يحدّد رسالة الطالب
  const [tieBreakTrigger, setTieBreakTrigger] = useState<ReserveTrigger | null>(null);
  const [weakDimensions, setWeakDimensions] = useState<RiasecDimension[]>([]);
  // أول تخصصين لا يزالان متقاربين عند الإنهاء -- نقول ذلك للطالب بصدق بدل تفضيل وهمي
  const [closeCall, setCloseCall] = useState(false);
  // تحت نقطة واحدة: دقة المركز الأول نحو 32-45% فقط (المدقّق C1) -- نقول "متعادلان" لا "متقاربان"
  const [tiedCall, setTiedCall] = useState(false);

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
  // القائمة المرتّبة كاملةً (لا أفضل ثلاثة): اختيار العائلات يحتاجها كلها كي
  // يجد بقية أفراد كل عائلة.
  const sortedMajors = useMemo(() => {
    return [...allValidMajors]
      .map((m) => ({
        ...m,
        // tieBreakAdjustment = أثر ترجيح السياق -- كان يسقط هنا صامتاً فتختلف
        // النتيجة المعروضة عمّا حُفظ لصفحة /report.
        // المنزلقان يعيدان التقييم للعرض فقط؛ بوزنين صفريين الترتيب هو ترتيب
        // المحرك حرفياً (applyAdmissionWeight يُرجع المدخل نفسه عند الصفر).
        combinedScore: applyAdmissionWeight(
          computeCombinedRankingScore(m.fitPercent, m.marketMultiplier, marketWeight) + (m.tieBreakAdjustment ?? 0),
          filterSettings ? computeFeasibilityPercent(filterSettings.grade, ADMISSION_INDEX[m.id]) : null,
          admissionWeight
        ),
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore);
  }, [allValidMajors, marketWeight, admissionWeight, filterSettings]);

  // ثلاث عائلات مختلفة، كل واحدة بأقرب أفرادها ومعها بقيتهم
  // (lib/familyRecommendation.ts -- السبب والقياس موثّقان هناك).
  const familySelection = useMemo(() => selectFamilyRecommendations(sortedMajors, MAJOR_FAMILIES), [sortedMajors]);
  const rankedMajors = useMemo(() => familySelection.recommendations.map((r) => r.lead), [familySelection]);

  // ما يُحفظ للتقرير = ما على الشاشة الآن، لا ترتيب المحرك الأصلي: بلا هذا،
  // يحرّك الطالب منزلقاً فتتغيّر توصياته أمامه، ثم يفتح التقرير فيجد القديمة.
  useEffect(() => {
    if (!isFinished || familySelection.recommendations.length === 0) return;
    try {
      localStorage.setItem("quizResults", JSON.stringify(familySelection.recommendations.map((r) => r.lead)));
      localStorage.setItem(
        "quizResultsV2",
        JSON.stringify({
          version: 2,
          families: familySelection.recommendations.map((r) => ({
            familyId: r.familyId,
            familyName: r.familyName,
            lead: r.lead,
            siblings: r.siblings,
          })),
          insufficientFamilies: familySelection.insufficientFamilies,
          weights: { market: marketWeight, admission: admissionWeight },
        })
      );
    } catch {
      // التخزين قد يكون معطّلاً -- النتيجة معروضة من الذاكرة بغضّ النظر.
    }
  }, [isFinished, familySelection, marketWeight, admissionWeight]);

  // Clear session on mount
  useEffect(() => {
    // في التصفح الخاص القديم أو عند تعطيل التخزين المحلي من إعدادات
    // الخصوصية، قد يرمي الوصول إلى localStorage نفسه SecurityError — بلا
    // try/catch هنا تنهار صفحة الاختبار بأكملها فوراً قبل ظهور أي سؤال.
    try {
      localStorage.removeItem("quizResults");
      localStorage.removeItem("userAnswers");
      localStorage.removeItem("filterSettings");
      localStorage.removeItem("subjectGrades");
      localStorage.removeItem("quizResultsV2");
    } catch {
      // تجاهل — الاختبار يعمل بلا حفظ محلي، أفضل من انهيار كامل.
    }
  }, []);

  // إعادة ضبط "توقيت بداية السؤال" عند كل انتقال — يغذّي مكوّن الزمن في VRS
  useEffect(() => {
    setQuestionShownAt(Date.now());
  }, [currentScreenIndex]);

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
            <SelectField
              label="المحافظة"
              id="province"
              name="province"
              hint={`ملاحظة: ${UNCOVERED_PROVINCES_REASON}`}
              required
            >
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
            <InputField
              label="المعدل (٪)"
              id="grade"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              name="grade"
              pattern="\d{1,3}(\.\d{1,2})?"
              title="رقم بين 0 و100، مثل 78 أو 78.5"
              onInput={(e) => applyGradeInput(e.currentTarget, 100)}
              placeholder="مثال: 78"
              required
            />
            {formBranch && (
              <div className="border-t border-line pt-5 space-y-3">
                <div>
                  <h3 className="font-bold text-ink">درجات موادك (اختياري)</h3>
                  <p className="text-xs text-ink-muted mt-1">
                    يرفع دقة التوصية عبر ربطها بنقاط قوّتك الدراسية الفعلية (لا رأيك الشخصي فقط) — تخصصان متقاربان
                    شخصياً قد يفرّقهما تفوّقك النسبي في مادة عن أخرى. اترك أي حقل فارغاً إن لم ترغب.
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
  const displayedScreens: Screen[] = [...ALL_QUIZ_SCREENS, ...tieBreakQuestions.map(singleScreen)];

  // ---- محرك التوصية القائم على RIASEC + نظام كشف الجدّية (VRS) ----
  // roundNumber = عدد جولات الترجيح المُنجَزة فعلياً حتى الآن (0 = الجولة
  // الأولى بعد الأسئلة الأربعين مباشرة) -- يُحدّ بـMAX_TIEBREAK_ROUNDS لمنع
  // إرهاق الطالب بأسئلة ترجيح لا نهائية إن ظلّ التعادل قائماً.
  const runRecommendationEngine = (finalAnswers: AnswerState, opts?: { roundNumber?: number }) => {
    // كل منطق التقييم (فصل التحقق، التناقضات، الترتيب، ترجيح السياق، قرار
    // جولة الاحتياط، VRS) في lib/quizEngine.ts -- نفس الدالة التي تقيسها أداة
    // المحاكاة، فلا يمكن أن يرى الطالب محركاً غير الذي قِيست دقّته وعدالته.
    const step = evaluateQuizStep(
      {
        answers: finalAnswers,
        extraQuestionsAsked: tieBreakQuestions,
        round: opts?.roundNumber ?? 0,
        branch: filterSettings.branch,
        grade: filterSettings.grade,
        subjectGrades,
        timingsMs: timings,
      },
      QUIZ_ENGINE_DATA
    );

    if (step.kind === "askMore") {
      const startIndex = ALL_QUIZ_SCREENS.length + tieBreakQuestions.length;
      setTieBreakQuestions((prev) => [...prev, ...(step.questions as QuizItem[])]);
      setTieBreakInfo(step.tieBreakInfo);
      setTieBreakTrigger(step.trigger === "legacy_tiebreak" ? "ambiguity" : step.trigger);
      setWeakDimensions(step.weakDimensions);
      setTieBreakPending(true);
      setTieBreakRound(step.nextRound);
      setCurrentScreenIndex(startIndex);
      setShowReview(false);
      return; // لا نُنهي الاختبار بعد -- ننتظر إجابات هذه الجولة
    }

    setTieBreakPending(false);
    setWarnings(step.warnings);
    setAllValidMajors(step.ranked);
    setTopUserDimensions(step.topUserDimensions);
    setVrsResult(step.vrs);
    setCloseCall(step.closeCall);
    setTiedCall(step.finalGap < 1);
    setIsFinished(true);
    try {
      // المفتاح القديم يبقى بشكله (RankedMajor[3]) كي يفتح تقرير محفوظ من
      // الإصدار السابق بلا كسر، لكن محتواه صار **قادة العائلات** لا أفضل
      // ثلاثة تخصصات، فيطابق ما رآه الطالب على الشاشة.
      const savedSelection = selectFamilyRecommendations(step.ranked, MAJOR_FAMILIES);
      localStorage.setItem("quizResults", JSON.stringify(savedSelection.recommendations.map((r) => r.lead)));
      localStorage.setItem(
        "quizResultsV2",
        JSON.stringify({
          version: 2,
          families: savedSelection.recommendations.map((r) => ({
            familyId: r.familyId,
            familyName: r.familyName,
            lead: r.lead,
            siblings: r.siblings,
          })),
          insufficientFamilies: savedSelection.insufficientFamilies,
        })
      );
      localStorage.setItem("userAnswers", JSON.stringify(step.scoredAnswers));
      // درجات المواد الاختيارية تدخل التوافق بوزن 30% -- بدونها يحسب /report
      // توافقاً مختلفاً عن الاختبار لنفس التخصص (الإصدار 2، المسار C-C).
      localStorage.setItem("subjectGrades", JSON.stringify(subjectGrades));
      localStorage.setItem("needsReview", JSON.stringify(step.vrs.band !== "low"));
    } catch {
      // تجاهل — النتيجة تُعرض من الحالة في الذاكرة بغضّ النظر؛ فقط لن
      // تُستعاد لاحقاً في صفحة /report إذا أُعيد فتحها في تبويب جديد.
    }
  };

  // ---- معالجة الإجابة ----
  // الزمن يُسجَّل **لكل قرار** لا لكل عبارة: شاشة الموقف قراراتها بعدد صفوفها
  // فيُقسَّم زمنها عليها، أما شاشة «الأقرب/الأبعد» فقرار واحد عن الشاشة كلها،
  // فتُسجَّل بمفتاح الشاشة بزمنها كاملاً -- قسمتها على خياراتها الأربعة كانت
  // تُظهر اختياراً في 6 ثوانٍ كأنه 1.5 ثانية، فيُنذر مؤشر التسرّع في VRS
  // بالخطأ (تشخيص المدقّق C4).
  const finishScreen = (screenIndex: number) => {
    const screen = displayedScreens[screenIndex];
    const elapsed = Date.now() - questionShownAt;
    const entries: [string, number][] =
      screen.format === "pick"
        ? [[screen.id, elapsed]]
        : screen.items.map((q) => [q.id, Math.round(elapsed / screen.items.length)]);
    setTimings((prev) => ({ ...prev, ...Object.fromEntries(entries) }));

    // آخر شاشة → انتقل لشاشة المراجعة، أو أنهِ مباشرة إن كانت هذه آخر عبارة
    // ترجيح إضافية (لا داعي لمراجعة ثانية على 4 أسئلة فقط أُضيفت لتوّها).
    if (screenIndex >= displayedScreens.length - 1) {
      const finalAnswers = { ...answersRef.current };
      if (tieBreakPending) {
        setTimeout(() => runRecommendationEngine(finalAnswers, { roundNumber: tieBreakRound }), 150);
      } else {
        setTimeout(() => setShowReview(true), 150);
      }
    } else {
      setCurrentScreenIndex(screenIndex + 1);
    }
  };

  const answerItem = (id: string, value: number) => {
    const next = { ...answersRef.current, [id]: value };
    answersRef.current = next;
    setAnswers(next);
  };

  // الأقرب +1 والأبعد −1 والباقيان 0 (lib/itemFormats.ts) -- اختيار ناقص لا يُسجَّل.
  const answerPick = (screen: Screen, most: string | null, least: string | null) => {
    setPicks((prev) => ({ ...prev, [screen.id]: { most, least } }));
    const next = { ...answersRef.current };
    const ids = screen.items.map((q) => q.id);
    if (most && least) Object.assign(next, pickAnswers(ids, most, least));
    else ids.forEach((id) => delete next[id]);
    answersRef.current = next;
    setAnswers(next);
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
          {vrsResult && (
            <p className="text-sm text-ink-muted">
              ثقة النتيجة:{" "}
              {vrsResult.band === "high" ? (
                <Badge tone="reach">منخفضة — راجع إجاباتك</Badge>
              ) : vrsResult.band === "medium" || closeCall ? (
                <Badge tone="close">متوسطة — أول خيارين متقاربان أو بعض الإجابات غير حاسمة</Badge>
              ) : (
                <Badge tone="safe">عالية</Badge>
              )}
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
          <div className="flex items-center justify-between border-t border-line pt-3">
            <label htmlFor="admissionWeight" className="font-bold text-ink text-sm">
              كم يهمّك أن يكون التخصص في متناول معدلك؟
            </label>
            <span className="text-sm font-bold text-primary-text">
              {admissionWeight === 0 ? "تجاهله كلياً" : `${Math.round(admissionWeight * 100)}٪`}
            </span>
          </div>
          <input
            id="admissionWeight"
            type="range"
            min={0}
            max={100}
            step={10}
            value={admissionWeight * 100}
            onChange={(e) => setAdmissionWeight(Number(e.target.value) / 100)}
            className="w-full accent-primary"
          />
          <p className="text-xs text-ink-muted">
            يقارن معدلك بأدنى حدّ قبول حكومي منشور لكل تخصص (نتائج القبول المركزي {CUTOFFS_YEAR}، القناة العامة — ليست
            ضماناً لهذا العام). التخصصات بلا حدّ منشور، ومنها الجامعات الأهلية، لا تتحرّك لأننا لا نعرف حدّها.
          </p>
        </Card>
        {/* المنزلق مطفأ افتراضياً (قرار المالك)، فالطالب الذي لا يحرّكه قد تتصدّر
            توصيته تخصصات كلها فوق معدله. شرط المدقّق لبقاء الافتراضي صفراً: قل له
            ذلك صراحةً بدل أن يكتشفه في التقرير. */}
        {admissionWeight === 0 &&
          filterSettings &&
          familySelection.recommendations[0] &&
          [familySelection.recommendations[0].lead, ...familySelection.recommendations[0].siblings].every(
            (m) => feasibilityNote(filterSettings.grade, ADMISSION_INDEX[m.id]).tone === "below"
          ) && (
            <Alert tone="primary" title="التوصية الأولى فوق معدلك في كل تخصصاتها">
              <p className="mt-1">
                كل تخصصات مجال «{familySelection.recommendations[0].familyName}» حدّها الحكومي المنشور أعلى من معدلك (
                {filterSettings.grade}٪). هي الأقرب لميولك، لكن إن أردت أن ترى ما يبلغه معدلك فحرّك منزلق «في متناول
                معدلك» أعلاه، أو راجع الدوام المسائي والجامعات الأهلية في التقرير.
              </p>
            </Alert>
          )}
        {/* الفارق الذي قاسه المحرك هو بين **أول تخصصين** في القائمة المسطّحة،
            لا بين قائدَي مجالين -- تسمية القادة هنا كانت تعرض رقماً لم يُقَس
            (رصده المدقّق عند C-B). عتبة «متقاربان» (4 نقاط) مضبوطة لفوارق
            التخصصات، ولا إفصاح على مستوى المجال قبل معايرة خاصة به. */}
        {closeCall && sortedMajors.length >= 2 && (
          <Alert
            tone="primary"
            title={tiedCall ? "أول خيارين متعادلان في توافقهما معك" : "أول خيارين متقاربان في توافقهما معك"}
          >
            <p className="mt-1">
              {tiedCall
                ? `«${sortedMajors[0].name}» و«${sortedMajors[1].name}» متعادلان عملياً — ترتيبهما لا يعني أن أحدهما يناسبك أكثر من الآخر.`
                : `«${sortedMajors[0].name}» يتقدّم على «${sortedMajors[1].name}» بفارق صغير فقط — كلاهما يناسب ميولك بدرجة متقاربة.`}{" "}
              قارن بينهما في طبيعة الدراسة وفرص العمل قبل أن تقرّر.
            </p>
          </Alert>
        )}
        {/* ثلاثة **مجالات** مختلفة بدل ثلاثة تخصصات متشابهة: أداة القياس تفصل
            بين المجالات بثقة (عائلة التوصية الأولى صحيحة 70.7%) ولا تفصل داخل
            المجال الواحد، فترتيب المتشابهات ادّعاء دقة غير موجودة.

            **المجال هو التوصية، لا العضو**: قياس المدقّق عند C-B يُظهر أن
            اختيار "أقرب عضو" يسوء كلما تماسك المجال (الحوسبة 61% فقط مقابل
            علوم الحياة 97%) -- لأن أعضاء المجال المتماسك متقاربون في الميول
            أصلاً. لذلك يُعرض العضو بوصفه "الأقرب حسب إجاباتك" بلا تراتب بصري
            قوي، وكل الأعضاء بنفس وزن العرض. */}
        <div className="grid gap-6 mt-8">
          {familySelection.recommendations.map((rec, index) => {
            const demand = getDemandLevel(rec.lead.marketMultiplier);
            return (
              <Card
                key={rec.familyId}
                variant="surface"
                radius="rounded-2xl"
                className="space-y-3 border-r-4 border-r-primary"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink-muted">المجال {index + 1} من 3</p>
                    <h2 className="mt-0.5 text-2xl font-bold text-ink break-words">{rec.familyName}</h2>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-3xl font-black text-primary-text">{Math.round(rec.lead.fitPercent)}%</div>
                    <div className="text-sm text-ink-muted">توافق أعلى أعضائه</div>
                  </div>
                </div>
                <div className="border-t border-line pt-3">
                  <p className="text-xs font-bold text-ink-soft">
                    {rec.siblings.length > 0
                      ? "تخصصات هذا المجال، الأقرب إلى إجاباتك أولاً — الفروق بينها في طبيعة الدراسة أكثر منها في ميولك:"
                      : "التخصص المتاح لك في هذا المجال:"}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {[rec.lead, ...rec.siblings].map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2"
                      >
                        <span className="min-w-0 text-ink">
                          {m.name} <span className="text-xs text-ink-muted">{m.category}</span>
                          {filterSettings && (
                            <span className="block text-xs text-ink-muted">
                              {feasibilityNote(filterSettings.grade, ADMISSION_INDEX[m.id]).text}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-primary-text">
                          {Math.round(m.fitPercent)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  {/* المدقّق (C7): نصف من تتصدّرهم تخصصات فوق معدلهم لهم عضو آخر في
                      المجال نفسه في المتناول -- يُسمّى صراحةً بدل أن يُترك للقراءة. */}
                  {filterSettings &&
                    (() => {
                      const members = [rec.lead, ...rec.siblings];
                      if (feasibilityNote(filterSettings.grade, ADMISSION_INDEX[rec.lead.id]).tone !== "below")
                        return null;
                      const within = members.find((m) =>
                        ["above", "near"].includes(feasibilityNote(filterSettings.grade, ADMISSION_INDEX[m.id]).tone)
                      );
                      return within ? (
                        <p className="mt-2 text-sm font-bold text-ink">في متناول معدلك ضمن هذا المجال: {within.name}</p>
                      ) : null;
                    })()}
                  <p className="mt-2 text-xs text-ink-muted">
                    طلب السوق لأقربها إليك ({rec.lead.name}): {demand.text}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
        {familySelection.insufficientFamilies && (
          <p className="mt-3 text-sm text-ink-muted">
            فرعك الدراسي يفتح {familySelection.familiesAvailable} مجالات فقط في بياناتنا، فعرضنا ما هو متاح كاملاً بلا
            حشو.
          </p>
        )}
        {isPilot && filterSettings && pilotIntake?.participating && (
          <PilotPanel
            branch={filterSettings.branch}
            grade={filterSettings.grade}
            subjectGrades={subjectGrades as Record<string, number | undefined>}
            answers={answers}
            shownLeads={rankedMajors.map((m) => m.id)}
            intake={pilotIntake}
            bank={bankFingerprint(SCORED_QUESTIONS.map((q) => q.id))}
            vrsBand={vrsResult?.band ?? null}
          />
        )}
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
        screens={displayedScreens}
        answers={answers}
        picks={picks}
        onEdit={(index) => {
          setShowReview(false);
          setCurrentScreenIndex(index);
        }}
        onSubmit={() => runRecommendationEngine({ ...answers })}
        onBack={() => {
          setShowReview(false);
          setCurrentScreenIndex(displayedScreens.length - 1);
        }}
      />
    );
  }

  // ---- بوابة التجربة الميدانية: النيّة تُسأل قبل أول سؤال (المدقّق، المسار هـ) ----
  if (isPilot && !pilotIntake) {
    return (
      <div className="py-12">
        <PilotIntake onDone={setPilotIntake} />
      </div>
    );
  }

  // ---- شاشة الأسئلة ----
  const screen = displayedScreens[currentScreenIndex];
  const screenIndex = currentScreenIndex;

  return (
    <div className="max-w-2xl mx-auto py-12 pb-28 space-y-8 md:pb-12">
      <QuizProgress current={currentScreenIndex} total={displayedScreens.length} />

      {/* تنبيه أسئلة الترجيح التكيفية */}
      {currentScreenIndex >= ALL_QUIZ_SCREENS.length && tieBreakPending && (
        <Alert tone="primary">
          {tieBreakTrigger !== "weak_dimension" && tieBreakInfo ? (
            <strong>
              نتيجتك متقاربة بين &quot;{tieBreakInfo.a}&quot; و&quot;{tieBreakInfo.b}&quot;
            </strong>
          ) : (
            <strong>
              إجاباتك عن جانب {weakDimensions.map((d) => RIASEC_LABELS[d]).join(" و")} كانت محايدة أو متباينة
            </strong>
          )}{" "}
          — {tieBreakQuestions.length} أسئلة قصيرة إضافية فقط (جولة واحدة) لتكون النتيجة أدق.
        </Alert>
      )}

      {/* بطاقة الشاشة -- المفتاح يعيد حركة الدخول عند كل انتقال */}
      <Card key={screen.id} variant="surface" radius="rounded-3xl" padding="p-5 md:p-10" className="a-fade">
        {screen.format === "grid" ? (
          <GridScreen
            scenario={screen.lead ?? ""}
            rows={screen.items}
            answers={answers as Record<string, ScaleValue | undefined>}
            onAnswer={answerItem}
            onNext={() => finishScreen(screenIndex)}
          />
        ) : screen.format === "pick" ? (
          <PickScreen
            prompt={screen.lead ?? ""}
            options={screen.items}
            most={picks[screen.id]?.most ?? null}
            least={picks[screen.id]?.least ?? null}
            onChange={(most, least) => answerPick(screen, most, least)}
            onNext={() => finishScreen(screenIndex)}
          />
        ) : (
          <div className="flex min-h-[300px] flex-col justify-center space-y-10 text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-ink leading-relaxed">{screen.items[0].text}</h1>
            {/* مقياس خمس نقاط بسهم تفاعلي: سحب أو نقر أو أسهم لوحة المفاتيح.
                لا انتقال تلقائي: يبقى السؤال حتى يضغط الطالب «التالي» (أو Enter)،
                فيراجع إجابته ويغيّرها قبل أن يمضي. */}
            <ArrowScale
              value={(answers[screen.items[0].id] as ScaleValue | undefined) ?? null}
              onChange={(v) => answerItem(screen.items[0].id, v)}
              onConfirm={() => finishScreen(screenIndex)}
              labels={getAnswerLabels(screen.items[0])}
              ariaLabel={screen.items[0].text}
            />
            {answers[screen.items[0].id] !== undefined && (
              <button
                type="button"
                onClick={() => finishScreen(screenIndex)}
                className="mx-auto rounded-xl bg-primary-solid px-8 py-3 font-bold text-white transition-all hover:bg-primary-solid-hover active:scale-[0.98]"
              >
                التالي
              </button>
            )}
          </div>
        )}
      </Card>

      {/* زر الرجوع */}
      {currentScreenIndex > 0 && (
        <button
          onClick={() => setCurrentScreenIndex((prev) => prev - 1)}
          className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors mx-auto"
        >
          <ChevronRight className="w-4 h-4" />
          السؤال السابق
        </button>
      )}
    </div>
  );
}
