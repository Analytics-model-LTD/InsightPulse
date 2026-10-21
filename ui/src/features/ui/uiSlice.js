import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import { addSet, duplicateSet, loadKpiSets, removeSet, resetAll, selectSet } from '../kpiSets/kpiSetsSlice';
import { WIZARD_STEPS } from '../../utils/constants';

const LAST = WIZARD_STEPS.length - 1;
const clamp = (n) => Math.max(0, Math.min(LAST, n));

const initialState = {
  tab: 'define', // 'define' | 'insights'
  wizardStep: 0, // index into WIZARD_STEPS
  wizardDir: 1, // 1 = slid forward, -1 = slid back (drives the slide animation)
  viewer: 0, // index into recipients, -1 = everyone
  sel: 0, // selected alert in the feed
  sevf: 'all', // severity filter
  mf: 'all', // measure filter
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTab(s, { payload }) {
      s.tab = payload;
    },
    goStep(s, { payload }) {
      const n = clamp(payload);
      s.wizardDir = n >= s.wizardStep ? 1 : -1;
      s.wizardStep = n;
    },
    nextStep(s) {
      s.wizardDir = 1;
      s.wizardStep = clamp(s.wizardStep + 1);
    },
    prevStep(s) {
      s.wizardDir = -1;
      s.wizardStep = clamp(s.wizardStep - 1);
    },
    setViewer(s, { payload }) {
      s.viewer = payload;
      s.sel = 0;
    },
    setSelectedAlert(s, { payload }) {
      s.sel = payload;
    },
    setSeverityFilter(s, { payload }) {
      s.sevf = payload;
      s.sel = 0;
    },
    setMeasureFilter(s, { payload }) {
      s.mf = payload;
      s.sel = 0;
    },
  },
  extraReducers: (builder) => {
    // A brand new set starts at the first slide.
    builder.addCase(addSet, (s) => {
      s.wizardStep = 0;
      s.wizardDir = -1;
    });
    // Switching / adding / removing a KPI set resets the insights view.
    builder.addMatcher(isAnyOf(selectSet, addSet, duplicateSet, removeSet, resetAll, loadKpiSets.fulfilled), (s) => {
      s.viewer = 0;
      s.sel = 0;
      s.sevf = 'all';
      s.mf = 'all';
    });
  },
});

export const { setTab, goStep, nextStep, prevStep, setViewer, setSelectedAlert, setSeverityFilter, setMeasureFilter } = uiSlice.actions;
export default uiSlice.reducer;
