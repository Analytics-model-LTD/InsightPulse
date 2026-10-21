import { dimBreakdown, sevClass, sevLabel } from '../../utils/analysis';
import { titleCase } from '../../utils/format';

export default function DrillPanel({ set, alert }) {
  if (!alert) {
    return (
      <div className="panel">
        <div className="empty">Select an alert to see which segments drove it.</div>
      </div>
    );
  }
  const br = dimBreakdown(set, alert);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Where it came from</h2>
          <p>
            {titleCase(alert.m.id)}, month {alert.t + 1}. Share of the movement by segment.
          </p>
        </div>
        <span className={`pill ${sevClass(alert)}`}>
          <i className="dot" />
          {sevLabel(alert)}
        </span>
      </div>
      {br.length ? (
        br.map((x) => (
          <div className="dim-block" key={x.dim}>
            <div className="label">{x.dim}</div>
            {x.rows.map((row) => (
              <div className="drill-row" key={row.name}>
                <span className="v" title={row.name}>
                  {row.name}
                </span>
                <div className="track">
                  <i className={row.other ? 'other' : ''} style={{ width: (row.p * 100).toFixed(1) + '%' }} />
                </div>
                <span className="pc">{Math.round(row.p * 100)}%</span>
              </div>
            ))}
          </div>
        ))
      ) : (
        <div className="empty">Add columns in step 3 to see which segments drove each alert.</div>
      )}
      <p className="muted small" style={{ margin: '14px 0 0' }}>
        Segment shares here are sample values. In production the platform computes them from your source and {set.llm} writes the narrative.
      </p>
    </div>
  );
}
