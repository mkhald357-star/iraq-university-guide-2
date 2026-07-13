"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, AlertTriangle, CheckCircle, Edit3 } from "lucide-react";
import questionsData from "../../data/questions.json";
import majorsData from "../../data/majors.json";

type AnswerState = Record<string, number>;

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
  questions: typeof questionsData;
  answers: AnswerState;
  onEdit: (index: number) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const labelMap: Record<number, string> = { 1: "نعم، بالتأكيد", 0.5: "ربما / أحياناً", [-1]: "لا، إطلاقاً" };
  const colorMap: Record<number, string> = {
    1: "text-primary font-bold",
    0.5: "text-blue-500 font-bold",
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
        <h2 className="text-3xl font-black text-slate-800">مراجعة إجاباتك</h2>
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
                <p className="text-xs text-slate-400 truncate">{q.text}</p>
                <p className={`text-sm mt-0.5 ${answered ? colorMap[val] ?? "text-slate-700" : "text-amber-600 font-bold"}`}>
                  {answered ? labelMap[val] ?? String(val) : "لم يتم الإجابة"}
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
          className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors mx-auto text-sm"
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

  const [filterSettings, setFilterSettings] = useState<null | {
    province: string;
    branch: string;
    gradeType: "expected" | "actual";
    grade: number;
  }>(null);

  // Clear session on mount
  useEffect(() => {
    localStorage.removeItem("quizResults");
    localStorage.removeItem("userAnswers");
    localStorage.removeItem("filterSettings");
  }, []);

  // Persist filterSettings
  useEffect(() => {
    if (filterSettings) {
      localStorage.setItem("filterSettings", JSON.stringify(filterSettings));
    }
  }, [filterSettings]);

  // ---- Pre-filter UI ----
  if (!filterSettings) {
    return (
      <div className="max-w-xl mx-auto py-12 space-y-8">
        <h2 className="text-3xl font-bold text-center text-primary">ابدأ الاختبار</h2>
        <form
          className="glass p-8 rounded-3xl space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const province = (form.elements.namedItem("province") as HTMLSelectElement).value;
            const branch = (form.elements.namedItem("branch") as HTMLSelectElement).value;
            const gradeType = (form.elements.namedItem("gradeType") as HTMLSelectElement).value as "expected" | "actual";
            const grade = Number((form.elements.namedItem("grade") as HTMLInputElement).value);
            setFilterSettings({ province, branch, gradeType, grade });
          }}
        >
          <div>
            <label className="block font-bold mb-2" htmlFor="province">المحافظة</label>
            <select name="province" className="w-full p-2 border rounded" required>
              <option value="">اختر المحافظة</option>
              <option value="بغداد">بغداد</option>
              <option value="البصرة">البصرة</option>
              <option value="نينوى">نينوى</option>
              <option value="أربيل">أربيل</option>
            </select>
          </div>
          <div>
            <label className="block font-bold mb-2" htmlFor="branch">الفرع الدراسي</label>
            <select name="branch" className="w-full p-2 border rounded" required>
              <option value="">اختر الفرع</option>
              <option value="علمي">علمي (إحيائي / تطبيقي)</option>
              <option value="أدبي">أدبي</option>
              <option value="فنون">فنون / إبداع</option>
              <option value="إدارة">إدارة و تسويق</option>
            </select>
          </div>
          <div>
            <label className="block font-bold mb-2" htmlFor="gradeType">نوع المعدل</label>
            <select name="gradeType" className="w-full p-2 border rounded" required>
              <option value="expected">معدل متوقع</option>
              <option value="actual">معدل حصل (حقيقي)</option>
            </select>
          </div>
          <div>
            <label className="block font-bold mb-2" htmlFor="grade">المعدل (٪)</label>
            <input
              type="number"
              name="grade"
              min="0"
              max="100"
              className="w-full p-2 border rounded"
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

  // ---- حساب الأسئلة المتاحة ----
  const branchMap: Record<string, string[]> = {
    "علمي": ["تكنولوجيا", "هندسة", "طبي"],
    "أدبي": ["إنسانيات", "لغات", "تربية"],
    "فنون": ["فنون وتصميم"],
    "إدارة": ["إدارة وتسويق"],
  };

  const allowedCategories = branchMap[filterSettings.branch] || [];
  const gradeIsHigh = filterSettings.grade >= 85;

  const allowedMajors = majorsData.filter((major) => {
    if (!allowedCategories.includes(major.category)) return false;
    if (!gradeIsHigh && major.category === "طبي") return false;
    return true;
  });

  const displayedQuestions = questionsData.filter((q) => {
    if (["q_science_branch", "q_high_grades"].includes(q.id)) return false;
    return Object.keys(q.weights).some((majorId) =>
      allowedMajors.some((m) => m.id === majorId)
    );
  });

  // ---- محرك الحساب ----
  const execute18StepEngine = (finalAnswers: AnswerState) => {
    let finalWarnings: string[] = [];

    if (filterSettings) {
      finalAnswers["q_science_branch"] = filterSettings.branch === "علمي" ? 1 : -1;
      finalAnswers["q_high_grades"] = Number(filterSettings.grade) >= 85 ? 1 : -1;
    }

    const comfortScore = finalAnswers["q_comfort_vs_salary"] ?? 0;
    const riskScore = finalAnswers["q_risk_reward"] ?? 0;
    if (comfortScore > 0 && riskScore > 0) {
      finalWarnings.push("لاحظنا تضارباً في إجاباتك: ترغب براتب عالي جداً ولكن تبحث عن الراحة القصوى. تم موازنة النتيجة بناءً على الواقع.");
      finalAnswers["q_risk_reward"] = 0;
    }

    const scores: Record<string, number> = {};
    questionsData.forEach((q) => {
      const userAns = finalAnswers[q.id] ?? 0;
      if (q.category === "hard_constraint") return;
      Object.entries(q.weights).forEach(([majorId, weight]) => {
        if (!scores[majorId]) scores[majorId] = 0;
        scores[majorId] += (weight as number) * userAns;
      });
    });

    const allowedCats = branchMap[filterSettings.branch] || [];
    const processedMajors = majorsData
      .map((major) => {
        let rawScore = scores[major.id] || 0;
        let valid = true;
        if (!allowedCats.includes(major.category)) valid = false;
        if (!gradeIsHigh && major.category === "طبي") valid = false;
        if (!valid) rawScore = -999;
        const baseScore = Math.max(0, rawScore + 20);
        const finalScore = baseScore * major.marketMultiplier;
        return { ...major, rawScore, finalScore, valid };
      })
      .filter((m) => m.valid);

    processedMajors.sort((a, b) => b.finalScore - a.finalScore);
    const top3 = processedMajors.slice(0, 3);

    setWarnings(finalWarnings);
    setTopMajors(top3);
    setIsFinished(true);
    localStorage.setItem("quizResults", JSON.stringify(top3));
    localStorage.setItem("userAnswers", JSON.stringify(finalAnswers));
  };

  // ---- معالجة الإجابة ----
  const handleAnswer = (answerWeight: number) => {
    const question = displayedQuestions[currentQuestionIndex];
    const newAnswers = { ...answers, [question.id]: answerWeight };
    setAnswers(newAnswers);

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
          <h2 className="text-4xl font-black text-primary">نتيجتك جاهزة!</h2>
          <p className="text-lg text-slate-600">
            بناءً على خوارزمية المطابقة المتقدمة وتحليل 18 خطوة، هذه هي أفضل التخصصات لك:
          </p>
        </div>
        {warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h4 className="font-bold">ملاحظة الخوارزمية:</h4>
              <p className="text-sm mt-1">{warnings[0]}</p>
            </div>
          </div>
        )}
        <div className="grid gap-6 mt-8">
          {topMajors.map((major, index) => (
            <div
              key={major.id}
              className="glass p-6 rounded-2xl flex items-center justify-between border-l-4 border-l-primary"
            >
              <div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {index + 1}. {major.name}
                </h3>
                <p className="text-slate-500">{major.category}</p>
                <p className="text-sm text-slate-400 mt-1">معامل السوق: {major.marketMultiplier}</p>
                <p className="text-sm text-slate-400 mt-1">النقاط الأولية: {major.rawScore}</p>
              </div>
              <div className="text-left">
                <div className="text-3xl font-black text-primary">
                  {Math.min(99, Math.round((major.finalScore / 50) * 100))}%
                </div>
                <div className="text-sm text-slate-400">نسبة التوافق</div>
              </div>
            </div>
          ))}
        </div>
        <div className="glass p-8 rounded-2xl bg-primary/5 border-primary/20 text-center space-y-4 mt-8">
          <h3 className="text-xl font-bold text-slate-800">احصل على تحليل الفجوة والجامعات الحكومية</h3>
          <p className="text-slate-600">
            يحتوي التقرير على الكليات والأقسام الدقيقة في الجامعات الحكومية والأهلية، مع تحليل لأسباب اختيار هذا التخصص لك.
          </p>
          <Link
            href={`/report?major=${topMajors[0]?.id}`}
            className="inline-flex items-center gap-2 bg-secondary text-white px-8 py-4 rounded-full font-bold shadow-lg hover:bg-purple-700 transition-all hover:-translate-y-1"
          >
            <span>فتح التقرير الشامل والمفصل</span>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
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
        onSubmit={() => execute18StepEngine({ ...answers })}
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
        <div className="flex justify-between text-sm font-bold text-slate-400">
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
        <div className="flex gap-1 mt-1">
          {displayedQuestions.map((_, i) => (
            <button
              key={i}
              onClick={() => i < currentQuestionIndex && setCurrentQuestionIndex(i)}
              disabled={i >= currentQuestionIndex}
              aria-label={`الانتقال لسؤال ${i + 1}`}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
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
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-relaxed">
          {question.text}
        </h2>
        <div className="flex flex-col gap-4 mt-auto">
          <button
            onClick={() => handleAnswer(1)}
            className="bg-primary text-white p-4 rounded-xl font-bold text-lg hover:bg-blue-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            نعم، بالتأكيد
          </button>
          <button
            onClick={() => handleAnswer(0.5)}
            className="bg-blue-50 text-primary border border-blue-200 p-4 rounded-xl font-bold text-lg hover:bg-blue-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            ربما / أحياناً
          </button>
          <button
            onClick={() => handleAnswer(-1)}
            className="bg-slate-100 text-slate-600 border border-slate-200 p-4 rounded-xl font-bold text-lg hover:bg-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            لا، إطلاقاً
          </button>
        </div>
      </div>

      {/* زر الرجوع */}
      {currentQuestionIndex > 0 && (
        <button
          onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors mx-auto"
        >
          <ChevronRight className="w-4 h-4" />
          السؤال السابق
        </button>
      )}
    </div>
  );
}
