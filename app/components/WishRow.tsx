"use client";
import type { ClassifiedWish, Band } from "../../lib/wishlistPlanner";
import { privateStatedMin, PRIVATE_NO_PUBLISHED_MIN } from "../../lib/admissionDisclosure";

const BAND_UI: Record<Band, { label: string; dot: string; bg: string; fg: string }> = {
  safe: { label: "مريح", dot: "bg-band-safe", bg: "bg-band-safe-bg", fg: "text-band-safe" },
  close: { label: "متقارب", dot: "bg-band-close", bg: "bg-band-close-bg", fg: "text-band-close" },
  reach: { label: "طموح", dot: "bg-band-reach", bg: "bg-band-reach-bg", fg: "text-band-reach" },
  unknown: { label: "غير معروف", dot: "bg-band-unknown", bg: "bg-band-unknown-bg", fg: "text-band-unknown" },
};

export default function WishRow({
  wish,
  index,
  onUp,
  onDown,
  onRemove,
}: {
  wish: ClassifiedWish;
  index: number;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const ui = BAND_UI[wish.band];

  return (
    <li
      dir="rtl"
      className={`a-rise flex items-center gap-3 rounded-md border border-line ${ui.bg} p-3 transition-all duration-200`}
    >
      <span className="w-7 shrink-0 text-center font-bold text-ink-muted">{index + 1}</span>

      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ui.dot}`} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{wish.offering.departmentName}</p>
        <p className="truncate text-sm text-ink-soft">
          {wish.offering.universityName} · {wish.offering.province} · {wish.session} · {wish.majorName}
        </p>
      </div>

      <div className="shrink-0 text-end">
        <div className={`text-sm font-bold ${ui.fg}`}>{ui.label}</div>
        <div className="text-xs text-ink-muted">
          {wish.offering.isDirectAdmission
            ? "قبول مباشر"
            : wish.cutoff === null
              ? "بلا حدّ منشور"
              : `الحد ${wish.cutoff}% · ${wish.margin! >= 0 ? "+" : ""}${wish.margin}`}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        {/* ≥44 بكسل للمس على الجوال */}
        <button
          onClick={onUp}
          aria-label="رفع"
          className="h-[22px] w-11 rounded-sm bg-surface-muted text-xs hover:bg-line active:scale-95"
        >
          ▲
        </button>
        <button
          onClick={onDown}
          aria-label="خفض"
          className="h-[22px] w-11 rounded-sm bg-surface-muted text-xs hover:bg-line active:scale-95"
        >
          ▼
        </button>
      </div>

      <button onClick={onRemove} aria-label="حذف" className="shrink-0 px-2 text-ink-muted hover:text-band-reach">
        ✕
      </button>
    </li>
  );
}
