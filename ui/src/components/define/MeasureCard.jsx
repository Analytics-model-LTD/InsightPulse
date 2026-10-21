import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { removeMeasure, updateMeasure } from '../../features/kpiSets/kpiSetsSlice';
import { AGG, DIRS, PRIS } from '../../utils/constants';
import { dirInfo, sumText, titleCase } from '../../utils/format';
import Segmented from '../common/Segmented';

export default function MeasureCard({ m, index, measures, defaultOpen }) {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(defaultOpen);
  const ratio = m.agg === 'ratio';
  const [dirCls, dirText] = dirInfo(m);
  const set = (key, value) => dispatch(updateMeasure({ index, key, value }));
  const text = (key) => (e) => set(key, e.target.value);

  const pri = PRIS.slice();
  if (!pri.some((p) => p[0] === String(m.priority))) pri.push([String(m.priority), 'Level ' + m.priority]);

  // Ratio selects list the other numbers; keep a dangling current value visible.
  const ratioOptions = (cur) => {
    const others = measures.filter((x, k) => k !== index && x.id);
    const seen = others.some((x) => x.id === cur);
    return (
      <>
        <option value="">Choose a number</option>
        {others.map((x) => (
          <option key={x.uid} value={x.id}>
            {titleCase(x.id)}
          </option>
        ))}
        {cur && !seen && <option value={cur}>{cur}</option>}
      </>
    );
  };

  const p = `m${m.uid}`;
  return (
    <details className="mcard" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="mname">{titleCase(m.id || 'new number')}</span>
        <span className="msum mono">{sumText(m)}</span>
        <span className={`pill mdir ${dirCls}`}>
          <i className="dot" />
          {dirText}
        </span>
      </summary>
      <div className="mbody">
        <div className="fields">
          <div className="field">
            <label htmlFor={`${p}-id`}>Name</label>
            <input type="text" id={`${p}-id`} value={m.id} onChange={text('id')} />
            <span className="help">Short, no spaces. For example: monthly_sales</span>
          </div>
          <div className="field">
            <label htmlFor={`${p}-agg`}>How should we work it out?</label>
            <select id={`${p}-agg`} value={m.agg} onChange={text('agg')}>
              {AGG.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {ratio ? (
            <>
              <div className="field">
                <label htmlFor={`${p}-num`}>Take this number…</label>
                <select id={`${p}-num`} value={m.numerator} onChange={text('numerator')}>
                  {ratioOptions(m.numerator)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${p}-den`}>…and divide it by</label>
                <select id={`${p}-den`} value={m.denominator} onChange={text('denominator')}>
                  {ratioOptions(m.denominator)}
                </select>
              </div>
            </>
          ) : (
            <div className="field span2">
              <label htmlFor={`${p}-col`}>Which column?</label>
              <input type="text" id={`${p}-col`} value={m.column} onChange={text('column')} />
            </div>
          )}
          <div className="field span2">
            <span className="lbl">How important is it?</span>
            <Segmented name={`${p}-pri`} options={pri} value={String(m.priority)} onChange={(v) => set('priority', Number(v) || 1)} />
          </div>
          <div className="field span2">
            <span className="lbl">What counts as a good result?</span>
            <Segmented name={`${p}-dir`} options={DIRS} value={m.direction} onChange={(v) => set('direction', v)} />
          </div>
          <div className="field span2">
            <label htmlFor={`${p}-where`}>Only count rows where… (optional)</label>
            <input type="text" id={`${p}-where`} placeholder="e.g. Status = 'Cancelled'" value={m.where} onChange={text('where')} />
          </div>
        </div>
        <div className="mfoot">
          <button className="btn ghost danger" onClick={() => dispatch(removeMeasure(index))}>
            Remove this number
          </button>
        </div>
      </div>
    </details>
  );
}
