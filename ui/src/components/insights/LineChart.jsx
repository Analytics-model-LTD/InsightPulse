import { fmtTick, titleCase } from '../../utils/format';

const markColor = (a) => (a.fav ? 'var(--good)' : a.sev === 'critical' ? 'var(--crit)' : a.sev === 'warning' ? 'var(--warn)' : 'var(--info)');

export default function LineChart({ m, vals, bands, marks }) {
  const W = 560;
  const H = 190;
  const l = 46;
  const r = 12;
  const tp = 12;
  const b = 26;
  const n = vals.length;

  let lo = Infinity;
  let hi = -Infinity;
  vals.forEach((v) => {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  });
  bands.forEach((bd) => {
    if (bd) {
      lo = Math.min(lo, bd.lo);
      hi = Math.max(hi, bd.hi);
    }
  });
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad;
  hi += pad;

  const X = (i) => l + ((W - l - r) * i) / (n - 1);
  const Y = (v) => tp + (H - tp - b) * (1 - (v - lo) / (hi - lo));

  const top = [];
  const bot = [];
  bands.forEach((bd, i) => {
    if (bd) {
      top.push(X(i).toFixed(1) + ',' + Y(bd.hi).toFixed(1));
      bot.unshift(X(i).toFixed(1) + ',' + Y(bd.lo).toFixed(1));
    }
  });
  const pts = vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
  const gid = 'ag-' + String(m.id).replace(/\W/g, '');

  return (
    <svg className="ch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titleCase(m.id)} over 24 months`}>
      {[0, 1, 2, 3].map((k) => {
        const val = lo + ((hi - lo) * k) / 3;
        const y = Y(val);
        return (
          <g key={k}>
            <line className="grid" x1={l} x2={W - r} y1={y.toFixed(1)} y2={y.toFixed(1)} />
            <text className="ax" x={l - 6} y={(y + 4).toFixed(1)} textAnchor="end">
              {fmtTick(m, val)}
            </text>
          </g>
        );
      })}
      {vals.map(
        (_, i) =>
          (i === 0 || (i + 1) % 4 === 0) && (
            <text key={i} className="ax" x={X(i).toFixed(1)} y={H - 8} textAnchor="middle">
              {i + 1}
            </text>
          )
      )}
      {top.length > 0 && <polygon points={top.concat(bot).join(' ')} fill="var(--accent)" fillOpacity="0.13" stroke="none" />}
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.3 }} />
          <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <polygon points={`${X(0).toFixed(1)},${H - b} ${pts} ${X(n - 1).toFixed(1)},${H - b}`} fill={`url(#${gid})`} stroke="none" />
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {marks.map((a) => (
        <g key={a.t}>
          <circle cx={X(a.t).toFixed(1)} cy={Y(a.v).toFixed(1)} r="10" fill={markColor(a)} fillOpacity="0.22" />
          <circle cx={X(a.t).toFixed(1)} cy={Y(a.v).toFixed(1)} r="5.5" fill={markColor(a)} stroke="var(--surface)" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}
