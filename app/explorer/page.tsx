"use client";

import { useEffect, useMemo, useState } from "react";
import { Compass } from "lucide-react";
import provincesData from "../../data/provinces.json";
import { fetchOfferingsForBranch, type Branch, type ExplorerOffering } from "../../lib/offeringsClient";
import PaginatedOfferingsTable from "../components/PaginatedOfferingsTable";
import { ChannelNotice } from "../components/ChannelNotice";
import { ResultsSkeleton, ErrorState, EmptyState } from "../components/StateViews";
import type { ViewState, DataFetchError, EmptyDiagnosis } from "../../lib/viewState";
import {
  CUTOFFS_YEAR,
  UNCOVERED_PROVINCES,
  UNCOVERED_PROVINCES_REASON,
  BRANCH_UNKNOWN_NOTE,
} from "../../lib/admissionDisclosure";
import { readStored, isPlainObject } from "../../lib/safeStorage";

const BRANCHES: { value: Branch; label: string }[] = [
  { value: "علمي", label: "علمي" },
  { value: "أدبي", label: "أدبي" },
  { value: "فنون", label: "فنون" },
];

// نفس منطق classifyOffering (lib/wishlistPlanner.ts) بالضبط: isDirectAdmission
// للأهلي لا يعني "بلا حدّ" -- يعني "لا رقم في مصدرنا" (data/admission_rules.md
// §32). قسم أهلي بشرط معلَن يُقارَن به؛ بلا شرط منشور لا يُفترَض "أقل حدّ ممكن"
// (Infinity، لا -Infinity -- لا يمرّ فلتر "الحدّ الأقصى" بلا دليل يبرّر ذلك).
function effectiveMinCutoff(o: ExplorerOffering): number {
  if (o.universityType === "أهلية") {
    return o.statedMinimumGrade?.value ?? Infinity;
  }
  const values = [o.averageGrades["صباحي"], o.averageGrades["مسائي"]].filter((v): v is number => v !== null);
  return values.length > 0 ? Math.min(...values) : Infinity;
}

