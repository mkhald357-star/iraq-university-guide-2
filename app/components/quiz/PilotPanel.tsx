"use client";

import { useState } from "react";
import majorsData from "../../../data/majors.json";
import { encodePilotRecord } from "../../../lib/pilotCode";

/**
 * لوحة التجربة الميدانية (الإصدار 2، المسار هـ) -- تظهر **فقط** برابط
 * /quiz?pilot=1 الذي يُعطى للطلاب المشاركين. تنتج رمزاً نصياً ينسخه الطالب
 * ويرسله طوعاً؛ لا يُرسل شيء تلقائياً. التفاصيل والخصوصية في lib/pilotCode.ts.
 */
export function PilotPanel({
  branch,
  grade,
  subjectGrades,
  answers,
  shownLeads,
}: {
  branch: string;
  grade: number;
  subjectGrades: Record<string, number | undefined>;
  answers: Record<string, number>;
  shownLeads: string[];
}) {
  const [intended, setIntended] = useState<string>("");
  const [rating, setRating] = useState<number | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const build = () => {
    const cleanSubjects = Object.fromEntries(
      Object.entries(subjectGrades).filter((e): e is [string, number] => typeof e[1] === "number")
    );
    setCode(
      encodePilotRecord({
        day: new Date().toISOString().slice(0, 10),
        branch,
        grade: Math.round(grade),
        subjectGrades: cleanSubjects,
        answers,
        shownLeads,
        intendedMajorId: intended || null,
        fitRating: rating,
      })
    );
    setCopied(false);
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      aria-labelledby="pilot-title"
      className="space-y-4 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50 p-5"
    >
      <div>
        <h2 id="pilot-title" className="text-lg font-bold text-ink">
          مشاركتك في تجربة التحقق من دقة المنصة
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          سؤالان قصيران، ثم رمز تنسخه وترسله لمنظّم التجربة. الرمز يحمل إجاباتك وفرعك ومعدلك فقط —{" "}
          <strong>بلا اسم ولا محافظة ولا أي وسيلة تواصل</strong>، ولا يُرسَل شيء من هنا تلقائياً.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-bold text-ink">ما التخصص الذي تدرسه أو تنوي دراسته فعلاً؟</span>
        <select
          value={intended}
          onChange={(e) => setIntended(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink"
        >
          <option value="">لم أقرّر بعد</option>
          {majorsData.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-1">
        <legend className="text-sm font-bold text-ink">كم تناسبك هذه التوصيات؟</legend>
        <div className="flex gap-2" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              onClick={() => setRating(n)}
              className={`h-11 w-11 rounded-xl border font-bold transition-colors ${
                rating === n ? "border-primary-solid bg-primary-solid text-white" : "border-line bg-surface text-ink"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">1 = لا تناسبني إطلاقاً · 5 = تناسبني تماماً</p>
      </fieldset>

      <button
        type="button"
        onClick={build}
        className="w-full rounded-xl bg-primary-solid p-3 font-bold text-white hover:bg-primary-solid-hover"
      >
        أنشئ رمز مشاركتي
      </button>

      {code && (
        <div className="space-y-2">
          <label htmlFor="pilot-code" className="text-sm font-bold text-ink">
            رمزك — انسخه وأرسله لمنظّم التجربة:
          </label>
          <textarea
            id="pilot-code"
            readOnly
            value={code}
            dir="ltr"
            rows={4}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-xl border border-line bg-surface p-2 font-mono text-xs text-ink"
          />
          <button
            type="button"
            onClick={copy}
            className="w-full rounded-xl border border-primary-200 bg-surface p-2.5 font-bold text-primary-text"
          >
            {copied ? "نُسخ ✓" : "انسخ الرمز"}
          </button>
        </div>
      )}
    </section>
  );
}
