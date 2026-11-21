import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, NotebookPen, Layers, Play, Coffee, CalendarPlus, Moon, Download, CheckSquare, FileText, ClipboardCheck, BookOpen, Keyboard } from 'lucide-react';
import { useStore } from '../store/store';
import { useUI } from '../store/ui';
import { MODULES } from '../store/defaults';
import { navigate } from '../lib/router';
import { useTimer } from '../store/timer';
import { exportBackup } from '../lib/backup';
import { MODULE_ICON } from './Shell';
import { blankTask } from './tasks';
import { today } from '../lib/dates';
import { uid } from '../lib/id';

interface Cmd { id: string; label: string; group: string; icon: ReactNode; hint?: string; run: () => void; keywords?: string }

export function CommandPalette() {
  const open = useUI((s) => s.palette);
  const setOpen = useUI((s) => s.setPalette);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const data = useStore();

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const close = () => setOpen(false);
    const go = (p: string) => () => { navigate(p); close(); };
    const actions: Cmd[] = [
      { id: 'new-task', label: 'New task', group: 'Create', icon: <Plus />, hint: 'N', run: () => { close(); useUI.getState().editTask(blankTask({ due: today() })); }, keywords: 'add todo homework' },
      { id: 'new-note', label: 'New note', group: 'Create', icon: <NotebookPen />, run: () => { const n = data.addNote(); navigate(`/notes/${n.id}`); close(); } },
      { id: 'new-event', label: 'New exam or deadline', group: 'Create', icon: <CalendarPlus />, run: () => { close(); useUI.getState().editEvent({ id: uid('evt'), title: '', kind: 'exam', date: today(), createdAt: Date.now() }); }, keywords: 'event test calendar assignment' },
      { id: 'new-deck', label: 'New flashcard deck', group: 'Create', icon: <Layers />, run: go('/cards?new=1') },
      { id: 'focus', label: 'Start a focus session', group: 'Do', icon: <Play />, hint: 'F', run: () => { const t = useTimer.getState(); if (t.mode !== 'focus') t.setMode('focus'); t.start(); navigate('/focus'); close(); }, keywords: 'pomodoro timer' },
      { id: 'break', label: 'Take a short break', group: 'Do', icon: <Coffee />, run: () => { const t = useTimer.getState(); t.setMode('short'); t.start(); navigate('/focus'); close(); } },
      { id: 'review', label: 'Review due flashcards', group: 'Do', icon: <Layers />, hint: 'R', run: go('/cards/review') },
      { id: 'theme', label: 'Toggle dark mode', group: 'Do', icon: <Moon />, run: () => { const t = data.settings.theme; const sysDark = matchMedia('(prefers-color-scheme: dark)').matches; const dark = t === 'dark' || t === 'ink' || t === 'midnight' || (t === 'system' && sysDark); const clean = t === 'light' || t === 'dark'; data.updateSettings({ theme: clean ? (dark ? 'light' : 'dark') : (dark ? 'paper' : 'ink') }); close(); } },
      { id: 'backup', label: 'Download a backup', group: 'Do', icon: <Download />, run: () => { exportBackup(); close(); } },
      { id: 'shortcuts', label: 'Keyboard shortcuts', group: 'Do', icon: <Keyboard />, hint: '?', run: () => { close(); useUI.getState().setShortcuts(true); } },
      ...MODULES.filter((m) => data.settings.modules[m.id]).map((m) => ({ id: `go-${m.id}`, label: `Go to ${m.label}`, group: 'Navigate', icon: MODULE_ICON[m.id]({}), run: go(`/${m.id}`), keywords: m.blurb })),
      { id: 'go-settings', label: 'Go to Settings', group: 'Navigate', icon: MODULE_ICON.settings({}), run: go('/settings'), keywords: 'theme preferences customise' },
    ];
    return actions;
  }, [data, setOpen]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    const close = () => setOpen(false);
    const match = (t: string) => t.toLowerCase().includes(s);
    const out: Cmd[] = commands.filter((c) => match(c.label) || (c.keywords && match(c.keywords)));
    data.tasks.filter((t) => match(t.title)).slice(0, 6).forEach((t) => out.push({ id: t.id, label: t.title, group: 'Tasks', icon: <CheckSquare />, hint: t.status === 'done' ? 'done' : t.due ?? '', run: () => { close(); useUI.getState().editTask(t); } }));
    data.notes.filter((n) => match(n.title) || match(n.body)).slice(0, 6).forEach((n) => out.push({ id: n.id, label: n.title || 'Untitled note', group: 'Notes', icon: <FileText />, run: () => { navigate(`/notes/${n.id}`); close(); } }));
    data.decks.filter((d) => match(d.name)).slice(0, 4).forEach((d) => out.push({ id: d.id, label: d.name, group: 'Decks', icon: <Layers />, run: () => { navigate(`/cards/${d.id}`); close(); } }));
    data.cards.filter((c) => match(c.front) || match(c.back)).slice(0, 5).forEach((c) => out.push({ id: c.id, label: c.front.replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, '$1').slice(0, 80), group: 'Cards', icon: <BookOpen />, run: () => { navigate(`/cards/${c.deckId}`); close(); } }));
    data.papers.filter((p) => match(p.title)).slice(0, 4).forEach((p) => out.push({ id: p.id, label: p.title, group: 'Practice', icon: <ClipboardCheck />, run: () => { navigate(`/practice`); close(); } }));
    data.events.filter((e) => match(e.title)).slice(0, 4).forEach((e) => out.push({ id: e.id, label: e.title, group: 'Calendar', icon: <CalendarPlus />, hint: e.date, run: () => { close(); useUI.getState().editEvent(e); } }));
    if (out.length === 0 || !out.some((c) => c.group === 'Create' && c.id === 'quick')) {
      out.push({ id: 'quick', label: `Add task “${q.trim()}”`, group: 'Create', icon: <Plus />, run: () => { useUI.getState().editTask(blankTask({ title: q.trim(), due: today() })); close(); } });
    }
    return out;
  }, [q, commands, data, setOpen]);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;
  let lastGroup = '';
  return createPortal(
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="modal cmdk" role="dialog" aria-label="Command palette">
        <div className="cmdk-input">
          <Search />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks, notes, cards… or type a command"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter') { e.preventDefault(); results[idx]?.run(); }
              if (e.key === 'Escape') setOpen(false);
            }} />
          <kbd>esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? <div className="cmdk-group">{c.group}</div> : null;
            lastGroup = c.group;
            return (
              <div key={`${c.group}-${c.id}`}>
                {header}
                <div className="cmdk-item" data-active={i === idx} onMouseMove={() => setIdx(i)} onClick={() => c.run()}>
                  {c.icon}<span className="truncate">{c.label}</span>{c.hint && <span className="hint">{c.hint}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span><kbd>esc</kbd> close</span></div>
      </div>
    </div>,
    document.body,
  );
}
