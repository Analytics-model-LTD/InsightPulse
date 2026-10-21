import { useDispatch, useSelector } from 'react-redux';
import { addSet, selectCurrentIndex, selectSet, selectSets } from '../../features/kpiSets/kpiSetsSlice';
import Icon from '../common/Icon';
import SaveStatus from '../common/SaveStatus';

export default function SetBar() {
  const dispatch = useDispatch();
  const sets = useSelector(selectSets);
  const current = useSelector(selectCurrentIndex);

  return (
    <div className="setrow">
      <div className="setpills" role="group" aria-label="Your KPI sets">
        {sets.map((s, i) => (
          <button key={s.uid} className="setpill" aria-pressed={i === current} onClick={() => dispatch(selectSet(i))}>
            {s.name || 'Untitled set'}
          </button>
        ))}
        <button className="setpill add" onClick={() => dispatch(addSet())}>
          <Icon name="plus" size={14} /> New set
        </button>
      </div>
      <SaveStatus />
    </div>
  );
}
