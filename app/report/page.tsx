"use client";
import React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { ArrowRight, TrendingUp, DollarSign, Briefcase, AlertCircle, Download, AlertTriangle, X } from "lucide-react";
import majorsData from "../../data/majors.json";
import universitiesMeta from "../../data/universities_meta.json";
import questionsData from "../../data/questions.json";
import riasecProfilesData from "../../data/major_riasec_profiles.json";
import { rankUniversityOfferings } from "../../lib/majorMatcher";
import type { UniversityOffering } from "../../lib/majorMatcher";
import {
  computeUserRiasecVector,
  computeMajorFit,
  computeDimensionGaps,
  RIASEC_LABELS,
  RIASEC_DIMENSIONS,
} from "../../lib/riasec";
import { computeEligibility } from "../../lib/eligibility";
import personalityTranslationsData from "../../data/personality_translations.json";
import { fetchMajorProfile, type DetailedMajorProfile } from "../../lib/majorProfileClient";
import EmptyState from "../components/EmptyState";
import UniversitiesTable from "../components/UniversitiesTable";
import { RadarChart } from "../components/RadarChart";
import { BRANCH_CATEGORY_MAP, fetchOfferingsForMajor } from "../../lib/offeringsClient";
import { ChannelNotice } from "../components/ChannelNotice";
import { CHANNEL_NOTICE_PLAIN, CUTOFFS_YEAR } from "../../lib/admissionDisclosure";
import { admissionCell } from "../../lib/admissionLabel";

