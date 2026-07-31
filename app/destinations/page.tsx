"use client";

import { useEffect, useState } from "react";
import { Briefcase, ShieldCheck, GraduationCap, AlertCircle } from "lucide-react";
import majorsData from "../../data/majors.json";
import { fetchMajorProfile, type DetailedMajorProfile } from "../../lib/majorProfileClient";
import { normalizeTriState, type TriState } from "../../lib/triState";

type LicensingRequirement = NonNullable<NonNullable<DetailedMajorProfile["career"]>["licensingRequirement"]>;

function LicensingCard({ req, children }: { req?: LicensingRequirement; children?: React.ReactNode }) {
  const state: TriState = normalizeTriState(req?.required);

  const toneClass: Record<TriState, string> = {
    yes: "border-band-close/30 bg-band-close-bg",
    partial: "border-band-close/30 bg-band-close-bg",
    no: "border-line bg-band-safe-bg",
    unknown: "border-line bg-surface-muted",
  };
  const iconToneClass: Record<TriState, string> = {
    yes: "bg-white/60 text-band-close",
    partial: "bg-white/60 text-band-close",
    no: "bg-white/60 text-band-safe",
    unknown: "bg-white/60 text-ink-muted",
  };

  return (
    <div className={`rounded-md border p-6 ${toneClass[state]}`}>
      <div className="flex items-center gap-3">
        <span className={`rounded-xl p-2.5 ${iconToneClass[state]}`}>
          <ShieldCheck className="h-5 w-5" />
        </span>
        <h2 className="font-bold text-ink">الترخيص المطلوب</h2>
      </div>

      {state === "yes" && (
        <>
          <p className="mt-3 text-sm font-bold text-ink">يتطلّب ترخيصاً مهنياً{req?.body ? `: ${req.body}` : ""}</p>
          {req?.note && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{req.note}</p>}
        </>
      )}

      {state === "partial" && (
        <>
          <p className="mt-3 text-sm font-bold text-ink">يتطلّب ترخيصاً في بعض المسارات فقط</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            ليس شرطاً لكل من يعمل في هذا التخصص — يخصّ مسارات محدَّدة.
          </p>
          {req?.body && <p className="mt-1 text-sm text-ink">الجهة: {req.body}</p>}
          {req?.note && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{req.note}</p>}
        </>
      )}

      {state === "no" && (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          لا يتطلّب ترخيصاً نقابياً خاصاً لمزاولة هذا التخصص.
          {req?.note ? ` ${req.note}` : ""}
        </p>
      )}

      {state === "unknown" && (
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">لم نتحقّق من متطلّبات الترخيص لهذا التخصص.</p>
      )}
      {children}
    </div>
  );
}

function PostgradNote({ value }: { value?: boolean | "جزئياً" }) {
  const state: TriState = normalizeTriState(value);
  if (state === "no" || state === "unknown") return null;
  return (
    <p className="mt-3 text-sm font-bold text-band-close">
      {state === "yes"
        ? "يحتاج دراسات عليا لممارسة فعلية كاملة في هذا المجال."
        : "بعض مسارات هذا التخصص تحتاج دراسات عليا للممارسة الكاملة، لا كلّها."}
    </p>
  );
}

export default function DestinationsPage() {
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

          <LicensingCard req={career.licensingRequirement}>
            <PostgradNote value={career.postgradNeededForPractice} />
          </LicensingCard>
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
