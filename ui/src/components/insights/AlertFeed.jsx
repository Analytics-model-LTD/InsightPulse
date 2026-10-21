import { narrative, sevClass, sevLabel } from '../../utils/analysis';
import { fmtVal, personName, titleCase } from '../../utils/format';

export default function AlertFeed({ set, items, everyone, via, sel, onSelect, hasBase }) {
  if (!items.length) {
    return (
      <div className="feed">
        <div className="empty">
          {hasBase
            ? 'No alerts match these filters. Try All, or a different measure.'
            : 'Nothing reached this view in the last 6 months. Either nothing passed the alert rules, or the severity and measure choices hide it.'}
        </div>
      </div>
    );
  }

  return (
    <div className="feed">
      {items.map((a, i) => {
        const cls = sevClass(a);
        return (
          <button key={a.m.uid + '-' + a.t} className={`alert ${cls}`} aria-pressed={i === sel} onClick={() => onSelect(i)}>
            <div className="alert-top">
              <span className="alert-title">{titleCase(a.m.id)}</span>
              <span className={`pill ${cls}`}>
                <i className="dot" />
                {sevLabel(a)}
              </span>
            </div>
            <p>{narrative(set, a)}</p>
            <div className="nums">
              <span>month {a.t + 1}</span>
              <span>value {fmtVal(a.m, a.v)}</span>
              <span>expected {fmtVal(a.m, a.exp)}</span>
              <span>strength {Math.abs(a.z).toFixed(1)}</span>
            </div>
            <div className="via">
              {everyone ? (
                a.to.map((x) => (
                  <span className="chip" key={x.uid}>
                    to {personName(x)}
                  </span>
                ))
              ) : via.length ? (
                via.map((v) => (
                  <span className="chip" key={v}>
                    sent by {v}
                  </span>
                ))
              ) : (
                <span className="chip">no channel enabled</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
