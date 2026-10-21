import { useDispatch, useSelector } from 'react-redux';
import { addMeasure, selectCurrentSet } from '../../../features/kpiSets/kpiSetsSlice';
import Icon from '../../common/Icon';
import MeasureCard from '../MeasureCard';

export default function StepNumbers() {
  const dispatch = useDispatch();
  const { measures } = useSelector(selectCurrentSet);

  return (
    <>
      <div className="stack">
        {measures.length ? (
          measures.map((m, i) => (
            <MeasureCard key={m.uid} m={m} index={i} measures={measures} defaultOpen={Boolean(m.justAdded) || measures.length <= 2} />
          ))
        ) : (
          <div className="empty">No numbers yet. Add the first one you want us to watch.</div>
        )}
      </div>
      <button className="add-block" onClick={() => dispatch(addMeasure())}>
        <Icon name="plus" size={18} /> Add a number
      </button>
    </>
  );
}
