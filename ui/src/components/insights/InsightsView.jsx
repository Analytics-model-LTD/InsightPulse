import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentIndex, selectCurrentSet, selectSet, selectSets } from '../../features/kpiSets/kpiSetsSlice';
import { fetchInsights, setKey } from '../../features/insights/insightsSlice';
import { setMeasureFilter, setSelectedAlert, setSeverityFilter, setViewer } from '../../features/ui/uiSlice';
import { analyse, cmpAlert, fromPayload, viaOf, visibleFor } from '../../utils/analysis';
import { SEV } from '../../utils/constants';
import { listOf, personName, sevText, titleCase } from '../../utils/format';
import AlertFeed from './AlertFeed';
import DrillPanel from './DrillPanel';
import Filters from './Filters';
import JointChart from './JointChart';
import MeasureCharts from './MeasureCharts';
import PeopleBar from './PeopleBar';

export default function InsightsView() {
  const dispatch = useDispatch();
  const sets = useSelector(selectSets);
  const current = useSelector(selectCurrentIndex);
  const set = useSelector(selectCurrentSet);
  const ui = useSelector((s) => s.ui);

  const recs = set.alerting.recipients;

  // Ask the backend command for this set's insights; refetch when the definition changes.
  const ins = useSelector((s) => s.insights);
  const key = useMemo(() => setKey(set), [set]);
  useEffect(() => {
    dispatch(fetchInsights());
  }, [dispatch, key]);
  const ready = ins.status === 'ready' && ins.key === key;
  const analysis = useMemo(() => {
    if (!ready) return null;
    return ins.source === 'shell' ? fromPayload(set, ins.data || {}) : analyse(set);
  }, [ready, ins.source, ins.data, set]);

  const header = (
    <>
      <div className="hero">
        <h2 className="hero-t">Here is what your team would see</h2>
        <p>
          Pick a person or team to see the alerts they would get, why each one fired, and the charts behind it.
        </p>
      </div>
      <div className="rbar">
        <div className="field">
          <label htmlFor="setsel">KPI set</label>
          <select id="setsel" value={current} onChange={(e) => dispatch(selectSet(Number(e.target.value)))}>
            {sets.map((s, i) => (
              <option key={s.uid} value={i}>
                {s.name || 'Untitled set'}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );

  if (!recs.length) {
    return (
      <section>
        {header}
        <div className="who">
          <div className="label">Show insights for</div>
          <div className="people">
            <span className="muted small">No one yet. Add a person or team in step 5 of Set up KPIs.</span>
          </div>
        </div>
        <div className="section-title">
          <h2>What this person receives</h2>
        </div>
        <div className="feed">
          <div className="empty">Nobody is set to receive alerts for this KPI set yet.</div>
        </div>
      </section>
    );
  }

  if (!ready) {
    return (
      <section>
        {header}
        <div className="section-title">
          <h2>Insights</h2>
        </div>
        {ins.status === 'error' ? (
          <div className="empty">
            Could not load insights: {ins.error}
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => dispatch(fetchInsights())}>
                Try again
              </button>
            </div>
          </div>
        ) : (
          <div className="empty">Loading insights…</div>
        )}
      </section>
    );
  }

  // ----- derive view state (guards for stale indexes after edits) -----
  const viewer = ui.viewer === -1 ? -1 : ui.viewer >= recs.length ? 0 : ui.viewer;
  const everyone = viewer === -1;
  const r = everyone ? null : recs[viewer];
  const mf = ui.mf !== 'all' && !set.measures.some((m) => m.id === ui.mf) ? 'all' : ui.mf;

  const counts = recs.map((x) => visibleFor(x, analysis).length);

  let base;
  if (everyone) {
    const map = {};
    recs.forEach((x) =>
      visibleFor(x, analysis).forEach((a) => {
        const k = a.m.id + '|' + a.t;
        if (!map[k]) map[k] = { ...a, to: [] };
        map[k].to.push(x);
      })
    );
    base = Object.keys(map)
      .map((k) => map[k])
      .sort(cmpAlert);
  } else {
    base = visibleFor(r, analysis).map((a) => ({ ...a, to: [r] }));
  }

  const sevCounts = { all: base.length, critical: 0, warning: 0, info: 0, fav: 0 };
  base.forEach((a) => {
    if (a.fav) sevCounts.fav++;
    else sevCounts[a.sev]++;
  });

  const items = base.filter((a) => {
    const sv = ui.sevf === 'all' || (ui.sevf === 'fav' ? a.fav : !a.fav && a.sev === ui.sevf);
    return sv && (mf === 'all' || a.m.id === mf);
  });
  const sel = ui.sel >= items.length ? 0 : ui.sel;

  const ms = everyone ? [] : listOf(r.measures);
  const via = everyone ? [] : viaOf(set, r);

  const crit = items.filter((a) => a.sev === 'critical' && !a.fav).length;
  const latest = items.length ? Math.max(...items.map((a) => a.t)) + 1 : null;
  const visM = everyone ? set.measures.length : set.measures.filter((m) => !ms.length || ms.indexOf(m.id) > -1).length;

  const shown = set.measures.filter((m) => (everyone || !ms.length || ms.indexOf(m.id) > -1) && (mf === 'all' || m.id === mf));
  const minSev = everyone ? 0 : SEV[r.min_severity] || 0;

  const contamination = (Number(set.contamination) * 100).toFixed(1).replace(/\.0$/, '');

  return (
    <section>
      {header}

      <PeopleBar recs={recs} counts={counts} viewer={viewer} onPick={(i) => dispatch(setViewer(i))} />

      <Filters
        counts={sevCounts}
        sevf={ui.sevf}
        mf={mf}
        measures={set.measures}
        onSeverity={(v) => dispatch(setSeverityFilter(v))}
        onMeasure={(v) => dispatch(setMeasureFilter(v))}
      />

      <div className="rmeta" style={{ marginTop: 12 }}>
        {everyone ? (
          <>
            <span className="chip">
              Everyone: {recs.length} recipient{recs.length === 1 ? '' : 's'} combined
            </span>
            <span className="chip">each alert shows who gets it</span>
          </>
        ) : (
          <>
            <span className="chip">hears about: {sevText(r.min_severity)}</span>
            <span className="chip">numbers: {ms.length ? ms.map(titleCase).join(', ') : 'all'}</span>
            <span className="chip">sent by: {via.length ? via.join(' + ') : 'no active channel'}</span>
          </>
        )}
      </div>

      <div className="sample-note">
        {ins.source === 'shell'
          ? 'Computed by your local backend through the insights.preview shell command.'
          : 'Sample data: 24 months, with a few planted anomalies so you can see how alerts, severity and routing behave under your current thresholds. No shell bridge was found.'}
      </div>

      <div className="summary">
        <div className="stat">
          <span className="label">Alerts, last 6 months</span>
          <b>{items.length}</b>
        </div>
        <div className="stat">
          <span className="label">Critical</span>
          <b style={{ color: crit ? 'var(--crit)' : 'inherit' }}>{crit}</b>
        </div>
        <div className="stat">
          <span className="label">Most recent</span>
          <b>{latest ? 'Month ' + latest : 'None'}</b>
        </div>
        <div className="stat">
          <span className="label">Numbers shown</span>
          <b>
            {visM} / {set.measures.length}
          </b>
        </div>
      </div>

      <div className="section-title">
        <h2>{everyone ? 'Everything your team receives' : 'What ' + personName(r) + ' receives'}</h2>
        <span className="muted small">{items.length ? 'Most urgent first' : ''}</span>
      </div>
      <div className="ins-grid">
        <AlertFeed
          set={set}
          items={items}
          everyone={everyone}
          via={via}
          sel={sel}
          hasBase={base.length > 0}
          onSelect={(i) => dispatch(setSelectedAlert(i))}
        />
        <DrillPanel set={set} alert={items[sel]} />
      </div>

      <div className="section-title">
        <h2>Numbers over time</h2>
        <span className="muted small">The shaded band is the normal range</span>
      </div>
      <MeasureCharts measures={shown} analysis={analysis} marksMinSeverity={(a) => SEV[a.sev] >= minSev} />

      <div className="section-title">
        <h2>Joint detector view</h2>
        <span className="muted small">
          {set.detector}, contamination {contamination}%: flags {analysis.jointN} of {analysis.jointValid} scored months
        </span>
      </div>
      <div className="panel chart-card" id="joint">
        <p className="muted small" style={{ margin: '0 0 6px' }}>
          Combined score across all measures per month.
          {ins.source === 'shell' ? '' : ' The preview uses a robust z-score blend as a stand-in; the platform runs the configured detector.'}
        </p>
        {analysis.joint.length > 0 ? <JointChart joint={analysis.joint} /> : <div className="empty">No joint scores returned.</div>}
        <div className="legend">
          <span>
            <i style={{ background: 'var(--crit)' }} />
            flagged month
          </span>
          <span>
            <i style={{ background: 'var(--muted)', opacity: 0.5 }} />
            normal
          </span>
          <span>grey tick: fewer than {analysis.minN} periods of history</span>
        </div>
      </div>
    </section>
  );
}
