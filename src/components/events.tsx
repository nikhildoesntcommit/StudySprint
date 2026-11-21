import { useState } from 'react';
import { Trash2, GraduationCap, FileText, CalendarDays, Bell, Wand2 } from 'lucide-react';
import type { CalEvent, EventKind } from '../types';
import { useStore } from '../store/store';
import { useUI } from '../store/ui';
import { Button, Field, Modal, Seg, toast, useConfirm } from './ui';
import { SubjectSelect } from './pickers';
import { daysBetween, formatDate, today } from '../lib/dates';
import { planRevision } from '../lib/plan';
import { uid } from '../lib/id';

export const EVENT_KINDS: Record<EventKind, { label: string; icon: typeof GraduationCap }> = {
  exam: { label: 'Exam', icon: GraduationCap },
  assignment: { label: 'Deadline', icon: FileText },
  event: { label: 'Event', icon: CalendarDays },
  reminder: { label: 'Reminder', icon: Bell },
};

export function EventEditor() {
  const ev = useUI((s) => s.editingEvent);
  const close = () => useUI.getState().editEvent(null);
  const exists = useStore((s) => (ev ? s.events.some((e) => e.id === ev.id) : false));
  return (
    <Modal open={!!ev} onClose={close} title={exists ? 'Edit event' : 'Add to calendar'} size="lg">
      {ev && <EventForm key={ev.id} initial={ev} exists={exists} onClose={close} />}
    </Modal>
  );
}

function EventForm({ initial, exists, onClose }: { initial: CalEvent; exists: boolean; onClose: () => void }) {
  const [e, setE] = useState(initial);
  const [plan, setPlan] = useState(false);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const confirm = useConfirm();
  const up = (p: Partial<CalEvent>) => setE((x) => ({ ...x, ...p }));
  const save = () => {
    if (!e.title.trim()) return;
    upsert('events', { ...e, title: e.title.trim() });
    onClose();
  };
  return (
    <div className="stack">
      <Seg value={e.kind} onChange={(kind) => up({ kind })} options={(Object.keys(EVENT_KINDS) as EventKind[]).map((k) => {
        const I = EVENT_KINDS[k].icon;
        return { value: k, label: <><I />{EVENT_KINDS[k].label}</> };
      })} />
      <input className="input title-input" autoFocus value={e.title} onChange={(x) => up({ title: x.target.value })} placeholder={e.kind === 'exam' ? 'e.g. Chemistry unit test' : e.kind === 'assignment' ? 'e.g. History essay due' : 'Title'} />
      <div className="grid-3">
        <Field label="Subject"><SubjectSelect value={e.subjectId} onChange={(subjectId) => up({ subjectId })} /></Field>
        <Field label="Date"><input type="date" className="input" value={e.date} onChange={(x) => up({ date: x.target.value || today() })} /></Field>
        <Field label="Time"><input type="time" className="input" value={e.time ?? ''} onChange={(x) => up({ time: x.target.value || undefined })} /></Field>
        <Field label="Location" style={{ gridColumn: 'span 2' }}><input className="input" value={e.location ?? ''} onChange={(x) => up({ location: x.target.value || undefined })} placeholder="Room, hall, link…" /></Field>
        <Field label="Ends"><input type="time" className="input" value={e.endTime ?? ''} onChange={(x) => up({ endTime: x.target.value || undefined })} /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" value={e.notes ?? ''} onChange={(x) => up({ notes: x.target.value || undefined })} placeholder="Topics covered, what to bring…" /></Field>
      {(e.kind === 'exam' || e.kind === 'assignment') && e.date > today() && (
        <div className="panel accent panel-pad stack-sm">
          <div className="row"><Wand2 style={{ width: 18, color: 'var(--accent)' }} /><b className="grow">Build a revision plan</b>
            <Button size="sm" variant={plan ? 'default' : 'primary'} onClick={() => setPlan((v) => !v)}>{plan ? 'Hide' : 'Plan it for me'}</Button></div>
          <p className="small muted">StudySprint spaces revision sessions across the {daysBetween(today(), e.date)} days before {formatDate(e.date)} — the spacing effect means you remember more for the same effort.</p>
          {plan && <RevisionPlanner event={e} onDone={() => { upsert('events', { ...e, title: e.title.trim() || 'Exam' }); onClose(); }} />}
        </div>
      )}
      <div className="row">
        {exists && <Button variant="ghost" className="danger" icon={<Trash2 />} onClick={async () => { if (await confirm({ title: 'Delete this event?', danger: true, confirm: 'Delete' })) { remove('events', e.id); onClose(); } }}>Delete</Button>}
        <div className="spacer" />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={!e.title.trim()}>Save</Button>
      </div>
    </div>
  );
}

