"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";

export interface PickOption {
  id: string;
  text: string;
}

/**
 * شاشة «الأقرب لي / الأبعد عني» (F3): 4 أنشطة من أبعاد مختلفة. النقرة
 * الأولى تختار الأقرب، والثانية على بطاقة أخرى تختار الأبعد، والنقر على
 * بطاقة مختارة يلغي اختيارها. تقيس الأولوية النسبية بين الأبعاد، ولا يتأثر
 * بها نمط «الموافقة على كل شيء».
 */
export function PickScreen({
  prompt,
  options,
  most,
  least,
  onChange,
  onNext,
}: {
  prompt: string;
  options: PickOption[];
  most: string | null;
  least: string | null;
  onChange: (most: string | null, least: string | null) => void;
  onNext: () => void;
}) {
  const choose = (id: string) => {
    if (id === most) return onChange(null, least);
    if (id === least) return onChange(most, null);
    if (most === null) return onChange(id, least);
    return onChange(most, id);
  };

  const step =
    most === null ? "اختر النشاط الأقرب إليك" : least === null ? "والآن اختر الأبعد عنك" : "ممتاز — اضغط التالي";
  const complete = most !== null && least !== null;

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <p className="text-lg md:text-xl font-bold text-ink">{prompt}</p>
        <p className="text-sm font-bold text-primary-text quiz-hint" aria-live="polite">
          {step}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3" role="group" aria-label={prompt}>
        {options.map((o, i) => {
          const state = o.id === most ? "most" : o.id === least ? "least" : null;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              aria-pressed={state !== null}
              aria-label={`${o.text}${state === "most" ? " — الأقرب لي" : state === "least" ? " — الأبعد عني" : ""}`}
              className={`quiz-card relative flex min-h-[112px] items-center justify-center rounded-2xl border-2 p-3 text-center font-bold leading-relaxed transition-all duration-300 ${
                state === "most"
                  ? "quiz-card-up border-primary-solid bg-primary-50 text-ink shadow-lg"
                  : state === "least"
                    ? "quiz-card-down border-line-strong bg-surface-muted text-ink-muted"
                    : "border-line bg-surface text-ink hover:border-primary-200 hover:-translate-y-0.5"
              }`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {state && (
                <span
                  className={`quiz-pop absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${
                    state === "most" ? "bg-primary-solid text-white" : "bg-ink-muted text-white"
                  }`}
                >
                  {state === "most" ? <ThumbsUp className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                  {state === "most" ? "الأقرب لي" : "الأبعد عني"}
                </span>
              )}
              {o.text}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!complete}
        className="w-full rounded-xl bg-primary-solid p-3.5 font-bold text-white transition-all enabled:hover:bg-primary-solid-hover enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        التالي
      </button>
    </div>
  );
}
