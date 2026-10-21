import { useDispatch } from 'react-redux';
import { removeRecipient, toggleRecipientMeasure, updateRecipient } from '../../features/kpiSets/kpiSetsSlice';
import { RECIPIENT_SEVERITY } from '../../utils/constants';
import { avatarBg, initials, listOf, personName, titleCase } from '../../utils/format';
import Segmented from '../common/Segmented';
import ToggleCard from '../common/ToggleCard';

export default function RecipientCard({ r, index, measures }) {
  const dispatch = useDispatch();
  const chosen = listOf(r.measures);
  const set = (key, value) => dispatch(updateRecipient({ index, key, value }));
  const p = `r${r.uid}`;

  return (
    <div className="person">
      <div className="phead">
        <span className="avatar" style={{ background: avatarBg(r.target) }}>
          {initials(r.target)}
        </span>
        <div className="pwrap">
          <b className="pname">{personName(r)}</b>
          <span className="muted small">{r.kind === 'team' ? 'Team' : 'Person'}</span>
        </div>
        <button className="btn ghost danger" onClick={() => dispatch(removeRecipient(index))}>
          Remove
        </button>
      </div>
      <div className="fields">
        <div className="field">
          <span className="lbl">Is this a person or a team?</span>
          <Segmented
            name={`${p}-kind`}
            options={[
              ['employee', 'One person'],
              ['team', 'A team'],
            ]}
            value={r.kind}
            onChange={(v) => set('kind', v)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${p}-t`}>{r.kind === 'team' ? 'Team name' : 'Email address'}</label>
          <input type="text" id={`${p}-t`} inputMode={r.kind === 'team' ? 'text' : 'email'} autoComplete="off" value={r.target} onChange={(e) => set('target', e.target.value)} />
        </div>
        <div className="field span2">
          <span className="lbl">Which alerts should they get?</span>
          <Segmented name={`${p}-sev`} options={RECIPIENT_SEVERITY} value={r.min_severity} onChange={(v) => set('min_severity', v)} />
        </div>
        <div className="field span2">
          <span className="lbl">Which numbers do they care about?</span>
          <div className="mchips">
            {measures.map((m) => (
              <label className="mchip" key={m.uid}>
                <input
                  type="checkbox"
                  checked={chosen.indexOf(m.id) > -1}
                  onChange={(e) => dispatch(toggleRecipientMeasure({ index, measureId: m.id, checked: e.target.checked }))}
                />
                <span>{titleCase(m.id)}</span>
              </label>
            ))}
          </div>
          <span className="help rhint">{chosen.length ? 'They only hear about these numbers.' : 'None picked means they hear about every number.'}</span>
        </div>
        <div className="field span2">
          <span className="lbl">How should we reach them?</span>
          <div className="tcards">
            <ToggleCard title="Email" checked={r.ch_email} onChange={(v) => set('ch_email', v)} />
            <ToggleCard title="Webhook" checked={r.ch_webhook} onChange={(v) => set('ch_webhook', v)} />
          </div>
        </div>
      </div>
    </div>
  );
}
