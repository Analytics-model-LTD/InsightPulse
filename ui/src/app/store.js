import { configureStore } from '@reduxjs/toolkit';
import kpiSets from '../features/kpiSets/kpiSetsSlice';
import insights from '../features/insights/insightsSlice';
import ui from '../features/ui/uiSlice';

export const store = configureStore({
  reducer: { kpiSets, insights, ui },
});

export default store;
