"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, Info, Plus, Sparkles } from "lucide-react";
import majorsData from "../../data/majors.json";
import { BRANCH_CATEGORY_MAP, fetchOfferingsForMajor } from "../../lib/offeringsClient";
import { computeEligibility } from "../../lib/eligibility";
import { analyzeWishlist } from "../../lib/wishlistPlanner";
import type { AlternativeCandidate, ClassifiedWish, StudySession, WishOffering } from "../../lib/wishlistPlanner";
import type { UniversityOffering } from "../../lib/majorMatcher";
import WishRow from "../components/WishRow";
import { ChannelNotice } from "../components/ChannelNotice";
import { CUTOFFS_YEAR } from "../../lib/admissionDisclosure";

const WISHLIST_STORAGE_KEY = "wishlistPlan";

interface FilterSettings {
  province: string;
  branch: string;
  grade: number;
}

function wishKey(w: WishOffering): string {
  return `${w.offering.universityId}|${w.offering.collegeId}|${w.offering.departmentName}|${w.session}`;
}

const DIAGNOSTIC_UI: Record<string, { icon: typeof AlertCircle; bg: string; border: string; text: string }> = {
  danger: { icon: AlertCircle, bg: "bg-band-reach-bg", border: "border-band-reach/30", text: "text-band-reach" },
  warning: { icon: AlertTriangle, bg: "bg-band-close-bg", border: "border-band-close/30", text: "text-band-close" },
  info: { icon: Info, bg: "bg-primary-50", border: "border-primary-200", text: "text-primary-800" },
};

