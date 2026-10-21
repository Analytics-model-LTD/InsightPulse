export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export const titleCase = (id) => String(id).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// YAML double-quoted string
export const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

// "a, b, c" -> ['a','b','c']
export const listOf = (s) =>
  String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function initials(t) {
  const base = String(t || '?')
    .split('@')[0]
    .split(/[._\- ]+/)
    .filter(Boolean);
  if (!base.length) return '?';
  if (base.length > 1) return (base[0][0] + base[1][0]).toUpperCase();
  return base[0].slice(0, 2).toUpperCase();
}

export const avatarBg = (t) => `hsl(${hash(String(t || '?')) % 360} 52% 36%)`;

export function personName(r) {
  const t = String(r.target || 'unset');
  if (r.kind === 'team') return titleCase(t);
  const w = t
    .split('@')[0]
    .split(/[._\-]+/)
    .filter(Boolean)
    .map((x) => x[0].toUpperCase() + x.slice(1));
  return w.join(' ') || t;
}

export function dirInfo(m) {
  if (m.direction === 'up_good') return ['fav', 'Higher is better'];
  if (m.direction === 'down_good') return ['info', 'Lower is better'];
  return ['neutral', 'Just watching'];
}

export function sumText(m) {
  if (m.agg === 'ratio') return `${m.numerator || '?'} ÷ ${m.denominator || '?'}`;
  const a = { sum: 'Sum', avg: 'Average', count: 'Count', min: 'Minimum', max: 'Maximum' }[m.agg] || m.agg;
  return `${a} of ${m.column || '?'}${m.where ? ' where ' + m.where : ''}`;
}

export function fmtVal(m, v) {
  if (m.agg === 'ratio') return (v * 100).toFixed(1) + '%';
  return Math.round(v).toLocaleString('en-US');
}

export function fmtTick(m, v) {
  if (m.agg === 'ratio') return Math.round(v * 100) + '%';
  if (Math.abs(v) >= 10000) return (v / 1000).toFixed(0) + 'k';
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(Math.round(v));
}

export const sevText = (s) => (s === 'critical' ? 'critical only' : s === 'warning' ? 'warnings and up' : 'everything');
