import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "safe" | "close" | "reach" | "unknown" | "muted" | "primary";

const TONE_CLASSES: Record<Tone, string> = {
  safe: "bg-band-safe-bg text-band-safe",
  close: "bg-band-close-bg text-band-close",
  reach: "bg-band-reach-bg text-band-reach",
  unknown: "bg-band-unknown-bg text-band-unknown",
  muted: "bg-surface-muted text-ink-muted",
  primary: "bg-primary-100 text-primary-700",
};

// شارة حالة نصية دائماً (لا تعتمد على اللون وحده) -- تُستخدم لـ"متاح/قريباً"،
// "الأرخص من بين المنشور"، "القبول متوقف"، وغيرها من إشارات الحالة القصيرة.
export function Badge({
  tone = "muted",
  icon: Icon,
  children,
  className = "",
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${TONE_CLASSES[tone]} ${className}`}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}
