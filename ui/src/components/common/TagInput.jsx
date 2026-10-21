import { useState } from 'react';
import { listOf } from '../../utils/format';
import Icon from './Icon';

// Chips input bound to a comma-separated string (the format the KPI set stores).
// Enter or comma adds a tag, Backspace on an empty box removes the last one.
export default function TagInput({ id, value, onChange, placeholder }) {
  const tags = listOf(value);
  const [text, setText] = useState('');

  const commit = (raw) => {
    const add = listOf(raw).filter((t) => tags.indexOf(t) === -1);
    if (add.length) onChange(tags.concat(add).join(', '));
    setText('');
  };
  const remove = (t) => onChange(tags.filter((x) => x !== t).join(', '));

  return (
    <div className="tags">
      {tags.map((t) => (
        <span className="tag" key={t}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => remove(t)}>
            <Icon name="x" size={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        id={id}
        value={text}
        placeholder={tags.length ? 'Add another…' : placeholder}
        onChange={(e) => (e.target.value.includes(',') ? commit(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(text);
          } else if (e.key === 'Backspace' && !text && tags.length) remove(tags[tags.length - 1]);
        }}
        onBlur={() => text.trim() && commit(text)}
      />
    </div>
  );
}
