import { useMemo, type CSSProperties } from 'react';
import type { Priority } from '../types';
import { useStore } from '../store/store';
import { SUBJECT_COLORS } from '../store/defaults';

export function SubjectSelect({ value, onChange, allowNone = true, className = 'select', placeholder = 'No subject' }: {
  value?: string; onChange: (id: string | undefined) => void; allowNone?: boolean; className?: string; placeholder?: string;
}) {
  const all = useStore((s) => s.subjects);
  const subjects = useMemo(() => all.filter((x) => !x.archived), [all]);
  return (
    <select className={className} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} aria-label="Subject">
      {allowNone && <option value="">{placeholder}</option>}
      {subjects.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
    </select>
  );
}

export const PRIORITY_META: Record<Priority, { label: string; color: string; short: string }> = {
  0: { label: 'No priority', color: 'var(--text-3)', short: '' },
  1: { label: 'Low', color: 'var(--info)', short: 'Low' },
  2: { label: 'Medium', color: 'var(--warning)', short: 'Med' },
  3: { label: 'High', color: 'var(--danger)', short: 'High' },
};

export function PrioritySelect({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(Number(e.target.value) as Priority)} aria-label="Priority">
      {([3, 2, 1, 0] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
    </select>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Colour">
      {Object.entries(SUBJECT_COLORS).map(([k, c]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} aria-label={c.label} title={c.label}
          className="swatch" style={{ '--c': c.hex } as CSSProperties} onClick={() => onChange(k)} />
      ))}
    </div>
  );
}

const EMOJIS = ['📐', '➗', '📊', '⚛️', '🧪', '🧬', '🔬', '🌱', '🧠', '📚', '✒️', '📝', '🏛️', '🌍', '🗺️', '💻', '🤖', '📈', '💼', '🗣️', '🇫🇷', '🇪🇸', '🇩🇪', '🇯🇵', '🎨', '🎵', '🎭', '⚽', '🏃', '🩺', '⚖️', '🕌', '🔭', '🪐', '⚙️', '🧮', '📖', '🎓', '⭐', '🔥'];

export function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <div className="emoji-grid">
      {EMOJIS.map((e) => (
        <button key={e} type="button" className="emoji-btn" aria-pressed={value === e} onClick={() => onChange(e)}>{e}</button>
      ))}
    </div>
  );
}
