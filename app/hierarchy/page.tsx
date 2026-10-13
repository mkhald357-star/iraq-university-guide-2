"use client";

import { useEffect, useMemo, useState } from "react";
import { ListTree } from "lucide-react";
import { fetchJSON } from "../../lib/offeringsClient";
import { ChannelNotice } from "../components/ChannelNotice";
import { ResultsSkeleton, ErrorState } from "../components/StateViews";
import type { ViewState, DataFetchError } from "../../lib/viewState";
import { CUTOFFS_YEAR } from "../../lib/admissionDisclosure";

/** [فرع، جنس، معدل، حصة(0|1)] */
type Value = [string, string, number, number];
interface Department {
  name: string;
  v: Value[];
}
interface College {
  name: string;
  level?: "college" | "track";
  collegeLevel?: Value[];
  departments: Department[];
}
interface University {
  name: string;
  colleges: College[];
}
interface Province {
  name: string;
  universities: University[];
}
interface HierarchyData {
  year: string;
  source: string;
  rows: number;
  provinces: Province[];
}

const BRANCHES = ["علمي", "أدبي", "فنون"] as const;

// الجنس يُذكر لقسم محدّد فقط (أنثى/ذكر)، وبقية الأقسام «مختلط» بلا أي وسم.
function ValueChips({ values, branch }: { values: Value[]; branch: string }) {
  const shown = values.filter((x) => !branch || x[0] === branch);
  if (!shown.length) return <span className="text-ink-muted">لا حد منشور لهذا الفرع</span>;
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1">
      {shown.map((x, i) => (
        <span key={i} className="whitespace-nowrap">
          <span className="text-ink-soft">
            {x[0]}
            {x[1] !== "مختلط" ? ` (${x[1]})` : ""}
            {x[3] ? " (حصة)" : ""}
          </span>{" "}
          <span className="font-bold tabular-nums text-ink">{x[2].toFixed(2)}%</span>
        </span>
      ))}
    </span>
  );
}

function collegeMatches(c: College, uniName: string, q: string): boolean {
  if (!q) return true;
  return uniName.includes(q) || c.name.includes(q) || c.departments.some((d) => d.name.includes(q));
}

