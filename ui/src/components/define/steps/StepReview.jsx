import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentSet } from '../../../features/kpiSets/kpiSetsSlice';
import { goStep } from '../../../features/ui/uiSlice';
import { SENSITIVITY, WIZARD_STEPS } from '../../../utils/constants';
import { avatarBg, initials, listOf, personName, titleCase } from '../../../utils/format';
import { validateSet } from '../../../utils/validate';
import Icon from '../../common/Icon';
import SaveStatus from '../../common/SaveStatus';

function Card({ title, step, children }) {
  const dispatch = useDispatch();
  return (
    <div className="sum-card">
      <div className="sum-top">
        <span className="label">{title}</span>
        <button className="btn sm ghost" onClick={() => dispatch(goStep(step))} aria-label={`Edit ${title}`}>
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

export default function StepReview() {
  const dispatch = useDispatch();
  const set = useSelector(selectCurrentSet);
  const issues = useMemo(() => validateSet(set), [set]);
  const a = set.alerting;
  const sens = SENSITIVITY.find(([v]) => Math.abs(Number(v) - Number(a.z_threshold)) < 0.001)?.[1] || 'Custom';
  const channels = [a.ch_email && 'Email', a.ch_webhook && 'Webhook'].filter(Boolean);
  const dims = listOf(set.dimensions);

  return (
    <>
      {issues.length ? (
        <div className="issues" role="alert">
          <div className="issues-head">
            <Icon name="alert" size={18} />
            <b>
              {issues.length} thing{issues.length === 1 ? '' : 's'} to check
            </b>
          </div>
          <ul>
            {issues.map((i, k) => (
              <li key={k}>
                <span>{i.text}</span>
                <button className="btn sm" onClick={() => dispatch(goStep(i.step))}>
                  Fix in {WIZARD_STEPS[i.step].short}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="allgood">
          <Icon name="check-circle" size={20} /> Everything looks good. Save it to see what each person would receive.
        </div>
      )}

      <div className="sum-grid">
        <Card title="Watching" step={0}>
          <b className="sum-big">{set.name || 'Untitled'}</b>
          <span className="muted small">
            From <span className="mono">{set.source}</span>, by {set.grain}
          </span>
        </Card>
        <Card title="Numbers" step={1}>
          <b className="sum-big">
            {set.measures.length} number{set.measures.length === 1 ? '' : 's'}
          </b>
          <div className="mchips ro">
            {set.measures.map((m) => (
              <span className="chip" key={m.uid}>
                {titleCase(m.id || 'unnamed')}
              </span>
            ))}
          </div>
        </Card>
        <Card title="Reasons" step={2}>
          {dims.length ? (
            <div className="mchips ro">
              {dims.map((d) => (
                <span className="chip" key={d}>
                  {d}
                </span>
              ))}
            </div>
          ) : (
            <span className="muted small">No columns picked, so alerts won't say where a change came from.</span>
          )}
        </Card>
        <Card title="Alerts" step={3}>
          <b className="sum-big">{sens}</b>
          <span className="muted small">
            {channels.length ? 'Sent by ' + channels.join(' and ').toLowerCase() : 'No way to send alerts yet'} · changes of {Math.round(Number(a.min_pct_change) * 1000) / 10}%+
          </span>
        </Card>
        <Card title="People" step={4}>
          <b className="sum-big">
            {a.recipients.length} recipient{a.recipients.length === 1 ? '' : 's'}
          </b>
          <div className="who-list">
            {a.recipients.map((r) => (
              <span className="who-item" key={r.uid}>
                <span className="avatar sm" style={{ background: avatarBg(r.target) }}>
                  {initials(r.target)}
                </span>
                {personName(r)}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="review-save">
        <SaveStatus />
      </div>
    </>
  );
}
