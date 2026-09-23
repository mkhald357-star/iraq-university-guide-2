"use client";

import { useState } from "react";
import majorsData from "../../../data/majors.json";
import type { IntentSource } from "../../../lib/pilotCode";

export interface PilotIntakeResult {
  /** false = اختار الطالب الإكمال بلا مشاركة؛ لا تظهر له لوحة الرمز. */
  participating: boolean;
  intendedMajorId: string | null;
  intentSource: IntentSource | null;
  intentCertainty: number | null;
}

const SOURCES: { value: IntentSource; label: string }[] = [
  { value: "interest", label: "لأنه يناسب ميولي واهتماماتي" },
  { value: "grade", label: "لأن معدلي يسمح به أو يناسبه" },
  { value: "family", label: "لأن أهلي يريدونه" },
  { value: "admitted", label: "قُبلت فيه فعلاً" },
  { value: "other", label: "سبب آخر" },
];

/**
 * بوابة التجربة الميدانية قبل الاختبار (الإصدار 2، المسار هـ) -- تظهر **فقط**
 * برابط /quiz?pilot=1.
 *
 * لماذا قبل الاختبار (المدقّق): سؤال "ماذا تنوي أن تدرس؟" بعد رؤية المجالات
 * الثلاثة يثبّت الإجابة على ما عُرض، فيقيس المحرك نفسه بنفسه. ومصدر النيّة
 * ويقينها يفصلان "أدرسه لأنه يناسبني" عن "لأن معدلي يسمح".
 *
 * الموافقة: أغلب المشاركين دون 18 سنة، فالنص يطلب موافقة وليّ الأمر صراحةً،
 * والإكمال بلا مشاركة متاح دائماً ولا يغيّر شيئاً في الاختبار.
 */
export function PilotIntake({ onDone }: { onDone: (r: PilotIntakeResult) => void }) {
  const [consent, setConsent] = useState(false);
  const [intended, setIntended] = useState("");
  const [source, setSource] = useState<IntentSource | null>(null);
  const [certainty, setCertainty] = useState<number | null>(null);

  return (
    <section
      aria-labelledby="pilot-intake-title"
      className="mx-auto max-w-2xl space-y-5 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50 p-5 md:p-8"
    >
      <div className="space-y-2">
        <h1 id="pilot-intake-title" className="text-xl font-bold text-ink">
          قبل أن تبدأ: تجربة التحقق من دقة المنصة
        </h1>
        <p className="text-sm text-ink-soft">
          نختبر هل توصيات المنصة تطابق ما يختاره الطلاب فعلاً. في النهاية ستحصل على رمز نصي تنسخه وترسله لمنظّم
          التجربة <strong>إن أردت</strong>. الرمز يحمل إجاباتك وفرعك ومعدلك ودرجات موادك مقرَّبة —{" "}
          <strong>بلا اسم ولا محافظة ولا أي وسيلة تواصل</strong>، ولا يُرسَل شيء من هنا تلقائياً.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-5 w-5 accent-primary"
        />
        <span>
          أوافق على المشاركة. <strong>إن كان عمري دون 18 سنة</strong> فقد أخبرت وليّ أمري ووافق.
        </span>
      </label>

      <fieldset disabled={!consent} className="space-y-5 disabled:opacity-50">
        <label className="block space-y-1">
          <span className="text-sm font-bold text-ink">ما التخصص الذي تدرسه أو تنوي دراسته فعلاً؟</span>
          <select
            value={intended}
            onChange={(e) => {
              setIntended(e.target.value);
              if (!e.target.value) {
                setSource(null);
                setCertainty(null);
              }
            }}
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

        {intended && (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold text-ink">لماذا هذا التخصص بالذات؟</legend>
              {SOURCES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="intent-source"
                    checked={source === s.value}
                    onChange={() => setSource(s.value)}
                    className="h-4 w-4 accent-primary"
                  />
                  {s.label}
                </label>
              ))}
            </fieldset>

            <fieldset className="space-y-1">
              <legend className="text-sm font-bold text-ink">كم أنت متأكد من هذا الاختيار؟</legend>
              <div className="flex gap-2" role="radiogroup">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={certainty === n}
                    onClick={() => setCertainty(n)}
                    className={`h-11 w-11 rounded-xl border font-bold transition-colors ${
                      certainty === n ? "border-primary-solid bg-primary-solid text-white" : "border-line bg-surface text-ink"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-muted">1 = متردّد جداً · 5 = متأكد تماماً</p>
            </fieldset>
          </>
        )}
      </fieldset>

      <div className="space-y-2">
        <button
          type="button"
          disabled={!consent || (!!intended && (!source || !certainty))}
          onClick={() =>
            onDone({
              participating: true,
              intendedMajorId: intended || null,
              intentSource: intended ? source : null,
              intentCertainty: intended ? certainty : null,
            })
          }
          className="w-full rounded-xl bg-primary-solid p-3 font-bold text-white hover:bg-primary-solid-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          ابدأ الاختبار
        </button>
        <button
          type="button"
          onClick={() => onDone({ participating: false, intendedMajorId: null, intentSource: null, intentCertainty: null })}
          className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm font-bold text-ink-soft"
        >
          أكمل الاختبار بلا مشاركة
        </button>
      </div>
    </section>
  );
}
