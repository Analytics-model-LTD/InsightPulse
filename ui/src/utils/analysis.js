// Sample-data + anomaly detection used to preview insights.
// Pure functions: everything takes the KPI set as an argument.
// Replace buildSeries()/dimBreakdown() with API data later; the shape of
// analyse()'s return value is what the UI components consume.
import { T, SEV, POOLS } from './constants';
import { hash, listOf, titleCase, fmtVal } from './format';
import { parseTopVals } from './yaml';

function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function median(a) {
  const b = a.slice().sort((x, y) => x - y);
  const n = b.length;
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
}

function robust(a) {
  const m = median(a);
  const mad = median(a.map((x) => Math.abs(x - m))) * 1.4826;
  return { med: m, sd: Math.max(mad, Math.abs(m) * 0.005, 1e-9) };
}

export const isRevenue = (m) => /revenue/i.test((m.column || '') + ' ' + m.id);

export function buildSeries(set) {
  const ser = {};
  set.measures.forEach((m) => {
    if (m.agg === 'ratio') return;
    const rnd = mulberry(hash(m.id));
    const base = isRevenue(m) ? 9000 : /accept|offer/i.test(m.id) ? 84 : 220;
    const amp = isRevenue(m) ? 0.06 : 0.07;
    const v = [];
    for (let i = 0; i < T; i++) v.push(base * (1 + (i - 12) * 0.002) * (1 + (rnd() * 2 - 1) * amp));
    if (m.direction === 'neutral') v[T - 1] *= 1.45;
    else if (m.direction === 'up_good') v[T - 5] *= 1.38;
    else if (m.direction === 'down_good') v[T - 1] *= 1.7;
    ser[m.id] = v;
  });
  set.measures.forEach((m) => {
    if (m.agg !== 'ratio') return;
    const n = ser[m.numerator];
    const d = ser[m.denominator];
    const v = [];
    if (n && d) {
      for (let i = 0; i < T; i++) v.push(n[i] / d[i]);
    } else {
      const rnd = mulberry(hash(m.id));
      for (let j = 0; j < T; j++) v.push(0.38 * (1 + (rnd() * 2 - 1) * 0.06));
      if (m.direction === 'up_good') v[T - 1] *= 0.7;
      else v[T - 1] *= 1.3;
    }
    ser[m.id] = v;
  });
  return ser;
}

function severityOf(set, m, z, fav) {
  if (fav || m.direction === 'neutral') return 'info';
  const thr = Number(set.alerting.z_threshold) || 3;
  const az = Math.abs(z);
  if (az >= thr * 1.6) return 'critical';
  if (az >= thr * 1.2) return 'warning';
  return 'info';
}

export function analyse(set) {
  const ser = buildSeries(set);
  const minN = Math.max(3, Number(set.min_n) || 7);
  const a = set.alerting;
  const thr = Number(a.z_threshold) || 3;
  const out = { ser, bands: {}, anoms: [], joint: [], minN };
  const zs = {};

  set.measures.forEach((m) => {
    const v = ser[m.id];
    const bands = [];
    const z = [];
    for (let t = 0; t < T; t++) {
      if (t < minN) {
        bands.push(null);
        z.push(null);
        continue;
      }
      const base = v.slice(Math.max(0, t - 12), t);
      const r = robust(base);
      bands.push({ lo: r.med - thr * r.sd, hi: r.med + thr * r.sd, med: r.med });
      const zz = (v[t] - r.med) / r.sd;
      z.push(Math.max(-99, Math.min(99, zz)));
      const abs = v[t] - r.med;
      const pct = r.med ? abs / r.med : 0;
      let ok = Math.abs(zz) >= thr && Math.abs(pct) >= Number(a.min_pct_change);
      if (ok && isRevenue(m)) ok = Math.abs(abs) >= Number(a.min_abs_change);
      if (ok) {
        const up = abs > 0;
        const fav = (m.direction === 'up_good' && up) || (m.direction === 'down_good' && !up);
        out.anoms.push({ m, t, v: v[t], exp: r.med, z: zz, pct, abs, up, fav, sev: severityOf(set, m, zz, fav) });
      }
    }
    out.bands[m.id] = bands;
    zs[m.id] = z;
  });

  const scores = [];
  for (let t = 0; t < T; t++) {
    if (t < minN) {
      scores.push(null);
      continue;
    }
    let s = 0;
    let c = 0;
    set.measures.forEach((m) => {
      const z = zs[m.id][t];
      if (z != null) {
        s += Math.min(Math.abs(z), 10) * Math.min(Math.abs(z), 10);
        c++;
      }
    });
    scores.push(c ? Math.sqrt(s / c) : 0);
  }
  const valid = scores.filter((x) => x != null).sort((x, y) => x - y);
  const k = Math.max(1, Math.round(valid.length * Number(set.contamination || 0.03)));
  const cut = valid.length ? valid[Math.max(0, valid.length - k)] : Infinity;
  out.joint = scores.map((s) => ({ s, flag: s != null && s >= cut }));
  out.jointN = k;
  out.jointValid = valid.length;
  return out;
}

