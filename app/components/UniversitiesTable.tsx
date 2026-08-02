// app/components/UniversitiesTable.tsx
"use client";

import { admissionCell } from "../../lib/admissionLabel";
import { ChannelBadge } from "./ChannelNotice";
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
  if (tone === "direct") return "text-emerald-700 font-bold";
  if (tone === "stated") return "text-primary-800 font-bold";
  if (tone === "unstated") return "text-slate-500 italic";
  return "";
}

function cellTitle(tone: string) {
  if (tone === "direct")
    return "لا يوجد حدّ قبول تنافسي مُعلَن لهذا القسم — القبول بلا منافسة على المعدل ضمن الفرع/الجلسة، لا مجرد بيانات ناقصة.";
  if (tone === "stated") return PRIVATE_MIN_HINT;
  if (tone === "unstated") return PRIVATE_NO_MIN_HINT;
  return undefined;
}

export default function UniversitiesTable({ offerings }: UniversitiesTableProps) {
  const hasAnyDirectAdmission = offerings.some((o) => o.universityType !== "أهلية" && o.isDirectAdmission);
  const hasAnyPrivate = offerings.some((o) => o.universityType === "أهلية");
  const hasMajorColumn = offerings.some((o) => !!o.majorName);

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex justify-end">
        <ChannelBadge />
      </div>
      <table className="min-w-full border border-slate-200 text-sm">
        <thead>
          <tr className="bg-slate-100">
            {hasMajorColumn && <th className="border px-3 py-2 text-right">التخصص</th>}
            <th className="border px-3 py-2 text-right">الجامعة</th>
            <th className="border px-3 py-2 text-right">النوع</th>
            <th className="border px-3 py-2 text-right">المحافظة</th>
            <th className="border px-3 py-2 text-right">الكلية</th>
            <th className="border px-3 py-2 text-right">القسم</th>
            <th className="border px-3 py-2 text-right">صباحي ({CUTOFFS_YEAR})</th>
            <th className="border px-3 py-2 text-right">مسائي ({CUTOFFS_YEAR})</th>
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
              o.statedMinimumGrade
            );
            return (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                {hasMajorColumn && (
                  <td className="border px-3 py-2 text-slate-600">{o.majorName ?? "—"}</td>
                )}
                <td className="border px-3 py-2 font-bold text-slate-800">{o.universityName}</td>
                <td className="border px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      o.universityType === "أهلية" ? "bg-primary-800/10 text-primary-800" : "bg-primary/10 text-primary"
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
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasAnyDirectAdmission && (
        <p className="text-xs text-slate-500 mt-2">
          <span className="text-emerald-700 font-bold">قبول مباشر</span>: لا يوجد حدّ قبول تنافسي مُعلَن لهذا القسم ضمن
          الدليل الرسمي — أي طالب مؤهَّل بفرعه يُقبَل دون منافسة على المعدل، وهذا ليس نقصاً في البيانات.
        </p>
      )}
      {hasAnyPrivate && (
        <p className="text-xs text-slate-500 mt-1">
          <span className="text-primary-800 font-bold">يشترط معدل X%</span>: شرط معدّل معلَن مسبقاً في دليل الجامعات
          الأهلية — لا نتيجة قبول بأثر رجعي كحدود الجامعات الحكومية.{" "}
          <span className="text-slate-500 italic">الحدّ الأدنى غير متوفّر</span>: الدليل لا يذكر حدّاً لهذا القسم تحديداً —
          هذا لا يعني بالضرورة عدم وجود شرط فعلي غير منشور في مصدرنا.
        </p>
      )}
    </div>
  );
}
