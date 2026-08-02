"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import provincesData from "../../data/provinces.json";
import { fetchOfferingsForBranch, toUniversityOffering, type Branch, type ExplorerOffering } from "../../lib/offeringsClient";
import { classifyOffering } from "../../lib/wishlistPlanner";
import type { Band, StudySession } from "../../lib/wishlistPlanner";
import PaginatedOfferingsTable from "../components/PaginatedOfferingsTable";
import { ChannelNotice } from "../components/ChannelNotice";
import { ResultsSkeleton, ErrorState, EmptyState } from "../components/StateViews";
import type { ViewState, DataFetchError } from "../../lib/viewState";
import { diagnoseEmpty, type GpaCheckFilters } from "../../lib/emptyDiagnosis";
import {
  ADMISSION_CHANNEL,
  UNCOVERED_PROVINCES,
  UNCOVERED_PROVINCES_REASON,
  BRANCH_UNKNOWN_NOTE,
  EVENING_MIN,
  eveningFloorNote,
} from "../../lib/admissionDisclosure";
import type { EmptyDiagnosis } from "../../lib/viewState";

// ترتيب مقصود: بلا حدّ منشور أقرب للاحتمال من "طموح" -- data/admission_rules.md §32.
const BAND_ORDER = ["safe", "close", "unknown", "reach"] as const;
type DisplayBand = (typeof BAND_ORDER)[number];

const BAND_UI: Record<DisplayBand, { label: string; bg: string; text: string }> = {
  safe: { label: "مريح", bg: "bg-band-safe-bg", text: "text-band-safe" },
  close: { label: "متقارب", bg: "bg-band-close-bg", text: "text-band-close" },
  unknown: { label: "بلا حدّ منشور", bg: "bg-band-unknown-bg", text: "text-band-unknown" },
  reach: { label: "طموح", bg: "bg-band-reach-bg", text: "text-band-reach" },
};

type SessionFilter = "both" | StudySession;

/** أفضل تصنيف بين الجلسات المطلوب اعتبارها فقط (لا كل جلسات العرض بالضرورة
    -- إن اختار الطالب "صباحي فقط" مثلاً، حدّ المسائي الأفضل لا يُحتسَب).
    لا اختصار مسبق على isDirectAdmission -- classifyOffering وحدها تقرّر
    (الأهلي isDirectAdmission=true دائماً لا يعني "مريح"، انظر §32). */
function bestBand(offering: ExplorerOffering, grade: number, sessionsToConsider: StudySession[]): Band {
  const full = toUniversityOffering(offering);
  const order: Band[] = ["safe", "close", "reach", "unknown"];
  let best: Band = "unknown";
  for (const session of sessionsToConsider) {
    const { band } = classifyOffering({ majorId: "", majorName: "", session, offering: full }, grade);
    if (order.indexOf(band) < order.indexOf(best)) best = band;
  }
  return best;
}

