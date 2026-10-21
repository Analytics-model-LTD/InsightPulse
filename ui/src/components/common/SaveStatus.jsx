import { useDispatch, useSelector } from 'react-redux';
import { saveKpiSets, selectSync } from '../../features/kpiSets/kpiSetsSlice';

// "Unsaved changes [Save]" / "Saved 10:31" / error, driven by the kpiSets sync state.
export default function SaveStatus({ showButton = true }) {
  const dispatch = useDispatch();
  const { status, source, error, savedAt, dirty } = useSelector(selectSync);
  const busy = status === 'saving' || status === 'loading';

  let text;
  let tone = 'muted';
  let canSave = false;
  if (status === 'saving') text = 'Saving…';
  else if (status === 'loading') text = 'Loading your saved sets…';
  else if (error) {
    text = error;
    tone = 'bad';
    canSave = source !== 'sample';
  } else if (source === 'sample') {
    text = 'Not saved: changes stay in this browser only';
    tone = 'warn';
  } else if (dirty) {
    text = 'Unsaved changes';
    tone = 'warn';
    canSave = true;
  } else if (savedAt) {
    text = 'Saved ' + new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    tone = 'good';
  } else {
    text = 'All changes saved';
    tone = 'good';
  }

  return (
    <div className={`savestat ${tone}`} role="status" title={source === 'sample' ? 'Run the app with npm run dev to save through the shell bridge.' : undefined}>
      <i className="sdot" />
      <span>{text}</span>
      {showButton && canSave && (
        <button className="btn sm" disabled={busy} onClick={() => dispatch(saveKpiSets())}>
          {error ? 'Try again' : 'Save'}
        </button>
      )}
    </div>
  );
}
