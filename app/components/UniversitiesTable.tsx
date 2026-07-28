// app/components/UniversitiesTable.tsx
"use client";

import { formatGrade } from "../../lib/admissionLabel";

interface UniversityOffering {
  universityName: string;
  universityType?: "حكومية" | "أهلية" | string;
  collegeName: string;
  departmentName?: string;
  province?: string;
  sessions?: string[];
  averageGrades?: Record<string, number | null>;
  isDirectAdmission?: boolean;
  /** اسم التخصص المطابَق (فاحص المعدل/مستكشف الجامعات فقط) -- عمود اختياري،
      يظهر فقط إن وُجد في عرض واحد على الأقل ضمن القائمة الممرَّرة. */
  majorName?: string | null;
}

interface UniversitiesTableProps {
  offerings: UniversityOffering[];
}

export default function UniversitiesTable({ offerings }: UniversitiesTableProps) {
  const hasAnyDirectAdmission = offerings.some((o) => o.isDirectAdmission);
  const hasMajorColumn = offerings.some((o) => !!o.majorName);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-slate-200 text-sm">
        <thead>
          <tr className="bg-slate-100">
            {hasMajorColumn && <th className="border px-3 py-2 text-right">التخصص</th>}
            <th className="border px-3 py-2 text-right">الجامعة</th>
            <th className="border px-3 py-2 text-right">النوع</th>
            <th className="border px-3 py-2 text-right">المحافظة</th>
            <th className="border px-3 py-2 text-right">الكلية</th>
            <th className="border px-3 py-2 text-right">القسم</th>
            <th className="border px-3 py-2 text-right">صباحي</th>
            <th className="border px-3 py-2 text-right">مسائي</th>
          </tr>
        </thead>
        <tbody>
          {offerings.map((o, idx) => {
            const hasMorning = !!o.sessions?.includes("صباحي");
            const hasEvening = !!o.sessions?.includes("مسائي");
            const morning = formatGrade(o.averageGrades?.["صباحي"], hasMorning, !!o.isDirectAdmission);
            const evening = formatGrade(o.averageGrades?.["مسائي"], hasEvening, !!o.isDirectAdmission);
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
                <td className="border px-3 py-2">{o.departmentName ?? "—"}</td>
                <td className={`border px-3 py-2 ${morning.isDirect ? "text-emerald-700 font-bold" : ""}`}>
                  <span
                    title={
                      morning.isDirect
                        ? "لا يوجد حدّ قبول تنافسي مُعلَن لهذا القسم — القبول بلا منافسة على المعدل ضمن الفرع/الجلسة، لا مجرد بيانات ناقصة."
                        : undefined
                    }
                  >
                    {morning.text}
                  </span>
                </td>
                <td className={`border px-3 py-2 ${evening.isDirect ? "text-emerald-700 font-bold" : ""}`}>
                  <span
                    title={
                      evening.isDirect
                        ? "لا يوجد حدّ قبول تنافسي مُعلَن لهذا القسم — القبول بلا منافسة على المعدل ضمن الفرع/الجلسة، لا مجرد بيانات ناقصة."
                        : undefined
                    }
                  >
                    {evening.text}
                  </span>
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
    </div>
  );
}
