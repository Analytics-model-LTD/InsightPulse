import { useEffect, useState } from 'react';

// Number input that lets the user clear the field while typing.
// Empty input is reported as 0 (same as the original prototype).
export default function NumberField({ value, onChange, ...rest }) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    const same = text === '' ? Number(value) === 0 : Number(text) === Number(value);
    if (!same) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      {...rest}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value === '' ? 0 : Number(e.target.value));
      }}
    />
  );
}
