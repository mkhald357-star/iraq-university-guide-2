"use client";
import { usePathname } from "next/navigation";
import { useReportIssue } from "../context/ReportIssueContext";

export default function SiteFooter() {
  const pathname = usePathname();
  const reportIssue = useReportIssue();

  return (
    <footer dir="rtl" className="mt-12 border-t border-line py-8 text-center text-sm text-ink-muted">
      <button
        type="button"
        onClick={() => reportIssue({ page: pathname })}
        className="font-bold text-ink-soft underline decoration-dotted underline-offset-4 transition-colors hover:text-primary"
      >
        بلّغ عن خطأ
      </button>
    </footer>
  );
}
