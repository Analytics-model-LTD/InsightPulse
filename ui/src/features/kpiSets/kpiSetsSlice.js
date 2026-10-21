import { createSlice, current, nanoid } from '@reduxjs/toolkit';
import { listOf } from '../../utils/format';
import { createBlankSet, createExample, createMeasure, createRecipient, hydrateSet } from './defaults';
import { loadKpiSets, saveKpiSets } from './kpiSetsThunks';

const initialState = {
  items: [createExample()],
  current: 0,
  // Persistence through the shell bridge
  sync: {
    status: 'idle', // idle | loading | saving
    source: 'unknown', // unknown | shell | sample (sample = no bridge, session only)
    error: null,
    savedAt: null,
    dirty: false,
  },
};

// Any of these changes what would be saved.
const EDIT_TYPES = new Set(
  [
    'addSet',
    'duplicateSet',
    'removeSet',
    'resetAll',
    'setField',
    'addMeasure',
    'updateMeasure',
    'removeMeasure',
    'addRecipient',
    'updateRecipient',
    'toggleRecipientMeasure',
    'removeRecipient',
  ].map((n) => 'kpiSets/' + n)
);

const active = (s) => s.items[s.current];

function setPath(obj, path, value) {
  const p = path.split('.');
  let o = obj;
  for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
  o[p[p.length - 1]] = value;
}

// When a measure id is renamed, keep ratio numerators/denominators and
// recipient measure filters pointing at it.
function renameRefs(set, oldId, newId) {
  if (!oldId || !newId) return;
  set.measures.forEach((x) => {
    if (x.numerator === oldId) x.numerator = newId;
    if (x.denominator === oldId) x.denominator = newId;
  });
  set.alerting.recipients.forEach((r) => {
    const l = listOf(r.measures);
    if (l.indexOf(oldId) > -1) r.measures = l.map((v) => (v === oldId ? newId : v)).join(', ');
  });
}

const kpiSetsSlice = createSlice({
  name: 'kpiSets',
  initialState,
  reducers: {
    // ----- sets -----
    selectSet(s, { payload }) {
      s.current = payload;
    },
    addSet: {
      reducer(s, { payload }) {
        s.items.push(payload);
        s.current = s.items.length - 1;
      },
      prepare: () => ({ payload: createBlankSet() }),
    },
    duplicateSet(s) {
      const copy = JSON.parse(JSON.stringify(current(active(s))));
      copy.uid = nanoid();
      copy.name = (copy.name || 'KPI set') + ' copy';
      s.items.push(copy);
      s.current = s.items.length - 1;
    },
    removeSet(s) {
      if (s.items.length > 1) {
        s.items.splice(s.current, 1);
        s.current = Math.max(0, s.current - 1);
      }
    },
    resetAll: {
      reducer(s, { payload }) {
        s.items = [payload];
        s.current = 0;
      },
      prepare: () => ({ payload: createExample() }),
    },

    // ----- any field on the active set, by dotted path (e.g. "alerting.z_threshold") -----
    setField(s, { payload: { path, value } }) {
      setPath(active(s), path, value);
    },

    // ----- measures -----
    addMeasure: {
      reducer(s, { payload }) {
        const set = active(s);
        let n = set.measures.length + 1;
        let id = 'measure_' + n;
        while (set.measures.some((x) => x.id === id)) id = 'measure_' + ++n;
        set.measures.push(createMeasure({ uid: payload.uid, id, column: 'ColumnName', justAdded: true }));
      },
      prepare: () => ({ payload: { uid: nanoid() } }),
    },
    updateMeasure(s, { payload: { index, key, value } }) {
      const set = active(s);
      const m = set.measures[index];
      if (!m) return;
      if (key === 'id') {
        const old = m.lastId || m.id;
        m.id = value;
        if (value) {
          renameRefs(set, old, value);
          m.lastId = value;
        }
      } else {
        m[key] = value;
      }
    },
    removeMeasure(s, { payload: index }) {
      const set = active(s);
      const gone = set.measures[index].id;
      set.measures.splice(index, 1);
      set.measures.forEach((x) => {
        if (x.numerator === gone) x.numerator = '';
        if (x.denominator === gone) x.denominator = '';
      });
      set.alerting.recipients.forEach((r) => {
        r.measures = listOf(r.measures)
          .filter((v) => v !== gone)
          .join(', ');
      });
    },

    // ----- recipients -----
    addRecipient: {
      reducer(s, { payload }) {
        active(s).alerting.recipients.push(createRecipient({ uid: payload.uid }));
      },
      prepare: () => ({ payload: { uid: nanoid() } }),
    },
    updateRecipient(s, { payload: { index, key, value } }) {
      const r = active(s).alerting.recipients[index];
      if (r) r[key] = value;
    },
    toggleRecipientMeasure(s, { payload: { index, measureId, checked } }) {
      const set = active(s);
      const r = set.alerting.recipients[index];
      if (!r) return;
      const chosen = listOf(r.measures);
      r.measures = set.measures
        .map((m) => m.id)
        .filter((id) => (id === measureId ? checked : chosen.indexOf(id) > -1))
        .join(', ');
    },
    removeRecipient(s, { payload: index }) {
      active(s).alerting.recipients.splice(index, 1);
    },
  },
  extraReducers: (b) => {
    b.addCase(loadKpiSets.pending, (s) => {
      s.sync.status = 'loading';
      s.sync.error = null;
    })
      .addCase(loadKpiSets.fulfilled, (s, { payload }) => {
        s.sync.status = 'idle';
        s.sync.source = payload.source;
        if (payload.sets.length) {
          s.items = payload.sets.map(hydrateSet);
          s.current = 0;
          s.sync.dirty = false;
        } else {
          // Nothing saved yet: the built-in example is unsaved work
          s.sync.dirty = payload.source === 'shell';
        }
      })
      .addCase(loadKpiSets.rejected, (s, a) => {
        s.sync.status = 'idle';
        s.sync.source = 'shell';
        s.sync.error = a.error.message || 'Could not load saved KPI sets';
      })
      .addCase(saveKpiSets.pending, (s) => {
        s.sync.status = 'saving';
        s.sync.error = null;
      })
      .addCase(saveKpiSets.fulfilled, (s, { payload }) => {
        s.sync.status = 'idle';
        s.sync.source = 'shell';
        s.sync.savedAt = payload.savedAt;
        s.sync.dirty = false;
      })
      .addCase(saveKpiSets.rejected, (s, a) => {
        s.sync.status = 'idle';
        s.sync.error = a.error.message || 'Could not save';
      })
      .addMatcher(
        (a) => EDIT_TYPES.has(a.type),
        (s) => {
          s.sync.dirty = true;
        }
      );
  },
});

export const {
  selectSet,
  addSet,
  duplicateSet,
  removeSet,
  resetAll,
  setField,
  addMeasure,
  updateMeasure,
  removeMeasure,
  addRecipient,
  updateRecipient,
  toggleRecipientMeasure,
  removeRecipient,
} = kpiSetsSlice.actions;

export const selectSets = (state) => state.kpiSets.items;
export const selectCurrentIndex = (state) => state.kpiSets.current;
export const selectCurrentSet = (state) => state.kpiSets.items[state.kpiSets.current];
export const selectSync = (state) => state.kpiSets.sync;

export { loadKpiSets, saveKpiSets };

export default kpiSetsSlice.reducer;
