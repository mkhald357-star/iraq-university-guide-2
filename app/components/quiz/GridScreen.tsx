"use client";

import { ArrowScale } from "./ArrowScale";
import { GENERIC_ANSWER_LABELS, type ScaleValue } from "./answerLabels";

export interface GridRow {
  id: string;
  text: string;
}

/**
 * شاشة «موقف بعدة عبارات» (F2): موقف واحد، وتحته عبارتان أو ثلاث يقيّم
 * الطالب كلاً منها -- شاشة واحدة تقيس أكثر من بُعد. زر «التالي» يُفعَّل
 * فقط بعد الإجابة عن كل العبارات.
 */
export function GridScreen({
  scenario,
  rows,
  answers,
  onAnswer,
  onNext,
}: {
  scenario: string;
  rows: GridRow[];
  answers: Record<string, ScaleValue | undefined>;
  onAnswer: (rowId: string, value: ScaleValue) => void;
  onNext: () => void;
}) {
  const answered = rows.filter((r) => answers[r.id] !== undefined).length;
  const complete = answered === rows.length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-primary-50 border border-primary-200 p-5 text-right">
        <p className="text-xs font-bold text-primary-text mb-1">تخيّل هذا الموقف</p>
        <p className="text-lg md:text-xl font-bold text-ink leading-relaxed">{scenario}</p>
      </div>

      <ul className="space-y-5">
        {rows.map((row, i) => (
          <li
            key={row.id}
            className={`quiz-row rounded-2xl border p-4 transition-colors ${
              answers[row.id] !== undefined ? "border-primary-200 bg-surface" : "border-line bg-surface"
            }`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <p className="mb-2 text-right font-bold text-ink leading-relaxed">{row.text}</p>
            <ArrowScale
              compact
              value={answers[row.id] ?? null}
              onChange={(v) => onAnswer(row.id, v)}
              labels={GENERIC_ANSWER_LABELS}
              ariaLabel={row.text}
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onNext}
        disabled={!complete}
        className="w-full rounded-xl bg-primary-solid p-3.5 font-bold text-white transition-all enabled:hover:bg-primary-solid-hover enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {complete ? "التالي" : `أجب عن كل العبارات (${answered}/${rows.length})`}
      </button>
    </div>
  );
}
