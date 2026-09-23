"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SCALE_STOPS, labelFor, type FiveLevelLabels, type ScaleValue } from "./answerLabels";

// وجه تعبيري لكل درجة -- زخرفي فقط (aria-hidden)، المعنى في النص.
const FACES = ["🤩", "🙂", "😐", "🙁", "🙅"] as const;

/**
 * مقياس إجابة تفاعلي من 5 درجات: سهم يُسحب على المسار ويستقر في أقرب درجة
 * بحركة ارتداد، أو نقرة مباشرة على الدرجة، أو لوحة المفاتيح (أسهم / Home /
 * End / Enter). **بلا موضع افتراضي** -- السهم لا يظهر حتى يختار الطالب،
 * لأن موضعاً افتراضياً في المنتصف يضخّم الإجابة المحايدة.
 * الحركة بـCSS فقط (globals.css: .quiz-thumb/.quiz-pop)، وتُعطَّل تلقائياً
 * تحت prefers-reduced-motion بالقاعدة العامة في globals.css.
 */
export function ArrowScale({
  value,
  onChange,
  onConfirm,
  labels,
  ariaLabel,
  compact = false,
}: {
  value: ScaleValue | null;
  /** source: "pointer" للسحب/النقر، "keyboard" للأسهم -- المستدعي يقرّر الانتقال التلقائي. */
  onChange: (v: ScaleValue, source: "pointer" | "keyboard") => void;
  onConfirm?: () => void;
  labels: FiveLevelLabels;
  ariaLabel: string;
  compact?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const [popKey, setPopKey] = useState(0);

  const index = value === null ? null : SCALE_STOPS.indexOf(value);
  // الكسر من بداية السطر (اليمين): 0 = أوافق بشدة، 1 = لا أوافق إطلاقاً
  const fractionOf = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (rect.right - clientX) / rect.width));
  };
  const commit = (i: number, source: "pointer" | "keyboard") => {
    const next = SCALE_STOPS[Math.min(4, Math.max(0, i))];
    if (next !== value) setPopKey((k) => k + 1);
    onChange(next, source);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragFraction(fractionOf(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragFraction === null) return;
    setDragFraction(fractionOf(e.clientX));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragFraction === null) return;
    commit(Math.round(fractionOf(e.clientX) * 4), "pointer");
    setDragFraction(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = index ?? 2;
    const moves: Record<string, number> = {
      ArrowRight: current - 1,
      ArrowUp: current - 1,
      ArrowLeft: current + 1,
      ArrowDown: current + 1,
      Home: 0,
      End: 4,
    };
    if (e.key in moves) {
      e.preventDefault();
      // بلا موضع افتراضي: أول ضغطة سهم من حالة "لا إجابة" تختار جانباً صريحاً
      // (يمين/أعلى = أوافق، يسار/أسفل = لا أوافق) ولا تسجّل "محايد" ضمناً.
      const firstPress = index === null ? (e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? 3 : null) : null;
      commit(firstPress ?? moves[e.key], "keyboard");
    } else if (e.key === "Enter" && value !== null) {
      e.preventDefault();
      onConfirm?.();
    }
  };

  const shownFraction = dragFraction ?? (index === null ? null : index / 4);
  const shownIndex = shownFraction === null ? null : Math.round(shownFraction * 4);
  const agreeSide = shownIndex !== null && shownIndex < 2;
  const neutral = shownIndex === 2;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value === null ? "لم تُختر إجابة بعد" : labelFor(labels, value)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDragFraction(null)}
        onKeyDown={onKeyDown}
        className={`relative touch-none select-none rounded-full cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-primary-200 ${
          compact ? "h-11" : "h-16"
        }`}
      >
        {/* المسار */}
        <div className="absolute inset-x-3 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-muted border border-line" />
        {/* الامتلاء من المنتصف إلى السهم -- لونه يعكس الموافقة أو عدمها */}
        {shownFraction !== null && !neutral && (
          <div
            className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full ${
              agreeSide ? "bg-primary-solid" : "bg-ink-muted/50"
            } ${dragFraction === null ? "quiz-fill" : ""}`}
            style={
              agreeSide
                ? { right: `calc(12px + ${shownFraction} * (100% - 24px))`, left: "50%" }
                : { right: "50%", left: `calc(12px + ${1 - shownFraction} * (100% - 24px))` }
            }
          />
        )}
        {/* الدرجات الخمس */}
        {SCALE_STOPS.map((stop, i) => (
          <span
            key={stop}
            aria-hidden="true"
            className={`absolute top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full border-2 transition-colors ${
              compact ? "h-3 w-3" : "h-4 w-4"
            } ${
              shownIndex === i
                ? "border-primary-solid bg-primary-solid"
                : i === 2
                  ? "border-line-strong bg-surface"
                  : "border-line bg-surface"
            }`}
            style={{ right: `calc(12px + ${i / 4} * (100% - 24px))` }}
          />
        ))}
        {/* السهم */}
        {shownFraction !== null && (
          <div
            aria-hidden="true"
            className={`absolute top-1/2 translate-x-1/2 -translate-y-1/2 ${dragFraction === null ? "quiz-thumb" : ""}`}
            style={{ right: `calc(12px + ${shownFraction} * (100% - 24px))` }}
          >
            <div
              key={popKey}
              className={`quiz-pop flex items-center justify-center rounded-full shadow-lg ring-2 ring-white ${
                compact ? "h-9 w-9 text-lg" : "h-12 w-12 text-2xl"
              } ${agreeSide ? "bg-primary-solid" : neutral ? "bg-surface-muted" : "bg-ink-muted"}`}
            >
              {FACES[shownIndex!]}
            </div>
          </div>
        )}
        {shownFraction === null && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold text-ink-muted quiz-hint">
            اسحب أو اضغط على الدرجة الأقرب لك
          </p>
        )}
      </div>

      {/* أسماء الدرجات -- أزرار نقر مباشر أيضاً */}
      <div className={`grid grid-cols-5 gap-1 text-center ${compact ? "text-[11px]" : "text-xs md:text-sm"}`}>
        {SCALE_STOPS.map((stop, i) => (
          <button
            key={stop}
            type="button"
            tabIndex={-1}
            onClick={() => commit(i, "pointer")}
            className={`rounded-lg px-1 py-1 leading-tight transition-colors ${
              index === i ? "font-black text-primary-text" : "text-ink-muted hover:text-ink"
            } ${compact && i !== 0 && i !== 2 && i !== 4 ? "invisible md:visible" : ""}`}
          >
            {labelFor(labels, stop)}
          </button>
        ))}
      </div>
    </div>
  );
}
