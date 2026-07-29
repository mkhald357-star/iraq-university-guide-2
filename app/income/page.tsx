"use client";

import { useState } from "react";
import { Wallet, TrendingUp, AlertCircle } from "lucide-react";
import majorsData from "../../data/majors.json";
import detailedProfilesData from "../../data/major_profiles_detailed.json";

interface DetailedProfile {
  id: string;
  career?: {
    governmentBaseSalary?: {
      amount: number;
      currency: string;
      basis: string;
      scope: string;
      source: string;
      lastVerified: string;
    } | null;
  };
  market?: {
    demandLevel?: string;
    saturationNote?: string;
    source?: string | null;
    lastVerified?: string | null;
  };
}

const PROFILES = detailedProfilesData as DetailedProfile[];

export default function IncomePage() {
  const [majorId, setMajorId] = useState("");
  const major = majorsData.find((m) => m.id === majorId);
  const profile = PROFILES.find((p) => p.id === majorId);
  const salary = profile?.career?.governmentBaseSalary;
  const market = profile?.market;

  return (
    <div dir="rtl" className="mx-auto max-w-3xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">دخل التخصص الموثّق</h1>
        <p className="mt-1 text-ink-soft">أرقام دخل من مصادر رسمية فقط — وإن لم تتوفّر، نقولها بصراحة.</p>
      </div>

      <div className="glass rounded-3xl p-6">
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

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
        <p>
          الرقم المعروض هو <span className="font-bold">الراتب الاسمي الحكومي الأول فقط</span> عند التعيين المركزي
          لحملة البكالوريوس — لا يمثّل القطاع الخاص، ولا العمل الحر، ولا مخصصات نقابية إضافية قد تنطبق على بعض
          المهن. راجع المصدر المذكور مباشرة لأي قرار يعتمد عليه.
        </p>
      </div>
    </div>
  );
}
