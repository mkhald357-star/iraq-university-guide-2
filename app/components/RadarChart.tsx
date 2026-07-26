"use client";

/**
 * مخطط رادار سداسي عام (لا مكتبة خارجية) — الشكل القياسي لعرض نموذج RIASEC.
 * يدعم شكلاً واحداً (بلا مفتاح ألوان، العنوان يكفي لتعريفه — انظر دليل
 * تصميم الرسوم البيانية) أو شكلين متراكبين (مفتاح ألوان إلزامي، تسمية
 * مباشرة على كل نقطة بدل الاعتماد على اللون وحده).
 */

export interface RadarSeries {
  name: string;
  color: string;
  values: Record<string, number>; // 0-100 لكل مفتاح محور
}

export interface RadarAxis {
  key: string;
  label: string;
}

export function RadarChart({ axes, series, size = 260 }: { axes: RadarAxis[]; series: RadarSeries[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2 - 6;
  const maxR = size / 2 - 44; // مساحة للتسميات حول المحيط
  const n = axes.length;

  const pointAt = (i: number, r: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="مخطط أبعاد الشخصية">
        {/* شبكة الحلقات -- خطوط ثانوية خافتة، لا تنافس بيانات الشكل نفسها */}
        {gridLevels.map((f) => {
          const pts = Array.from({ length: n }, (_, i) => pointAt(i, maxR * f).join(",")).join(" ");
          return <polygon key={f} points={pts} fill="none" stroke="#e2e8f0" strokeWidth={1} />;
        })}
        {/* المحاور */}
        {axes.map((_, i) => {
          const [x, y] = pointAt(i, maxR);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />;
        })}

        {/* أشكال البيانات -- الأولى معبّأة شفافة، الثانية (إن وُجدت) حدّ فقط لتمييزها بصرياً بلا الاعتماد على اللون وحده */}
        {series.map((s, sIdx) => {
          const pts = axes.map((a, i) => pointAt(i, (Math.max(0, Math.min(100, s.values[a.key] ?? 0)) / 100) * maxR));
          const pointsAttr = pts.map((p) => p.join(",")).join(" ");
          return (
            <g key={s.name}>
              <polygon
                points={pointsAttr}
                fill={s.color}
                fillOpacity={sIdx === 0 ? 0.16 : 0.06}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={sIdx === 1 ? "5,4" : undefined}
              />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3.5} fill={s.color} />
              ))}
            </g>
          );
        })}

        {/* تسميات المحاور */}
        {axes.map((a, i) => {
          const [x, y] = pointAt(i, maxR + 22);
          return (
            <text
              key={a.key}
              x={x}
              y={y}
              fontSize={11}
              fontWeight={700}
              fill="#475569"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {a.label}
            </text>
          );
        })}
      </svg>

      {/* مفتاح الألوان -- فقط عند وجود أكثر من شكل واحد (شكل مفرد يكفيه العنوان) */}
      {series.length > 1 && (
        <div className="flex items-center gap-4 text-xs font-bold">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: s.color }} />
              <span style={{ color: s.color }}>{s.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
