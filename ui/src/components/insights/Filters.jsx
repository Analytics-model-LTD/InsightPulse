import { SEVERITY_FILTERS } from '../../utils/constants';
import { titleCase } from '../../utils/format';
import Segmented from '../common/Segmented';

export default function Filters({ counts, sevf, mf, measures, onSeverity, onMeasure }) {
  return (
    <div className="filters">
      <Segmented
        name="sevf"
        className="sm"
        ariaLabel="Filter by severity"
        value={sevf}
        onChange={onSeverity}
        options={SEVERITY_FILTERS.map(([v, label]) => [
          v,
          <>
            {label} <em>{counts[v]}</em>
          </>,
        ])}
      />
      <div className="field">
        <label htmlFor="mf">Number</label>
        <select id="mf" value={mf} onChange={(e) => onMeasure(e.target.value)}>
          <option value="all">All numbers</option>
          {measures.map((m) => (
            <option key={m.uid} value={m.id}>
              {titleCase(m.id)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
