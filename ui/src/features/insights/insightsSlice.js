import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { isUnavailable, runShell, SHELL_ACTIONS } from '../../shell/shellClient';
import { serializeSet } from '../../utils/serialize';
import { selectCurrentSet } from '../kpiSets/kpiSetsSlice';

export const setKey = (set) => JSON.stringify(serializeSet(set));

// Ask the backend command for the insights of the active KPI set.
// `key` ties the result to the exact definition it was computed for.
export const fetchInsights = createAsyncThunk('insights/fetch', async (_, { getState, signal }) => {
  const set = serializeSet(selectCurrentSet(getState()));
  const key = JSON.stringify(set);
  try {
    const data = await runShell(SHELL_ACTIONS.INSIGHTS_PREVIEW, { set }, { signal });
    return { source: 'shell', key, data };
  } catch (e) {
    if (isUnavailable(e)) return { source: 'sample', key, data: null };
    throw e;
  }
});

const initialState = {
  status: 'idle', // idle | loading | ready | error
  source: null, // 'shell' | 'sample'
  key: null,
  data: null, // raw payload from the command (see SHELL_COMMANDS.md)
  error: null,
  requestId: null,
};

const insightsSlice = createSlice({
  name: 'insights',
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchInsights.pending, (s, a) => {
      s.status = 'loading';
      s.error = null;
      s.requestId = a.meta.requestId;
    })
      .addCase(fetchInsights.fulfilled, (s, a) => {
        if (a.meta.requestId !== s.requestId) return; // a newer request superseded this one
        s.status = 'ready';
        s.source = a.payload.source;
        s.key = a.payload.key;
        s.data = a.payload.data;
      })
      .addCase(fetchInsights.rejected, (s, a) => {
        if (a.meta.requestId !== s.requestId) return;
        s.status = 'error';
        s.error = a.error.message || 'Unknown error';
      });
  },
});

export default insightsSlice.reducer;
