import { escapeHtml, listOf, q } from './format';

export function parseTopVals(set) {
  const out = {};
  String(set.top_n_values || '')
    .split('\n')
    .forEach((line) => {
      const i = line.indexOf(':');
      if (i < 1) return;
      const k = line.slice(0, i).trim();
      const v = listOf(line.slice(i + 1));
      if (k && v.length) out[k] = v;
    });
  return out;
}

export function toYaml(s) {
  const L = [];
  const a = s.alerting;
  L.push('kpi_set:');
  L.push('  name: ' + q(s.name));
  L.push('  llm: ' + q(s.llm));
  L.push('  detector: ' + q(s.detector) + '            # several measures together, not one at a time');
  L.push('  detector_params: { contamination: ' + Number(s.contamination) + ' }');
  L.push('  source: ' + s.source);
  L.push('  time_column: ' + s.time_column);
  L.push('  grain: ' + s.grain);
  L.push('  measures:');
  s.measures.forEach((m) => {
    L.push('    - id: ' + m.id);
    L.push('      agg: ' + m.agg);
    if (m.agg === 'ratio') {
      L.push('      numerator: ' + m.numerator);
      L.push('      denominator: ' + m.denominator);
    } else L.push('      column: ' + m.column);
    if (m.where) L.push('      where: ' + q(m.where));
    L.push('      direction: ' + m.direction);
    L.push('      priority: ' + m.priority);
  });
  L.push('  dimensions: [' + listOf(s.dimensions).join(', ') + ']');
  L.push('  top_n: ' + s.top_n);
  L.push('  top_n_strategy: ' + s.top_n_strategy);
  if (s.top_n_strategy === 'manual') {
    const tv = parseTopVals(s);
    const keys = Object.keys(tv);
    if (keys.length) {
      L.push('  top_n_values:');
      keys.forEach((k) => L.push('    ' + k + ': [' + tv[k].map(q).join(', ') + ']'));
    }
  }
  L.push('  alerting:');
  L.push('    z_threshold: ' + Number(a.z_threshold).toFixed(1));
  L.push('    min_abs_change: ' + a.min_abs_change + '         # revenue units');
  L.push('    min_pct_change: ' + a.min_pct_change);
  const ch = [];
  if (a.ch_email) ch.push('email');
  if (a.ch_webhook) ch.push('webhook');
  L.push('    channels: [' + ch.join(', ') + ']');
  L.push('    recipients:');
  a.recipients.forEach((r) => {
    L.push('      - ' + r.kind + ': ' + r.target);
    const rc = [];
    if (r.ch_email) rc.push('email');
    if (r.ch_webhook) rc.push('webhook');
    L.push('        channels: [' + rc.join(', ') + ']');
    L.push('        min_severity: ' + r.min_severity);
    const ms = listOf(r.measures);
    if (ms.length) L.push('        measures: [' + ms.join(', ') + ']');
  });
  L.push('  min_n: ' + s.min_n);
  return L.join('\n');
}

export const toYamlAll = (sets) => sets.map(toYaml).join('\n\n---\n');

// Returns an HTML string (input is escaped first), for dangerouslySetInnerHTML.
export function highlightYaml(t) {
  return t
    .split('\n')
    .map((line) => {
      let e = escapeHtml(line);
      let c = '';
      const i = e.indexOf(' #');
      if (i > -1) {
        c = '<span class="c">' + e.slice(i) + '</span>';
        e = e.slice(0, i);
      }
      e = e.replace(/^(\s*(?:- )?)([A-Za-z_]+)(:)/, '$1<span class="k">$2</span>$3');
      e = e.replace(/(&quot;.*?&quot;)/g, '<span class="s">$1</span>');
      e = e.replace(/(: )(-?\d+(?:\.\d+)?)(\s*$)/, '$1<span class="n">$2</span>$3');
      return e + c;
    })
    .join('\n');
}
