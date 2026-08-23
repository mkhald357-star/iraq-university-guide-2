import type { LucideIcon } from "lucide-react";

type Tone = "primary" | "muted";
type Size = "sm" | "md" | "lg";

const TONE_CLASSES: Record<Tone, string> = {
  primary: "bg-primary-100 text-primary-700",
  muted: "bg-surface-muted text-ink-muted",
};

const WRAPPER_SIZE: Record<Size, string> = {
  sm: "rounded-lg p-2",
  md: "rounded-xl p-2.5",
  lg: "rounded-2xl p-3",
};

const ICON_SIZE: Record<Size, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

// حاوية أيقونة موحّدة (خلفية + لون) -- كانت مكرَّرة حرفياً
// (bg-primary-100 text-primary-700) عبر 8 ملفات مختلفة.
export function IconBadge({
  icon: Icon,
  tone = "primary",
  size = "md",
  className = "",
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: Size;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${WRAPPER_SIZE[size]} ${TONE_CLASSES[tone]} ${className}`}
    >
      <Icon className={ICON_SIZE[size]} aria-hidden="true" />
    </span>
  );
}
