export default function JointChart({ joint }) {
  const W = 560;
  const H = 120;
  const l = 30;
  const r = 12;
  const tp = 10;
  const b = 24;
  const n = joint.length;
  let mx = 0;
  joint.forEach((j) => {
    if (j.s != null) mx = Math.max(mx, j.s);
  });
  mx = mx || 1;
  const bw = (W - l - r) / n;

  return (
    <svg className="ch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Joint anomaly score by month">
      <line className="grid" x1={l} x2={W - r} y1={H - b} y2={H - b} />
      <text className="ax" x={l - 6} y={tp + 4} textAnchor="end">
        {mx.toFixed(1)}
      </text>
      <text className="ax" x={l - 6} y={H - b + 4} textAnchor="end">
        0
      </text>
      {joint.map((j, i) => {
        const x = l + i * bw + bw * 0.15;
        const w = bw * 0.7;
        if (j.s == null) return <rect key={i} x={x.toFixed(1)} y={H - b - 3} width={w.toFixed(1)} height="3" fill="var(--line)" />;
        const h = Math.max(2, ((H - tp - b) * j.s) / mx);
        return (
          <rect
            key={i}
            x={x.toFixed(1)}
            y={(H - b - h).toFixed(1)}
            width={w.toFixed(1)}
            height={h.toFixed(1)}
            rx="2"
            fill={j.flag ? 'var(--crit)' : 'var(--muted)'}
            fillOpacity={j.flag ? 1 : 0.45}
          />
        );
      })}
      {joint.map(
        (_, i) =>
          (i === 0 || (i + 1) % 4 === 0) && (
            <text key={i} className="ax" x={(l + i * bw + bw / 2).toFixed(1)} y={H - 8} textAnchor="middle">
              {i + 1}
            </text>
          )
      )}
    </svg>
  );
}