// محاور مخطط الرادار -- ثابتة، مُشتقّة من نفس تسميات RIASEC المستخدَمة في
// بقية الصفحة، كي يبقى المخطط والجدول النصي متّسقين دائماً بلا تكرار يدوي.
const RADAR_AXES = RIASEC_DIMENSIONS.map((d) => ({ key: d, label: RIASEC_LABELS[d] }));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Skeleton Loading Components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-slate-200 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8">
      {/* رأس */}
      <div className="glass p-8 rounded-3xl space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-3 flex-1">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-10 w-64" />
            <Shimmer className="h-4 w-40" />
          </div>
          <Shimmer className="h-14 w-36 rounded-2xl" />
        </div>
        <div className="grid md:grid-cols-2 gap-6 pt-4">
          <Shimmer className="h-24 rounded-2xl" />
          <Shimmer className="h-24 rounded-2xl" />
        </div>
      </div>

      {/* تحليل */}
      <div className="glass p-8 rounded-3xl space-y-4">
        <Shimmer className="h-6 w-48 mb-4" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3 bg-white p-4 rounded-xl">
            <Shimmer className="h-3 w-3 rounded-full mt-1 shrink-0" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>

      {/* جامعات */}
      <div className="space-y-4">
        <Shimmer className="h-8 w-56" />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Shimmer key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Shimmer key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Data Freshness Alert
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DataFreshnessAlert() {
  const [show, setShow] = useState(false);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    // يُقرأ من data/universities_meta.json (نسخة صغيرة من meta فقط، وليس ملف
    // universities.json الكامل 2+ ميجابايت -- انظر scripts/build-major-offerings.js)
    // بدل تاريخ ثابت مكتوب يدوياً هنا -- كان يُنسى تحديثه مع كل تحديث بيانات فعلي
    // فيُظهر (أو يُخفي) التنبيه بلا علاقة بحداثة البيانات الحقيقية.
    const updated = new Date((universitiesMeta as { lastUpdated: string }).lastUpdated);
    const days = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
    if (days >= 365) {
      setIsStale(true);
      setShow(true);
    } else if (days >= 180) {
      setIsStale(false);
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm mb-6 ${
        isStale ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"
      }`}
      role="alert"
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1">
        {isStale
          ? "⚠️ تنبيه: بيانات الجامعات ومعدلات القبول قد لا تكون محدّثة لهذا العام. يُنصح بمراجعة موقع الجامعة الرسمي للتأكد."
          : "ℹ️ ملاحظة: آخر تحديث للبيانات كان منذ أكثر من 6 أشهر. التوصيات دقيقة لكن ننصح بمتابعة إعلانات الجامعات."}
      </p>
      <button
        onClick={() => setShow(false)}
        aria-label="إغلاق"
        className="shrink-0 hover:opacity-60 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// دالة تصدير PDF
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function exportPDF(data: {
  majorName: string;
  category: string;
  demandText: string;
  points: string[];
  universities: Array<{
    uniName: string;
    uniType: string;
    collegeName: string;
    departmentName: string;
    location: string;
    morningGrade: number | null;
    hasMorning: boolean;
    eveningGrade: number | null;
    hasEvening: boolean;
    isDirectAdmission: boolean;
    statedMinimumGrade: { value: number } | null;
  }>;
}) {
  const uniRows = data.universities
    .map((u) => {
      const morning = admissionCell(u.uniType, u.hasMorning, u.isDirectAdmission, u.morningGrade, u.statedMinimumGrade);
      const evening = admissionCell(u.uniType, u.hasEvening, u.isDirectAdmission, u.eveningGrade, u.statedMinimumGrade);
      return `
      <tr>
        <td>${u.uniName}</td>
        <td>${u.uniType}</td>
        <td>${u.location}</td>
        <td>${u.collegeName}</td>
        <td>${u.departmentName}</td>
        <td>${morning.text}</td>
        <td>${evening.text}</td>
      </tr>`;
    })
    .join("");

  const pointsList = data.points.map((p) => `<li style="margin-bottom:8px;line-height:1.6">${p}</li>`).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير التوجيه الجامعي – ${data.majorName}</title>
  <style>
    @page { size: A4; margin: 18mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; font-size: 11pt; color: #1e293b; direction: rtl; }
    .header { background: linear-gradient(135deg,#0d9488,#115e59); color: white; padding: 18px 22px; border-radius: 10px; margin-bottom: 18px; display:flex; justify-content:space-between; align-items:center; }
    .header-title { font-size: 18pt; font-weight: 700; }
    .info-cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 18px; }
    .info-card { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; text-align: center; }
    .info-card .label { font-size: 9pt; color: #64748b; margin-bottom: 3px; }
    .info-card .value { font-size: 12pt; font-weight: 700; color: #0d9488; }
    .section-title { font-size: 12pt; font-weight: 700; color: #0d9488; margin: 16px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #ccfbf1; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th { background: #f1f5f9; padding: 7px 9px; text-align: right; font-weight: 600; color: #475569; border: 1px solid #e2e8f0; }
    td { padding: 6px 9px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    ul { padding-right: 18px; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #94a3b8; display:flex; justify-content:space-between; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">تقرير التوجيه الجامعي</div>
      <div style="font-size:10pt;opacity:.85;margin-top:3px">تخصص: ${data.majorName} — ${data.category}</div>
    </div>
    <div style="font-size:9pt;opacity:.7;text-align:left">${new Date().toLocaleDateString("ar-IQ", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>

  <div class="info-cards">
    <div class="info-card"><div class="label">التخصص</div><div class="value">${data.majorName}</div></div>
    <div class="info-card"><div class="label">الطلب في السوق</div><div class="value" style="font-size:10pt">${data.demandText}</div></div>
  </div>

  <div class="section-title">📊 تحليل التوافق</div>
  <ul>${pointsList}</ul>

  ${
    data.universities.length > 0
      ? `
  <div class="section-title">🏛️ الجامعات والكليات الموصى بها</div>
  <p style="font-size:9pt;color:#64748b;margin-bottom:8px;line-height:1.5">${CHANNEL_NOTICE_PLAIN}</p>
  <table>
    <thead><tr><th>الجامعة</th><th>النوع</th><th>المحافظة</th><th>الكلية</th><th>القسم</th><th>صباحي (${CUTOFFS_YEAR})</th><th>مسائي (${CUTOFFS_YEAR})</th></tr></thead>
    <tbody>${uniRows}</tbody>
  </table>`
      : ""
  }

  <div class="footer">
    <span>منصة التوجيه الجامعي – العراق</span>
    <span>هذا التقرير استرشادي — يُنصح بمراجعة مختص للتوجيه الأكاديمي</span>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// المحتوى الرئيسي للتقرير
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ReportContent() {
  const searchParams = useSearchParams();
  const majorId = searchParams.get("major");

  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [filterSettings, setFilterSettings] = useState<any>(null);
  const [offeringsByMajor, setOfferingsByMajor] = useState<Record<string, UniversityOffering[]>>({});
  const [detailedProfileState, setDetailedProfileState] = useState<DetailedMajorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // بيانات localStorage قد تكون تالفة (حصة تخزين ممتلئة، تعديل يدوي، أو
      // تغيّر شكل البيانات بعد تحديث للموقع بينما لا تزال بيانات جلسة قديمة
      // محفوظة عند المستخدم) — بلا try/catch هنا كان أي خطأ JSON.parse يسقط
      // حتى ErrorBoundary العام ويستبدل الصفحة بأكملها برسالة خطأ عامة، بدل
      // معاملة الحالة كما لو لم يُكمل المستخدم الاختبار أصلاً (حالة مُعالَجة
      // فعلاً أدناه).
      let ua: Record<string, number> = {};
      let qr: any[] = [];
      let fs: any = null;
      try {
        const savedAnswers = localStorage.getItem("userAnswers");
        const savedResults = localStorage.getItem("quizResults");
        const savedFilters = localStorage.getItem("filterSettings");
        if (savedAnswers) ua = JSON.parse(savedAnswers);
        if (savedResults) qr = JSON.parse(savedResults);
        if (savedFilters) fs = JSON.parse(savedFilters);
      } catch {
        // نتجاهل البيانات التالفة بصمت — الحقول تبقى بقيمها الافتراضية
        // (نتائج فارغة) فتُعرض شاشة "لم تكمل الاختبار" الطبيعية أدناه.
      }
      if (cancelled) return;
      setUserAnswers(ua);
      setQuizResults(qr);
      setFilterSettings(fs);

      // ── جلب عروض الجامعات فقط للتخصصات المعروضة فعلياً في هذه الصفحة ──
      // (التخصص الأساسي + حتى 3 توصيات) بدل تحميل بيانات كل التخصصات الـ88
      // دفعة واحدة. هذا هو صلب حل مشكلة حجم الحزمة (PROJECT.md §7 بند 1).
      const resolvedMajor = majorsData.find((m) => m.id === majorId) || qr[0];
      if (resolvedMajor) {
        const topIds = (qr?.length > 0 ? qr.slice(0, 3) : [resolvedMajor]).map((m: any) => m.id);
        const neededIds = Array.from(new Set<string>([resolvedMajor.id, ...topIds]));
        const [fetched, profile] = await Promise.all([
          Promise.all(neededIds.map((id) => fetchOfferingsForMajor(id))),
          fetchMajorProfile(resolvedMajor.id),
        ]);
        if (!cancelled) setDetailedProfileState(profile);
        const offMap: Record<string, UniversityOffering[]> = {};
        neededIds.forEach((id, i) => {
          offMap[id] = fetched[i];
        });

        // إن كان التخصص الأساسي غير مؤهَّل بالفرع أو بلا أي عرض يبلغه معدل
        // الطالب فعلاً، نحتاج بدائل محسوبة من كامل فئات فرعه (TASKS.md المهمة
        // ٣) -- نجلب عروضها الآن أيضاً بالتوازي، بدل جلب كل شيء مسبقاً بلا
        // داعٍ في الحالة الشائعة (طالب مؤهَّل، لا حاجة لأي بديل).
        if (fs) {
          const primaryOfferings = offMap[resolvedMajor.id] || [];
          const primaryEligibility = computeEligibility(fs.branch, fs.grade, primaryOfferings);
          if (!primaryEligibility.branchEligible || primaryEligibility.reachableOffers.length === 0) {
            const allowedCats = BRANCH_CATEGORY_MAP[fs.branch] || [];
            const candidateIds = majorsData
              .filter((m) => allowedCats.includes(m.category) && !neededIds.includes(m.id))
              .map((m) => m.id);
            const fetchedMore = await Promise.all(candidateIds.map((id) => fetchOfferingsForMajor(id)));
            candidateIds.forEach((id, i) => {
              offMap[id] = fetchedMore[i];
            });
          }
        }

        if (!cancelled) setOfferingsByMajor(offMap);
      }

      if (!cancelled) setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [majorId]);

  // ── Skeleton أثناء التحميل ──
  if (isLoading) return <ReportSkeleton />;

  const major = majorsData.find((m) => m.id === majorId) || quizResults[0];

  if (!major) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold">التخصص غير موجود أو لم تكمل الاختبار</h1>
        <Link href="/quiz" className="text-primary mt-4 inline-block hover:underline font-bold">
          بدء الاختبار الآن
        </Link>
      </div>
    );
  }

  // ── دوال مساعدة ──
  // حُذفت getSalaryRange (كانت تشتق مدى راتب بالدينار من marketMultiplier
  // بلا أي مصدر رسمي أو سنة أو منهجية -- تخمين مركّب على تخمين، والفارق بين
  // طرفي المدى يبلغ الضِعف فلا قيمة قرارية له أصلاً. انظر TASKS.md المهمة ١.
  const getDemandLevel = (multiplier: number) => {
    if (multiplier >= 1.4) return { text: "مرتفع جداً", color: "text-emerald-600", bg: "bg-emerald-100" };
    if (multiplier >= 1.2) return { text: "مرتفع", color: "text-blue-600", bg: "bg-blue-100" };
    if (multiplier >= 1.0) return { text: "متوسط", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { text: "منخفض/متشبع", color: "text-red-600", bg: "bg-red-100" };
  };

  const primaryMajor = major;
  // مجالات العمل الحقيقية (لا نصاً عاماً واحداً يُعرَض لكل تخصص بصرف النظر
  // عن واقعه -- اكتُشف أنه يذكر "الشركات الأجنبية العاملة في العراق" حتى
  // لتخصصات لا وجود واقعي لهذا القطاع فيها، مثل طب الأسنان). يُستخدَم القطاع
  // الحقيقي الموثَّق من major_profiles_detailed.json إن وُجد لهذا التخصص،
  // وإلا عبارة محايدة لا تدّعي قطاعاً بعينه بلا مصدر.
  const detailedProfile = detailedProfileState;
  const employerSectorsText = detailedProfile?.career?.employerSectors?.length
    ? detailedProfile.career.employerSectors.join("، ")
    : "القطاعين الحكومي والخاص، حسب طبيعة التخصص ومتطلبات ممارسته المهنية.";
  // راتب القطاع الحكومي الاسمي الأساسي فقط (موحّد حسب الشهادة لا التخصص،
  // انظر scripts/merge-major-research.js) -- لا رقم للقطاع الخاص لعدم توفر
  // بيانات رواتب موثّقة المصدر له في العراق حالياً.
  const govSalary = detailedProfile?.career?.governmentBaseSalary ?? null;
  const demand = getDemandLevel(primaryMajor?.marketMultiplier ?? 0);

  // ── الجامعات ومطابقة التخصصات ──
  // إن لم توجد أي عروض ضمن محافظة الطالب تحديداً، نُعيد البحث وطنياً بدل
  // إظهار صفحة فارغة فوراً — كثير من التخصصات (خصوصاً النادرة جغرافياً)
  // متاحة فعلاً في محافظات أخرى، والطالب يستفيد من رؤيتها مع توضيح أنها
  // خارج محافظته، بدل رسالة "لم نجد شيئاً" رغم وجود خيارات حقيقية في العراق.
  const primaryOfferingsNational = offeringsByMajor[primaryMajor.id] || [];
  let offerings = filterSettings?.province
    ? primaryOfferingsNational.filter((o) => o.province === filterSettings.province)
    : primaryOfferingsNational;
  let isNationalFallback = false;
  if (offerings.length === 0 && filterSettings?.province) {
    offerings = primaryOfferingsNational;
    isNationalFallback = offerings.length > 0;
  }
  const ranked = rankUniversityOfferings(offerings);
  const offeringPublic = ranked.filter((o) => o.universityType === "حكومية");
  const offeringPrivate = ranked.filter((o) => o.universityType === "أهلية");
  const hasOfferings = offeringPublic.length > 0 || offeringPrivate.length > 0;
  if (!hasOfferings) {
    return <EmptyState message="لم نجد جامعات تطبق هذا التخصص، لا في محافظتك ولا وطنياً" />;
  }

  // ── تحليل التوافق القائم على نموذج RIASEC ──
  const userRiasecVector = computeUserRiasecVector(userAnswers, questionsData);
  const riasecProfiles = riasecProfilesData.profiles as Record<string, Partial<Record<string, number>>>;

  // ── بوّابة الأهلية كقرار قاطع (TASKS.md المهمة ٣) ──
  // قبول الفرع شرط إداري قاطع (نعم/لا)، لا توافقاً متدرّجاً. تُحسَب على كل
  // عروض التخصص (لا فقط المحافظة المُفلترة) كي لا يُخلَط "غير موجود بمحافظتك"
  // مع "فرعك لا يقبله إطلاقاً" — سؤالان مختلفان تماماً.
  const eligibility = filterSettings ? computeEligibility(filterSettings.branch, filterSettings.grade, ranked) : null;

  // بدائل محسوبة عند عدم الأهلية أو عدم بلوغ أي عرض فعلياً -- لا نعرض تحذيراً
  // بلا مخرج ملموس. تُحسَب من كامل بنك التخصصات (لا الثلاثة المُقترَحة فقط)
  // ضمن فروع الطالب المؤهَّل لها فعلياً، مرتّبة بالتوافق الشخصي.
  const computeNearestAlternatives = (excludeMajorId: string, limit = 3) => {
    if (!filterSettings) return [];
    const allowedCats = BRANCH_CATEGORY_MAP[filterSettings.branch] || [];
    const candidates = majorsData
      .filter((m) => m.id !== excludeMajorId && allowedCats.includes(m.category))
      .map((m) => {
        const profile = riasecProfiles[m.id] ?? {};
        const fitPercent = computeMajorFit(userRiasecVector, profile);
        const mOfferings = offeringsByMajor[m.id] || [];
        const mEligibility = computeEligibility(filterSettings.branch, filterSettings.grade, mOfferings);
        return { major: m, fitPercent, eligibility: mEligibility };
      })
      .filter((c) => c.eligibility.branchEligible && c.eligibility.reachableOffers.length > 0)
      .sort((a, b) => b.fitPercent - a.fitPercent);
    return candidates.slice(0, limit);
  };
  const nearestAlternatives =
    eligibility && (!eligibility.branchEligible || eligibility.reachableOffers.length === 0)
      ? computeNearestAlternatives(primaryMajor.id)
      : [];

  const generateAnalysisForMajor = (
    majorObj: any
  ): {
    points: string[];
    branchEligible: boolean;
    dimensionGaps: ReturnType<typeof computeDimensionGaps>;
    profile: Partial<Record<string, number>>;
    alignedDimensions: { d: string; userScore: number; majorScore: number }[];
  } => {
    const points: string[] = [];
    const profile = riasecProfiles[majorObj.id] ?? {};
    const fitPercent = majorObj.fitPercent ?? computeMajorFit(userRiasecVector, profile);
    // كل الأبعاد الستة مع فارقها، لا أعلى بُعدين فقط (TASKS.md المهمة ٤).
    const dimensionGaps = computeDimensionGaps(userRiasecVector, profile);

    // أفضل قسم حكومي حقيقي لهذا التخصص تحديداً (لا تخصص الصفحة الأساسي
    // فقط) — نحتاجه لمقارنة معدل الطالب الفعلي بالحد الأدنى الحقيقي، بدل
    // رسالة عامة "معدلك مناسب" لا تُقارَن بأي رقم فعلي.
    const majorOfferingsNational = offeringsByMajor[majorObj.id] || [];
    const majorOfferings = filterSettings?.province
      ? majorOfferingsNational.filter((o) => o.province === filterSettings.province)
      : majorOfferingsNational;
    const majorBestPublic = rankUniversityOfferings(majorOfferings).find((o) => o.universityType === "حكومية");
    const requiredGrade = majorBestPublic?.averageGrades?.["صباحي"] ?? null;

    // بوّابة الأهلية على مستوى العراق كله (لا محافظة الطالب فقط) -- سؤال
    // "هل فرعي مقبول لهذا التخصص إطلاقاً؟" وطني بطبيعته، منفصل عن سؤال
    // "أي جامعة قريبة مني" (TASKS.md المهمة ٣).
    const nationalOfferings = majorOfferingsNational;
    const majorEligibility = filterSettings
      ? computeEligibility(filterSettings.branch, filterSettings.grade, nationalOfferings)
      : null;

    // أقوى الأبعاد المشتركة بين شخصية الطالب ومتطلبات هذا التخصص تحديداً
    const alignedDimensions = RIASEC_DIMENSIONS.map((d) => ({
      d,
      userScore: userRiasecVector[d] ?? 0,
      majorScore: (profile[d] ?? 0) * 10,
    }))
      .filter((x) => x.userScore >= 55 && x.majorScore >= 55)
      .sort((a, b) => Math.min(b.userScore, b.majorScore) - Math.min(a.userScore, a.majorScore));

    points.push(
      `نسبة التوافق الشخصي بينك وبين هذا التخصص هي ${Math.round(fitPercent)}%، بناءً على مقارنة سماتك بمتطلبات التخصص الفعلية.`
    );

    if (alignedDimensions.length > 0) {
      const names = alignedDimensions
        .slice(0, 2)
        .map((x) => RIASEC_LABELS[x.d])
        .join(" و");
      points.push(`اخترنا لك هذا التخصص لأن سماتك في البُعد ${names} تتوافق بقوة مع متطلبات العمل فيه.`);
    }

    // تنبيه عند وجود فجوة واضحة بين سمة يحتاجها التخصص بشدة وسمة الطالب فيها ضعيفة
    const gapDimension = RIASEC_DIMENSIONS.map((d) => ({
      d,
      userScore: userRiasecVector[d] ?? 0,
      majorScore: (profile[d] ?? 0) * 10,
    }))
      .filter((x) => x.majorScore >= 70 && x.userScore <= 35)
      .sort((a, b) => b.majorScore - a.majorScore)[0];
    if (gapDimension) {
      points.push(
        `ملاحظة: هذا التخصص يتطلب عادةً سمة ${RIASEC_LABELS[gapDimension.d]} بشكل قوي، بينما إجاباتك أظهرت ميلاً أقل لها — قد تحتاج جهداً إضافياً للتأقلم معها.`
      );
    }

    if (filterSettings && majorEligibility) {
      // نصّ قاطع بدل "توافق جزئي" الغامضة -- قبول الفرع شرط إداري (نعم/لا)،
      // لا توافقاً متدرّجاً (TASKS.md المهمة ٣).
      points.push(
        `الفروع المقبولة: ${majorEligibility.allowedBranches.join("، ") || "—"} · فرعك: ${filterSettings.branch} · الحالة: ${
          majorEligibility.branchEligible ? "مؤهَّل" : "غير مؤهَّل"
        }.`
      );
      if (majorEligibility.branchEligible) {
        // مقارنة صريحة برقم حقيقي بدل جملة عامة مطمئنة لا تعني شيئاً: معدل
        // الطالب مقابل الحد الأدنى الفعلي، مع بديل محسوب لا إحالة غامضة.
        if (majorEligibility.reachableOffers.length > 0) {
          points.push(
            `معدلك (${filterSettings.grade}%) يبلغ فعلاً ${majorEligibility.reachableOffers.length} عرضاً حقيقياً لهذا التخصص${
              requiredGrade !== null && filterSettings.grade >= requiredGrade
                ? ` (منها أفضل خيار حكومي بحد أدنى ${requiredGrade}% وفق حدود ${CUTOFFS_YEAR} في ${majorBestPublic!.universityName})`
                : ""
            }.`
          );
        } else if (majorEligibility.lowestCutoff !== null) {
          points.push(
            `تحذير: معدلك (${filterSettings.grade}%) دون أدنى حدّ تنافسي حقيقي لهذا التخصص (${majorEligibility.lowestCutoff}% وفق حدود ${CUTOFFS_YEAR}) بفارق ${Math.abs(
              majorEligibility.gapToLowest ?? 0
            ).toFixed(1)} نقطة.`
          );
        }
      }
    }

    points.push(
      `سوق العمل لهذا التخصص "${demand.text}"، مما يعني فرص توظيف ${demand.text === "مرتفع جداً" ? "قوية جداً" : demand.text === "مرتفع" ? "جيدة" : "متوسطة"}.`
    );

    return {
      points,
      branchEligible: majorEligibility ? majorEligibility.branchEligible : true,
      dimensionGaps,
      profile,
      alignedDimensions,
    };
  };

  const topMajors = quizResults?.length > 0 ? quizResults.slice(0, 3) : [major];
  const allAnalyses = topMajors.map((m) => ({ major: m, ...generateAnalysisForMajor(m) }));
  // بوّابة الأهلية القاطعة (TASKS.md المهمة ٣): تخصص غير مؤهَّل بالفرع لا
  // يُعرَض ضمن التوصيات الأساسية إطلاقاً -- يُنقَل لقسم منفصل صريح بدل
  // خلطه بصمت مع توصيات مؤهَّلة فعلاً.
  const analyses = allAnalyses.filter((a) => a.branchEligible);
  const ineligibleAnalyses = allAnalyses.filter((a) => !a.branchEligible);

  // المرتبة والفارق عن التخصص الأول (TASKS.md المهمة ٤) -- فقط حين تُعرَض
  // الصفحة عبر نتيجة اختبار حقيقية بأكثر من تخصص واحد (topMajors من quizResults).
  const primaryMajorRank = topMajors.findIndex((m: any) => m.id === primaryMajor.id) + 1;
  const topMajorFit =
    topMajors.length > 1
      ? (topMajors[0].fitPercent ?? computeMajorFit(userRiasecVector, riasecProfiles[topMajors[0].id] ?? {}))
      : null;
  const primaryMajorFit = computeMajorFit(userRiasecVector, riasecProfiles[primaryMajor.id] ?? {});
  const fitGapFromFirst = topMajorFit !== null && primaryMajorRank > 0 ? primaryMajorFit - topMajorFit : null;
  const isNarrowMargin = fitGapFromFirst !== null && Math.abs(fitGapFromFirst) < 3 && primaryMajorRank > 1;

  // ── بيانات PDF ──
  const pdfData = {
    majorName: primaryMajor?.name || "",
    category: primaryMajor?.category || "",
    demandText: demand?.text || "",
    points: analyses[0]?.points || [],
    universities: [...offeringPublic, ...offeringPrivate].map((o) => ({
      uniName: o.universityName,
      uniType: o.universityType,
      collegeName: o.collegeName,
      departmentName: o.departmentName,
      location: o.province,
      morningGrade: o.averageGrades?.["صباحي"] ?? null,
      hasMorning: !!o.sessions?.includes("صباحي"),
      eveningGrade: o.averageGrades?.["مسائي"] ?? null,
      hasEvening: !!o.sessions?.includes("مسائي"),
      isDirectAdmission: !!o.isDirectAdmission,
      statedMinimumGrade: o.statedMinimumGrade ?? null,
    })),
  };

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* تنبيه حداثة البيانات */}
      <DataFreshnessAlert />

      {/* إخلاء مسؤولية قانوني دائم -- كان موجوداً سابقاً فقط داخل تصدير PDF،
          لا في الصفحة الحيّة نفسها (PROJECT.md §7 بند 21). طالب قد لا يُصدّر
          PDF إطلاقاً فلا يرى التنويه أبداً لولا هذا. */}
      <div className="bg-slate-50 border border-slate-200 text-slate-600 p-4 rounded-2xl text-sm flex items-start gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-slate-400" />
        <p>
          هذا التقرير توصية استرشادية إحصائية، وليس قراراً رسمياً للقبول. الجهة الرسمية الوحيدة المعتمدة للتقديم والقبول
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

      <Link href="/quiz" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary transition-colors">
        <ArrowRight className="w-4 h-4" />
        <span>إعادة الاختبار</span>
      </Link>

      {/* رأس التقرير */}
      <div className="glass p-8 md:p-10 rounded-3xl space-y-6 border-t-8 border-t-primary">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 pb-6 gap-4">
          <div>
            <div className="inline-block bg-primary/10 text-primary px-4 py-1 rounded-full text-sm font-bold mb-3">
              التقرير التفصيلي
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-800">{primaryMajor?.name}</h1>
            <p className="text-lg text-slate-500 mt-2">قطاع: {primaryMajor?.category}</p>
            {primaryMajorRank > 0 && topMajors.length > 1 && (
              <p className="text-sm text-slate-500 mt-1">
                المرتبة {primaryMajorRank} من {topMajors.length} في نتيجتك
                {fitGapFromFirst !== null && primaryMajorRank > 1 && (
                  <> · يبعد {Math.abs(fitGapFromFirst).toFixed(1)} نقطة عن التخصص الأول</>
                )}
              </p>
            )}
            {isNarrowMargin && (
              <p className="text-sm text-amber-600 font-bold mt-1">فارق ضيّق — تعامل مع الخيارين كمتكافئين تقريباً.</p>
            )}
          </div>

          <div className="flex flex-col gap-3 items-end">
            {/* مؤشر الطلب */}
            <div
              className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-sm ${demand.bg} ${demand.color}`}
            >
              <TrendingUp className="w-6 h-6" />
              <div className="text-right">
                <div className="text-xs opacity-80">الطلب في السوق العراقي</div>
                <div>{demand.text}</div>
              </div>
            </div>
            {/* زر تصدير PDF */}
            <button
              onClick={() => exportPDF(pdfData)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-all hover:-translate-y-0.5 shadow-md"
            >
              <Download className="w-4 h-4" />
              تصدير PDF
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 pt-4">
          <div className="bg-slate-50 p-6 rounded-2xl flex items-start gap-4 border border-slate-100">
            <div className="bg-white p-3 rounded-xl text-slate-400 shadow-sm">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">الراتب المتوقع للبداية</h2>
              {govSalary?.amount ? (
                <>
                  <p className="text-slate-700 text-sm mt-1">
                    {govSalary.amount.toLocaleString("ar-IQ")} د.ع تقريباً — الراتب الاسمي الأساسي عند التعيين الحكومي
                    الأول لحملة البكالوريوس ({govSalary.basis}).
                  </p>
                  <p className="text-slate-400 text-xs mt-1">{govSalary.scope}</p>
                </>
              ) : (
                <p className="text-slate-500 text-sm mt-1">لا تتوفر بيانات رواتب موثّقة المصدر لهذا التخصص حالياً.</p>
              )}
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl flex items-start gap-4 border border-slate-100 hover:border-primary/30 transition-colors">
            <div className="bg-white p-3 rounded-xl text-primary shadow-sm">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">مجالات وأماكن العمل</h2>
              <p className="text-slate-600 mt-1 text-sm leading-relaxed">{employerSectorsText}</p>
              {!detailedProfile && (
                <p className="text-slate-400 text-xs mt-1">
                  (معلومات عامة — تفاصيل موثَّقة أدق قيد الإعداد لهذا التخصص)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* بصمتك الشخصية -- شكل واحد فقط (لا مقارنة هنا)، يجيب "من أنت؟" قبل
          أي مقارنة بتخصص معيّن. لا مفتاح ألوان لازم لشكل مفرد (العنوان يكفي). */}
      <div className="glass p-8 rounded-3xl">
        <h2 className="text-xl font-bold text-slate-800 mb-1">بصمتك الشخصية</h2>
        <p className="text-sm text-slate-500 mb-4">
          توزيع سماتك عبر الأبعاد الستة لنموذج RIASEC، من إجاباتك في الاختبار.
        </p>
        <RadarChart
          axes={RADAR_AXES}
          series={[{ name: "أنت", color: "var(--c-primary-600)", values: userRiasecVector as Record<string, number> }]}
        />
      </div>

      {/* تحليل التوافق */}
      <div className="glass p-8 rounded-3xl space-y-6">
        {analyses.map(({ major: m, points, dimensionGaps, alignedDimensions }, idx) => {
          const GAP_THRESHOLD = 15; // TASKS.md المهمة ٤: عتبة وسم "فجوة" المقترَحة
          const translations =
            (personalityTranslationsData.translations as Record<string, Record<string, string>>)[m.category] ?? {};
          return (
            <div key={idx} className="mb-10">
              <h2 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full inline-block" />
                {m.name} — {m.category}
              </h2>

              <div className="space-y-3">
                {points.map((pt, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-50"
                  >
                    {pt.includes("تحذير") || pt.includes("تشير") ? (
                      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <p className="text-slate-700 leading-relaxed font-medium">{pt}</p>
                  </div>
                ))}
              </div>

              {/* جدول الأبعاد الستة كاملة -- لا أعلى بُعدين فقط (TASKS.md المهمة ٤) */}
              <div className="mt-5 bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs">
                        <th className="text-right p-3 font-bold">البُعد</th>
                        <th className="text-right p-3 font-bold">أنت</th>
                        <th className="text-right p-3 font-bold">التخصص</th>
                        <th className="text-right p-3 font-bold">الفارق</th>
                        <th className="text-right p-3 font-bold">ماذا يعني هذا يومياً؟</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dimensionGaps.map((g) => {
                        const isGap = g.gap <= -GAP_THRESHOLD;
                        return (
                          <tr key={g.dimension} className="border-t border-slate-50">
                            <td className="p-3 font-bold text-slate-700">{RIASEC_LABELS[g.dimension]}</td>
                            <td className="p-3 tabular-nums">{Math.round(g.userScore)}%</td>
                            <td className="p-3 tabular-nums">{Math.round(g.majorScore)}%</td>
                            <td className="p-3">
                              <span
                                className={`tabular-nums font-bold ${
                                  isGap
                                    ? "text-red-600"
                                    : g.gap >= GAP_THRESHOLD
                                      ? "text-emerald-600"
                                      : "text-slate-500"
                                }`}
                              >
                                {g.gap > 0 ? "+" : ""}
                                {Math.round(g.gap)}
                              </span>
                              {isGap && (
                                <span className="mr-2 inline-block text-[11px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                  فجوة
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500 text-xs">{translations[g.dimension] ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* أعمال متوقعة -- مستخرجة من نفس الأبعاد المتوافقة أعلاه، لا
                  نصاً عاماً جديداً. مستويان: أبرز 1-2 بُعد (نفس ما يُفسَّر به
                  الاختيار في نص التوصية) مقابل بقية الأبعاد المتوافقة. */}
              {alignedDimensions.length > 0 && (
                <div className="mt-5 grid md:grid-cols-2 gap-4">
                  {alignedDimensions.slice(0, 2).length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                      <h3 className="font-bold text-emerald-800 text-sm mb-2">مهارة عالية متوقعة</h3>
                      <ul className="space-y-1.5">
                        {alignedDimensions.slice(0, 2).map((x) => (
                          <li key={x.d} className="text-sm text-emerald-900 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                            {translations[x.d] ?? RIASEC_LABELS[x.d as keyof typeof RIASEC_LABELS]}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {alignedDimensions.slice(2).length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <h3 className="font-bold text-blue-800 text-sm mb-2">من المتوقع نجاحك فيها</h3>
                      <ul className="space-y-1.5">
                        {alignedDimensions.slice(2).map((x) => (
                          <li key={x.d} className="text-sm text-blue-900 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                            {translations[x.d] ?? RIASEC_LABELS[x.d as keyof typeof RIASEC_LABELS]}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* تخصصات تناسب الشخصية لكن الفرع لا يؤهّل لها -- منفصلة تماماً عن
          التوصيات المؤهَّلة، لا مدموجة معها بصمت (TASKS.md المهمة ٣) */}
      {ineligibleAnalyses.length > 0 && (
        <div className="glass p-8 rounded-3xl space-y-4 border border-amber-200 bg-amber-50/40">
          <h2 className="text-xl font-bold text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            تخصصات تناسب شخصيتك لكن فرعك لا يؤهّلك لها
          </h2>
          <div className="grid gap-3">
            {ineligibleAnalyses.map(({ major: m }, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl border border-amber-100">
                <p className="font-bold text-slate-800">{m.name}</p>
                <p className="text-sm text-slate-500 mt-1">{m.category}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* بديل محسوب بدل تحذير بلا مخرج -- يظهر فقط حين لا يوجد أي عرض حكومي
          أو أهلي يبلغه معدل الطالب فعلاً الآن، أو حين لا يؤهّله فرعه أصلاً
          للتخصص الأساسي (TASKS.md المهمة ٣) */}
      {nearestAlternatives.length > 0 && (
        <div className="glass p-8 rounded-3xl space-y-4 border border-primary/20 bg-primary/5">
          <h2 className="text-xl font-bold text-slate-800">أقرب تخصصات ضمن متناول معدلك وفرعك الآن</h2>
          <div className="grid gap-3">
            {nearestAlternatives.map(({ major: m, fitPercent }, idx) => (
              <Link
                key={idx}
                href={`/report?major=${m.id}`}
                className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 hover:border-primary/40 transition-colors"
              >
                <div>
                  <p className="font-bold text-slate-800">{m.name}</p>
                  <p className="text-sm text-slate-500">{m.category}</p>
                </div>
                <div className="text-primary font-black">{Math.round(fitPercent)}%</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isNationalFallback && (
        <div className="flex items-start gap-3 bg-primary-50 border border-primary-200 text-primary-800 p-4 rounded-2xl mb-8">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            لم نجد هذا التخصص في محافظة &quot;{filterSettings?.province}&quot; تحديداً، فوسّعنا البحث لعموم العراق —
            الجامعات أدناه قد تكون في محافظات أخرى.
          </p>
        </div>
      )}

      <ChannelNotice />

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          🏛️ الجامعات الحكومية ({offeringPublic.length})
        </h2>
        {offeringPublic.length > 0 ? (
          <UniversitiesTable offerings={offeringPublic} />
        ) : (
          <EmptyState message="لا توجد جامعات حكومية لهذا التخصص" />
        )}
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          🎓 الجامعات والكليات الأهلية ({offeringPrivate.length})
        </h2>
        {offeringPrivate.length > 0 ? (
          <UniversitiesTable offerings={offeringPrivate} />
        ) : (
          <EmptyState message="لا توجد جامعات أهلية لهذا التخصص" />
        )}
      </section>

      <div className="text-center pt-12 pb-8 border-t border-slate-200 mt-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-10 py-4 rounded-full font-bold hover:bg-slate-800 transition-all shadow-xl hover:-translate-y-1 hover:shadow-2xl"
        >
          العودة للصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// export افتراضي مع Suspense
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function ReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportContent />
    </Suspense>
  );
}
