"use client";
import { useState } from "react";
import UniversitiesTable from "./UniversitiesTable";
import type { ExplorerOffering } from "../../lib/offeringsClient";

const BATCH = 30;

/** جدول عروض مُصفّح -- يعرض دفعة أولى ثم يوسّعها بزر "عرض المزيد"، بدل
    رسم آلاف الصفوف دفعة واحدة (فرع "علمي" وحده قد يبلغ 1,827 عرضاً). */
export default function PaginatedOfferingsTable({ offerings }: { offerings: ExplorerOffering[] }) {
  const [visible, setVisible] = useState(BATCH);
  const shown = offerings.slice(0, visible);
  const remaining = offerings.length - visible;

  return (
    <div>
      <UniversitiesTable offerings={shown} />
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + BATCH)}
          className="mt-3 w-full rounded-md border border-line py-2.5 text-sm font-bold text-primary-text
                     transition-colors duration-200 hover:bg-surface-muted"
        >
          عرض المزيد ({remaining.toLocaleString("ar-IQ")} متبقٍّ)
        </button>
      )}
    </div>
  );
}