export default function ExplorerPage() {
  const [branch, setBranch] = useState<Branch | "">("");
  const [branchState, setBranchState] = useState<ViewState<ExplorerOffering[]>>({ status: "idle" });
  const offerings = useMemo(() => (branchState.status === "ready" ? branchState.data : []), [branchState]);

  const [province, setProvince] = useState("");
  const [maxCutoff, setMaxCutoff] = useState("");

  useEffect(() => {
    try {
      const fs = readStored("filterSettings", isPlainObject, null);
      if (fs && typeof fs.province === "string") setProvince(fs.province);
    } catch {
      // بيانات تالفة -- تُترَك الفلاتر فارغة.
    }
  }, []);

  useEffect(() => {
    if (!branch) {
      setBranchState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setBranchState({ status: "loading" });
    fetchOfferingsForBranch(branch)
      .then((data) => {
        if (!cancelled) setBranchState({ status: "ready", data });
      })
      .catch((e: DataFetchError) => {
        if (!cancelled) setBranchState({ status: "error", error: e });
      });
    return () => {
      cancelled = true;
    };
  }, [branch]);

  function retryFetch() {
    if (!branch) return;
    setBranchState({ status: "loading" });
    fetchOfferingsForBranch(branch)
      .then((data) => setBranchState({ status: "ready", data }))
      .catch((e: DataFetchError) => setBranchState({ status: "error", error: e }));
  }

  const filtered = useMemo(() => {
    const max = maxCutoff === "" ? null : Number(maxCutoff);
    return offerings
      .filter((o) => {
        if (province && o.province !== province) return false;
        if (max !== null && effectiveMinCutoff(o) > max) return false;
        return true;
      })
      .sort((a, b) => {
        // معروف الفرع أولاً -- غير المعروف متاح بعده لا مخفياً (§29). ثانياً
        // اسم الجامعة أبجدياً -- لا ترتيب المصدر الخام (كل الحكومي مذكور قبل
        // كل الأهلي فيه بنيوياً، فيدفن آلاف الأقسام الأهلية المعروفة الفرع
        // فعلياً خلف كل الحكومي أولاً؛ الأبجدي يوزّعها فعلياً بدل دفنها).
        const knownDiff = Number(b.branchKnown) - Number(a.branchKnown);
        if (knownDiff !== 0) return knownDiff;
        return a.universityName.localeCompare(b.universityName, "ar");
      });
  }, [offerings, province, maxCutoff]);

  const hasUnknownBranch = filtered.some((o) => !o.branchKnown);

  // تشخيص الفراغ بالتخفيف التدريجي (data/admission_rules.md §31) -- الفرع
  // لا يحمل مفهوم "معدّل"/"جلسة" كـ/gpa-check، فالتشخيص مبنيّ محلياً على
  // فلترتَي المحافظة والحدّ الأقصى فقط، بنفس منطق `filtered` أعلاه تماماً.
  const emptyDiagnosis: EmptyDiagnosis | null = useMemo(() => {
    if (filtered.length > 0) return null;
    if (!offerings.length) return { code: "NO_DATA", relaxable: null, wouldYield: 0, nearest: [] };

    const max = maxCutoff === "" ? null : Number(maxCutoff);
    if (province) {
      const n = offerings.filter((o) => max === null || effectiveMinCutoff(o) <= max).length;
      if (n > 0) return { code: "PROVINCE_TOO_NARROW", relaxable: "province", wouldYield: n, nearest: [] };
    }
    if (max !== null) {
      const n = offerings.filter((o) => !province || o.province === province).length;
      if (n > 0) return { code: "FILTERS_TOO_NARROW", relaxable: null, wouldYield: n, nearest: [] };
    }
    return { code: "NO_DATA", relaxable: null, wouldYield: 0, nearest: [] };
  }, [filtered, offerings, province, maxCutoff]);

  function relaxFilter(what: "province" | "session") {
    if (what === "province") setProvince("");
  }

  return (
    <div dir="rtl" className="mx-auto max-w-5xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">مستكشف الجامعات</h1>
        <p className="mt-1 text-ink-soft">تصفّح كل قسم جامعي في العراق، وفلتِره بالمحافظة والفرع والحد الأدنى.</p>
        <p className="mt-1 text-sm text-ink-soft">
          تريد الجدول الرسمي كما نشرته الوزارة مرتباً بالمحافظة والجامعة والكلية والقسم؟{" "}
          <a
            href="/hierarchy"
            className="font-bold underline decoration-dotted underline-offset-4 hover:text-primary-text"
          >
            الحدود بالتسلسل
          </a>
        </p>
      </div>

      {/* ── اختيار الفرع -- إلزامي أولاً، بلا جلب بيانات قبل الاختيار ── */}
      <div className="bg-surface border border-line shadow-sm rounded-3xl p-6">
        <p className="mb-3 font-bold text-ink">الفرع الدراسي</p>
        <div className="flex flex-wrap gap-3">
          {BRANCHES.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => setBranch(b.value)}
              className={`rounded-xl px-6 py-2.5 font-bold transition-colors ${
                branch === b.value
                  ? "bg-primary-solid text-white"
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

      {branch && branchState.status === "loading" && <ResultsSkeleton />}
      {branch && branchState.status === "error" && <ErrorState error={branchState.error} onRetry={retryFetch} />}

      {branch && branchState.status === "ready" && (
        <>
          <ChannelNotice />

          <div className="bg-surface border border-line shadow-sm grid gap-4 rounded-3xl p-6 sm:grid-cols-2">
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
                {UNCOVERED_PROVINCES.map((p) => (
                  <option key={p} value={p} disabled>
                    {p} (غير مغطّاة)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-muted">{UNCOVERED_PROVINCES_REASON}</p>
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

          {hasUnknownBranch && (
            <p className="rounded-xl border border-line bg-surface-muted p-3 text-xs text-ink-muted">
              {BRANCH_UNKNOWN_NOTE}
            </p>
          )}

          {filtered.length === 0 ? (
            emptyDiagnosis && <EmptyState diagnosis={emptyDiagnosis} grade={0} onRelax={relaxFilter} />
          ) : (
            <PaginatedOfferingsTable offerings={filtered} />
          )}
        </>
      )}
    </div>
  );
}
