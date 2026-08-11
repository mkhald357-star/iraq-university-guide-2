"use client";

import { X } from "lucide-react";
import majorsData from "../../data/majors.json";

/** قائمة اختيار تخصص واحدة -- مُستخرَجة من app/compare/page.tsx (2026-08-11)
 *  لإعادة استخدامها في app/decider/page.tsx أيضاً: نفس نمط الاستبعاد
 *  (لا يظهر تخصص مختار في خانة أخرى)، ونفس تسمية aria للوصولية. */
export function MajorPicker({
  value,
  onChange,
  onRemove,
  excludeIds,
  index,
}: {
  value: string;
  onChange: (id: string) => void;
  onRemove?: () => void;
  excludeIds: string[];
  index: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={`التخصص ${index + 1}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line p-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">اختر تخصصاً...</option>
        {majorsData
          .filter((m) => m.id === value || !excludeIds.includes(m.id))
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.category}
            </option>
          ))}
      </select>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="إزالة هذا التخصص"
          className="shrink-0 rounded-lg border border-line p-2.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