function RevisionPlanner({ event, onDone }: { event: CalEvent; onDone: () => void }) {
  const [topicsText, setTopicsText] = useState('');
  const [rounds, setRounds] = useState(3);
  const [perDay, setPerDay] = useState(2);
  const [minutes, setMinutes] = useState(40);
  const [skipWeekends, setSkipWeekends] = useState(false);
  const addTask = useStore((s) => s.addTask);
  const topics = topicsText.split('\n').map((t) => t.trim()).filter(Boolean);
  const plan = topics.length ? planRevision(topics, today(), event.date, rounds, perDay, skipWeekends) : [];
  const roundName = (r: number) => (r === 1 ? 'Learn' : r === rounds ? 'Final review' : 'Recall');
  const create = () => {
    const groupTag = `plan-${uid().slice(0, 4)}`;
    plan.forEach((p, i) => addTask({
      title: `${roundName(p.round)}: ${p.topic}`, subjectId: event.subjectId, due: p.date, estimateMin: minutes,
      priority: p.round === rounds ? 3 : 2, tags: ['revision', groupTag], order: Date.now() + i,
      notes: `Revision for ${event.title} on ${formatDate(event.date)}.${p.round > 1 ? ' Start by recalling from memory before checking notes.' : ''}`,
    }));
    toast(`${plan.length} revision sessions added to your planner`, { tone: 'success' });
    onDone();
  };
  return (
    <div className="stack-sm" style={{ marginTop: 6 }}>
      <Field label="Topics (one per line)">
        <textarea className="textarea" value={topicsText} onChange={(x) => setTopicsText(x.target.value)} placeholder={'Atomic structure\nBonding\nRates of reaction'} />
      </Field>
      <div className="grid-3">
        <Field label="Sessions per topic"><input type="number" className="input" min={1} max={6} value={rounds} onChange={(x) => setRounds(Math.max(1, Math.min(6, Number(x.target.value) || 1)))} /></Field>
        <Field label="Max sessions a day"><input type="number" className="input" min={1} max={8} value={perDay} onChange={(x) => setPerDay(Math.max(1, Math.min(8, Number(x.target.value) || 1)))} /></Field>
        <Field label="Minutes each"><input type="number" className="input" min={10} step={5} value={minutes} onChange={(x) => setMinutes(Number(x.target.value) || 30)} /></Field>
      </div>
      <label className="row small"><input type="checkbox" checked={skipWeekends} onChange={(x) => setSkipWeekends(x.target.checked)} /> Keep weekends free</label>
      {plan.length > 0 && (
        <div className="plan-preview">
          {plan.slice(0, 40).map((p, i) => (
            <div key={i} className="plan-row"><span className="tnum faint">{formatDate(p.date, { weekday: true })}</span><span className="grow truncate">{roundName(p.round)}: {p.topic}</span></div>
          ))}
          {plan.length > 40 && <div className="faint small">+{plan.length - 40} more</div>}
        </div>
      )}
      <Button variant="primary" disabled={!plan.length} onClick={create}>Add {plan.length || ''} sessions to planner</Button>
    </div>
  );
}
