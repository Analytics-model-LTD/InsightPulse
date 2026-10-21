import { useDispatch, useSelector } from 'react-redux';
import { goStep } from '../../features/ui/uiSlice';
import { WIZARD_STEPS } from '../../utils/constants';
import Icon from '../common/Icon';

export default function Stepper() {
  const dispatch = useDispatch();
  const step = useSelector((s) => s.ui.wizardStep);
  const total = WIZARD_STEPS.length;

  return (
    <div className="stepper-wrap">
      <ol className="stepper" aria-label="Setup steps">
        {WIZARD_STEPS.map((st, i) => {
          const state = i < step ? 'done' : i === step ? 'current' : 'todo';
          return (
            <li key={st.id} className={state}>
              <button className="st" aria-current={i === step ? 'step' : undefined} aria-label={`Step ${i + 1} of ${total}: ${st.short}`} onClick={() => dispatch(goStep(i))}>
                <span className="dot">{state === 'done' ? <Icon name="check" size={16} /> : i + 1}</span>
                <span className="lbl">{st.short}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="step-count">
        Step {step + 1} of {total} · <b>{WIZARD_STEPS[step].short}</b>
      </div>
      <div className="progress" aria-hidden="true">
        <i style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>
    </div>
  );
}
