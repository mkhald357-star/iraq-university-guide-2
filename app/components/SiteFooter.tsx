"use client";
import { usePathname } from "next/navigation";
import { useReportIssue } from "../context/ReportIssueContext";
import ThemeToggle from "./ThemeToggle";

export default function SiteFooter() {
  const pathname = usePathname();
  const reportIssue = useReportIssue();

  return (
    <footer dir="rtl" className="mt-12 border-t border-line py-8 text-sm text-ink-muted">
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-4 px-4">
        <button
          type="button"
          onClick={() => reportIssue({ page: pathname })}
          className="font-bold text-ink-soft underline decoration-dotted underline-offset-4 transition-colors hover:text-primary-text"
        >
          بلّغ عن خطأ
        </button>
        <span className="text-line" aria-hidden="true">
          ·
        </span>
        <ThemeToggle />
      </div>
    </footer>
  );
}
