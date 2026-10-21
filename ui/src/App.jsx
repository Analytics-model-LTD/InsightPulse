import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setTab } from './features/ui/uiSlice';
import { loadKpiSets } from './features/kpiSets/kpiSetsSlice';
import Header from './components/layout/Header';
import DefineView from './components/define/DefineView';
import InsightsView from './components/insights/InsightsView';

export default function App() {
  const dispatch = useDispatch();
  const tab = useSelector((s) => s.ui.tab);

  // Load saved KPI sets through the shell bridge (falls back to the built-in example).
  useEffect(() => {
    dispatch(loadKpiSets());
  }, [dispatch]);

  // Deep link: /#insights opens the insights tab.
  useEffect(() => {
    if (window.location.hash === '#insights') dispatch(setTab('insights'));
  }, [dispatch]);

  useEffect(() => {
    try {
      window.history.replaceState(null, '', tab === 'insights' ? '#insights' : '#define');
    } catch {
      /* ignore */
    }
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <div className="wrap">
      <Header />
      {/* Define stays mounted (just hidden) so open/closed cards survive tab switches */}
      <DefineView hidden={tab !== 'define'} />
      {tab === 'insights' && <InsightsView />}
    </div>
  );
}
