"use client";

import { useEffect, useMemo, useState } from "react";
import { Compass } from "lucide-react";
import provincesData from "../../data/provinces.json";
import { fetchOfferingsForBranch, type Branch, type ExplorerOffering } from "../../lib/offeringsClient";
import PaginatedOfferingsTable from "../components/PaginatedOfferingsTable";
import { ChannelNotice } from "../components/ChannelNotice";
import { CUTOFFS_YEAR } from "../../lib/admissionDisclosure";

const BRANCHES: { value: Branch; label: string }[] = [
  { value: "علمي", label: "علمي" },
  { value: "أدبي", label: "أدبي" },
  { value: "فنون", label: "فنون" },
];

function effectiveMinCutoff(o: ExplorerOffering): number {
  if (o.isDirectAdmission) return -Infinity;
  const values = [o.averageGrades["صباحي"], o.averageGrades["مسائي"]].filter(
    (v): v is number => v !== null
  );
  return values.length > 0 ? Math.min(...values) : Infinity;
}

export default function ExplorerPage() {
  const [branch, setBranch] = useState<Branch | "">("");
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<ExplorerOffering[]>([]);

  const [province, setProvince] = useState("");
  const [maxCutoff, setMaxCutoff] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("filterSettings");
      if (saved) {
        const fs = JSON.parse(saved);
        if (fs.province) setProvince(fs.province);
      }
    } catch {
      // بيانات تالفة -- تُترَك الفلاتر فارغة.
    }
  }, []);

  useEffect(() => {
    if (!branch) {
      setOfferings([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOfferingsForBranch(branch).then((data) => {
      if (!cancelled) {
        setOfferings(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [branch]);

  const filtered = useMemo(() => {
    const max = maxCutoff === "" ? null : Number(maxCutoff);
    return offerings.filter((o) => {
      if (province && o.province !== province) return false;
      if (max !== null && effectiveMinCutoff(o) > max) return false;
      return true;
    });
  }, [offerings, province, maxCutoff]);

  return (
    <div dir="rtl" className="mx-auto max-w-5xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">مستكشف الجامعات</h1>
        <p className="mt-1 text-ink-soft">تصفّح كل قسم جامعي في العراق، وفلتِره بالمحافظة والفرع والحد الأدنى.</p>
      </div>

      {/* ── اختيار الفرع -- إلزامي أولاً، بلا جلب بيانات قبل الاختيار ── */}
      <div className="glass rounded-3xl p-6">
        <p className="mb-3 font-bold text-ink">الفرع الدراسي</p>
        <div className="flex flex-wrap gap-3">
          {BRANCHES.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => setBranch(b.value)}
              className={`rounded-xl px-6 py-2.5 font-bold transition-colors ${
                branch === b.value
                  ? "bg-primary text-white"
                  : "border border-line text-ink-soft hover:bg-surface-muted"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {!branch && (
        <p className="rounded-2xl border border-line bg-surface p-8 text-center text-ink-muted">
          <Compass className="mx-auto mb-3 h-8 w-8 text-ink-muted" />
          اختر فرعاً للبدء — كل الأقسام الجامعية الحقيقية لهذا الفرع تظهر أدناه.
        </p>
      )}

      {branch && loading && <p className="text-center text-ink-muted">جارٍ جلب بيانات فرع {branch}...</p>}

      {branch && !loading && (
        <>
          <ChannelNotice />

          <div className="glass grid gap-4 rounded-3xl p-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block font-bold" htmlFor="province">
                المحافظة
              </label>
              <select
                id="province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full rounded-xl border border-line p-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">كل المحافظات</option>
                {provincesData.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block font-bold" htmlFor="maxCutoff">
                الحد الأدنى وفق حدود {CUTOFFS_YEAR} (أظهر الأقسام بحدّ لا يتجاوز)
              </label>
              <input
                id="maxCutoff"
                type="number"
                min={0}
                max={120}
                step="0.01"
                value={maxCutoff}
                onChange={(e) => setMaxCutoff(e.target.value)}
                placeholder="مثال: 70 (اتركه فارغاً لعرض الكل)"
                className="w-full rounded-xl border border-line p-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <p className="text-sm text-ink-muted">
            {filtered.length.toLocaleString("ar-IQ")} قسماً من أصل {offerings.length.toLocaleString("ar-IQ")}
          </p>

          {filtered.length === 0 ? (
            <p className="text-center text-ink-muted">لا توجد أقسام مطابقة لهذه الفلاتر.</p>
          ) : (
            <PaginatedOfferingsTable offerings={filtered} />
          )}
        </>
      )}
    </div>
  );
}