export default function WishlistPage() {
  const [filterSettings, setFilterSettings] = useState<FilterSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const [selectedMajorId, setSelectedMajorId] = useState<string>("");
  const [majorOfferings, setMajorOfferings] = useState<UniversityOffering[]>([]);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false);

  const [wishlist, setWishlist] = useState<WishOffering[]>([]);

  const [suggestedSafe, setSuggestedSafe] = useState<ClassifiedWish[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsRequested, setSuggestionsRequested] = useState(false);

  // ── تحميل إعدادات الطالب (من نتيجة اختبار سابقة) وقائمة الرغبات المحفوظة ──
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem("filterSettings");
      if (savedFilters) setFilterSettings(JSON.parse(savedFilters));
      const savedWishlist = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (savedWishlist) setWishlist(JSON.parse(savedWishlist));
    } catch {
      // بيانات تالفة -- نتجاهلها بصمت، الحقول تبقى فارغة.
    }
    setIsLoadingSettings(false);
  }, []);

  // ── حفظ قائمة الرغبات في localStorage عند أي تغيير ──
  useEffect(() => {
    if (isLoadingSettings) return; // تفادي الكتابة فوق بيانات محفوظة قبل تحميلها فعلياً
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
  }, [wishlist, isLoadingSettings]);

  // ── جلب عروض التخصص المختار ──
  useEffect(() => {
    if (!selectedMajorId) {
      setMajorOfferings([]);
      return;
    }
    let cancelled = false;
    setIsLoadingOfferings(true);
    fetchOfferingsForMajor(selectedMajorId).then((offerings) => {
      if (!cancelled) {
        setMajorOfferings(offerings);
        setIsLoadingOfferings(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedMajorId]);

  const chosenKeys = useMemo(() => new Set(wishlist.map(wishKey)), [wishlist]);

  // diagnostics/counts/wishes لا تعتمد على بدائل مريحة إطلاقاً -- تُحسَب فوراً
  // من القائمة نفسها فقط. suggestedSafe المعروضة أدناه حقل منفصل تماماً،
  // مُحسوبة عند الطلب فقط عبر loadSuggestions() (بحث في عشرات التخصصات
  // المؤهَّلة لفرع الطالب، مكلف بما يكفي لتفادي حسابه تلقائياً بلا طلب).
  const analysis = useMemo(() => {
    if (!filterSettings) return null;
    return analyzeWishlist(wishlist, filterSettings.grade);
  }, [wishlist, filterSettings]);

  const diagnostics = analysis?.diagnostics ?? [];
  const counts = analysis?.counts ?? { safe: 0, close: 0, reach: 0, unknown: 0 };
  const classifiedWishes = analysis?.wishes ?? [];

  async function loadSuggestions() {
    if (!filterSettings) return;
    setSuggestionsRequested(true);
    setIsLoadingSuggestions(true);
    const allowedCats = BRANCH_CATEGORY_MAP[filterSettings.branch] || [];
    const candidateMajors = majorsData.filter((m) => allowedCats.includes(m.category));
    const results = await Promise.all(
      candidateMajors.map(async (m) => {
        const offerings = await fetchOfferingsForMajor(m.id);
        const eligibility = computeEligibility(filterSettings.branch, filterSettings.grade, offerings);
        if (!eligibility.branchEligible) return null;
        const candidate: AlternativeCandidate = { majorId: m.id, majorName: m.name, offerings };
        return candidate;
      })
    );
    const candidates = results.filter((c): c is AlternativeCandidate => c !== null);
    const result = analyzeWishlist(wishlist, filterSettings.grade, candidates);
    setSuggestedSafe(result.suggestedSafe);
    setIsLoadingSuggestions(false);
  }

  function addWish(offering: UniversityOffering, session: StudySession) {
    const major = majorsData.find((m) => m.id === selectedMajorId);
    if (!major) return;
    const wish: WishOffering = { majorId: major.id, majorName: major.name, session, offering };
    if (chosenKeys.has(wishKey(wish))) return;
    setWishlist((prev) => [...prev, wish]);
  }

  function addSuggested(w: ClassifiedWish) {
    const wish: WishOffering = { majorId: w.majorId, majorName: w.majorName, session: w.session, offering: w.offering };
    if (chosenKeys.has(wishKey(wish))) return;
    setWishlist((prev) => [...prev, wish]);
  }

  function moveWish(index: number, dir: -1 | 1) {
    setWishlist((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeWish(index: number) {
    setWishlist((prev) => prev.filter((_, i) => i !== index));
  }

  if (isLoadingSettings) {
    return <div className="py-20 text-center text-ink-muted">جارٍ التحميل...</div>;
  }

  if (!filterSettings) {
    return (
      <div className="text-center py-20 space-y-4">
        <h1 className="text-2xl font-bold">أكمل الاختبار أولاً</h1>
        <p className="text-ink-soft">مخطّط الرغبات يحتاج معدلك وفرعك الدراسي لتصنيف كل رغبة بدقة.</p>
        <Link href="/quiz" className="text-primary font-bold hover:underline inline-block">
          بدء الاختبار الآن
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8" dir="rtl">
      <div>
        <h1 className="text-3xl font-black text-ink">مخطّط الرغبات</h1>
        <p className="text-ink-soft mt-1">
          رتّب رغباتك الجامعية كما تفعل فعلياً في نظام القبول المركزي، واعرف فوراً أين أنت مريح وأين أنت طموح.
        </p>
      </div>

      <ChannelNotice />

      {/* ── إضافة رغبة جديدة ── */}
      <div className="glass p-6 rounded-3xl space-y-4">
        <h2 className="text-xl font-bold text-ink">أضف رغبة</h2>
        <select
          value={selectedMajorId}
          onChange={(e) => setSelectedMajorId(e.target.value)}
          className="w-full p-3 border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">اختر تخصصاً لعرض عروضه...</option>
          {majorsData.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.category}
            </option>
          ))}
        </select>

        {isLoadingOfferings && <p className="text-sm text-ink-muted">جارٍ جلب العروض...</p>}

        {!isLoadingOfferings && selectedMajorId && majorOfferings.length === 0 && (
          <p className="text-sm text-ink-muted">لا توجد عروض حقيقية لهذا التخصص.</p>
        )}

        {!isLoadingOfferings && majorOfferings.length > 0 && (
          <ul className="max-h-96 overflow-y-auto space-y-2">
            {majorOfferings.map((o, idx) => (
              <li
                key={idx}
                className="flex flex-wrap items-center justify-between gap-3 border border-line rounded-xl p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-bold text-ink truncate">
                    {o.universityName} — {o.collegeName}
                  </p>
                  <p className="text-ink-soft truncate">
                    {o.departmentName} · {o.province} · {o.universityType}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {(o.sessions as StudySession[]).map((session) => {
                    const alreadyAdded = chosenKeys.has(
                      `${o.universityId}|${o.collegeId}|${o.departmentName}|${session}`
                    );
                    const grade = o.averageGrades[session];
                    return (
                      <button
                        key={session}
                        disabled={alreadyAdded}
                        onClick={() => addWish(o, session)}
                        className="flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-3 py-1.5 font-bold
                                   hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {session} {o.isDirectAdmission ? "(مباشر)" : grade !== null ? `${grade}%` : ""}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── قائمة الرغبات المرتَّبة ── */}
      <div className="glass p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-bold text-ink">رغباتك ({wishlist.length})</h2>
          <div className="flex gap-3 text-sm font-bold">
            <span className="text-band-safe">مريح: {counts.safe}</span>
            <span className="text-band-close">متقارب: {counts.close}</span>
            <span className="text-band-reach">طموح: {counts.reach}</span>
            <span className="text-band-unknown">غير معروف: {counts.unknown}</span>
          </div>
        </div>

        {classifiedWishes.length === 0 ? (
          <p className="text-sm text-ink-muted">لم تضف أي رغبة بعد.</p>
        ) : (
          <ul className="space-y-2">
            {classifiedWishes.map((w, idx) => (
              <WishRow
                key={wishKey(w)}
                wish={w}
                index={idx}
                onUp={() => moveWish(idx, -1)}
                onDown={() => moveWish(idx, 1)}
                onRemove={() => removeWish(idx)}
              />
            ))}
          </ul>
        )}

        {/* ── التشخيصات ── */}
        {diagnostics.length > 0 && (
          <div className="space-y-2 pt-2">
            {diagnostics.map((d, i) => {
              const ui = DIAGNOSTIC_UI[d.level];
              const Icon = ui.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 ${ui.bg} border ${ui.border} ${ui.text} p-3 rounded-xl text-sm`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{d.message}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── بدائل مريحة مقترحة ── */}
      <div className="glass p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            بدائل مريحة مقترحة
          </h2>
          <button
            onClick={loadSuggestions}
            disabled={isLoadingSuggestions}
            className="text-sm font-bold text-primary hover:underline disabled:opacity-50"
          >
            {isLoadingSuggestions ? "جارٍ البحث..." : "اقترح لي بدائل"}
          </button>
        </div>
        <p className="text-sm text-ink-soft">
          يبحث في كل التخصصات المؤهَّل لها فرعك عن عروض تبلغها معدلك بارتياح، ولم تُضِفها بعد.
        </p>
        {suggestionsRequested && !isLoadingSuggestions && suggestedSafe.length === 0 && (
          <p className="text-sm text-ink-muted">لم نجد بدائل مريحة إضافية غير المُضافة فعلاً.</p>
        )}
        {suggestedSafe.length > 0 && (
          <ul className="space-y-2">
            {suggestedSafe.map((w) => (
              <li
                key={wishKey({ majorId: w.majorId, majorName: w.majorName, session: w.session, offering: w.offering })}
                className="flex flex-wrap items-center justify-between gap-3 border border-band-safe/30 bg-band-safe-bg rounded-xl p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-bold text-ink truncate">
                    {w.majorName} — {w.offering.universityName}
                  </p>
                  <p className="text-ink-soft truncate">
                    {w.offering.departmentName} · {w.offering.province} · {w.session}
                  </p>
                </div>
                <button
                  onClick={() => addSuggested(w)}
                  className="flex items-center gap-1 rounded-lg bg-band-safe text-white px-3 py-1.5 font-bold shrink-0
                             hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
