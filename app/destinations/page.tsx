"use client";

import { useState } from "react";
import { Briefcase, ShieldCheck, GraduationCap, AlertCircle } from "lucide-react";
import majorsData from "../../data/majors.json";
import detailedProfilesData from "../../data/major_profiles_detailed.json";

interface DetailedProfile {
  id: string;
  career?: {
    realJobTitles?: string[];
    employerSectors?: string[];
    licensingRequirement?: { required: boolean; body: string; note: string };
    postgradNeededForPractice?: boolean;
  };
}

const PROFILES = detailedProfilesData as DetailedProfile[];

export default function DestinationsPage() {
  const [majorId, setMajorId] = useState("");
  const major = majorsData.find((m) => m.id === majorId);
  const profile = PROFILES.find((p) => p.id === majorId);
  const career = profile?.career;

  return (
    <div dir="rtl" className="mx-auto max-w-3xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">وجهات العمل بعد التخرّج</h1>
        <p className="mt-1 text-ink-soft">أين يشتغل خرّيجو تخصصك فعلاً في العراق، وما الترخيص المطلوب.</p>
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

      {major && career && (
        <div className="space-y-4">
          <div className="rounded-md border border-line bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary-100 p-2.5 text-primary-700">
                <Briefcase className="h-5 w-5" />
              </span>
              <h2 className="font-bold text-ink">المسمّيات الوظيفية الفعلية</h2>
            </div>
            <ul className="mt-4 grid gap-2">
              {(career.realJobTitles ?? []).map((title) => (
                <li key={title} className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                  {title}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-line bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary-100 p-2.5 text-primary-700">
                <GraduationCap className="h-5 w-5" />
              </span>
              <h2 className="font-bold text-ink">قطاعات العمل</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {(career.employerSectors ?? []).join("، ")}
            </p>
          </div>

          <div
            className={`rounded-md border p-6 ${
              career.licensingRequirement?.required
                ? "border-band-close/30 bg-band-close-bg"
                : "border-line bg-band-safe-bg"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`rounded-xl p-2.5 ${
                  career.licensingRequirement?.required
                    ? "bg-white/60 text-band-close"
                    : "bg-white/60 text-band-safe"
                }`}
              >
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h2 className="font-bold text-ink">الترخيص المطلوب</h2>
            </div>
            {career.licensingRequirement?.required ? (
              <>
                <p className="mt-3 text-sm font-bold text-ink">{career.licensingRequirement.body}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{career.licensingRequirement.note}</p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                لا يتطلّب ترخيصاً نقابياً خاصاً لمزاولة هذا التخصص.
                {career.licensingRequirement?.note ? ` ${career.licensingRequirement.note}` : ""}
              </p>
            )}
            {career.postgradNeededForPractice && (
              <p className="mt-3 text-sm font-bold text-band-close">
                يحتاج دراسات عليا لممارسة فعلية كاملة في هذا المجال.
              </p>
            )}
          </div>
        </div>
      )}

      {major && !career && (
        <p className="text-center text-ink-muted">لا تتوفر بيانات وجهات عمل موثَّقة المصدر لهذا التخصص حالياً.</p>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
        <p>
          هذه معلومات واقعية استرشادية عن سوق العمل الفعلي، وجهات الترخيص قد تُحدِّث شروطها من وقت لآخر — راجع
          الجهة الرسمية المذكورة مباشرة قبل اتخاذ قرار يعتمد عليها.
        </p>
      </div>
    </div>
  );
}
