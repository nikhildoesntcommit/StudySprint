import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { CalendarDays, Clock, Flag, Hash, Repeat, Timer, Trash2, Plus, ListChecks, CornerDownLeft, Play, X } from 'lucide-react';
import type { Task, Priority, Recurrence } from '../types';
import { useStore } from '../store/store';
import { subjectHex } from '../store/defaults';
import { parseQuickAdd } from '../lib/quickadd';
import { formatDuration, formatTime, relativeDay, today } from '../lib/dates';
import { uid } from '../lib/id';
import { pop } from '../lib/audio';
import { Button, Check3, Field, IconButton, Modal, SubjectChip, toast, useConfirm } from './ui';
import { PRIORITY_META, PrioritySelect, SubjectSelect } from './pickers';
import { navigate } from '../lib/router';
import { useTimer } from '../store/timer';

export function TaskRow({ task, onOpen, showSubject = true, compact }: { task: Task; onOpen?: (t: Task) => void; showSubject?: boolean; compact?: boolean }) {
  const subject = useStore((s) => s.subjects.find((x) => x.id === task.subjectId));
  const toggle = useStore((s) => s.toggleTask);
  const clock24 = useStore((s) => s.settings.clock24);
  const done = task.status === 'done';
  const overdue = !done && task.due && task.due < today();
  const subDone = task.subtasks.filter((s) => s.done).length;
  const onToggle = () => {
    const before = useStore.getState().tasks;
    toggle(task.id);
    if (!done) {
      pop();
      toast(task.recur ? 'Done — next one scheduled' : 'Task completed', { tone: 'success', action: { label: 'Undo', run: () => useStore.getState().set(() => ({ tasks: before })) } });
    }
  };
  return (
    <div className={`task-row${done ? ' done' : ''}${compact ? ' compact' : ''}`} onClick={() => onOpen?.(task)} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(e) => { if (e.key === 'Enter' && onOpen) onOpen(task); }}>
      <Check3 checked={done} onChange={onToggle} color={task.priority ? PRIORITY_META[task.priority].color : subject ? subjectHex(subject.color) : undefined} />
      <div className="grow">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {task.due && (
            <span className={overdue ? 'danger-text' : task.due === today() ? 'accent-text' : ''}>
              <CalendarDays />{relativeDay(task.due)}{task.dueTime ? ` · ${formatTime(task.dueTime, clock24)}` : ''}
            </span>
          )}
          {task.recur && <span><Repeat />{task.recur}</span>}
          {task.estimateMin ? <span><Clock />{formatDuration(task.estimateMin)}</span> : null}
          {task.subtasks.length > 0 && <span><ListChecks />{subDone}/{task.subtasks.length}</span>}
          {task.priority > 0 && !compact && <span style={{ color: PRIORITY_META[task.priority].color }}><Flag />{PRIORITY_META[task.priority].short}</span>}
          {task.tags.map((t) => <span key={t} className="faint">#{t}</span>)}
        </div>
      </div>
      {showSubject && subject && <span className="hide-mobile"><SubjectChip subject={subject} size="sm" /></span>}
      {!done && (
        <IconButton size="sm" label="Focus on this task" className="task-focus" onClick={(e) => {
          e.stopPropagation();
          useTimer.getState().setLink({ taskId: task.id, subjectId: task.subjectId, intention: task.title });
          navigate('/focus');
        }}><Play /></IconButton>
      )}
    </div>
  );
}

export function QuickAdd({ defaults, placeholder, autoFocus, onAdded }: { defaults?: Partial<Task>; placeholder?: string; autoFocus?: boolean; onAdded?: (t: Task) => void }) {
  const [text, setText] = useState('');
  const subjects = useStore((s) => s.subjects);
  const addTask = useStore((s) => s.addTask);
  const clock24 = useStore((s) => s.settings.clock24);
  const ref = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseQuickAdd(text, subjects), [text, subjects]);
  const subj = subjects.find((s) => s.id === parsed.subjectId);
  const submit = () => {
    if (!parsed.title) return;
    const t = addTask({ ...defaults, ...parsed, subjectId: parsed.subjectId ?? defaults?.subjectId, due: parsed.due ?? defaults?.due });
    setText('');
    onAdded?.(t);
  };
  const hasChips = text.trim() && (parsed.due || parsed.subjectId || parsed.priority || parsed.estimateMin || parsed.recur || parsed.tags.length);
  return (
    <div className="quickadd">
      <div className="quickadd-row">
        <Plus className="quickadd-plus" />
        <input ref={ref} className="quickadd-input" value={text} autoFocus={autoFocus}
          placeholder={placeholder ?? 'Add a task — try “Essay draft #english fri 5pm !high ~1h”'}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setText(''); ref.current?.blur(); } }}
          aria-label="Add a task" />
        {text && <button type="button" className="btn primary sm" onClick={submit}><CornerDownLeft />Add</button>}
      </div>
      {hasChips ? (
        <div className="quickadd-chips">
          {subj && <SubjectChip subject={subj} size="sm" />}
          {parsed.due && <span className="chip sm accent"><CalendarDays />{relativeDay(parsed.due)}{parsed.dueTime ? ` ${formatTime(parsed.dueTime, clock24)}` : ''}</span>}
          {parsed.priority > 0 && <span className="chip sm" style={{ color: PRIORITY_META[parsed.priority].color }}><Flag />{PRIORITY_META[parsed.priority].label}</span>}
          {parsed.estimateMin && <span className="chip sm"><Timer />{formatDuration(parsed.estimateMin)}</span>}
          {parsed.recur && <span className="chip sm"><Repeat />{parsed.recur}</span>}
          {parsed.tags.map((t) => <span key={t} className="chip sm"><Hash />{t}</span>)}
        </div>
      ) : null}
    </div>
  );
}