export default function GpaCheckPage() {
  const [branch, setBranch] = useState<Branch | "">("");
  const [branchState, setBranchState] = useState<ViewState<ExplorerOffering[]>>({ status: "idle" });
  const offerings = useMemo(
    () => (branchState.status === "ready" ? branchState.data : []),
    [branchState]
  );

  const [grade, setGrade] = useState("");
  const [province, setProvince] = useState("");
  const [university, setUniversity] = useState("");
  const [session, setSession] = useState<SessionFilter>("both");

  const [searched, setSearched] = useState(false);
  const [groups, setGroups] = useState<Record<DisplayBand, ExplorerOffering[]>>({
    safe: [],
    close: [],
    unknown: [],
    reach: [],
  });
  const [emptyDiagnosis, setEmptyDiagnosis] = useState<EmptyDiagnosis | null>(null);
  // نتائج موجودة (طموح و/أو بلا حدّ منشور) لكن صفر مريح/متقارب -- بطاقة
  // توجيه فوق النتائج، لا بدلاً منها (data/admission_rules.md §32).
  const [noReachable, setNoReachable] = useState<EmptyDiagnosis | null>(null);

  // تعبئة تلقائية من نتيجة اختبار سابقة إن وُجدت -- قابلة للتعديل، وليست إلزامية.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("filterSettings");
      if (saved) {
        const fs = JSON.parse(saved);
        if (fs.branch) setBranch(fs.branch);
        if (fs.grade) setGrade(String(fs.grade));
        if (fs.province) setProvince(fs.province);
      }
    } catch {
      // بيانات تالفة -- تُترَك الحقول فارغة.
    }
  }, []);

  // جلب عروض الفرع فور اختياره -- لازم مبكراً (لا عند "افحص" فقط) كي تُعبَّأ
  // قائمتا المحافظة/الجامعة الاختياريتان أدناه من بيانات حقيقية محمَّلة سلفاً.
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

  // جامعات هذه المحافظة تحديداً ضمن عروض الفرع المختار فقط (لا كل جامعات
  // العراق) -- حتى لا تظهر جامعة بلا أي قسم فعلي مطابق لفرع الطالب.
  const universitiesInProvince = useMemo(() => {
    if (!province) return [];
    const names = new Set(offerings.filter((o) => o.province === province).map((o) => o.universityName));
    return [...names].sort((a, b) => a.localeCompare(b, "ar"));
  }, [offerings, province]);

  function handleProvinceChange(value: string) {
    setProvince(value);
    setUniversity(""); // الجامعة المختارة سابقاً قد لا تنتمي للمحافظة الجديدة
  }

  // منطق الفلترة الحقيقي -- يُستعمَل في handleSubmit مباشرة، ويُمرَّر أيضاً
  // لـdiagnoseEmpty كي لا ينحرف التشخيص عن النتيجة الفعلية (data/admission_rules.md §31).
  // "unknown" (بلا حدّ منشور) مجموعة مرئية رابعة الآن لا نتيجة مخفية (§32) --
  // فهي "تطابق" هنا أيضاً؛ التشخيص الحقيقي للفراغ التام هو غياب الأربعة معاً.
  function matchesFilter(o: ExplorerOffering, f: GpaCheckFilters): boolean {
    if (f.province && o.province !== f.province) return false;
    if (university && o.universityName !== university) return false;
    const sessionsToConsider: StudySession[] = f.session === "both" ? ["صباحي", "مسائي"] : [f.session];
    const relevantSessions = sessionsToConsider.filter((s) => o.sessions.includes(s));
    return relevantSessions.length > 0;
  }

  // فارق موحَّد (حكومي بحدّ حقيقي، أو أهلي بشرط معلَن) -- cutoff - grade
  // (موجب = غير مبلوغ بعد). قسم أهلي بلا شرط منشور يُستبعَد من الحساب (Infinity)
  // لأن لا رقم نقارن به أصلاً -- لا نخترعه.
  function reachableOffering(o: ExplorerOffering, grade: number, sess: "صباحي" | "مسائي") {
    if (o.universityType === "أهلية") {
      const min = o.statedMinimumGrade?.value;
      if (min == null) return { ok: false, gap: Infinity };
      return { ok: grade >= min, gap: min - grade };
    }
    if (o.isDirectAdmission) return { ok: true, gap: -Infinity };
    const cutoff = o.averageGrades[sess];
    if (cutoff == null) return { ok: false, gap: Infinity };
    return { ok: grade >= cutoff, gap: cutoff - grade };
  }

  // أقرب الخيارات "الطموحة" بفارقها -- تُستعمَل في بطاقة NO_REACHABLE.
  function nearestByGap(list: ExplorerOffering[], grade: number, limit: number) {
    const sessions: Array<"صباحي" | "مسائي"> = session === "both" ? ["صباحي", "مسائي"] : [session as "صباحي" | "مسائي"];
    return list
      .map((o) => {
        const best = sessions
          .map((s) => reachableOffering(o, grade, s))
          .filter((r) => Number.isFinite(r.gap))
          .sort((a, b) => a.gap - b.gap)[0];
        return best ? { offering: o, gap: best.gap } : null;
      })
      .filter((x): x is { offering: ExplorerOffering; gap: number } => x !== null)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, limit);
  }

  // هل رفع فلتر (محافظة ثم جلسة) يُنتج خياراً مريحاً/متقارباً فعلياً؟ --
  // لا نقترح رفع فلتر بلا wouldYield > 0 (نفس قاعدة diagnoseEmpty في §31).
  function countReachable(f: GpaCheckFilters): number {
    let n = 0;
    for (const o of offerings) {
      if (!matchesFilter(o, f)) continue;
      const sessionsToConsider: StudySession[] = f.session === "both" ? ["صباحي", "مسائي"] : [f.session];
      const relevant = sessionsToConsider.filter((s) => o.sessions.includes(s));
      const band = bestBand(o, f.grade, relevant);
      if (band === "safe" || band === "close") n++;
    }
    return n;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!branch || !grade) return;
    setSearched(true);

    const gradeNum = Number(grade);
    const currentFilters: GpaCheckFilters = { grade: gradeNum, session, province };

    const next: Record<DisplayBand, ExplorerOffering[]> = { safe: [], close: [], unknown: [], reach: [] };
    for (const o of offerings) {
      if (!matchesFilter(o, currentFilters)) continue;
      const sessionsToConsider: StudySession[] = session === "both" ? ["صباحي", "مسائي"] : [session];
      const relevantSessions = sessionsToConsider.filter((s) => o.sessions.includes(s));
      const band = bestBand(o, gradeNum, relevantSessions);
      next[band].push(o);
    }
    // معروف الفرع أولاً داخل كل مجموعة، ثم اسم الجامعة أبجدياً -- لا ترتيب
    // المصدر الخام (كل الحكومي قبل كل الأهلي بنيوياً، يدفن مئات الأقسام
    // الأهلية المعروفة الفرع فعلياً خلف كل الحكومي؛ الأبجدي يوزّعها فعلياً
    // بدل دفنها -- انظر data/admission_rules.md §29).
    for (const band of BAND_ORDER) {
      next[band].sort((a, b) => {
        const knownDiff = Number(b.branchKnown) - Number(a.branchKnown);
        if (knownDiff !== 0) return knownDiff;
        return a.universityName.localeCompare(b.universityName, "ar");
      });
    }
    setGroups(next);

    const total = next.safe.length + next.close.length + next.unknown.length + next.reach.length;
    setEmptyDiagnosis(total === 0 ? diagnoseEmpty(offerings, currentFilters, matchesFilter, reachableOffering) : null);

    // NO_REACHABLE: نتائج موجودة (طموح/بلا حدّ منشور) لكن صفر مريح ومتقارب.
    const reachableCount = next.safe.length + next.close.length;
    if (total > 0 && reachableCount === 0) {
      let relaxable: "province" | "session" | null = null;
      let wouldYield = 0;
      if (province) {
        const n = countReachable({ ...currentFilters, province: "" });
        if (n > 0) {
          relaxable = "province";
          wouldYield = n;
        }
      }
      if (!relaxable && session !== "both") {
        const n = countReachable({ ...currentFilters, session: "both" });
        if (n > 0) {
          relaxable = "session";
          wouldYield = n;
        }
      }
      setNoReachable({
        code: "NO_REACHABLE",
        relaxable,
        wouldYield,
        nearest: nearestByGap(next.reach, gradeNum, 5),
      });
    } else {
      setNoReachable(null);
    }
  }

  function relaxFilter(what: "province" | "session") {
    if (what === "province") setProvince("");
    if (what === "session") setSession("both");
  }

  const totalResults = groups.safe.length + groups.close.length + groups.reach.length;
  const hasUnknownBranch =
    groups.safe.some((o) => !o.branchKnown) ||
    groups.close.some((o) => !o.branchKnown) ||
    groups.reach.some((o) => !o.branchKnown);

  return (
    <div dir="rtl" className="mx-auto max-w-4xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">فاحص المعدل السريع</h1>
        <p className="mt-1 text-ink-soft">أدخل معدّلك وفرعك، وشوف أي قسم يصلك — بلا اختبار وبلا حساب.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass grid gap-4 rounded-3xl p-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block font-bold" htmlFor="branch">
            الفرع الدراسي
          </label>
          <select
            id="branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value as Branch)}
            className="w-full rounded-xl border border-line p-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
          >
            <option value="">اختر الفرع</option>
            <option value="علمي">علمي (إحيائي / تطبيقي)</option>
            <option value="أدبي">أدبي</option>
            <option value="فنون">فنون / إبداع</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block font-bold" htmlFor="grade">
            المعدل (٪)
          </label>
          <input
            id="grade"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="مثال: 78"
            className="w-full rounded-xl border border-line p-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
        </div>

        <div>
          <label className="mb-2 block font-bold" htmlFor="province">
            المحافظة <span className="font-normal text-ink-muted">(اختياري)</span>
          </label>
          <select
            id="province"
            value={province}
            onChange={(e) => handleProvinceChange(e.target.value)}
            disabled={!branch}
            className="w-full rounded-xl border border-line p-3 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
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

        {province && (
          <div>
            <label className="mb-2 block font-bold" htmlFor="university">
              الجامعة <span className="font-normal text-ink-muted">(اختياري)</span>
            </label>
            <select
              id="university"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              className="w-full rounded-xl border border-line p-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">كل جامعات {province}</option>
              {universitiesInProvince.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-2 block font-bold">
            الجلسة الدراسية <span className="font-normal text-ink-muted">(اختياري)</span>
          </label>
          <div className="flex gap-2">
            {([
              { value: "both", label: "كلاهما" },
              { value: "صباحي", label: "صباحي" },
              { value: "مسائي", label: "مسائي" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSession(opt.value)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  session === opt.value
                    ? "bg-primary text-white"
                    : "border border-line text-ink-soft hover:bg-surface-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {EVENING_MIN != null && Number(grade) > 0 && Number(grade) < EVENING_MIN && (
            <p className="mt-2 text-xs text-ink-muted">{eveningFloorNote(EVENING_MIN)}</p>
          )}
        </div>

        <div className="flex items-end sm:col-span-2">
          <button
            type="submit"
            disabled={branchState.status === "loading" || !branch}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold
                       text-white transition-colors hover:bg-primary-700 disabled:opacity-50 sm:w-auto"
          >
            <Search className="h-4 w-4" />
            {branchState.status === "loading" ? "جارٍ التحميل..." : "افحص"}
          </button>
        </div>
      </form>

      {branchState.status === "loading" && <ResultsSkeleton rows={3} />}
      {branchState.status === "error" && <ErrorState error={branchState.error} onRetry={retryFetch} />}

      {searched && branchState.status === "ready" && (
        <>
          <ChannelNotice />

          {totalResults === 0 ? (
            emptyDiagnosis ? (
              <EmptyState diagnosis={emptyDiagnosis} grade={Number(grade)} onRelax={relaxFilter} />
            ) : (
              <p className="text-center text-ink-muted">
                لا توجد أقسام ضمن معدّلك في هذه الفلاتر وفق بيانات {ADMISSION_CHANNEL}. جرّب توسيع الفلاتر أو معدلاً آخر.
              </p>
            )
          ) : (
            <div className="space-y-4">
              {hasUnknownBranch && (
                <p className="rounded-xl border border-line bg-surface-muted p-3 text-xs text-ink-muted">
                  {BRANCH_UNKNOWN_NOTE}
                </p>
              )}
              {(["safe", "close", "reach"] as const).map((band) => {
                const list = groups[band];
                if (list.length === 0) return null;
                const ui = BAND_UI[band];
                return (
                  <details key={band} className="group rounded-md border border-line bg-surface p-5" open={band === "safe"}>
                    <summary className="flex cursor-pointer list-none items-center gap-3 font-extrabold text-ink">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${ui.bg} ${ui.text}`}>
                        {ui.label}
                      </span>
                      {list.length.toLocaleString("ar-IQ")} قسماً
                    </summary>
                    <div className="mt-4">
                      <PaginatedOfferingsTable offerings={list} />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
        <p>
          هذه نتيجة استرشادية إحصائية، وليست قراراً رسمياً للقبول. الجهة الرسمية الوحيدة المعتمدة للتقديم والقبول
          الجامعي هي{" "}
          <a
            href="https://cap.mohesr.gov.iq"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary hover:underline"
          >
            القبول المركزي التابع لوزارة التعليم العالي والبحث العلمي
          </a>
          — راجعها دائماً قبل اتخاذ قرارك النهائي.
        </p>
      </div>
    </div>
  );
}
