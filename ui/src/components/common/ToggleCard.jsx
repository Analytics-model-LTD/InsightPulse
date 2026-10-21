// Switch-style checkbox card, e.g. "Email: Send alerts by email".
export default function ToggleCard({ title, hint, checked, onChange }) {
  return (
    <label className="tcard">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="sw" aria-hidden="true" />
      <span className="tcard-text">
        <b>{title}</b>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}
