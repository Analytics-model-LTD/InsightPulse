import { createAsyncThunk } from '@reduxjs/toolkit';
import { isUnavailable, runShell, SHELL_ACTIONS } from '../../shell/shellClient';
import { serializeSet } from '../../utils/serialize';
import { toYamlAll } from '../../utils/yaml';

// Load saved KPI sets. No bridge or no command configured -> keep the built-in example.
export const loadKpiSets = createAsyncThunk(
  'kpiSets/load',
  async (_, { signal }) => {
    try {
      const data = await runShell(SHELL_ACTIONS.LOAD_KPI_SETS, {}, { signal });
      return { source: 'shell', sets: Array.isArray(data?.sets) ? data.sets : [] };
    } catch (e) {
      if (isUnavailable(e)) return { source: 'sample', sets: [] };
      throw e;
    }
  },
  { condition: (_, { getState }) => getState().kpiSets.sync.status !== 'loading' }
);

// Save every KPI set (JSON for the backend to store/validate, plus the rendered YAML).
export const saveKpiSets = createAsyncThunk('kpiSets/save', async (_, { getState }) => {
  const items = getState().kpiSets.items;
  const data = await runShell(SHELL_ACTIONS.SAVE_KPI_SETS, { sets: items.map(serializeSet), yaml: toYamlAll(items) });
  return { savedAt: data?.saved_at || new Date().toISOString() };
});
