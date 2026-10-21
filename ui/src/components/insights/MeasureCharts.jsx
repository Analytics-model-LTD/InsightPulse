import { fmtVal, sumText, titleCase } from '../../utils/format';
import LineChart from './LineChart';

export default function MeasureCharts({ measures, analysis, marksMinSeverity }) {
  if (!measures.length) return <div className="charts"><div className="empty">No measures to show for this choice.</div></div>;

  return (
    <div className="charts">
      {measures.map((m) => {
        const v = analysis.ser[m.id];
        if (!v || v.length < 2) {
          return (
            <div className="panel chart-card" key={m.uid}>
              <h3>{titleCase(m.id)}</h3>
              <div className="empty" style={{ marginTop: 10 }}>
                No data was returned for this measure.
              </div>
            </div>
          );
        }
        const marks = analysis.anoms.filter((a) => a.m.id === m.id && marksMinSeverity(a));
        return (
          <div className="panel chart-card" key={m.uid}>
            <div className="top">
              <div>
                <h3>{titleCase(m.id)}</h3>
                <span className="muted small mono">{sumText(m)}</span>
              </div>
              <span className="big">{fmtVal(m, v[v.length - 1])}</span>
            </div>
            <LineChart m={m} vals={v} bands={analysis.bands[m.id]} marks={marks} />
            <div className="legend">
              <span>
                <i style={{ background: 'var(--accent)', opacity: 0.3, borderRadius: 2 }} />
                expected range
              </span>
              <span>
                <i style={{ background: 'var(--crit)' }} />
                critical
              </span>
              <span>
                <i style={{ background: 'var(--warn)' }} />
                warning
              </span>
              <span>
                <i style={{ background: 'var(--info)' }} />
                info
              </span>
              <span>
                <i style={{ background: 'var(--good)' }} />
                favourable
              </span>
              <span>x axis: months in service</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
