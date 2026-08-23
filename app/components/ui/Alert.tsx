import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "info" | "primary" | "safe" | "close" | "reach";

const TONE_CLASSES: Record<Tone, string> = {
  info: "border-line bg-surface-muted text-ink-soft",
  primary: "border-primary-200 bg-primary-50 text-primary-800",
  safe: "border-band-safe/30 bg-band-safe-bg text-band-safe",
  close: "border-band-close/30 bg-band-close-bg text-band-close",
  reach: "border-band-reach/30 bg-band-reach-bg text-band-reach",
};

const ICON_CLASSES: Record<Tone, string> = {
  info: "text-ink-muted",
  primary: "text-primary-700",
  safe: "text-band-safe",
  close: "text-band-close",
  reach: "text-band-reach",
};

// صندوق تنويه موحّد (أيقونة + عنوان اختياري + نص) -- كان مكرَّراً بألوان
// Tailwind مباشرة (emerald/amber/red/yellow) بلا أي نسخة للوضع الداكن، وهي
// نفس فئة العطل المُكتشَفة والمُصلَحة سابقاً في بقية الموقع.
export function Alert({
  tone = "info",
  icon: Icon,
  title,
  children,
  className = "",
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${TONE_CLASSES[tone]} ${className}`}
    >
      {Icon && <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_CLASSES[tone]}`} aria-hidden="true" />}
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
