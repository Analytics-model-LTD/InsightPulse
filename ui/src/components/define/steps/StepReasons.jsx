import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentSet, setField } from '../../../features/kpiSets/kpiSetsSlice';
import { TOP_N_STRATEGIES } from '../../../utils/constants';
import NumberStepper from '../../common/NumberStepper';
import Segmented from '../../common/Segmented';
import TagInput from '../../common/TagInput';

export default function StepReasons() {
  const dispatch = useDispatch();
  const s = useSelector(selectCurrentSet);
  const set = (path, value) => dispatch(setField({ path, value }));

  return (
    <div className="fields">
      <div className="field span2">
        <label htmlFor="d-dims">Columns that might explain a change</label>
        <TagInput id="d-dims" value={s.dimensions} onChange={(v) => set('dimensions', v)} placeholder="Type a column name and press Enter" />
        <span className="help">For example: Region, Plan, Occupation. Each alert will show which of their values drove the change.</span>
      </div>
      <div className="field span2">
        <span className="lbl" id="d-topn-l">
          How many values should we show per column?
        </span>
        <NumberStepper id="d-topn" min={1} max={6} value={s.top_n} onChange={(v) => set('top_n', v)} />
      </div>
      <div className="field span2">
        <span className="lbl">Which values should we show?</span>
        <Segmented
          name="strat"
          className="big"
          value={s.top_n_strategy}
          onChange={(v) => set('top_n_strategy', v)}
          options={TOP_N_STRATEGIES.map(([v, title, sub]) => [
            v,
            <>
              <b>{title}</b>
              <small>{sub}</small>
            </>,
          ])}
        />
      </div>
      {s.top_n_strategy === 'manual' && (
        <div className="field span2">
          <label htmlFor="d-vals">Your values, one column per line</label>
          <textarea id="d-vals" rows={3} placeholder={'Region: North, South\nPlan: Free, Pro'} value={s.top_n_values} onChange={(e) => set('top_n_values', e.target.value)} />
          <span className="help">
            Write it like <span className="mono">Column: Value A, Value B</span>
          </span>
        </div>
      )}
    </div>
  );
}
