import { useDispatch, useSelector } from 'react-redux';
import { duplicateSet, removeSet, resetAll, selectCurrentSet, selectSets, setField } from '../../../features/kpiSets/kpiSetsSlice';
import { DETECTORS, GRAINS, LLMS } from '../../../utils/constants';
import NumberField from '../../common/NumberField';
import Segmented from '../../common/Segmented';

export default function StepBasics() {
  const dispatch = useDispatch();
  const s = useSelector(selectCurrentSet);
  const sets = useSelector(selectSets);
  const text = (path) => (e) => dispatch(setField({ path, value: e.target.value }));
  const set = (path, value) => dispatch(setField({ path, value }));
  const pct = Math.round(Number(s.contamination) * 1000) / 10;

  return (
    <>
      <div className="fields">
        <div className="field span2">
          <label htmlFor="g-name">Give it a name</label>
          <input type="text" id="g-name" placeholder="e.g. Customer retention" value={s.name} onChange={text('name')} />
        </div>
        <div className="field">
          <label htmlFor="g-src">Where is your data?</label>
          <input type="text" id="g-src" value={s.source} onChange={text('source')} />
          <span className="help">The name of your table or dataset.</span>
        </div>
        <div className="field">
          <label htmlFor="g-time">Which column has the date?</label>
          <input type="text" id="g-time" value={s.time_column} onChange={text('time_column')} />
          <span className="help">The column that says when each row happened.</span>
        </div>
        <div className="field span2">
          <span className="lbl">Show results by</span>
          <Segmented name="grain" options={GRAINS} value={s.grain} onChange={(v) => set('grain', v)} />
        </div>
      </div>

      <details className="adv">
        <summary>More settings (optional)</summary>
        <div className="fields">
          <div className="field">
            <label htmlFor="g-llm">Which AI writes the summaries?</label>
            <select id="g-llm" value={s.llm} onChange={text('llm')}>
              {LLMS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="g-det">How should we spot unusual results?</label>
            <select id="g-det" value={s.detector} onChange={text('detector')}>
              {DETECTORS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="g-cont">How often is a month usually unusual? (%)</label>
            <NumberField id="g-cont" step="0.5" min="0.1" max="50" value={pct} onChange={(v) => set('contamination', v / 100)} />
            <span className="help">3 means about 3 months in every 100.</span>
          </div>
          <div className="field">
            <label htmlFor="g-minn">Months to learn from first</label>
            <NumberField id="g-minn" min="3" max="24" value={s.min_n} onChange={(v) => set('min_n', v)} />
            <span className="help">We won't flag the earliest months.</span>
          </div>
        </div>
      </details>

      <details className="adv">
        <summary>Manage this set</summary>
        <div className="row-btns" style={{ paddingBottom: 14 }}>
          <button className="btn" onClick={() => dispatch(duplicateSet())}>
            Duplicate this set
          </button>
          <button className="btn danger" disabled={sets.length < 2} title={sets.length < 2 ? 'You need at least one set' : undefined} onClick={() => dispatch(removeSet())}>
            Remove this set
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              if (window.confirm('Replace everything with the built-in example? Your current sets will be lost.')) dispatch(resetAll());
            }}
          >
            Start over with the example
          </button>
        </div>
      </details>
    </>
  );
}
