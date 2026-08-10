"use client";

import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Briefcase, ListChecks, Plus, X, Trophy, AlertCircle } from "lucide-react";
import majorsData from "../../data/majors.json";
import { fetchMajorProfile, type DetailedMajorProfile } from "../../lib/majorProfileClient";
import { normalizeTriState } from "../../lib/triState";
import {
  MAX_COMPARE_MAJORS,
  MIN_COMPARE_MAJORS,
  computeComparisonHighlights,
  sanitizeSelection,
} from "../../lib/compareMajors";

function MajorSelect({
  value,
  onChange,
  onRemove,
  excludeIds,
  index,
}: {
  value: string;
  onChange: (id: string) => void;
  onRemove?: () => void;
  excludeIds: string[];
  index: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={`التخصص ${index + 1}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line p-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">اختر تخصصاً...</option>
        {majorsData
          .filter((m) => m.id === value || !excludeIds.includes(m.id))
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.category}
            </option>
          ))}
      </select>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="إزالة هذا التخصص"
          className="shrink-0 rounded-lg border border-line p-2.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: typeof GraduationCap; title: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line pb-3">
      <span className="rounded-lg bg-primary-100 p-2 text-primary-700">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="font-bold text-ink">{title}</h3>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="mt-1 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}

const DEMAND_TONE: Record<string, string> = {
  "مرتفع": "text-band-safe",
  "متوسط": "text-band-close",
  "منخفض": "text-band-reach",
  "شديد الانخفاض": "text-band-reach",
  "متشبع": "text-band-reach",
};

export default function ComparePage() {
  const [slots, setSlots] = useState<string[]>(["", ""]);
  const [profiles, setProfiles] = useState<Record<string, DetailedMajorProfile | null>>({});

  const selectedIds = useMemo(() => sanitizeSelection(slots), [slots]);

  useEffect(() => {
    if (selectedIds.length < MIN_COMPARE_MAJORS) return;
    let cancelled = false;
    Promise.all(selectedIds.map((id) => fetchMajorProfile(id).then((p) => [id, p] as const))).then((pairs) => {
      if (cancelled) return;
      setProfiles((prev) => {
        const next = { ...prev };
        for (const [id, p] of pairs) next[id] = p;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join("|")]);

  const entries = selectedIds.map((id) => ({ majorId: id, profile: profiles[id] ?? null }));
  const highlights = useMemo(() => computeComparisonHighlights(entries), [entries]);
  const showComparison = selectedIds.length >= MIN_COMPARE_MAJORS;

  function updateSlot(index: number, id: string) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = id;
      return next;
    });
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function addSlot() {
    setSlots((prev) => (prev.length >= MAX_COMPARE_MAJORS ? prev : [...prev, ""]));
  }

  return (
    <div dir="rtl" className="mx-auto max-w-5xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">الموازنة بين التخصصات</h1>
        <p className="mt-1 text-ink-soft">ضع تخصصين أو ثلاثة جنباً لجنب: الدراسة، والعمل، والقبول.</p>
      </div>

      <div className="glass rounded-3xl p-6 space-y-3">
        {slots.map((value, index) => (
          <MajorSelect
            key={index}
            index={index}
            value={value}
            excludeIds={slots.filter((_, i) => i !== index).filter(Boolean)}
            onChange={(id) => updateSlot(index, id)}
            onRemove={index >= MIN_COMPARE_MAJORS ? () => removeSlot(index) : undefined}
          />
        ))}

        {slots.length < MAX_COMPARE_MAJORS && (
          <button
            type="button"
            onClick={addSlot}
            className="flex items-center gap-1.5 text-sm font-bold text-primary-700 transition-colors hover:text-primary-800"
          >
            <Plus className="h-4 w-4" />
            أضف تخصصاً {slots.length === 2 ? "ثالثاً" : ""}
          </button>
        )}
      </div>

      {!showComparison && (
        <p className="text-center text-ink-muted">اختر تخصصين على الأقل لبدء الموازنة.</p>
      )}

      {showComparison && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {entries.map(({ majorId, profile }) => {
            const major = majorsData.find((m) => m.id === majorId);
            const study = profile?.study;
            const career = profile?.career;
            const market = profile?.market;
            const eligibility = profile?.eligibility;
            const licensingState = normalizeTriState(career?.licensingRequirement?.required);
            const cutoff = eligibility?.observedCutoffRange;
            const studyNatureParts = study?.studyNature
              ? [
                  study.studyNature.theoretical ? `نظري ${study.studyNature.theoretical}٪` : null,
                  study.studyNature.lab ? `مختبر ${study.studyNature.lab}٪` : null,
                  study.studyNature.field ? `ميداني ${study.studyNature.field}٪` : null,
                  study.studyNature.clinical ? `سريري ${study.studyNature.clinical}٪` : null,
                ].filter(Boolean)
              : [];

            return (
              <div
                key={majorId}
                className="min-w-[280px] flex-1 rounded-md border border-line bg-surface p-6 shadow-sm space-y-5"
              >
                <div>
                  {(majorId === highlights.lowestCutoffMajorId || majorId === highlights.highestDemandMajorId) && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {majorId === highlights.lowestCutoffMajorId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-band-safe-bg px-2.5 py-1 text-xs font-bold text-band-safe">
                          <Trophy className="h-3 w-3" />
                          أدنى حدّ قبول ملحوظ بين المقارَنين
                        </span>
                      )}
                      {majorId === highlights.highestDemandMajorId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-band-safe-bg px-2.5 py-1 text-xs font-bold text-band-safe">
                          <Trophy className="h-3 w-3" />
                          الأعلى طلباً بين المقارَنين
                        </span>
                      )}
                    </div>
                  )}
                  <h2 className="text-lg font-extrabold text-ink">{major?.name ?? majorId}</h2>
                  {major?.category && <p className="text-xs text-ink-muted">{major.category}</p>}
                </div>

                {!profile && (
                  <p className="text-sm text-ink-muted">جارٍ تحميل بيانات هذا التخصص...</p>
                )}

                {profile && (
                  <>
                    <div>
                      <SectionHeading icon={ListChecks} title="القبول" />
                      <Row label="حدّ القبول الملحوظ">
                        {cutoff ? `${cutoff.min}٪ – ${cutoff.max}٪` : "لا تتوفر بيانات حدّ قبول موثَّقة"}
                      </Row>
                      <Row label="الفروع المؤهَّلة">
                        {eligibility?.allowedBranches?.length ? eligibility.allowedBranches.join("، ") : "غير محدَّد"}
                      </Row>
                      <Row label="القبول المباشر">
                        {eligibility?.hasDirectAdmissionOffers ? "يوجد قبول مباشر في بعض الأقسام" : "لا قبول مباشر موثَّق"}
                      </Row>
                    </div>

                    <div>
                      <SectionHeading icon={GraduationCap} title="الدراسة" />
                      <Row label="مدة الدراسة">
                        {study?.yearsOfStudy ? `${study.yearsOfStudy} سنوات` : "غير متوفرة"}
                        {study?.hasPreparatoryOrInternshipYear ? " + سنة تحضيرية/إقامة إلزامية" : ""}
                      </Row>
                      <Row label="طبيعة الدراسة">
                        {studyNatureParts.length ? studyNatureParts.join(" · ") : "غير متوفرة"}
                      </Row>
                      <Row label="مواد أساسية">
                        {study?.coreSubjects?.length
                          ? study.coreSubjects.slice(0, 4).join("، ") +
                            (study.coreSubjects.length > 4 ? ` +${study.coreSubjects.length - 4} أخرى` : "")
                          : "غير متوفرة"}
                      </Row>
                    </div>

                    <div>
                      <SectionHeading icon={Briefcase} title="العمل" />
                      <Row label="مستوى الطلب">
                        <span className={`font-bold ${market?.demandLevel ? DEMAND_TONE[market.demandLevel] ?? "" : ""}`}>
                          {market?.demandLevel ?? "غير متوفر"}
                        </span>
                      </Row>
                      {market?.saturationNote && <Row label="حالة السوق">{market.saturationNote}</Row>}
                      <Row label="الراتب الحكومي الأول">
                        {career?.governmentBaseSalary?.amount
                          ? `${career.governmentBaseSalary.amount.toLocaleString("ar-IQ")} د.ع`
                          : "غير متوفر"}
                      </Row>
                      <Row label="الترخيص المهني">
                        {licensingState === "yes" && "يتطلّب ترخيصاً"}
                        {licensingState === "partial" && "يتطلّب ترخيصاً في بعض المسارات"}
                        {licensingState === "no" && "لا يتطلّب ترخيصاً"}
                        {licensingState === "unknown" && "غير معروف"}
                      </Row>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
        <p>
          كل الأرقام هنا محسوبة من نفس بيانات المنصة الموثَّقة المصدر لكل تخصص — لا تقييم ذاتي أو ترجيح. غياب حقل يعني
          أننا لم نوثِّقه بعد لهذا التخصص تحديداً، لا أنه غير موجود فعلياً.
        </p>
      </div>
    </div>
  );
}
