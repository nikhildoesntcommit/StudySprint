import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { Check, X, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Subject } from '../types';
import { subjectHex } from '../store/defaults';
import { useStore } from '../store/store';

// ---- Buttons ---------------------------------------------------------------

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger' | 'default';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = 'default', size = 'md', block, icon, className = '', children, ...rest }: BtnProps) {
  const cls = ['btn', variant !== 'default' && variant, size !== 'md' && size, block && 'block', className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest}>{icon}{children}</button>;
}

export function IconButton({ label, size, active, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm'; active?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} className={['icon-btn', size, active && 'active', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}

// ---- Form bits -------------------------------------------------------------

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function Seg<T extends string | number>({ value, options, onChange, full, label }: {
  value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; full?: boolean; label?: string;
}) {
  return (
    <div className={`seg${full ? ' full' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={String(o.value)} aria-pressed={o.value === value} title={o.title} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, style }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="field" style={style}>
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function SettingRow({ title, desc, children }: { title: ReactNode; desc?: ReactNode; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="grow">
        <div className="setting-title">{title}</div>
        {desc && <div className="setting-desc">{desc}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

// ---- Display ---------------------------------------------------------------

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 6 }}>{action}</div>}
    </div>
  );
}

export function SubjectChip({ subject, size }: { subject?: Subject; size?: 'sm' }) {
  if (!subject) return null;
  return (
    <span className={`chip subj-chip${size ? ` ${size}` : ''}`} style={{ '--c': subjectHex(subject.color) } as CSSProperties}>
      <span aria-hidden>{subject.emoji}</span><span className="truncate">{subject.name}</span>
    </span>
  );
}

export function useSubject(id?: string) {
  return useStore((s) => (id ? s.subjects.find((x) => x.id === id) : undefined));
}

export function Ring({ value, size = 64, stroke = 7, color = 'var(--accent)', track = 'var(--surface-3)', children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      {children && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>}
    </div>
  );
}

export function Bar({ value, color, thin }: { value: number; color?: string; thin?: boolean }) {
  return <div className={`bar${thin ? ' thin' : ''}`}><i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, '--c': color } as CSSProperties} /></div>;
}

export function Check3({ checked, onChange, color, square, label }: { checked: boolean; onChange: () => void; color?: string; square?: boolean; label?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label ?? (checked ? 'Mark not done' : 'Mark done')}
      className={`check${square ? ' square' : ''}`} style={{ '--c': color } as CSSProperties}
      onClick={(e) => { e.stopPropagation(); onChange(); }}>
      <Check />
    </button>
  );
}

// ---- Modal -----------------------------------------------------------------

export function Modal({ open, onClose, title, children, footer, size, icon }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'lg' | 'xl'; icon?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${size ? ` ${size}` : ''}`} role="dialog" aria-modal="true">
        {title && (
          <div className="modal-head">
            {icon}
            <h2>{title}</h2>
            <IconButton label="Close" onClick={onClose}><X /></IconButton>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---- Menu ------------------------------------------------------------------

export function Menu({ trigger, children, align = 'right', up }: { trigger: (open: () => void, isOpen: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger(() => setOpen((v) => !v), open)}
      {open && <div className={`menu${align === 'left' ? ' left' : ''}${up ? ' up' : ''}`} role="menu">{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger, active }: { icon?: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean; active?: boolean }) {
  return <button type="button" role="menuitem" className={`menu-item${danger ? ' danger' : ''}`} data-active={active} onClick={onClick}>{icon}{children}</button>;
}

// ---- Toasts ----------------------------------------------------------------

interface Toast { id: number; text: string; tone?: 'info' | 'success' | 'warn'; action?: { label: string; run: () => void } }
const useToasts = create<{ list: Toast[]; push: (t: Omit<Toast, 'id'>) => void; drop: (id: number) => void }>((set) => ({
  list: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ list: [...s.list.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ list: s.list.filter((x) => x.id !== id) })), t.action ? 6000 : 3200);
  },
  drop: (id) => set((s) => ({ list: s.list.filter((x) => x.id !== id) })),
}));

export const toast = (text: string, opts: Omit<Toast, 'id' | 'text'> = {}) => useToasts.getState().push({ text, ...opts });

export function Toasts() {
  const { list, drop } = useToasts();
  return createPortal(
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div className="toast" key={t.id}>
          {t.tone === 'success' ? <CheckCircle2 /> : t.tone === 'warn' ? <AlertTriangle /> : <Info />}
          <span className="grow">{t.text}</span>
          {t.action && <button type="button" onClick={() => { t.action!.run(); drop(t.id); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ---- Confirm ---------------------------------------------------------------

interface ConfirmReq { title: string; body?: ReactNode; confirm?: string; danger?: boolean; resolve: (v: boolean) => void }
const ConfirmCtx = createContext<(r: Omit<ConfirmReq, 'resolve'>) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const ask = useCallback((r: Omit<ConfirmReq, 'resolve'>) => new Promise<boolean>((resolve) => setReq({ ...r, resolve })), []);
  const done = (v: boolean) => { req?.resolve(v); setReq(null); };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal open={!!req} onClose={() => done(false)} title={req?.title}
        footer={<><Button onClick={() => done(false)}>Cancel</Button><Button variant={req?.danger ? 'danger' : 'primary'} className={req?.danger ? 'solid' : ''} onClick={() => done(true)} autoFocus>{req?.confirm ?? 'Confirm'}</Button></>}>
        {req?.body && <div className="muted">{req.body}</div>}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

// ---- Hooks -----------------------------------------------------------------

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useHotkey(key: string, fn: (e: KeyboardEvent) => void, deps: unknown[] = [], opts: { allowInInput?: boolean } = {}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing && !opts.allowInInput) return;
      const want = key.toLowerCase().split('+');
      const k = want.pop()!;
      const mod = want.includes('mod');
      if (mod !== (e.metaKey || e.ctrlKey)) return;
      if (want.includes('shift') !== e.shiftKey && k.length > 1) return;
      if (e.key.toLowerCase() !== k) return;
      fn(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
