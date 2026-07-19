"use client";
import React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import {
  ArrowRight, TrendingUp, DollarSign,
  Briefcase, AlertCircle, Download, AlertTriangle, X
} from "lucide-react";
import majorsData from "../../data/majors.json";
import universitiesData from "../../data/universities.json";
import majorMappings from "../../data/major_department_mapping.json";
import questionsData from "../../data/questions.json";
import riasecProfilesData from "../../data/major_riasec_profiles.json";
import { findUniversitiesForMajor, rankUniversityOfferings } from "../../lib/majorMatcher";
import type { University } from "../../lib/majorMatcher";
import { computeUserRiasecVector, computeMajorFit, RIASEC_LABELS, RIASEC_DIMENSIONS } from "../../lib/riasec";
import EmptyState from "../components/EmptyState";
import UniversitiesTable from "../components/UniversitiesTable";

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
    // يُقرأ مباشرة من data/universities.json (meta.lastUpdated) بدل تاريخ
    // ثابت مكتوب يدوياً هنا -- كان يُنسى تحديثه مع كل تحديث بيانات فعلي
    // فيُظهر (أو يُخفي) التنبيه بلا علاقة بحداثة البيانات الحقيقية.
    const updated = new Date(universitiesData.meta.lastUpdated);
    const days = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
    if (days >= 365) { setIsStale(true); setShow(true); }
    else if (days >= 180) { setIsStale(false); setShow(true); }
  }, []);

  if (!show) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm mb-6 ${
        isStale
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-amber-50 border-amber-200 text-amber-800"
      }`}
      role="alert"
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1">
        {isStale
          ? "⚠️ تنبيه: بيانات الجامعات ومعدلات القبول قد لا تكون محدّثة لهذا العام. يُنصح بمراجعة موقع الجامعة الرسمي للتأكد."
          : "ℹ️ ملاحظة: آخر تحديث للبيانات كان منذ أكثر من 6 أشهر. التوصيات دقيقة لكن ننصح بمتابعة إعلانات الجامعات."}
      </p>
      <button onClick={() => setShow(false)} aria-label="إغلاق" className="shrink-0 hover:opacity-60 transition-opacity">
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
  salaryRange: string;
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
  }>;
}) {
  const formatGrade = (grade: number | null, available: boolean) => {
    if (!available) return "—";
    return grade !== null ? `${grade}%` : "قبول مباشر";
  };
  const uniRows = data.universities
    .map(
      (u) => `
      <tr>
        <td>${u.uniName}</td>
        <td>${u.uniType}</td>
        <td>${u.location}</td>
        <td>${u.collegeName}</td>
        <td>${u.departmentName}</td>
        <td>${formatGrade(u.morningGrade, u.hasMorning)}</td>
        <td>${formatGrade(u.eveningGrade, u.hasEvening)}</td>
      </tr>`
    )
    .join("");

  const pointsList = data.points
    .map((p) => `<li style="margin-bottom:8px;line-height:1.6">${p}</li>`)
    .join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير التوجيه الجامعي – ${data.majorName}</title>
  <style>
    @page { size: A4; margin: 18mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; font-size: 11pt; color: #1e293b; direction: rtl; }
    .header { background: linear-gradient(135deg,#1e40af,#7c3aed); color: white; padding: 18px 22px; border-radius: 10px; margin-bottom: 18px; display:flex; justify-content:space-between; align-items:center; }
    .header-title { font-size: 18pt; font-weight: 700; }
    .info-cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 18px; }
    .info-card { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; text-align: center; }
    .info-card .label { font-size: 9pt; color: #64748b; margin-bottom: 3px; }
    .info-card .value { font-size: 12pt; font-weight: 700; color: #1e40af; }
    .section-title { font-size: 12pt; font-weight: 700; color: #1e40af; margin: 16px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #dbeafe; }
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
    <div style="font-size:9pt;opacity:.7;text-align:left">${new Date().toLocaleDateString("ar-IQ",{year:"numeric",month:"long",day:"numeric"})}</div>
  </div>

  <div class="info-cards">
    <div class="info-card"><div class="label">التخصص</div><div class="value">${data.majorName}</div></div>
    <div class="info-card"><div class="label">الراتب المتوقع</div><div class="value" style="font-size:10pt">${data.salaryRange}</div></div>
    <div class="info-card"><div class="label">الطلب في السوق</div><div class="value" style="font-size:10pt">${data.demandText}</div></div>
  </div>

  <div class="section-title">📊 تحليل التوافق</div>
  <ul>${pointsList}</ul>

  ${data.universities.length > 0 ? `
  <div class="section-title">🏛️ الجامعات والكليات الموصى بها</div>
  <table>
    <thead><tr><th>الجامعة</th><th>النوع</th><th>المحافظة</th><th>الكلية</th><th>القسم</th><th>صباحي</th><th>مسائي</th></tr></thead>
    <tbody>${uniRows}</tbody>
  </table>` : ""}

  <div class="footer">
    <span>منصة التوجيه الجامعي – العراق</span>
    <span>هذا التقرير استرشادي — يُنصح بمراجعة مختص للتوجيه الأكاديمي</span>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير."); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // بيانات localStorage قد تكون تالفة (حصة تخزين ممتلئة، تعديل يدوي، أو
    // تغيّر شكل البيانات بعد تحديث للموقع بينما لا تزال بيانات جلسة قديمة
    // محفوظة عند المستخدم) — بلا try/catch هنا كان أي خطأ JSON.parse يسقط
    // حتى ErrorBoundary العام ويستبدل الصفحة بأكملها برسالة خطأ عامة، بدل
    // معاملة الحالة كما لو لم يُكمل المستخدم الاختبار أصلاً (حالة مُعالَجة
    // فعلاً أدناه).
    try {
      const savedAnswers = localStorage.getItem("userAnswers");
      const savedResults = localStorage.getItem("quizResults");
      const savedFilters = localStorage.getItem("filterSettings");
      if (savedAnswers) setUserAnswers(JSON.parse(savedAnswers));
      if (savedResults) setQuizResults(JSON.parse(savedResults));
      if (savedFilters) setFilterSettings(JSON.parse(savedFilters));
    } catch {
      // نتجاهل البيانات التالفة بصمت — الحقول تبقى بقيمها الافتراضية
      // (نتائج فارغة) فتُعرض شاشة "لم تكمل الاختبار" الطبيعية أدناه.
    }
    // محاكاة تحميل طفيف لإظهار Skeleton بشكل واضح
    setTimeout(() => setIsLoading(false), 600);
  }, []);

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
  const getSalaryRange = (multiplier: number) => {
    if (multiplier >= 1.4) return "1,500,000 - 3,000,000+ دينار عراقي";
    if (multiplier >= 1.2) return "1,000,000 - 2,000,000 دينار عراقي";
    if (multiplier >= 1.0) return "750,000 - 1,500,000 دينار عراقي";
    return "500,000 - 1,000,000 دينار عراقي";
  };

  const getDemandLevel = (multiplier: number) => {
    if (multiplier >= 1.4) return { text: "مرتفع جداً", color: "text-emerald-600", bg: "bg-emerald-100" };
    if (multiplier >= 1.2) return { text: "مرتفع", color: "text-blue-600", bg: "bg-blue-100" };
    if (multiplier >= 1.0) return { text: "متوسط", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { text: "منخفض/متشبع", color: "text-red-600", bg: "bg-red-100" };
  };

  const primaryMajor = major;
  const demand = getDemandLevel(primaryMajor?.marketMultiplier ?? 0);

  // ── الجامعات ومطابقة التخصصات ──
  // إن لم توجد أي عروض ضمن محافظة الطالب تحديداً، نُعيد البحث وطنياً بدل
  // إظهار صفحة فارغة فوراً — كثير من التخصصات (خصوصاً النادرة جغرافياً)
  // متاحة فعلاً في محافظات أخرى، والطالب يستفيد من رؤيتها مع توضيح أنها
  // خارج محافظته، بدل رسالة "لم نجد شيئاً" رغم وجود خيارات حقيقية في العراق.
  let offerings = findUniversitiesForMajor(
    primaryMajor,
    universitiesData.universities as unknown as University[],
    majorMappings.mappings,
    { province: filterSettings?.province }
  );
  let isNationalFallback = false;
  if (offerings.length === 0 && filterSettings?.province) {
    offerings = findUniversitiesForMajor(
      primaryMajor,
      universitiesData.universities as unknown as University[],
      majorMappings.mappings
    );
    isNationalFallback = offerings.length > 0;
  }
  const ranked = rankUniversityOfferings(offerings);
  const offeringPublic = ranked.filter(o => o.universityType === 'حكومية');
  const offeringPrivate = ranked.filter(o => o.universityType === 'أهلية');
  const hasOfferings = offeringPublic.length > 0 || offeringPrivate.length > 0;
  if (!hasOfferings) {
    return <EmptyState message="لم نجد جامعات تطبق هذا التخصص، لا في محافظتك ولا وطنياً" />;
  }

  // ── تحليل التوافق القائم على نموذج RIASEC ──
  const userRiasecVector = computeUserRiasecVector(userAnswers, questionsData);
  const riasecProfiles = riasecProfilesData.profiles as Record<string, Partial<Record<string, number>>>;

  const generateAnalysisForMajor = (majorObj: any): string[] => {
    const points: string[] = [];
    const profile = riasecProfiles[majorObj.id] ?? {};
    const fitPercent = majorObj.fitPercent ?? computeMajorFit(userRiasecVector, profile);

    // أفضل قسم حكومي حقيقي لهذا التخصص تحديداً (لا تخصص الصفحة الأساسي
    // فقط) — نحتاجه لمقارنة معدل الطالب الفعلي بالحد الأدنى الحقيقي، بدل
    // رسالة عامة "معدلك مناسب" لا تُقارَن بأي رقم فعلي.
    const majorOfferings = findUniversitiesForMajor(
      majorObj,
      universitiesData.universities as unknown as University[],
      majorMappings.mappings,
      filterSettings?.province ? { province: filterSettings.province } : undefined
    );
    const majorBestPublic = rankUniversityOfferings(majorOfferings).find((o) => o.universityType === "حكومية");
    const requiredGrade = majorBestPublic?.averageGrades?.["صباحي"] ?? null;

    // أقوى الأبعاد المشتركة بين شخصية الطالب ومتطلبات هذا التخصص تحديداً
    const alignedDimensions = RIASEC_DIMENSIONS
      .map((d) => ({ d, userScore: userRiasecVector[d] ?? 0, majorScore: (profile[d] ?? 0) * 10 }))
      .filter((x) => x.userScore >= 55 && x.majorScore >= 55)
      .sort((a, b) => Math.min(b.userScore, b.majorScore) - Math.min(a.userScore, a.majorScore));

    points.push(`نسبة التوافق الشخصي بينك وبين هذا التخصص هي ${Math.round(fitPercent)}%، بناءً على مقارنة سماتك بمتطلبات التخصص الفعلية.`);

    if (alignedDimensions.length > 0) {
      const names = alignedDimensions.slice(0, 2).map((x) => RIASEC_LABELS[x.d]).join(" و");
      points.push(`اخترنا لك هذا التخصص لأن سماتك في البُعد ${names} تتوافق بقوة مع متطلبات العمل فيه.`);
    }

    // تنبيه عند وجود فجوة واضحة بين سمة يحتاجها التخصص بشدة وسمة الطالب فيها ضعيفة
    const gapDimension = RIASEC_DIMENSIONS
      .map((d) => ({ d, userScore: userRiasecVector[d] ?? 0, majorScore: (profile[d] ?? 0) * 10 }))
      .filter((x) => x.majorScore >= 70 && x.userScore <= 35)
      .sort((a, b) => b.majorScore - a.majorScore)[0];
    if (gapDimension) {
      points.push(`ملاحظة: هذا التخصص يتطلب عادةً سمة ${RIASEC_LABELS[gapDimension.d]} بشكل قوي، بينما إجاباتك أظهرت ميلاً أقل لها — قد تحتاج جهداً إضافياً للتأقلم معها.`);
    }

    if (filterSettings) {
      const branchMatch =
        filterSettings.branch === "علمي" && majorObj.category === "طبي"
          ? "يتوافق تخصصك مع اختيارك للفرع العلمي."
          : filterSettings.branch !== "علمي" && majorObj.category !== "طبي"
          ? "يتماشى التخصص مع اختيارك للفرع الأدبي أو الفنون."
          : "هناك توافق جزئي بين فرعك وهذا التخصص، لكن إجاباتك الأخرى دعّمت هذه التوصية.";
      points.push(branchMatch);
      // مقارنة صريحة برقم حقيقي بدل جملة عامة مطمئنة لا تعني شيئاً: معدل
      // الطالب مقابل الحد الأدنى الفعلي لأفضل قسم حكومي متاح لهذا التخصص.
      if (requiredGrade !== null) {
        if (filterSettings.grade >= requiredGrade) {
          points.push(`معدلك (${filterSettings.grade}%) يكفي فعلاً لأفضل خيار حكومي متاح لهذا التخصص (الحد الأدنى ${requiredGrade}% في ${majorBestPublic!.universityName}).`);
        } else {
          points.push(`تحذير: معدلك (${filterSettings.grade}%) أقل من الحد الأدنى الفعلي لأفضل خيار حكومي لهذا التخصص (${requiredGrade}% في ${majorBestPublic!.universityName}) — راجع بقية الخيارات في الجدول أدناه، فقد تجد قسماً أو جامعة أهلية بحد أدنى أقرب لمعدلك.`);
        }
      } else if (filterSettings.grade >= 85) {
        points.push(`معدلك (${filterSettings.grade}%) يُظهر تفوقاً يُفضِّل التخصصات ذات الطلب العالي في السوق.`);
      } else {
        points.push(`معدلك (${filterSettings.grade}%) يشير إلى خيارات تخصص ذات متطلبات قبول مناسبة (لا تتوفر بيانات حد أدنى تاريخي منشور لأفضل خيار حكومي لهذا التخصص تحديداً).`);
      }
    }

    points.push(`سوق العمل لهذا التخصص "${demand.text}"، مما يعني فرص توظيف ${demand.text === "مرتفع جداً" ? "قوية جداً" : demand.text === "مرتفع" ? "جيدة" : "متوسطة"}.`);
    points.push(`الراتب المتوقع عند التخرج يتراوح بين ${getSalaryRange(majorObj.marketMultiplier)}.`);

    return points;
  };

  const topMajors = quizResults?.length > 0 ? quizResults.slice(0, 3) : [major];
const analyses = topMajors.map((m) => ({ major: m, points: generateAnalysisForMajor(m) }));

  // ── بيانات PDF ──
  const pdfData = {
  majorName: primaryMajor?.name || "",
  category: primaryMajor?.category || "",
  salaryRange: getSalaryRange(primaryMajor?.marketMultiplier || 0),
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
  })),
};



return (
  <div className="max-w-5xl mx-auto py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* تنبيه حداثة البيانات */}
      <DataFreshnessAlert />

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
          </div>

          <div className="flex flex-col gap-3 items-end">
            {/* مؤشر الطلب */}
            <div className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-sm ${demand.bg} ${demand.color}`}>
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
          <div className="bg-slate-50 p-6 rounded-2xl flex items-start gap-4 border border-slate-100 hover:border-emerald-200 transition-colors">
            <div className="bg-white p-3 rounded-xl text-emerald-600 shadow-sm">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">الراتب المتوقع للبداية</h2>
              <p className="text-emerald-700 font-bold mt-1">{getSalaryRange(primaryMajor?.marketMultiplier)}</p>
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl flex items-start gap-4 border border-slate-100 hover:border-primary/30 transition-colors">
            <div className="bg-white p-3 rounded-xl text-primary shadow-sm">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">مجالات وأماكن العمل</h2>
              <p className="text-slate-600 mt-1 text-sm leading-relaxed">
                شركات القطاع الخاص، المؤسسات الحكومية، العمل الحر، أو الشركات الأجنبية العاملة في العراق.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* تحليل التوافق */}
      <div className="glass p-8 rounded-3xl space-y-6">
        {analyses.map(({ major: m, points }, idx) => (
          <div key={idx} className="mb-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-secondary rounded-full inline-block" />
              {m.name} — {m.category}
            </h2>
            <div className="space-y-3">
              {points.map((pt, i) => (
                <div key={i} className="flex items-start gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-50">
                  {pt.includes("تحذير") || pt.includes("تشير") ? (
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-2 h-2 mt-2 rounded-full bg-secondary flex-shrink-0" />
                  )}
                  <p className="text-slate-700 leading-relaxed font-medium">{pt}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

        {isNationalFallback && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl mb-8">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              لم نجد هذا التخصص في محافظة &quot;{filterSettings?.province}&quot; تحديداً، فوسّعنا البحث لعموم العراق — الجامعات
              أدناه قد تكون في محافظات أخرى.
            </p>
          </div>
        )}

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
