"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, AlertCircle, Users, ShieldAlert } from "lucide-react";
import majorsData from "../../data/majors.json";
import salaryAllowances from "../../data/salary-allowances.json";
import { fetchMajorProfile, type DetailedMajorProfile } from "../../lib/majorProfileClient";

export default function IncomePage() {
  const [majorId, setMajorId] = useState("");
  const [profile, setProfile] = useState<DetailedMajorProfile | null>(null);
  const major = majorsData.find((m) => m.id === majorId);

  useEffect(() => {
    if (!majorId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    fetchMajorProfile(majorId).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [majorId]);

  const salary = profile?.career?.governmentBaseSalary;
  const market = profile?.market;

  return (
    <div dir="rtl" className="mx-auto max-w-3xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">دخل التخصص الموثّق</h1>
        <p className="mt-1 text-ink-soft">أرقام دخل من مصادر رسمية فقط — وإن لم تتوفّر، نقولها بصراحة.</p>
      </div>

      <div className="bg-surface border border-line shadow-sm rounded-3xl p-6">
        <label className="mb-2 block font-bold" htmlFor="major">
          اختر التخصص
        </label>
        <select
          id="major"
          value={majorId}
          onChange={(e) => setMajorId(e.target.value)}
          className="w-full rounded-xl border border-line p-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">اختر تخصصاً...</option>
          {majorsData.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.category}
            </option>
          ))}
        </select>
      </div>

      {major && (
        <div className="space-y-4">
          <div className="rounded-md border border-line bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary-100 p-2.5 text-primary-700">
                <Wallet className="h-5 w-5" />
              </span>
              <h2 className="font-bold text-ink">الراتب الحكومي الأول</h2>
            </div>

            {salary?.amount ? (
              <>
                <div className="mt-4 text-3xl font-extrabold text-primary-700">
                  {salary.amount.toLocaleString("ar-IQ")} د.ع
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{salary.basis}</p>
                <p className="mt-3 rounded-lg border-s-4 border-primary-600 bg-surface-subtle p-3 text-sm leading-relaxed text-ink-soft">
                  {salary.scope}
                </p>
                <p className="mt-3 text-xs text-ink-muted">
                  المصدر: {salary.source} · آخر تحقّق: {salary.lastVerified}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                لا تتوفر بيانات رواتب موثّقة المصدر لهذا التخصص حالياً.
              </p>
            )}
          </div>

          {/* المخصصات القانونية -- محتوى ثابت لا يتغيّر بالتخصص المختار عمداً
              (مبدأ الخطة: لا تُخزَّن/تُعرَض مخصصة على مستوى التخصص إلا إن كانت
              تتغيّر فعلاً بتغيّره). راجع data/salary-allowances.json ومصادره. */}
          <div className="rounded-md border border-line bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary-100 p-2.5 text-primary-700">
                <Users className="h-5 w-5" />
              </span>
              <h2 className="font-bold text-ink">المخصصات القانونية</h2>
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-muted">
              عامّة لكل موظفي الدولة -- لا علاقة لها بالتخصص
            </p>
            <ul className="mt-2 grid gap-2 text-sm leading-relaxed text-ink-soft">
              <li>
                <span className="font-bold text-ink">
                  {salaryAllowances.universal.dependency.amountIQD.toLocaleString("ar-IQ")} د.ع شهرياً
                </span>{" "}
                مخصصة إعالة (م. {salaryAllowances.universal.dependency.article}) --{" "}
                {salaryAllowances.universal.dependency.conditions}
              </li>
              <li>
                <span className="font-bold text-ink">
                  {salaryAllowances.universal.perChild.amountIQD.toLocaleString("ar-IQ")} د.ع شهرياً
                </span>{" "}
                عن كل طفل، ولغاية الطفل الرابع (م. {salaryAllowances.universal.perChild.article}) -- تستمر للابن حتى{" "}
                {salaryAllowances.universal.perChild.sonContinuesToAge} سنة إن كان{" "}
                {salaryAllowances.universal.perChild.sonContinuationCondition}، وللبنت ما لم يتحقق{" "}
                {salaryAllowances.universal.perChild.daughterContinuesUnless}.
              </li>
            </ul>

            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-ink-muted">
              قد تنطبق حسب طبيعة المهنة -- لم نتحقّق من الأهلية لكل تخصص بعينه بعد
            </p>
            <ul className="mt-2 grid gap-2 text-sm leading-relaxed text-ink-soft">
              <li className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-band-close" />
                <span>
                  مخصصة خطورة مهنية:{" "}
                  <span className="font-bold text-ink">
                    {salaryAllowances.hazardAllowance.rangePercent[0]}٪–
                    {salaryAllowances.hazardAllowance.rangePercent[1]}٪
                  </span>{" "}
                  من الراتب (م. {salaryAllowances.hazardAllowance.article}) --{" "}
                  {salaryAllowances.hazardAllowance.grantedBy}. {salaryAllowances.hazardAllowance.eligibilityNote}.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-band-close" />
                <span>
                  مخصصة منع مزاولة المهنة:{" "}
                  <span className="font-bold text-ink">
                    {salaryAllowances.practiceProhibitionAllowance.minPercent}٪ فأكثر
                  </span>{" "}
                  من الراتب ({salaryAllowances.practiceProhibitionAllowance.legalBasis}) --{" "}
                  {salaryAllowances.practiceProhibitionAllowance.appliesTo}.{" "}
                  {salaryAllowances.practiceProhibitionAllowance.eligibilityNote}.
                </span>
              </li>
            </ul>

            <p className="mt-4 rounded-lg border-s-4 border-primary-600 bg-surface-subtle p-3 text-xs leading-relaxed text-ink-muted">
              سقف مجموع المخصصات: لا يزيد المجموع على {salaryAllowances.totalCap.percentOfSalary}٪ من الراتب، باستثناء{" "}
              {salaryAllowances.totalCap.excludes} (م. {salaryAllowances.totalCap.article}).
            </p>

            <p className="mt-3 text-xs text-ink-muted">
              المصدر: {salaryAllowances.legalBasis.primary} · {salaryAllowances.legalBasis.amendment} · آخر تحقّق:{" "}
              {salaryAllowances.lastVerified}
            </p>
          </div>

          {market && (market.demandLevel || market.saturationNote) && (
            <div className="rounded-md border border-line bg-surface p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-primary-100 p-2.5 text-primary-700">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <h2 className="font-bold text-ink">سياق سوق العمل</h2>
              </div>
              {market.demandLevel && (
                <p className="mt-4 text-sm font-bold text-ink">مستوى الطلب: {market.demandLevel}</p>
              )}
              {market.saturationNote && (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{market.saturationNote}</p>
              )}
              {market.source && (
                <p className="mt-3 text-xs text-ink-muted">
                  المصدر: {market.source}
                  {market.lastVerified ? ` · آخر تحقّق: ${market.lastVerified}` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted p-4 text-sm text-ink-soft">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-muted" />
        <p>
          الرقم المعروض هو <span className="font-bold">الراتب الاسمي الحكومي الأول فقط</span> عند التعيين المركزي لحملة
          البكالوريوس — لا يمثّل القطاع الخاص، ولا العمل الحر، ولا مخصصات نقابية إضافية قد تنطبق على بعض المهن. راجع
          المصدر المذكور مباشرة لأي قرار يعتمد عليه.
        </p>
      </div>
    </div>
  );
}
