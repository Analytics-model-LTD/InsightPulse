// Friendly checks shown on the Review slide. They never block saving.
// step = index into WIZARD_STEPS, so each issue can link to the slide that fixes it.
import { PLACEHOLDERS } from './constants';
import { personName, titleCase } from './format';

const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function validateSet(set) {
  const issues = [];
  const add = (step, text) => issues.push({ step, text });

  if (!String(set.name).trim()) add(0, 'Give this KPI set a name.');
  if (!String(set.source).trim() || set.source === PLACEHOLDERS.source) add(0, 'Tell us the real table or dataset name.');
  if (!String(set.time_column).trim() || set.time_column === PLACEHOLDERS.time_column) add(0, 'Pick the column that holds the date.');

  if (!set.measures.length) add(1, 'Add at least one number to track.');
  const seen = new Set();
  set.measures.forEach((m) => {
    const label = m.id ? titleCase(m.id) : 'A number';
    if (!m.id) add(1, 'One of your numbers has no name.');
    else if (!ID_RE.test(m.id)) add(1, `"${m.id}" should only use letters, numbers and underscores.`);
    else if (seen.has(m.id)) add(1, `Two numbers are both called "${m.id}".`);
    seen.add(m.id);
    if (m.agg === 'ratio') {
      if (!m.numerator || !m.denominator) add(1, `${label}: choose both numbers to compare.`);
    } else if (!String(m.column).trim() || m.column === PLACEHOLDERS.column) {
      add(1, `${label}: choose which column to use.`);
    }
  });

  const a = set.alerting;
  if (!a.ch_email && !a.ch_webhook) add(3, 'Turn on at least one way to send alerts.');

  if (!a.recipients.length) add(4, 'Add at least one person or team.');
  a.recipients.forEach((r) => {
    const t = String(r.target).trim();
    if (!t) add(4, 'Someone on your list has no email or team name.');
    else if (r.kind === 'employee' && t === PLACEHOLDERS.email) add(4, 'Replace the example email address with a real one.');
    else if (r.kind === 'employee' && !EMAIL_RE.test(t)) add(4, `"${t}" doesn't look like an email address.`);
    if (t && !r.ch_email && !r.ch_webhook) add(4, `${personName(r)} has no way to be reached. Turn on email or webhook.`);
  });

  return issues;
}
