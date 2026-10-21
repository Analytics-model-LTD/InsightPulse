// Frontend side of the shell bridge. Replaces the REST layer.
// runShell('insights.preview', { set }) -> POST /__shell/run -> shell.config.js command -> JSON result.

export const SHELL_ACTIONS = {
  LOAD_KPI_SETS: 'kpi_sets.load',
  SAVE_KPI_SETS: 'kpi_sets.save',
  INSIGHTS_PREVIEW: 'insights.preview',
};

export class ShellError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ShellError';
    this.code = code;
    this.details = details;
  }
}

export async function runShell(action, params = {}, { signal } = {}) {
  let res;
  try {
    res = await fetch('/__shell/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ShellError('BRIDGE_UNREACHABLE', 'Shell bridge is not reachable. Run the app with npm run dev.');
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON: a static host answered, so there is no bridge */
  }
  if (!body || typeof body.ok !== 'boolean') {
    throw new ShellError('BRIDGE_UNREACHABLE', 'Shell bridge is not available here. Run the app with npm run dev.');
  }
  if (!body.ok) throw new ShellError(body.error?.code || 'COMMAND_FAILED', body.error?.message || 'Command failed', body.error);
  return body.data;
}

// "No bridge / nothing configured" means the app falls back to sample data.
// Any other failure (command crashed, bad JSON, timeout) is a real error and is shown.
export const isUnavailable = (e) => e instanceof ShellError && (e.code === 'BRIDGE_UNREACHABLE' || e.code === 'NOT_CONFIGURED');
