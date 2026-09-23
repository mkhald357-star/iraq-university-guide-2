"use client";

// شريط تقدّم مقطّع: كل شاشة مقطع يمتلئ بحركة، مع رسالة تشجيع خفيفة عند
// محطات الطريق (لا تكشف أي نتيجة).
const MILESTONES: Record<number, string> = {
  0.25: "بداية ممتازة — ربع الطريق",
  0.5: "في منتصف الطريق، استمر",
  0.75: "اقتربت كثيراً من النهاية",
};

export function QuizProgress({ current, total }: { current: number; total: number }) {
  const ratio = total > 0 ? current / total : 0;
  const milestone = Object.entries(MILESTONES)
    .reverse()
    .find(([at]) => ratio >= Number(at) && ratio < Number(at) + 1 / total)?.[1];

  return (
    <div className="space-y-2" aria-label={`السؤال ${current + 1} من ${total}`}>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
              i < current ? "bg-primary-solid" : i === current ? "bg-primary-200 quiz-hint" : "bg-surface-muted"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs font-bold text-ink-muted">
        <span>
          {current + 1} / {total}
        </span>
        {milestone && <span className="a-fade text-primary-text">{milestone}</span>}
      </div>
    </div>
  );
}
