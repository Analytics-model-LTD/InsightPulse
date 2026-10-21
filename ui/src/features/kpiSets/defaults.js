import { nanoid } from '@reduxjs/toolkit';

// `uid` is a stable React key only; it is never written to the YAML.

export const createMeasure = (over = {}) => ({
  uid: nanoid(),
  id: 'measure_1',
  agg: 'sum',
  column: 'ColumnName',
  numerator: '',
  denominator: '',
  where: '',
  direction: 'neutral',
  priority: 2,
  ...over,
});

export const createRecipient = (over = {}) => ({
  uid: nanoid(),
  kind: 'employee',
  target: 'name@company.com',
  ch_email: true,
  ch_webhook: false,
  min_severity: 'warning',
  measures: '', // comma separated measure ids; empty = all measures
  ...over,
});

export function createExample() {
  return {
    uid: nanoid(),
    name: 'Retention effectiveness',
    llm: 'claude-sonnet-5-5',
    detector: 'iforest',
    contamination: 0.03,
    source: 'service',
    time_column: 'MonthsInService',
    grain: 'month',
    measures: [
      createMeasure({ id: 'retention_calls', agg: 'sum', column: 'RetentionCalls', direction: 'neutral', priority: 3 }),
      createMeasure({ id: 'offers_accepted', agg: 'sum', column: 'RetentionOffersAccepted', direction: 'up_good', priority: 2 }),
      createMeasure({
        id: 'acceptance_rate',
        agg: 'ratio',
        column: '',
        numerator: 'offers_accepted',
        denominator: 'retention_calls',
        direction: 'up_good',
        priority: 1,
      }),
      createMeasure({ id: 'revenue_lost', agg: 'sum', column: 'MonthlyRevenue', where: "Churn = 'Yes'", direction: 'down_good', priority: 1 }),
    ],
    dimensions: 'MadeCallToRetentionTeam, CreditRating, Occupation',
    top_n: 3,
    top_n_strategy: 'manual',
    top_n_values: 'MadeCallToRetentionTeam: Yes, No',
    alerting: {
      z_threshold: 3.0,
      min_abs_change: 500,
      min_pct_change: 0.1,
      ch_email: true,
      ch_webhook: true,
      recipients: [
        createRecipient({ target: 'retention.lead@company.com', min_severity: 'info', measures: '' }),
        createRecipient({ kind: 'team', target: 'executives', min_severity: 'critical', measures: 'revenue_lost' }),
      ],
    },
    min_n: 7,
  };
}

// Turn a set loaded from a command (no client-only fields) into store shape.
export function hydrateSet(raw) {
  const d = createBlankSet();
  return {
    ...d,
    ...raw,
    uid: nanoid(),
    measures: (raw.measures || []).map((m) => ({ uid: nanoid(), ...m })),
    alerting: {
      ...d.alerting,
      ...(raw.alerting || {}),
      recipients: (raw.alerting?.recipients || []).map((r) => ({ uid: nanoid(), ...r })),
    },
  };
}

export function createBlankSet() {
  const c = createExample();
  c.name = 'New KPI set';
  c.source = 'source_table';
  c.time_column = 'DateColumn';
  c.measures = [createMeasure({ id: 'measure_1', priority: 1 })];
  c.dimensions = '';
  c.top_n_values = '';
  c.alerting.recipients = [createRecipient({ min_severity: 'info' })];
  return c;
}
