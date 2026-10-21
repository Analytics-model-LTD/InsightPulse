// Radio group styled as a segmented control.
// options: [[value, label], ...]  (label can be JSX)
export default function Segmented({ name, options, value, onChange, className = '', ariaLabel }) {
  return (
    <div className={`segmented ${className}`.trim()} role="radiogroup" aria-label={ariaLabel}>
      {options.map(([v, label]) => (
        <label key={v}>
          <input type="radio" name={name} value={v} checked={String(v) === String(value)} onChange={() => onChange(v)} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}
