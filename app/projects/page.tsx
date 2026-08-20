"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Wrench, Sparkles, Search, AlertCircle } from "lucide-react";
import majorsData from "../../data/majors.json";
import { PROJECT_ANGLES, type ProjectAngleId } from "../../data/projectAngleGlossary";
import { fetchMajorProjects, type MajorProjectSet, type ProjectIdea } from "../../lib/projectsClient";

const ANGLE_ICON: Record<ProjectAngleId, typeof Wrench> = {
  technical: Wrench,
  ai: Sparkles,
  research: Search,
};

function GlossarySection() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PROJECT_ANGLES.map((angle) => {
        const Icon = ANGLE_ICON[angle.id];
        return (
          <div key={angle.id} className="rounded-md border border-line bg-surface p-5 shadow-sm">
            <span className="inline-flex rounded-xl bg-primary-100 p-2.5 text-primary-700">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-3 font-bold text-ink">{angle.label}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{angle.glossary}</p>
          </div>
        );
      })}
    </div>
  );
}

function IdeaCard({ idea }: { idea: ProjectIdea }) {
  return (
    <details className="group rounded-md border border-line bg-surface p-4 open:shadow-sm">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        {idea.title}
        <svg
          className="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-45"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
        <p>
          <span className="font-bold text-ink-muted">المشكلة: </span>
          {idea.problem}
        </p>
        <p>
          <span className="font-bold text-ink-muted">التنفيذ: </span>
          {idea.description}
        </p>
      </div>
    </details>
  );
}

function AngleSection({ angleId, ideas }: { angleId: ProjectAngleId; ideas: ProjectIdea[] }) {
  const meta = PROJECT_ANGLES.find((a) => a.id === angleId)!;
  const Icon = ANGLE_ICON[angleId];
  return (
    <div className="rounded-md border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-primary-100 p-2.5 text-primary-700">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-bold text-ink">
          {meta.label} <span className="text-sm font-normal text-ink-muted">({ideas.length})</span>
        </h2>
      </div>
      <div className="mt-5 grid gap-2.5">
        {ideas.map((idea, i) => (
          <IdeaCard key={i} idea={idea} />
        ))}
      </div>
    </div>
  );
}

export default function ProjectsPage(): ReactNode {
  const [majorId, setMajorId] = useState("");
  const [projectSet, setProjectSet] = useState<MajorProjectSet | null>(null);
  const major = majorsData.find((m) => m.id === majorId);

  useEffect(() => {
    if (!majorId) {
      setProjectSet(null);
      return;
    }
    let cancelled = false;
    fetchMajorProjects(majorId).then((p) => {
      if (!cancelled) setProjectSet(p);
    });
    return () => {
      cancelled = true;
    };
  }, [majorId]);

  return (
    <div dir="rtl" className="mx-auto max-w-3xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">بنك أفكار مشاريع التخرّج</h1>
        <p className="mt-1 text-ink-soft">أفكار مشاريع مرتبطة بتخصصك وبحاجة حقيقية في السوق المحلي.</p>
      </div>

      <GlossarySection />

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

      {major && projectSet && (
        <div className="space-y-5">
          <AngleSection angleId="technical" ideas={projectSet.technical} />
          <AngleSection angleId="ai" ideas={projectSet.ai} />
          <AngleSection angleId="research" ideas={projectSet.research} />
          <AngleSection angleId="impact" ideas={projectSet.impact} />
        </div>
      )}

      {major && !projectSet && (
        <p className="text-center text-ink-muted">لا تتوفر أفكار مشاريع لهذا التخصص حالياً.</p>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
        <p>
          هذه أفكار استرشادية مبنية على طبيعة التخصص، لا مسحاً سوقياً موثَّقاً — نقطة بداية للتفكير والتخصيص، لا قائمة
          نهائية أو تقييماً لجدوى تجارية فعلية.
        </p>
      </div>
    </div>
  );
}
