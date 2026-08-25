"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Scale, ArrowLeft, RotateCcw } from "lucide-react";
import majorsData from "../../data/majors.json";
import riasecProfilesData from "../../data/major_riasec_profiles.json";
import tiebreakerQuestionsData from "../../data/tiebreaker_questions.json";
import { MajorPicker } from "../components/MajorPicker";
import {
  computeUserRiasecVector,
  findDivergentDimensions,
  selectQuestionsForDimensions,
  RIASEC_LABELS,
  type RiasecQuestion,
  type RiasecVector,
} from "../../lib/riasec";
import { computeDimensionLeans, computeDeciderVerdict } from "../../lib/decider";

const defaultLabelMap: Record<number, string> = { 1: "نعم، بالتأكيد", 0: "ربما / أحياناً", [-1]: "لا، إطلاقاً" };
function answerLabel(q: RiasecQuestion, val: number): string {
  const labels = (q as unknown as { answerLabels?: { yes: string; maybe: string; no: string } }).answerLabels;
  if (labels) {
    if (val === 1) return labels.yes;
    if (val === 0) return labels.maybe;
    if (val === -1) return labels.no;
  }
  return defaultLabelMap[val] ?? String(val);
}

export default function DeciderPage() {
  const [majorAId, setMajorAId] = useState("");
  const [majorBId, setMajorBId] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const majorA = majorsData.find((m) => m.id === majorAId);
  const majorB = majorsData.find((m) => m.id === majorBId);
  const ready = !!majorAId && !!majorBId && majorAId !== majorBId;

  // useMemo مباشرة على majorAId/majorBId -- كائن {} احتياطي جديد في كل تصيير
  // كان يكسر ثبات المرجع فيُبطل تذكّر useMemo التالية عبثاً (تحذير eslint حقيقي).
  const profileA = useMemo(
    () => (riasecProfilesData.profiles as Record<string, RiasecVector>)[majorAId] ?? {},
    [majorAId]
  );
  const profileB = useMemo(
    () => (riasecProfilesData.profiles as Record<string, RiasecVector>)[majorBId] ?? {},
    [majorBId]
  );

  const targetDims = useMemo(() => (ready ? findDivergentDimensions(profileA, profileB, 2) : []), [ready, profileA, profileB]);

  const questions = useMemo(
    () => (ready ? selectQuestionsForDimensions(tiebreakerQuestionsData as RiasecQuestion[], targetDims) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, targetDims.join("|")]
  );

  const finished = ready && questions.length > 0 && currentIndex >= questions.length;

  function reset() {
    setMajorAId("");
    setMajorBId("");
    setAnswers({});
    setCurrentIndex(0);
  }

  function handleAnswer(value: number) {
    const q = questions[currentIndex];
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
    setCurrentIndex((i) => i + 1);
  }

  const verdict = useMemo(() => {
    if (!finished) return null;
    const userVector = computeUserRiasecVector(answers, questions);
    const leans = computeDimensionLeans(userVector, profileA, profileB, targetDims);
    return computeDeciderVerdict(leans);
  }, [finished, answers, questions, profileA, profileB, targetDims]);

  return (
    <div dir="rtl" className="mx-auto max-w-2xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">حسم الحيرة</h1>
        <p className="mt-1 text-ink-soft">محتار بين تخصصات متقاربة؟ أسئلة ترجيح قصيرة تفصل بينها.</p>
      </div>

      {!ready && (
        <div className="bg-surface border border-line shadow-sm rounded-3xl p-6 space-y-3">
          <MajorPicker index={0} value={majorAId} excludeIds={majorBId ? [majorBId] : []} onChange={setMajorAId} />
          <MajorPicker index={1} value={majorBId} excludeIds={majorAId ? [majorAId] : []} onChange={setMajorBId} />
          {majorAId && majorAId === majorBId && (
            <p className="text-sm text-band-reach">اختر تخصصين مختلفين للمقارنة.</p>
          )}
        </div>
      )}

      {ready && !finished && questions.length > 0 && (
        <>
          <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-800">
            <strong>
              {majorA?.name} مقابل {majorB?.name}
            </strong>{" "}
            — {questions.length} أسئلة قصيرة تفصل بينهما على المحاور الأكثر اختلافاً بينهما.
          </div>

          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-valuenow={currentIndex}
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-label={`سؤال ${currentIndex + 1} من ${questions.length}`}
          >
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < currentIndex ? "bg-primary" : i === currentIndex ? "bg-primary/60" : "bg-line"
                }`}
              />
            ))}
          </div>

          <div className="bg-surface border border-line shadow-sm p-8 md:p-12 rounded-3xl text-center space-y-10 min-h-[300px] flex flex-col justify-center">
            <h2 className="text-xl md:text-2xl font-bold text-ink leading-relaxed">{questions[currentIndex].text}</h2>
            <div className="flex flex-col gap-4 mt-auto">
              {[1, 0, -1].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleAnswer(val)}
                  className={
                    val === 1
                      ? "bg-primary-solid text-white p-4 rounded-xl font-bold text-lg hover:bg-primary-solid-hover transition-all hover:scale-[1.02] active:scale-[0.98]"
                      : val === 0
                        ? "bg-primary-50 text-primary-text border border-primary-200 p-4 rounded-xl font-bold text-lg hover:bg-primary-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        : "bg-surface-muted text-ink-soft border border-line p-4 rounded-xl font-bold text-lg hover:border-line-strong transition-all hover:scale-[1.02] active:scale-[0.98]"
                  }
                >
                  {answerLabel(questions[currentIndex], val)}
                </button>
              ))}
            </div>
          </div>

          {currentIndex > 0 && (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => i - 1)}
              className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors mx-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              السؤال السابق
            </button>
          )}
        </>
      )}

      {finished && verdict && (
        <div className="space-y-5">
          <div className="glass rounded-3xl p-8 text-center space-y-4">
            <span className="inline-flex rounded-full bg-primary-100 p-3 text-primary-700">
              <Scale className="h-6 w-6" />
            </span>

            {verdict.leaningTowardA === null && (
              <>
                <h2 className="text-xl font-extrabold text-ink">النتيجة متعادلة</h2>
                <p className="text-sm leading-relaxed text-ink-soft">
                  هذا العدد القليل من الأسئلة لا يكفي لترجيح أي تخصص بينهما. جرّب مقارنة كاملة، أو أعد المحاولة بإجابات
                  أكثر حسماً.
                </p>
              </>
            )}

            {verdict.leaningTowardA !== null && (
              <>
                <h2 className="text-xl font-extrabold text-ink">
                  {verdict.strength === "moderate" ? "أجوبتك تميل بشكل ملحوظ نحو" : "أجوبتك تميل قليلاً نحو"}{" "}
                  {verdict.leaningTowardA ? majorA?.name : majorB?.name}
                </h2>
                <p className="text-sm leading-relaxed text-ink-soft">
                  الفارق ظهر أساساً في: {targetDims.map((d) => RIASEC_LABELS[d]).join(" و")}.
                </p>
              </>
            )}

            <p className="rounded-lg border-s-4 border-primary-600 bg-surface-subtle p-3 text-xs leading-relaxed text-ink-muted">
              هذا ترجيح مبني على {questions.length} أسئلة تفضيل قصيرة فقط، لا اختبار الميول الكامل (40 سؤالاً في «بوصلة
              التخصص») — اعتبره مؤشراً إضافياً لا حكماً نهائياً.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={`/compare?a=${majorAId}&b=${majorBId}`}
              className="rounded-md border border-line bg-surface p-4 text-center text-sm font-bold text-ink transition-colors hover:bg-surface-muted"
            >
              موازنة كاملة بين التخصصين
            </Link>
            <Link
              href="/quiz"
              className="rounded-md border border-line bg-surface p-4 text-center text-sm font-bold text-ink transition-colors hover:bg-surface-muted"
            >
              اختبار الميول الكامل
            </Link>
          </div>

          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors mx-auto text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            جرّب تخصصين آخرين
          </button>
        </div>
      )}
    </div>
  );
}
