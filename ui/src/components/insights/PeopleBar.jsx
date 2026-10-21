import { avatarBg, initials, personName } from '../../utils/format';

export default function PeopleBar({ recs, counts, viewer, onPick }) {
  return (
    <div className="who">
      <div className="label">Show insights for</div>
      <div className="people">
        <button className="person-chip" aria-pressed={viewer === -1} onClick={() => onPick(-1)}>
          <span className="avatar all">All</span>
          <span className="pc-name">
            Everyone
            <small>
              {recs.length} recipient{recs.length === 1 ? '' : 's'}
            </small>
          </span>
        </button>
        {recs.map((x, i) => (
          <button key={x.uid} className="person-chip" aria-pressed={i === viewer} onClick={() => onPick(i)}>
            <span className="avatar" style={{ background: avatarBg(x.target) }}>
              {initials(x.target)}
            </span>
            <span className="pc-name">
              {personName(x)}
              <small>
                {x.kind === 'team' ? 'Team' : 'Employee'} · {counts[i]} alert{counts[i] === 1 ? '' : 's'}
              </small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
