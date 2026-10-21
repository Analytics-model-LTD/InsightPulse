export const T = 24; // months of sample data

export const SEV = { info: 0, warning: 1, critical: 2 };

// The setup wizard, one slide per entry.
export const WIZARD_STEPS = [
  { id: 'basics', short: 'Basics', icon: 'tag', title: 'What are we watching?', sub: 'Give it a name and tell us where the data lives.' },
  { id: 'numbers', short: 'Numbers', icon: 'bars', title: 'Which numbers matter?', sub: 'Add the numbers you want us to keep an eye on, like sales or sign-ups.' },
  { id: 'reasons', short: 'Reasons', icon: 'search', title: 'How should we explain changes?', sub: 'Pick the columns that help answer "why did this move?"' },
  { id: 'alerts', short: 'Alerts', icon: 'bell', title: 'When should we tell people?', sub: 'Choose how picky we should be before sending an alert.' },
  { id: 'people', short: 'People', icon: 'users', title: 'Who should hear about it?', sub: 'Each person only gets what you choose for them.' },
  { id: 'review', short: 'Review', icon: 'check', title: 'Looks good?', sub: 'Check your setup, then save it.' },
];

export const AGG = [
  ['sum', 'Add them up'],
  ['avg', 'Average'],
  ['count', 'Count the rows'],
  ['min', 'Smallest value'],
  ['max', 'Largest value'],
  ['ratio', 'Compare two numbers (ratio)'],
];

export const DIRS = [
  ['up_good', 'Higher is better'],
  ['down_good', 'Lower is better'],
  ['neutral', 'Just watch it'],
];

export const PRIS = [
  ['1', 'High'],
  ['2', 'Medium'],
  ['3', 'Low'],
];

export const GRAINS = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['quarter', 'Quarter'],
];

export const DETECTORS = [
  ['iforest', 'Smart: looks at all numbers together'],
  ['zscore', 'Simple: one number at a time'],
  ['mad', 'Steady: ignores one-off spikes'],
  ['stl', 'Seasonal: knows about yearly patterns'],
];

export const LLMS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'];

export const TOP_N_STRATEGIES = [
  ['manual', "I'll choose", 'Type the exact values below'],
  ['by_volume', 'Most common', 'The values with the most rows'],
  ['by_impact', 'Biggest movers', 'The values that changed the most'],
];

export const SENSITIVITY = [
  ['4', 'Relaxed', 'Only big surprises'],
  ['3', 'Balanced', 'Recommended'],
  ['2.5', 'Sensitive', 'Catches small shifts'],
];

export const SEVERITY_FILTERS = [
  ['all', 'All'],
  ['critical', 'Critical'],
  ['warning', 'Warning'],
  ['info', 'Info'],
  ['fav', 'Good news'],
];

export const RECIPIENT_SEVERITY = [
  ['info', 'Everything'],
  ['warning', 'Warnings & critical'],
  ['critical', 'Critical only'],
];

// Values the "new KPI set" starts with; the review step asks the user to replace them.
export const PLACEHOLDERS = {
  source: 'source_table',
  time_column: 'DateColumn',
  column: 'ColumnName',
  email: 'name@company.com',
};

// Sample segment values used for the drill-down until the real API exists.
export const POOLS = {
  CreditRating: ['Highest', 'High', 'Medium', 'Low', 'Very low'],
  Occupation: ['Professional', 'Crafts', 'Other', 'Self-employed', 'Retired', 'Student'],
};
