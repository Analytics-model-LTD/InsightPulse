import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectSets } from '../../features/kpiSets/kpiSetsSlice';
import { highlightYaml, toYamlAll } from '../../utils/yaml';

// The technical YAML, collapsed until the user asks for it.
export default function DefinitionAccordion() {
  const sets = useSelector(selectSets);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('Copy YAML');
  const preRef = useRef(null);
  const text = useMemo(() => (open ? toYamlAll(sets) : ''), [open, sets]);
  const html = useMemo(() => (open ? highlightYaml(text) : ''), [open, text]);

  const flash = (msg, ms) => {
    setLabel(msg);
    setTimeout(() => setLabel('Copy YAML'), ms);
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      flash('Copied', 1500);
    } catch {
      // Clipboard blocked: select the text so the user can copy manually.
      const range = document.createRange();
      range.selectNodeContents(preRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      flash('Press copy shortcut', 2000);
    }
  }

  return (
    <details className="def" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="def-title">
          <b>Technical definition</b>
          <small>The YAML your answers create. Open it if you want to see or copy it.</small>
        </span>
      </summary>
      <div className="def-body">
        <div className="def-actions">
          <button className="btn" onClick={copy}>
            {label}
          </button>
        </div>
        <pre className="yaml" ref={preRef} tabIndex={0} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </details>
  );
}
