// app/components/UniversitiesTable.tsx
"use client";

interface UniversityOffering {
  universityName: string;
  universityType?: "حكومية" | "أهلية" | string;
  collegeName: string;
  departmentName?: string;
  province?: string;
  sessions?: string[];
  averageGrades?: Record<string, number | null>;
  isDirectAdmission?: boolean;
}

interface UniversitiesTableProps {
  offerings: UniversityOffering[];
}

function formatGrade(value: number | null | undefined, sessionAvailable: boolean) {
  if (!sessionAvailable) return "—";
  if (value == null) return "قبول مباشر";
  return `${value}%`;
}

export default function UniversitiesTable({ offerings }: UniversitiesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-slate-200 text-sm">
        <thead>
          <tr className="bg-slate-100">
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
            return (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="border px-3 py-2 font-bold text-slate-800">{o.universityName}</td>
                <td className="border px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      o.universityType === "أهلية"
                        ? "bg-secondary/10 text-secondary"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {o.universityType === "أهلية" ? "أهلية" : "حكومية"}
                  </span>
                </td>
                <td className="border px-3 py-2">{o.province ?? "—"}</td>
                <td className="border px-3 py-2">{o.collegeName}</td>
                <td className="border px-3 py-2">{o.departmentName ?? "—"}</td>
                <td className="border px-3 py-2">{formatGrade(o.averageGrades?.["صباحي"], hasMorning)}</td>
                <td className="border px-3 py-2">{formatGrade(o.averageGrades?.["مسائي"], hasEvening)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
