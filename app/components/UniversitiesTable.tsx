// app/components/UniversitiesTable.tsx
"use client";

interface UniversityOffering {
  universityName: string;
  collegeName: string;
  sessions?: string[];
  averageGrades?: Record<string, number | null>;
  province?: string;
}

interface UniversitiesTableProps {
  offerings: UniversityOffering[];
}

export default function UniversitiesTable({ offerings }: UniversitiesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-slate-200">
        <thead>
          <tr className="bg-slate-100">
            <th className="border px-3 py-2 text-right">الجامعة</th>
            <th className="border px-3 py-2 text-right">الكلية</th>
            <th className="border px-3 py-2 text-right">الجلسة</th>
            <th className="border px-3 py-2 text-right">متوسط الدرجات</th>
            <th className="border px-3 py-2 text-right">الموقع</th>
          </tr>
        </thead>
        <tbody>
          {offerings.map((o, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              <td className="border px-3 py-2">{o.universityName}</td>
              <td className="border px-3 py-2">{o.collegeName}</td>
              <td className="border px-3 py-2">{o.sessions?.[0] ?? ""}</td>
              <td className="border px-3 py-2">
                {o.averageGrades?.["صباحي"] != null ? o.averageGrades?.["صباحي"] : "—"}
              </td>
              <td className="border px-3 py-2">{o.province}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
