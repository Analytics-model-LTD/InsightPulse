import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentSet, setField } from '../../../features/kpiSets/kpiSetsSlice';
import { SENSITIVITY } from '../../../utils/constants';
import NumberField from '../../common/NumberField';
import Segmented from '../../common/Segmented';
import ToggleCard from '../../common/ToggleCard';

export default function StepAlerts() {
  const dispatch = useDispatch();
  const { alerting: a } = useSelector(selectCurrentSet);
  const set = (path, value) => dispatch(setField({ path, value }));

  // Highlight a preset only when the threshold matches it exactly.
  const sensValue = SENSITIVITY.find(([v]) => Math.abs(Number(v) - Number(a.z_threshold)) < 0.001)?.[0] ?? null;
  const pct = Math.round(Number(a.min_pct_change) * 1000) / 10;

  return (
    <div className="fields">
      <div className="field span2">
        <span className="lbl">How picky should we be?</span>
        <Segmented
          name="sens"
          className="big"
          value={sensValue}
          onChange={(v) => set('alerting.z_threshold', Number(v))}
          options={SENSITIVITY.map(([v, title, sub]) => [
            v,
            <>
              <b>{title}</b>
              <small>{sub}</small>
            </>,
          ])}
        />
      </div>
      <div className="field span2">
        <div className="rule">
          We'll alert you when a number moves <b>{Number(a.z_threshold)}</b> steps away from its normal range and changes by at least{' '}
          <b>{pct}%</b>. For money numbers it must also change by <b>{Number(a.min_abs_change).toLocaleString('en-US')}</b> or more.
        </div>
      </div>
      <div className="field span2">
        <details className="adv">
          <summary>Fine-tune the numbers (optional)</summary>
          <div className="fields">
            <div className="field">
              <label htmlFor="a-z">Steps away from normal</label>
              <NumberField id="a-z" step="0.1" min="1" value={a.z_threshold} onChange={(v) => set('alerting.z_threshold', v)} />
              <span className="help">Higher means fewer alerts.</span>
            </div>
            <div className="field">
              <label htmlFor="a-pct">Smallest change to care about (%)</label>
              <NumberField id="a-pct" step="1" min="0" value={pct} onChange={(v) => set('alerting.min_pct_change', v / 100)} />
            </div>
            <div className="field">
              <label htmlFor="a-abs">Smallest money change to care about</label>
              <NumberField id="a-abs" min="0" value={a.min_abs_change} onChange={(v) => set('alerting.min_abs_change', v)} />
              <span className="help">In the same units as your money numbers.</span>
            </div>
          </div>
        </details>
      </div>
      <div className="field span2">
        <span className="lbl">How should alerts be sent?</span>
        <div className="tcards">
          <ToggleCard title="Email" hint="Send alerts to people's inboxes" checked={a.ch_email} onChange={(v) => set('alerting.ch_email', v)} />
          <ToggleCard title="Webhook" hint="Post alerts to another tool" checked={a.ch_webhook} onChange={(v) => set('alerting.ch_webhook', v)} />
        </div>
      </div>
    </div>
  );
}