export function TaskEditor({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return <Modal open={!!task} onClose={onClose} title={task && useStore.getState().tasks.some((t) => t.id === task.id) ? 'Edit task' : 'New task'} size="lg">
    {task && <TaskForm key={task.id} initial={task} onClose={onClose} />}
  </Modal>;
}

function TaskForm({ initial, onClose }: { initial: Task; onClose: () => void }) {
  const [t, setT] = useState<Task>(initial);
  const [newSub, setNewSub] = useState('');
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const confirm = useConfirm();
  const up = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }));
  const save = () => {
    if (!t.title.trim()) return;
    upsert('tasks', { ...t, title: t.title.trim() });
    onClose();
  };
  const addSub = () => {
    if (!newSub.trim()) return;
    up({ subtasks: [...t.subtasks, { id: uid('st'), title: newSub.trim(), done: false }] });
    setNewSub('');
  };
  return (
    <div className="stack">
      <input className="input title-input" value={t.title} onChange={(e) => up({ title: e.target.value })} placeholder="What needs doing?" autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }} />
      <div className="grid-3">
        <Field label="Subject"><SubjectSelect value={t.subjectId} onChange={(subjectId) => up({ subjectId })} /></Field>
        <Field label="Priority"><PrioritySelect value={t.priority} onChange={(priority: Priority) => up({ priority })} /></Field>
        <Field label="Status">
          <select className="select" value={t.status} onChange={(e) => up({ status: e.target.value as Task['status'], completedAt: e.target.value === 'done' ? t.completedAt ?? Date.now() : undefined })}>
            <option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option>
          </select>
        </Field>
        <Field label="Due date">
          <div className="row" style={{ gap: 6 }}>
            <input type="date" className="input" value={t.due ?? ''} onChange={(e) => up({ due: e.target.value || undefined })} />
            {t.due && <IconButton size="sm" label="Clear date" onClick={() => up({ due: undefined, dueTime: undefined })}><X /></IconButton>}
          </div>
        </Field>
        <Field label="Time"><input type="time" className="input" value={t.dueTime ?? ''} onChange={(e) => up({ dueTime: e.target.value || undefined })} /></Field>
        <Field label="Repeat">
          <select className="select" value={t.recur ?? ''} onChange={(e) => up({ recur: (e.target.value || null) as Recurrence })}>
            <option value="">Never</option><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekly">Every week</option><option value="monthly">Every month</option>
          </select>
        </Field>
        <Field label="Estimate (minutes)"><input type="number" min={0} step={5} className="input" value={t.estimateMin ?? ''} onChange={(e) => up({ estimateMin: e.target.value ? Number(e.target.value) : undefined })} /></Field>
        <Field label="Tags" hint="Comma separated" style={{ gridColumn: 'span 2' }}>
          <input className="input" value={t.tags.join(', ')} onChange={(e) => up({ tags: e.target.value.split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean) })} placeholder="homework, revision" />
        </Field>
      </div>
      <Field label="Checklist">
        <div className="subtasks">
          {t.subtasks.map((st) => (
            <div key={st.id} className="subtask">
              <Check3 square checked={st.done} onChange={() => up({ subtasks: t.subtasks.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)) })} />
              <input className="input bare grow" value={st.title} onChange={(e) => up({ subtasks: t.subtasks.map((x) => (x.id === st.id ? { ...x, title: e.target.value } : x)) })} />
              <IconButton size="sm" label="Remove step" onClick={() => up({ subtasks: t.subtasks.filter((x) => x.id !== st.id) })}><X /></IconButton>
            </div>
          ))}
          <div className="subtask">
            <Plus style={{ width: 16, color: 'var(--text-3)' }} />
            <input className="input bare grow" value={newSub} placeholder="Add a step" onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addSub(); }} />
          </div>
        </div>
      </Field>
      <Field label="Notes"><textarea className="textarea" value={t.notes ?? ''} onChange={(e) => up({ notes: e.target.value })} placeholder="Details, links, page numbers…" /></Field>
      <div className="row">
        {useStore.getState().tasks.some((x) => x.id === t.id) && (
          <Button variant="ghost" className="danger" icon={<Trash2 />} onClick={async () => {
            if (await confirm({ title: 'Delete this task?', confirm: 'Delete', danger: true })) { remove('tasks', t.id); onClose(); }
          }}>Delete</Button>
        )}
        <div className="spacer" />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={!t.title.trim()}>Save</Button>
      </div>
    </div>
  );
}

export function blankTask(p: Partial<Task> = {}): Task {
  return { id: uid('task'), title: '', priority: 0, status: 'todo', subtasks: [], tags: [], createdAt: Date.now(), order: Date.now(), ...p };
}

export function PriorityDot({ p }: { p: Priority }) {
  return <span className="subj-dot" style={{ '--c': PRIORITY_META[p].color } as CSSProperties} />;
}
