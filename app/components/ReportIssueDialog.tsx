"use client";
import { useEffect, useRef, useState } from "react";
import { buildReportText, telegramLink, instagramLink, type IssueContext } from "../../lib/reportIssue";
import { REPORT_TELEGRAM_HANDLE, REPORT_INSTAGRAM_HANDLE } from "../../lib/siteMeta";

export default function ReportIssueDialog({ context, onClose }: { context: IssueContext | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (context) {
      setText(buildReportText(context));
      if (!d.open) d.showModal();
    }
  }, [context]);

  const close = () => {
    const d = ref.current;
    if (!d) return;
    d.classList.add("is-closing");
    window.setTimeout(() => {
      d.classList.remove("is-closing");
      d.close();
      onClose();
    }, 160);
  };

  return (
    <dialog
      ref={ref}
      dir="rtl"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      className="soon m-auto w-[min(94vw,34rem)] rounded-lg border border-line
                 bg-surface p-0 text-ink shadow-lg backdrop:bg-black/50"
    >
      {/* محتوى داخلي مشروط بـcontext لا مُركَّب دائماً -- <dialog> مغلق يظل
          يُصيَّر محتواه بالكامل في HTML (بخلاف {false && ...})، وChromium
          يطبّق caret-color:transparent داخلياً على العناصر القابلة للتركيز
          ضمن dialog مغلق وقت الترطيب (hydration) بلا مقابل في HTML الخادم --
          عدم اختلاف حقيقي في المنطق، لكنه يُنتج تحذير ترطيب صاخباً. تجنُّبه
          بعدم تصيير textarea إطلاقاً إلا عند فتح الحوار فعلاً (اكتُشف حياً،
          data/admission_rules.md §33). */}
      {context && (
        <div className="p-6">
          <h2 className="text-xl font-extrabold">بلّغ عن خطأ</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            إذا لقيت رقماً غلط أو قسماً ما يوجد، خبّرنا. نراجعه مقابل الدليل الرسمي ونصلّحه.
          </p>

          <label className="mt-5 block text-sm font-bold text-ink" htmlFor="report-text">
            نصّ البلاغ — عدّله كما تحب
          </label>
          <textarea
            id="report-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            dir="rtl"
            className="mt-2 w-full rounded-md border border-line bg-surface-subtle p-3
                       text-sm leading-relaxed text-ink
                       focus-visible:outline focus-visible:outline-2
                       focus-visible:outline-primary-600"
          />

          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            ما نرسل شي تلقائياً. النصّ يتكوّن بجهازك، وأنت اللي ترسله. ما نضيف معدّلك ولا أي معلومة عنك. عند الضغط على
            تلغرام أو إنستغرام ننسخ النصّ لك، فالصقه في المحادثة. حساباتنا الوحيدة: تلغرام {REPORT_TELEGRAM_HANDLE}{" "}
            وإنستغرام {REPORT_INSTAGRAM_HANDLE}، وأي حساب آخر باسمنا ليس لنا.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={telegramLink()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                navigator.clipboard?.writeText(text);
                close();
              }}
              className="rounded-md px-5 py-2.5 text-sm font-bold text-white
                         transition-transform duration-200 hover:-translate-y-0.5"
              style={{ background: "var(--g-primary)" }}
            >
              أرسل عبر تلغرام
            </a>

            <a
              href={instagramLink()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                navigator.clipboard?.writeText(text);
                close();
              }}
              className="rounded-md border border-line px-5 py-2.5 text-sm font-bold text-ink-soft
                         transition-colors duration-200 hover:bg-surface-muted"
            >
              أرسل عبر إنستغرام
            </a>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(text);
              }}
              className="rounded-md border border-line px-5 py-2.5 text-sm font-bold text-ink-soft
                         transition-colors duration-200 hover:bg-surface-muted"
            >
              انسخ النصّ
            </button>

            <button
              type="button"
              onClick={close}
              className="rounded-md px-4 py-2.5 text-sm font-bold text-ink-muted
                         transition-colors duration-200 hover:bg-surface-muted"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