export function dimBreakdown(set, al) {
  if (al.segments) return al.segments; // computed by the backend command
  const dims = listOf(set.dimensions);
  const tv = parseTopVals(set);
  const n = Math.max(1, Number(set.top_n) || 3);
  const out = [];
  dims.forEach((d) => {
    const manual = set.top_n_strategy === 'manual' && tv[d];
    const vals = manual ? tv[d] : (POOLS[d] || ['Value A', 'Value B', 'Value C', 'Value D', 'Value E', 'Value F']).slice(0, n);
    const rnd = mulberry(hash(d + al.m.id + al.t));
    const w = vals.map(() => {
      const r = rnd();
      return 0.15 + r * r * 1.2;
    });
    const other = manual ? 0 : 0.18;
    const tot = w.reduce((x, y) => x + y, 0) + other;
    const rows = w.map((x, i) => ({ name: vals[i], p: x / tot })).sort((x, y) => y.p - x.p);
    if (other) rows.push({ name: 'All others', p: other / tot, other: true });
    out.push({ dim: d, rows });
  });
  return out;
}

export function visibleFor(r, an) {
  const ms = listOf(r.measures);
  const min = SEV[r.min_severity] || 0;
  const items = an.anoms.filter((a) => a.t >= T - 6 && SEV[a.sev] >= min && (!ms.length || ms.indexOf(a.m.id) > -1));
  items.sort((a, b) => SEV[b.sev] - SEV[a.sev] || (a.m.priority || 9) - (b.m.priority || 9) || b.t - a.t);
  return items;
}

export const cmpAlert = (a, b) => SEV[b.sev] - SEV[a.sev] || (a.m.priority || 9) - (b.m.priority || 9) || b.t - a.t;

export function viaOf(set, r) {
  const v = [];
  if (r.ch_email && set.alerting.ch_email) v.push('email');
  if (r.ch_webhook && set.alerting.ch_webhook) v.push('webhook');
  return v;
}

export function narrative(set, al) {
  if (al.narrative) return al.narrative; // written by the backend command / LLM
  const m = al.m;
  const dir = al.up ? 'rose' : 'fell';
  const rel = al.up ? 'above' : 'below';
  let s = `${titleCase(m.id)} ${dir} to ${fmtVal(m, al.v)} in month ${al.t + 1}, ${Math.round(Math.abs(al.pct) * 100)}% ${rel} the expected ${fmtVal(m, al.exp)}.`;
  const br = dimBreakdown(set, al);
  if (br.length && br[0].rows.length) {
    const top = br[0].rows[0];
    s += ` Largest contributor: ${br[0].dim} = ${top.name} (${Math.round(top.p * 100)}% of the movement).`;
  }
  if (m.direction === 'neutral') s += ' This measure has no good direction, so it is shown for context.';
  else s += al.fav ? ' This is a favourable move.' : ' This is an unfavourable move.';
  return s;
}

// Convert the JSON a backend command returns (see SHELL_COMMANDS.md) into the same
// shape analyse() produces, so the components don't care where the data came from.
export function fromPayload(set, p) {
  const byId = Object.fromEntries(set.measures.map((m) => [m.id, m]));
  const ser = {};
  const bands = {};
  set.measures.forEach((m) => {
    ser[m.id] = Array.isArray(p.series?.[m.id]) ? p.series[m.id] : [];
    bands[m.id] = Array.isArray(p.bands?.[m.id]) ? p.bands[m.id] : ser[m.id].map(() => null);
  });
  const anoms = (p.anomalies || [])
    .filter((a) => byId[a.measure_id])
    .map((a) => ({
      m: byId[a.measure_id],
      t: a.t,
      v: a.value,
      exp: a.expected,
      z: a.z,
      pct: a.pct,
      abs: a.abs ?? a.value - a.expected,
      up: a.up ?? a.value >= a.expected,
      fav: Boolean(a.favourable),
      sev: a.severity in SEV ? a.severity : 'info',
      narrative: a.narrative,
      segments: a.segments?.map((g) => ({
        dim: g.dimension,
        rows: (g.rows || []).map((r) => ({ name: r.name, p: r.share, other: Boolean(r.other) })),
      })),
    }));
  const joint = (p.joint || []).map((j) => ({ s: j.score ?? null, flag: Boolean(j.flag) }));
  return {
    ser,
    bands,
    anoms,
    joint,
    jointN: p.joint_flagged ?? joint.filter((j) => j.flag).length,
    jointValid: p.joint_scored ?? joint.filter((j) => j.s != null).length,
    minN: p.min_n ?? Math.max(3, Number(set.min_n) || 7),
  };
}

export const sevClass = (al) => (al.fav ? 'fav' : al.sev);
export const sevLabel = (al) => (al.fav ? 'Favourable' : al.sev[0].toUpperCase() + al.sev.slice(1));
