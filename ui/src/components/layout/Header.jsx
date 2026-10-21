import { useDispatch, useSelector } from 'react-redux';
import { setTab } from '../../features/ui/uiSlice';

export default function Header() {
  const dispatch = useDispatch();
  const tab = useSelector((s) => s.ui.tab);

  return (
    <header className="top">
      <div className="brand">
        <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3de8c8" />
              <stop offset="1" stopColor="#8a7dff" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="13" fill="none" stroke="url(#lg)" strokeWidth="2.5" />
          <path d="M8 20 L13 14 L17 18 L24 9" fill="none" stroke="url(#lg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="24" cy="9" r="2.2" fill="#3de8c8" />
        </svg>
        <div>
          <div className="eyebrow">Analytics Model</div>
          <h1>KPI Insight Studio</h1>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" id="tab-define" aria-selected={tab === 'define'} onClick={() => dispatch(setTab('define'))}>
          Set up
        </button>
        <button role="tab" id="tab-insights" aria-selected={tab === 'insights'} onClick={() => dispatch(setTab('insights'))}>
          Insights
        </button>
      </div>
    </header>
  );
}
