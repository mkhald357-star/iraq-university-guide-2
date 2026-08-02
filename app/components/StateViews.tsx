"use client";
import { usePathname } from "next/navigation";
import type { DataFetchError, EmptyDiagnosis } from "../../lib/viewState";
import { useReportIssue } from "../context/ReportIssueContext";

/* ═══ التحميل: هيكل يطابق شكل المحتوى، لا دوّار (نفس نمط Shimmer في
   app/report/page.tsx) ═══ */
function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-surface-muted ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent motion-reduce:animate-none" />
    </div>
  );
}

export function ResultsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div dir="rtl" role="status" aria-live="polite" aria-busy="true" className="mt-6 grid gap-3">
      <span className="sr-only">جارٍ تحميل النتائج</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-md border border-line p-4">
          <Shimmer className="h-3 w-3 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-3.5 w-2/5" />
            <Shimmer className="h-3 w-3/5 opacity-70" />
          </div>
          <Shimmer className="h-6 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ═══ الفشل: سبب مفهوم + فعل ═══ */
const FAILURE_TEXT: Record<string, { title: string; body: string }> = {
  timeout: {
    title: "الاتصال بطيء",
    body: "ما قدرنا نجيب البيانات خلال المهلة. تأكّد من الإنترنت وحاول مرة ثانية.",
  },
  network: {
    title: "تعذّر الاتصال",
    body: "ما قدرنا نوصل للبيانات. تأكّد من الإنترنت وحاول مرة ثانية.",
  },
  notFound: {
    title: "البيانات غير متوفّرة",
    body: "هذا خلل عندنا لا عندك. إذا تكرّر، بلّغنا عنه.",
  },
  parse: {
    title: "البيانات غير صالحة",
    body: "هذا خلل عندنا لا عندك. إذا تكرّر، بلّغنا عنه.",
  },
  unknown: {
    title: "صار خطأ غير متوقّع",
    body: "حاول مرة ثانية. إذا تكرّر، بلّغنا عنه.",
  },
};

export function ErrorState({ error, onRetry }: { error: DataFetchError; onRetry: () => void }) {
  const pathname = usePathname();
  const reportIssue = useReportIssue();
  const t = FAILURE_TEXT[error.kind] ?? FAILURE_TEXT.unknown;
  return (
    <div dir="rtl" role="alert" className="mt-6 rounded-md border border-line bg-surface-subtle p-6 text-center">
      <p className="text-lg font-extrabold text-ink">{t.title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{t.body}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md px-6 py-2.5 text-sm font-bold text-white
                     transition-transform duration-200 hover:-translate-y-0.5
                     focus-visible:outline focus-visible:outline-2
                     focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          style={{ background: "var(--g-primary)" }}
        >
          حاول مرة ثانية
        </button>
        <button
          type="button"
          onClick={() => reportIssue({ page: pathname, shownValue: `فشل جلب: ${error.kind}` })}
          className="rounded-md border border-line px-5 py-2.5 text-sm font-bold text-ink-soft
                     transition-colors duration-200 hover:bg-surface-muted"
        >
          بلّغ عن المشكلة
        </button>
      </div>
    </div>
  );
}

/* ═══ الفراغ: أهم مكوّن في الحزمة -- راجع data/admission_rules.md §31 لقواعد
   النبرة (لا حكم على الطالب، لا اعتذار، لا نصيحة بلا فائدة) ═══ */
export function EmptyState({
  diagnosis,
  grade,
  onRelax,
  children,
}: {
  diagnosis: EmptyDiagnosis;
  grade: number;
  onRelax: (what: "province" | "session") => void;
  children?: React.ReactNode; // بدائل محسوبة تمرّرها الصفحة
}) {
  const pathname = usePathname();
  const reportIssue = useReportIssue();
  const { code, wouldYield, nearest } = diagnosis;

  return (
    <div dir="rtl" className="mt-6 rounded-md border border-line bg-surface-subtle p-6">
      {code === "PROVINCE_TOO_NARROW" && (
        <>
          <p className="font-extrabold text-ink">ما في خيارات بهذي المحافظة ضمن معدّلك</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            لكن في <strong>{wouldYield}</strong> خيار بمحافظات ثانية يوصلها معدّلك.
          </p>
          <button
            type="button"
            onClick={() => onRelax("province")}
            className="mt-4 rounded-md px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: "var(--g-primary)" }}
          >
            شوف كل المحافظات
          </button>
        </>
      )}

      {code === "SESSION_UNAVAILABLE" && (
        <>
          <p className="font-extrabold text-ink">ما في خيارات بهذي الدراسة ضمن معدّلك</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            في <strong>{wouldYield}</strong> خيار بالدراسة الثانية يوصلها معدّلك.
          </p>
          <button
            type="button"
            onClick={() => onRelax("session")}
            className="mt-4 rounded-md px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: "var(--g-primary)" }}
          >
            شوف الصباحي والمسائي
          </button>
        </>
      )}

      {code === "FILTERS_TOO_NARROW" && (
        <>
          <p className="font-extrabold text-ink">ما في نتائج ضمن الفلاتر الحالية</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            في <strong>{wouldYield}</strong> خيار لو خفّفت الحدّ الأدنى المُدخَل.
          </p>
        </>
      )}

      {code === "NO_REACHABLE" && (
        <>
          <p className="font-extrabold text-ink">بمعدّل {grade}% ما في خيار ضمن متناولك بالفلاتر الحالية</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            النتائج تحت هذي البطاقة كلها حدودها أعلى من معدّلك — نعرضها لك للاطّلاع.
          </p>

          {(diagnosis.relaxable === "province" || diagnosis.relaxable === "session") && wouldYield > 0 && (
            <button
              type="button"
              onClick={() => onRelax(diagnosis.relaxable as "province" | "session")}
              className="mt-4 rounded-md px-5 py-2.5 text-sm font-bold text-white"
              style={{ background: "var(--g-primary)" }}
            >
              {diagnosis.relaxable === "province" ? "شوف كل المحافظات" : "شوف الصباحي والمسائي"} ({wouldYield})
            </button>
          )}

          {nearest.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold text-ink-soft">أقرب الخيارات الطموحة وفارقها عن معدّلك:</p>
              <ul className="mt-2 grid gap-1.5">
                {nearest.map((n, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-sm bg-surface px-3 py-2 text-sm"
                  >
                    <span className="truncate text-ink">
                      {(n.offering as any).departmentName} — {(n.offering as any).universityName}
                    </span>
                    <span className="shrink-0 font-bold text-band-close">فارق {n.gap.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {children}
        </>
      )}

      {code === "GRADE_BELOW_ALL" && (
        <>
          <p className="font-extrabold text-ink">بمعدّل {grade}% ما وصلنا لخيار ضمن الفلاتر الحالية</p>

          {nearest.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold text-ink-soft">أقرب الخيارات وفارقها عن معدّلك:</p>
              <ul className="mt-2 grid gap-1.5">
                {nearest.map((n, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-sm bg-surface px-3 py-2 text-sm"
                  >
                    <span className="truncate text-ink">
                      {(n.offering as any).departmentName} — {(n.offering as any).universityName}
                    </span>
                    <span className="shrink-0 font-bold text-band-close">فارق {n.gap.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {children}
        </>
      )}

      {code === "NO_DATA" && (
        <>
          <p className="font-extrabold text-ink">ما وصلتنا بيانات</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            هذا خلل عندنا لا عندك. حاول تحديث الصفحة، وإذا تكرّر بلّغنا عنه.
          </p>
        </>
      )}
    </div>
  );
}
