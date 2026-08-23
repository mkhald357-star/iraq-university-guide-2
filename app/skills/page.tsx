"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Users, Wrench, Cpu, AlertCircle } from "lucide-react";
import majorsData from "../../data/majors.json";
import { SKILL_CATEGORIES, type SkillCategoryId } from "../../data/skillCategoryGlossary";
import { fetchMajorSkills, type MajorSkillSet, type SkillEntry } from "../../lib/skillsClient";

const CATEGORY_ICON: Record<SkillCategoryId, typeof Users> = {
  soft: Users,
  practical: Wrench,
  digital: Cpu,
};

function GlossarySection() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SKILL_CATEGORIES.map((cat) => {
        const Icon = CATEGORY_ICON[cat.id];
        return (
          <div key={cat.id} className="rounded-md border border-line bg-surface p-5 shadow-sm">
            <span className="inline-flex rounded-xl bg-primary-100 p-2.5 text-primary-700">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-3 font-bold text-ink">{cat.label}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{cat.glossary}</p>
          </div>
        );
      })}
    </div>
  );
}

function SkillCategorySection({ categoryId, skills }: { categoryId: SkillCategoryId; skills: SkillEntry[] }) {
  const meta = SKILL_CATEGORIES.find((c) => c.id === categoryId)!;
  const Icon = CATEGORY_ICON[categoryId];
  return (
    <div className="rounded-md border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-primary-100 p-2.5 text-primary-700">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-bold text-ink">{meta.label}</h2>
      </div>
      <div className="mt-5 grid gap-5">
        {skills.map((s) => (
          <div key={s.name} className="border-s-4 border-primary-200 ps-4">
            <p className="font-bold text-ink">{s.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              <span className="font-bold text-ink-muted">لماذا: </span>
              {s.why}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              <span className="font-bold text-ink-muted">كيف: </span>
              {s.how}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SkillsPage(): ReactNode {
  const [majorId, setMajorId] = useState("");
  const [skillSet, setSkillSet] = useState<MajorSkillSet | null>(null);
  const major = majorsData.find((m) => m.id === majorId);

  useEffect(() => {
    if (!majorId) {
      setSkillSet(null);
      return;
    }
    let cancelled = false;
    fetchMajorSkills(majorId).then((s) => {
      if (!cancelled) setSkillSet(s);
    });
    return () => {
      cancelled = true;
    };
  }, [majorId]);

  return (
    <div dir="rtl" className="mx-auto max-w-3xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-ink">مهارات تسبق التخرّج</h1>
        <p className="mt-1 text-ink-soft">المهارات التي يطلبها سوق تخصصك، وتستطيع بناءها وأنت طالب.</p>
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

      {major && skillSet && (
        <div className="space-y-5">
          <SkillCategorySection categoryId="soft" skills={skillSet.soft} />
          <SkillCategorySection categoryId="practical" skills={skillSet.practical} />
          <SkillCategorySection categoryId="digital" skills={skillSet.digital} />
        </div>
      )}

      {major && !skillSet && (
        <p className="text-center text-ink-muted">لا تتوفر بيانات مهارات لهذا التخصص حالياً.</p>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted p-4 text-sm text-ink-soft">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-muted" />
        <p>
          هذه توصيات مهنية استرشادية مبنية على طبيعة التخصص وسوق العمل الفعلي، لا بيانات رسمية مُستشهَد بها كالحدود
          الدنيا والرواتب في بقية المنصة — اعتبرها نقطة بداية للتفكير، لا قائمة نهائية.
        </p>
      </div>
    </div>
  );
}
