"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, AlertTriangle, CheckCircle, Edit3 } from "lucide-react";
import questionsData from "../../data/questions.json";
import validityQuestionsData from "../../data/validity_questions.json";
import contradictionPairsData from "../../data/contradiction_pairs.json";
import majorsData from "../../data/majors.json";
import provincesData from "../../data/provinces.json";
import riasecProfilesData from "../../data/major_riasec_profiles.json";
import {
  computeUserRiasecVector,
  computeMajorFit,
  computeCombinedRankingScore,
  topDimensions,
  RIASEC_LABELS,
  type RiasecDimension,
  type RiasecVector,
} from "../../lib/riasec";
import { computeValidityRiskScore, type ValidityCheckResult } from "../../lib/validity";

type AnswerState = Record<string, number>;
interface QuizItem {
  id: string;
  text: string;
  dimensions: RiasecVector;
  // لأسئلة المقارنة الصريحة ("تفضّل A على B؟") فقط -- تستبدل نصوص الأزرار
  // العامة بنص يوضّح صراحة أي طرف من المقارنة يختاره كل زر، فيزول غموض "لا،
  // إطلاقاً" (هل يعني رفض A لصالح B، أم رفض الاثنين معاً؟) دون أي تغيير على
  // dimensions أو آلية التسجيل نفسها. الأسئلة الأخرى بلا هذا الحقل تستخدم
  // الأزرار العامة كما هي (fallback).
  answerLabels?: { yes: string; maybe: string; no: string };
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
    1: "text-primary font-bold",
    0: "text-blue-500 font-bold",
    [-1]: "text-slate-400 font-bold",
  };

  const unanswered = questions.filter((q) => answers[q.id] === undefined);

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-6 animate-in fade-in duration-300">
      {/* العنوان */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mx-auto">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-black text-slate-800">مراجعة إجاباتك</h1>
        <p className="text-slate-500">راجع إجاباتك قبل إرسال الاختبار — يمكنك تعديل أي إجابة</p>
      </div>

      {/* تحذير إجابات فائتة */}
      {unanswered.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            لم تُجب على <strong>{unanswered.length} سؤال</strong>. يُفضَّل الإجابة على جميع الأسئلة للحصول على توصية دقيقة.
          </p>
        </div>
      )}

      {/* قائمة الإجابات */}
      <div className="glass rounded-3xl p-6 space-y-3 max-h-[420px] overflow-y-auto">
        {questions.map((q, i) => {
          const val = answers[q.id];
          const answered = val !== undefined;
          return (
            <div
              key={q.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                answered ? "bg-white border-slate-100" : "bg-amber-50 border-amber-200"
              }`}
            >
              {/* رقم */}
              <span className="shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                {i + 1}
              </span>

              {/* النص والإجابة */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 truncate">{q.text}</p>
                <p className={`text-sm mt-0.5 ${answered ? colorMap[val] ?? "text-slate-700" : "text-amber-600 font-bold"}`}>
                  {answered ? answerLabelFor(q, val) : "لم يتم الإجابة"}
                </p>
              </div>

              {/* زر التعديل */}
              <button
                onClick={() => onEdit(i)}
                className="shrink-0 flex items-center gap-1 text-xs text-primary hover:text-blue-800 font-bold transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                تعديل
              </button>
            </div>
          );
        })}
      </div>

      {/* أزرار الإجراء */}
      <div className="space-y-3">
        <button
          onClick={onSubmit}
          className="w-full bg-primary text-white py-4 rounded-2xl font-black text-lg hover:bg-blue-800 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-primary/20"
        >
          إرسال الاختبار وعرض التوصية ✨
        </button>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors mx-auto text-sm"
        >
          <ChevronRight className="w-4 h-4" />
          الرجوع للسؤال الأخير
        </button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// المكوّن الرئيسي
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function Quiz() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [isFinished, setIsFinished] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [topMajors, setTopMajors] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [topUserDimensions, setTopUserDimensions] = useState<{ dimension: RiasecDimension; score: number }[]>([]);
  const [vrsResult, setVrsResult] = useState<ValidityCheckResult | null>(null);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [questionShownAt, setQuestionShownAt] = useState<number>(() => Date.now());

  const [filterSettings, setFilterSettings] = useState<null | {
    province: string;
    branch: string;
    gradeType: "expected" | "actual";
    grade: number;
  }>(null);

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
      <div className="max-w-xl mx-auto py-12 space-y-8">
        <h1 className="text-3xl font-bold text-center text-primary">ابدأ الاختبار</h1>
        <form
          className="glass p-8 rounded-3xl space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const province = (form.elements.namedItem("province") as HTMLSelectElement).value;
            const branch = (form.elements.namedItem("branch") as HTMLSelectElement).value;
            const gradeType = (form.elements.namedItem("gradeType") as HTMLSelectElement).value as "expected" | "actual";
            const grade = Number((form.elements.namedItem("grade") as HTMLInputElement).value);
            // بلا هذا، يبقى توقيت "بداية السؤال" عند وقت تحميل الصفحة (قبل
            // ملء نموذج الفلترة أصلاً)، فيُحتسب زمن ملء النموذج بأكمله
            // خطأً كجزء من "زمن الإجابة على السؤال الأول" في مؤشر الجدّية.
            setQuestionShownAt(Date.now());
            setFilterSettings({ province, branch, gradeType, grade });
          }}
        >
          <div>
            <label className="block font-bold mb-2" htmlFor="province">المحافظة</label>
            <select id="province" name="province" className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40" required>
              <option value="">اختر المحافظة</option>
              {AVAILABLE_PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              ملاحظة: محافظات إقليم كردستان (أربيل، دهوك، السليمانية) غير مغطاة بعد — نظام قبول منفصل عن القبول المركزي.
            </p>
          </div>
          <div>
            <label className="block font-bold mb-2" htmlFor="branch">الفرع الدراسي</label>
            <select id="branch" name="branch" className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40" required>
              <option value="">اختر الفرع</option>
              <option value="علمي">علمي (إحيائي / تطبيقي)</option>
              <option value="أدبي">أدبي</option>
              <option value="فنون">فنون / إبداع</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              الفروع الرسمية الثلاثة فقط في نظام القبول المركزي. تخصصات الإدارة والتسويق والمحاسبة مقبولة من فرعي العلمي والأدبي، وستظهر تلقائياً ضمن توصياتك أياً كان فرعك.
            </p>
          </div>
          <div>
            <label className="block font-bold mb-2" htmlFor="gradeType">نوع المعدل</label>
            <select id="gradeType" name="gradeType" className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40" required>
              <option value="expected">معدل متوقع</option>
              <option value="actual">معدل حصل (حقيقي)</option>
            </select>
          </div>
          <div>
            <label className="block font-bold mb-2" htmlFor="grade">المعدل (٪)</label>
            <input
              id="grade"
              type="number"
              name="grade"
              min="0"
              max="100"
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="مثال: 78"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-blue-800 transition-colors"
          >
            بدء الاختبار
          </button>
        </form>
      </div>
    );
  }

  // ---- الفروع الرسمية الثلاثة فقط في نظام القبول المركزي العراقي (علمي/
  // أدبي/فنون) — "إدارة" ليست فرعاً رسمياً مستقلاً (انظر data/admission_rules.md
  // §8)، فتخصصات الإدارة والتسويق والمحاسبة مُدرَجة ضمن كلا الفرعين العلمي
  // والأدبي، تماماً كما تقبلها الجامعات فعلياً من خريجي الفرعين معاً ----
  const branchMap: Record<string, string[]> = {
    "علمي": ["تكنولوجيا", "هندسة", "طبي", "تقنيات طبية مساندة", "علوم", "زراعة", "إدارة وتسويق"],
    "أدبي": ["إنسانيات", "لغات", "تربية", "إدارة وتسويق"],
    "فنون": ["فنون وتصميم"],
  };

  const gradeIsHigh = filterSettings.grade >= 85;
  // فئة "تقنيات طبية مساندة" (أشعة، تخدير، علاج وظيفي...) تخصصات تقنية لا
  // طب كامل — حدودها الدنيا الحقيقية منخفضة نسبياً (60-80%)، خلافاً لبوابة
  // معدل ٨٥٪ أدناه المخصَّصة حصراً لفئة "طبي" (طب/أسنان/صيدلة). تُستثنى
  // عمداً من هذه البوابة، ولا تحتاج أي شرط هنا لأن الفحص التالي يخص فئة
  // "طبي" حرفياً فقط.

  // كل الأسئلة (المُسجَّلة على أبعاد RIASEC + أسئلة التحقق الثلاثة) تُعرض
  // للجميع بصرف النظر عن الفرع، لأنها تقيس سمات شخصية عامة لا تفضيلاً
  // مباشراً لتخصص بعينه.
  const displayedQuestions = ALL_QUIZ_QUESTIONS;

  // ---- محرك التوصية القائم على RIASEC + نظام كشف الجدّية (VRS) ----
  const runRecommendationEngine = (finalAnswers: AnswerState) => {
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

    const userVector = computeUserRiasecVector(scoredAnswers, questionsData);
    const allowedCats = branchMap[filterSettings.branch] || [];

    const processedMajors = majorsData
      .map((major) => {
        const profile = (riasecProfilesData.profiles as Record<string, any>)[major.id] ?? {};
        const fitPercent = computeMajorFit(userVector, profile);
        let valid = allowedCats.includes(major.category);
        if (!gradeIsHigh && major.category === "طبي") valid = false;
        const combinedScore = computeCombinedRankingScore(fitPercent, major.marketMultiplier);
        return { ...major, fitPercent, combinedScore, valid };
      })
      .filter((m) => m.valid);

    processedMajors.sort((a, b) => b.combinedScore - a.combinedScore);
    const top3 = processedMajors.slice(0, 3);
    const userTopDimensions = topDimensions(userVector, 2);

    const vrs = computeValidityRiskScore(scoredAnswers, validityAnswers, timings, contradictionPairsData, questionsData);

    setWarnings(finalWarnings);
    setTopMajors(top3);
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

    // آخر سؤال → انتقل لشاشة المراجعة
    if (currentQuestionIndex >= displayedQuestions.length - 1) {
      setTimeout(() => setShowReview(true), 150);
    } else {
      setTimeout(() => setCurrentQuestionIndex((prev) => prev + 1), 150);
    }
  };

  // ---- شاشة النتيجة ----
  if (isFinished) {
    return (
      <div className="py-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black text-primary">نتيجتك جاهزة!</h1>
          <p className="text-lg text-slate-600">
            بناءً على تحليل شخصيتك المهنية عبر أسئلة الاختبار ونموذج RIASEC العالمي، هذه هي أفضل التخصصات لك:
          </p>
          {topUserDimensions.length > 0 && (
            <p className="text-sm text-slate-500">
              أبرز سماتك:{" "}
              <span className="font-bold text-primary">
                {topUserDimensions.map((d) => RIASEC_LABELS[d.dimension]).join(" و")}
              </span>
            </p>
          )}
        </div>
        {warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h4 className="font-bold">ملاحظة الخوارزمية:</h4>
              <ul className="text-sm mt-1 space-y-1 list-disc list-inside">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {vrsResult && vrsResult.band !== "low" && (
          <div
            className={`p-4 rounded-2xl flex items-start gap-3 border ${
              vrsResult.band === "high"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h4 className="font-bold">
                {vrsResult.band === "high" ? "ننصح بمراجعة إجاباتك" : "قد تحتاج نتيجتك مراجعة إضافية"}
              </h4>
              <p className="text-sm mt-1">
                لاحظ نظام التحقق نمطاً في إجاباتك قد يقلل من دقة التوصية (مثل إجابات متسرعة جداً أو متناقضة أو
                غير متمايزة). النتيجة أدناه لا تزال معروضة، لكن ننصحك بإعادة الاختبار بتركيز أكبر إن لم تكن
                التوصية منطقية بالنسبة لك.
              </p>
            </div>
          </div>
        )}
        <div className="grid gap-6 mt-8">
          {topMajors.map((major, index) => (
            <div
              key={major.id}
              className="glass p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4 border-r-4 border-r-primary"
            >
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-slate-800 break-words">
                  {index + 1}. {major.name}
                </h2>
                <p className="text-slate-500">{major.category}</p>
                <p className="text-sm text-slate-500 mt-1">معامل الطلب في السوق: {major.marketMultiplier}</p>
              </div>
              <div className="text-left shrink-0">
                <div className="text-3xl font-black text-primary">
                  {Math.round(major.fitPercent)}%
                </div>
                <div className="text-sm text-slate-500">نسبة التوافق الشخصي</div>
              </div>
            </div>
          ))}
        </div>
        {topMajors.length > 0 ? (
          <div className="glass p-8 rounded-2xl bg-primary/5 border-primary/20 text-center space-y-4 mt-8">
            <h2 className="text-xl font-bold text-slate-800">احصل على تحليل الفجوة والجامعات الحكومية</h2>
            <p className="text-slate-600">
              يحتوي التقرير على الكليات والأقسام الدقيقة في الجامعات الحكومية والأهلية، مع تحليل لأسباب اختيار هذا التخصص لك.
            </p>
            <Link
              href={`/report?major=${topMajors[0].id}`}
              className="inline-flex items-center gap-2 bg-secondary text-white px-8 py-4 rounded-full font-bold shadow-lg hover:bg-purple-700 transition-all hover:-translate-y-1"
            >
              <span>فتح التقرير الشامل والمفصل</span>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
        ) : (
          <div className="glass p-8 rounded-2xl text-center space-y-2 mt-8">
            <p className="text-slate-600 font-bold">لم نجد تخصصات مطابقة لفرعك الدراسي ضمن بيانات المنصة الحالية.</p>
            <p className="text-slate-500 text-sm">جرّب إعادة الاختبار، أو تواصل معنا إن استمرت المشكلة.</p>
          </div>
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
        <div className="flex justify-between text-sm font-bold text-slate-600">
          <span>السؤال {currentQuestionIndex + 1} من {displayedQuestions.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
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
                  ? "bg-primary cursor-pointer hover:bg-blue-700"
                  : i === currentQuestionIndex
                  ? "bg-primary/60"
                  : "bg-slate-200 cursor-default"
              }`}
            />
          ))}
        </div>
      </div>

      {/* بطاقة السؤال */}
      <div className="glass p-8 md:p-12 rounded-3xl text-center space-y-12 animate-in fade-in zoom-in-95 duration-300 min-h-[350px] flex flex-col justify-center">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 leading-relaxed">
          {question.text}
        </h1>
        <div className="flex flex-col gap-4 mt-auto">
          <button
            onClick={() => handleAnswer(1)}
            className="bg-primary text-white p-4 rounded-xl font-bold text-lg hover:bg-blue-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {question.answerLabels?.yes ?? "نعم، بالتأكيد"}
          </button>
          <button
            onClick={() => handleAnswer(0)}
            className="bg-blue-50 text-primary border border-blue-200 p-4 rounded-xl font-bold text-lg hover:bg-blue-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {question.answerLabels?.maybe ?? "ربما / أحياناً"}
          </button>
          <button
            onClick={() => handleAnswer(-1)}
            className="bg-slate-100 text-slate-600 border border-slate-200 p-4 rounded-xl font-bold text-lg hover:bg-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {question.answerLabels?.no ?? "لا، إطلاقاً"}
          </button>
        </div>
      </div>

      {/* زر الرجوع */}
      {currentQuestionIndex > 0 && (
        <button
          onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors mx-auto"
        >
          <ChevronRight className="w-4 h-4" />
          السؤال السابق
        </button>
      )}
    </div>
  );
}
