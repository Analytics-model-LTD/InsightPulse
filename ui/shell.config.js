const env = { PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' };
export default {
  cwd: '..',                       // ui/ -> InsightPulse root
  timeoutMs: 120_000,
  commands: {
    'kpi_sets.load': { command: 'python', args: ['src/cli.py', 'kpi-sets', 'load'], env },
    'kpi_sets.save': { command: 'python', args: ['src/cli.py', 'kpi-sets', 'save'], env },
    'insights.preview': { command: 'python', args: ['src/cli.py', 'insights', 'preview'], env, timeoutMs: 180_000 },
  },
};