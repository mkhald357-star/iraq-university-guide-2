"use client";
import { createContext, useCallback, useContext, useState } from "react";
import ReportIssueDialog from "../components/ReportIssueDialog";
import type { IssueContext } from "../../lib/reportIssue";

const ReportIssueCtx = createContext<((ctx: IssueContext) => void) | null>(null);

/**
 * يوفّر reportIssue(ctx) لأي مكوّن عبر useReportIssue() -- نقطة تركيب واحدة
 * (app/layout.tsx) بدل نافذة منفصلة في كل موضع استدعاء (data/admission_rules.md §33).
 */
export function ReportIssueProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<IssueContext | null>(null);

  const reportIssue = useCallback((ctx: IssueContext) => setContext(ctx), []);
  const close = useCallback(() => setContext(null), []);

  return (
    <ReportIssueCtx.Provider value={reportIssue}>
      {children}
      <ReportIssueDialog context={context} onClose={close} />
    </ReportIssueCtx.Provider>
  );
}

export function useReportIssue(): (ctx: IssueContext) => void {
  const fn = useContext(ReportIssueCtx);
  if (!fn) throw new Error("useReportIssue() يجب أن يُستعمَل داخل ReportIssueProvider");
  return fn;
}
