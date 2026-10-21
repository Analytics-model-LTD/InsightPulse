import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { saveKpiSets, selectCurrentSet, selectSync } from '../../features/kpiSets/kpiSetsSlice';
import { nextStep, prevStep, setTab } from '../../features/ui/uiSlice';
import { WIZARD_STEPS } from '../../utils/constants';
import Icon from '../common/Icon';
import DefinitionAccordion from './DefinitionAccordion';
import SetBar from './SetBar';
import Stepper from './Stepper';
import StepAlerts from './steps/StepAlerts';
import StepBasics from './steps/StepBasics';
import StepNumbers from './steps/StepNumbers';
import StepPeople from './steps/StepPeople';
import StepReasons from './steps/StepReasons';
import StepReview from './steps/StepReview';

const BODIES = [StepBasics, StepNumbers, StepReasons, StepAlerts, StepPeople, StepReview];

export default function DefineView({ hidden }) {
  const dispatch = useDispatch();
  const setUid = useSelector((s) => selectCurrentSet(s).uid);
  const step = useSelector((s) => s.ui.wizardStep);
  const dir = useSelector((s) => s.ui.wizardDir);
  const sync = useSelector(selectSync);

  const info = WIZARD_STEPS[step];
  const Body = BODIES[step];
  const last = step === WIZARD_STEPS.length - 1;
  const saving = sync.status === 'saving';

  // After moving between slides, bring the slide into view and move focus to its heading.
  const topRef = useRef(null);
  const headRef = useRef(null);
  const prevStepRef = useRef(step);
  useEffect(() => {
    if (prevStepRef.current === step) return;
    prevStepRef.current = step;
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    headRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Last slide: save (when a shell bridge exists), then open the insights tab.
  async function saveAndSee() {
    if (sync.source !== 'sample') {
      const res = await dispatch(saveKpiSets());
      if (res.meta.requestStatus !== 'fulfilled') return; // the error is shown in the status line
    }
    dispatch(setTab('insights'));
  }

  return (
    <section hidden={hidden}>
      <div className="define-shell">
        <div className="hero">
          <h2 className="hero-t">What should we keep an eye on?</h2>
          <p>Answer a few quick questions. You can change anything later.</p>
        </div>

        <SetBar />

        <div className="wizard" ref={topRef}>
          <Stepper />

          <div className="viewport">
            <div className={`slide ${dir < 0 ? 'back' : 'fwd'}`} key={step}>
              <div className="step-head">
                <span className="step-ico">
                  <Icon name={info.icon} size={24} />
                </span>
                <div>
                  <h2 ref={headRef} tabIndex={-1}>
                    {info.title}
                  </h2>
                  <p>{info.sub}</p>
                </div>
              </div>
              <div className="panel step-body">
                <Body key={setUid} />
              </div>
            </div>
          </div>

          <nav className="wiz-nav" aria-label="Step navigation">
            <button className="btn lg ghost" style={{ visibility: step === 0 ? 'hidden' : 'visible' }} onClick={() => dispatch(prevStep())}>
              <Icon name="arrow-left" size={18} /> Back
            </button>
            {last ? (
              <button className="btn lg primary" disabled={saving} onClick={saveAndSee}>
                {saving ? 'Saving…' : 'Save & see insights'} <Icon name="arrow-right" size={18} />
              </button>
            ) : (
              <button className="btn lg primary" onClick={() => dispatch(nextStep())}>
                Next: {WIZARD_STEPS[step + 1].short} <Icon name="arrow-right" size={18} />
              </button>
            )}
          </nav>
        </div>

        <DefinitionAccordion />
      </div>
    </section>
  );
}