export default function HierarchyPage() {
  const [state, setState] = useState<ViewState<HierarchyData>>({ status: "loading" });
  const [province, setProvince] = useState("");
  const [branch, setBranch] = useState("");
  const [query, setQuery] = useState("");

  function load() {
    setState({ status: "loading" });
    fetchJSON<HierarchyData>("/data/hierarchy.json")
      .then((data) => setState({ status: "ready", data }))
      .catch((e: DataFetchError) => setState({ status: "error", error: e }));
  }
  useEffect(load, []);

  const data = state.status === "ready" ? state.data : null;
  const q = query.trim();

  const visible = useMemo(() => {
    if (!data) return [];
    const has = (vals: Value[] | undefined) => !branch || (vals ?? []).some((x) => x[0] === branch);
    return data.provinces
      .filter((p) => !province || p.name === province)
      .map((p) => ({
        ...p,
        universities: p.universities
          .map((u) => ({
            ...u,
            colleges: u.colleges
              .filter((c) => collegeMatches(c, u.name, q))
              // مع فرع محدّد: لا تُعرض كلية ولا قسم بلا حد منشور لذلك الفرع (بدل صفوف «لا حد»)
              .map((c) => ({ ...c, departments: c.departments.filter((d) => has(d.v)) }))
              .filter((c) => c.departments.length > 0 || has(c.collegeLevel))
              .map((c) => (has(c.collegeLevel) ? c : { ...c, collegeLevel: undefined })),
          }))
          .filter((u) => u.colleges.length > 0),
      }))
      .filter((p) => p.universities.length > 0);
  }, [data, province, q, branch]);

  const collegeCount = visible.reduce((n, p) => n + p.universities.reduce((m, u) => m + u.colleges.length, 0), 0);

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-black text-ink">
          <ListTree className="h-7 w-7" aria-hidden="true" />
          الحدود الدنيا بالتسلسل
        </h1>
        <p className="mt-1 text-ink-soft">
          كل صف من جدول «الحدود الدنيا للقبول المركزي» {CUTOFFS_YEAR} مرتّباً: المحافظة، فالجامعة، فالكلية، فالقسم.
        </p>
      </div>

      <ChannelNotice />

      <div className="rounded-md border border-line bg-surface-subtle p-4 text-sm leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">اقرأ هذا قبل الاعتماد على رقم</p>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>
            <strong>حد القسم</strong> يظهر تحت اسم القسم فقط حين نشرت الوزارة صفاً باسمه.
          </li>
          <li>
            <strong>حد الكلية أو المسار</strong> هو أدنى حد للتقديم على الكلية كلها (أو المسار كله في المعاهد التقنية)،
            وهو لأقسامها التي لا صف خاصاً بها. قد يكون حد قسمك الفعلي أعلى منه، والوزارة لم تنشره.
          </li>
          <li>الجنس يُذكر لقسم أو كلية محدّدة فقط (مثل كليات البنات والتمريض). وبقية الأقسام مختلطة بلا وسم.</li>
        </ul>
      </div>

      <div className="grid gap-4 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:grid-cols-3">
        <label className="block text-sm font-bold text-ink">
          المحافظة
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-surface p-2.5 font-normal"
          >
            <option value="">كل المحافظات</option>
            {(data?.provinces ?? []).map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold text-ink">
          الفرع الدراسي
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-surface p-2.5 font-normal"
          >
            <option value="">كل الفروع</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold text-ink">
          بحث (جامعة، كلية، قسم)
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="مثال: الحاسوب"
            className="mt-1 w-full rounded-xl border border-line bg-surface p-2.5 font-normal"
          />
        </label>
      </div>

      {state.status === "loading" && <ResultsSkeleton />}
      {state.status === "error" && <ErrorState error={state.error} onRetry={load} />}

      {data && (
        <>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {collegeCount.toLocaleString("ar-IQ")} كلية/معهد معروضة من {data.rows.toLocaleString("ar-IQ")} صفاً رسمياً.
          </p>
          {visible.length === 0 && (
            <p className="rounded-md border border-line p-6 text-center text-ink-soft">
              لا نتائج لهذه الفلاتر. جرّب «كل المحافظات» أو أزل نص البحث.
            </p>
          )}
          {visible.map((p) => (
            <section key={p.name} aria-labelledby={`prov-${p.name}`} className="space-y-3">
              <h2 id={`prov-${p.name}`} className="text-xl font-extrabold text-ink">
                {p.name}
              </h2>
              {p.universities.map((u) => (
                <details key={u.name} className="rounded-md border border-line bg-surface" open={!!q || !!province}>
                  <summary className="cursor-pointer p-3 font-bold text-ink">
                    {u.name} <span className="text-sm font-normal text-ink-muted">({u.colleges.length} كلية/معهد)</span>
                  </summary>
                  <ul className="space-y-3 border-t border-line p-3">
                    {u.colleges.map((c) => {
                      const hasDepts = c.departments.length > 0;
                      return (
                        <li key={c.name} className="rounded-md bg-surface-subtle p-3">
                          <p className="font-bold text-ink">{c.name}</p>
                          {hasDepts && (
                            <ul className="mt-2 space-y-1 text-sm">
                              {c.departments.map((d) => (
                                <li key={d.name} className="flex flex-wrap items-baseline justify-between gap-x-4">
                                  <span>{d.name}</span>
                                  <ValueChips values={d.v} branch={branch} />
                                </li>
                              ))}
                            </ul>
                          )}
                          {c.collegeLevel && (
                            <p className="mt-2 border-t border-line pt-2 text-sm">
                              <span className="me-2 rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-ink-muted">
                                {c.level === "track" ? "حد المسار" : "حد الكلية"}
                                {hasDepts ? " (للأقسام بلا صف خاص)" : " (لا أقسام مذكورة في الملف)"}
                              </span>
                              <ValueChips values={c.collegeLevel} branch={branch} />
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </section>
          ))}
          <p className="text-xs text-ink-muted">المصدر: {data.source}. القرار النهائي لموقع الوزارة الرسمي.</p>
        </>
      )}
    </div>
  );
}
