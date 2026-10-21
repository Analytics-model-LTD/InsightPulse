// Little − 3 + control for small whole numbers.
export default function NumberStepper({ id, value, min = 1, max = 6, onChange }) {
  const v = Math.min(max, Math.max(min, Number(value) || min));
  return (
    <div className="numstep" role="group" aria-labelledby={id + '-l'}>
      <button type="button" className="btn" aria-label="Fewer" disabled={v <= min} onClick={() => onChange(v - 1)}>
        −
      </button>
      <output id={id} aria-live="polite">
        {v}
      </output>
      <button type="button" className="btn" aria-label="More" disabled={v >= max} onClick={() => onChange(v + 1)}>
        +
      </button>
    </div>
  );
}
