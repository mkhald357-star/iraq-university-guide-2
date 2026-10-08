// app/components/UniversitiesTable.tsx
"use client";

import { usePathname } from "next/navigation";
import { Flag } from "lucide-react";
import { admissionCell, GOV_EVENING_MIN_HINT } from "../../lib/admissionLabel";
import { ChannelBadge } from "./ChannelNotice";
import { useReportIssue } from "../context/ReportIssueContext";
import {
  CUTOFFS_YEAR,
  PRIVATE_MIN_HINT,
  PRIVATE_NO_MIN_HINT,
  BRANCH_UNKNOWN_BADGE,
} from "../../lib/admissionDisclosure";

interface UniversityOffering {
  universityName: string;
  universityType?: "حكومية" | "أهلية" | string;
  collegeName: string;
  departmentName?: string;
  province?: string;
  sessions?: string[];
  averageGrades?: Record<string, number | null>;
  isDirectAdmission?: boolean;
  statedMinimumGrade?: { value: number } | null;
  /** false لقسم بلا فرع معروف (fetchOfferingsForBranch فقط -- §29). undefined
      لعروض لا تحمل مفهوم "فرع" أصلاً (نتائج /report المطابَقة بالاسم مباشرة). */
  branchKnown?: boolean;
  /** اسم التخصص المطابَق (فاحص المعدل/مستكشف الجامعات فقط) -- عمود اختياري،
      يظهر فقط إن وُجد في عرض واحد على الأقل ضمن القائمة الممرَّرة. */
  majorName?: string | null;
}

interface UniversitiesTableProps {
  offerings: UniversityOffering[];
}

function cellClass(tone: string) {
  if (tone === "stated") return "text-primary-800 font-bold";
  if (tone === "unstated") return "text-ink-muted italic";
  return "";
}

function cellTitle(tone: string) {
  if (tone === "evening") return GOV_EVENING_MIN_HINT;
  if (tone === "stated") return PRIVATE_MIN_HINT;
  if (tone === "unstated") return PRIVATE_NO_MIN_HINT;
  return undefined;
}

export default function UniversitiesTable({ offerings }: UniversitiesTableProps) {
  const pathname = usePathname();
  const reportIssue = useReportIssue();
  const hasAnyNoPublishedCutoff = offerings.some(
    (o) =>
      o.universityType !== "أهلية" &&
      ((o.sessions?.includes("صباحي") && o.averageGrades?.["صباحي"] == null) ||
        (o.sessions?.includes("مسائي") && o.averageGrades?.["مسائي"] == null))
  );
  const hasAnyGovEvening = offerings.some(
    (o) => o.universityType !== "أهلية" && o.sessions?.includes("مسائي") && o.averageGrades?.["مسائي"] != null
  );
  const hasAnyPrivate = offerings.some((o) => o.universityType === "أهلية");
  const hasMajorColumn = offerings.some((o) => !!o.majorName);

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex justify-end">
        <ChannelBadge />
      </div>
      <table className="min-w-full border border-line text-sm">
        <thead>
          <tr className="bg-surface-muted">
            {hasMajorColumn && <th className="border px-3 py-2 text-right">التخصص</th>}
            <th className="border px-3 py-2 text-right">الجامعة</th>
            <th className="border px-3 py-2 text-right">النوع</th>
            <th className="border px-3 py-2 text-right">المحافظة</th>
            <th className="border px-3 py-2 text-right">الكلية</th>
            <th className="border px-3 py-2 text-right">القسم</th>
            <th className="border px-3 py-2 text-right">صباحي ({CUTOFFS_YEAR})</th>
            <th className="border px-3 py-2 text-right">مسائي ({CUTOFFS_YEAR})</th>
            <th className="border px-3 py-2 text-right">
              <span className="sr-only">إبلاغ</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {offerings.map((o, idx) => {
            const hasMorning = !!o.sessions?.includes("صباحي");
            const hasEvening = !!o.sessions?.includes("مسائي");
            const morning = admissionCell(
              o.universityType,
              hasMorning,
              !!o.isDirectAdmission,
              o.averageGrades?.["صباحي"],
              o.statedMinimumGrade
            );
            const evening = admissionCell(
              o.universityType,
              hasEvening,
              !!o.isDirectAdmission,
              o.averageGrades?.["مسائي"],
              o.statedMinimumGrade,
              "مسائي"
            );
            return (
              <tr key={idx} className={idx % 2 === 0 ? "bg-surface" : "bg-surface-muted"}>
                {hasMajorColumn && <td className="border px-3 py-2 text-ink-soft">{o.majorName ?? "—"}</td>}
                <td className="border px-3 py-2 font-bold text-ink">{o.universityName}</td>
                <td className="border px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      o.universityType === "أهلية"
                        ? "bg-primary-800/10 text-primary-800"
                        : "bg-primary/10 text-primary-text"
                    }`}
                  >
                    {o.universityType === "أهلية" ? "أهلية" : "حكومية"}
                  </span>
                </td>
                <td className="border px-3 py-2">{o.province ?? "—"}</td>
                <td className="border px-3 py-2">{o.collegeName}</td>
                <td className="border px-3 py-2">
                  {o.departmentName ?? "—"}
                  {o.branchKnown === false && (
                    <span className="ms-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold text-ink-muted">
                      {BRANCH_UNKNOWN_BADGE}
                    </span>
                  )}
                </td>
                <td className={`border px-3 py-2 ${cellClass(morning.tone)}`}>
                  <span title={cellTitle(morning.tone)}>{morning.text}</span>
                </td>
                <td className={`border px-3 py-2 ${cellClass(evening.tone)}`}>
                  <span title={cellTitle(evening.tone)}>{evening.text}</span>
                </td>
                <td className="border px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      reportIssue({
                        page: pathname,
                        university: o.universityName,
                        college: o.collegeName,
                        department: o.departmentName,
                        shownValue: `صباحي: ${morning.text} · مسائي: ${evening.text}`,
                      })
                    }
                    aria-label={`بلّغ عن خطأ في ${o.departmentName ?? o.collegeName}`}
                    title="بلّغ عن خطأ"
                    className="rounded-sm p-1.5 text-ink-muted opacity-60
                               transition-opacity duration-200 hover:text-band-reach hover:opacity-100
                               focus-visible:opacity-100"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasAnyNoPublishedCutoff && (
        <p className="text-xs text-ink-muted mt-2">
          <span className="text-ink-muted font-bold">لا حدّ منشور في دليل 2025-2026</span>: لم يرد لهذا القسم حدّ قبول
          تنافسي منشور في ملف الحدود الدنيا الرسمي لهذا العام (مثل الأقسام المستحدثة أو المستثناة مركزياً).
        </p>
      )}
      {hasAnyGovEvening && (
        <p className="text-xs text-ink-muted mt-1">
          <span className="text-ink-soft font-bold">المسائي (حدّ أدنى)</span>: {GOV_EVENING_MIN_HINT}
        </p>
      )}
      {hasAnyPrivate && (
        <p className="text-xs text-ink-muted mt-1">
          <span className="text-primary-800 font-bold">يشترط معدل X%</span>: شرط معدّل معلَن مسبقاً في دليل الجامعات
          الأهلية — لا نتيجة قبول بأثر رجعي كحدود الجامعات الحكومية.{" "}
          <span className="text-ink-muted italic">الحدّ الأدنى غير متوفّر</span>: الدليل لا يذكر حدّاً لهذا القسم
          تحديداً — هذا لا يعني بالضرورة عدم وجود شرط فعلي غير منشور في مصدرنا.
        </p>
      )}
    </div>
  );
}
