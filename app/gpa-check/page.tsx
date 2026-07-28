"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import { fetchOfferingsForBranch, toUniversityOffering, type Branch, type ExplorerOffering } from "../../lib/offeringsClient";
import { classifyOffering } from "../../lib/wishlistPlanner";
import type { Band, StudySession } from "../../lib/wishlistPlanner";
import PaginatedOfferingsTable from "../components/PaginatedOfferingsTable";

const BAND_UI: Record<"safe" | "close" | "reach", { label: string; bg: string; text: string }> = {
  safe: { label: "مريح", bg: "bg-band-safe-bg", text: "text-band-safe" },
  close: { label: "متقارب", bg: "bg-band-close-bg", text: "text-band-close" },
  reach: { label: "طموح", bg: "bg-band-reach-bg", text: "text-band-reach" },
};

/** أفضل تصنيف بين كل جلسات العرض (المباشر مريح دائماً بصرف النظر عن الجلسات). */
function bestBand(offering: ExplorerOffering, grade: number): Band {
  if (offering.isDirectAdmission) return "safe";
  const full = toUniversityOffering(offering);
  const order: Band[] = ["safe", "close", "reach", "unknown"];
  let best: Band = "unknown";
  for (const session of offering.sessions as StudySession[]) {
    const { band } = classifyOffering({ majorId: "", majorName: "", session, offering: full }, grade);
    if (order.indexOf(band) < order.indexOf(best)) best = band;
  }
  return best;
}

export default function GpaCheckPage() {
  const [branch, setBranch] = useState<Branch | "">("");
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [groups, setGroups] = useState<Record<"safe" | "close" | "reach", ExplorerOffering[]>>({
    safe: [],
    close: [],
    reach: [],
  });

  // تعبئة تلقائية من نتيجة اختبار سابقة إن وُجدت -- قابلة للتعديل، وليست إلزامية.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("filterSettings");
      if (saved) {
        const fs = JSON.parse(saved);
        if (fs.branch) setBranch(fs.branch);
        if (fs.grade) setGrade(String(fs.grade));
      }
    } catch {
      // بيانات تالفة -- تُترَك الحقول فارغة.
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!branch || !grade) return;
    setLoading(true);
    setSearched(true);
    const offerings = await fetchOfferingsForBranch(branch);
    const gradeNum = Number(grade);
    const next: Record<"safe" | "close" | "reach", ExplorerOffering[]> = { safe: [], close: [], reach: [] };
    for (const o of offerings) {
      const band = bestBand(o, gradeNum);
      if (band === "safe" || band === "close" || band === "reach") next[band].push(o);
    }
    setGroups(next);
    setLoading(false);
  }

  const totalResults = groups.safe.length + groups.close.length + groups.reach.length;

  return (
    <div dir="rtl" className="mx-auto max-w-4xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">فاحص المعدل السريع</h1>
        <p className="mt-1 text-ink-soft">أدخل معدّلك وفرعك، وشوف أي قسم يصلك — بلا اختبار وبلا حساب.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass grid gap-4 rounded-3xl p-6 sm:grid-cols-[1fr_1fr_auto]">
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

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold
                       text-white transition-colors hover:bg-primary-700 disabled:opacity-50 sm:w-auto"
          >
            <Search className="h-4 w-4" />
            {loading ? "جارٍ الفحص..." : "افحص"}
          </button>
        </div>
      </form>

      {searched && !loading && (
        <>
          {totalResults === 0 ? (
            <p className="text-center text-ink-muted">
              لا توجد أقسام يبلغها هذا المعدل ضمن فرع {branch} حالياً. جرّب معدلاً آخر أو راجع النتيجة.
            </p>
          ) : (
            <div className="space-y-4">
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
