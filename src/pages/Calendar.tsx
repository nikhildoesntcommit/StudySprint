import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, CalendarPlus, Plus, Trash2, CalendarDays, LayoutGrid, List as ListIcon, Clock, MapPin } from 'lucide-react';
import type { ClassSlot } from '../types';
import { useStore } from '../store/store';
import { useUI } from '../store/ui';
import { subjectHex } from '../store/defaults';
import { DAY_NAMES, DAY_SHORT, MONTHS, addDaysYmd, formatDate, formatTime, hhmm, minutesOf, monthGrid, parseYmd, relativeDay, today, daysBetween } from '../lib/dates';
import { useRoute } from '../lib/router';
import { uid } from '../lib/id';
import { Button, Empty, Field, IconButton, Modal, Seg, Switch, useConfirm } from '../components/ui';
import { SubjectSelect } from '../components/pickers';
import { TaskRow, blankTask } from '../components/tasks';
import { EVENT_KINDS } from '../components/events';

type View = 'month' | 'agenda' | 'timetable';

export default function Calendar() {
  const { query } = useRoute();
  const qView = query.get('view') as View | null;
  const [view, setView] = useState<View>(qView || 'month');
  useEffect(() => { if (qView) setView(qView); }, [qView]);
  return (
    <div className="page wide">
      <div className="page-head">
        <div><h1>Calendar</h1><p>Exams, deadlines, and your weekly timetable in one place.</p></div>
        <div className="page-actions">
          <Seg value={view} onChange={setView} options={[{ value: 'month', label: <><CalendarDays />Month</> }, { value: 'agenda', label: <><ListIcon />Agenda</> }, { value: 'timetable', label: <><LayoutGrid />Timetable</> }]} />
          <Button variant="primary" icon={<CalendarPlus />} onClick={() => useUI.getState().editEvent({ id: uid('evt'), title: '', kind: 'exam', date: today(), createdAt: Date.now() })}>Add event</Button>
        </div>
      </div>
      {view === 'month' ? <MonthView /> : view === 'agenda' ? <AgendaView /> : <Timetable />}
    </div>
  );
}

function MonthView() {
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const subjects = useStore((s) => s.subjects);
  const classes = useStore((s) => s.classes);
  const weekStart = useStore((s) => s.settings.weekStart);
  const clock24 = useStore((s) => s.settings.clock24);
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(today());
  const grid = useMemo(() => monthGrid(ym.y, ym.m, weekStart), [ym, weekStart]);
  const color = (id?: string) => subjectHex(subjects.find((s) => s.id === id)?.color);
  const shift = (d: number) => setYm(({ y, m }) => { const x = new Date(y, m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const dayEvents = events.filter((e) => e.date === selected).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const dayTasks = tasks.filter((t) => t.due === selected);
  const dayClasses = classes.filter((c) => c.day === parseYmd(selected).getDay()).sort((a, b) => a.start.localeCompare(b.start));
  const headers = Array.from({ length: 7 }, (_, i) => DAY_SHORT[(i + weekStart) % 7]);

  return (
    <div className="cal-layout">
      <div className="panel cal-month">
        <div className="cal-toolbar">
          <h2 className="display" style={{ fontSize: '1.45rem' }}>{MONTHS[ym.m]} <span className="faint">{ym.y}</span></h2>
          <div className="spacer" />
          <Button size="sm" onClick={() => { setYm({ y: now.getFullYear(), m: now.getMonth() }); setSelected(today()); }}>Today</Button>
          <IconButton label="Previous month" onClick={() => shift(-1)}><ChevronLeft /></IconButton>
          <IconButton label="Next month" onClick={() => shift(1)}><ChevronRight /></IconButton>
        </div>
        <div className="cal-grid">
          {headers.map((h) => <div key={h} className="cal-head">{h}</div>)}
          {grid.map((d) => {
            const inMonth = parseYmd(d).getMonth() === ym.m;
            const evs = events.filter((e) => e.date === d);
            const ts = tasks.filter((t) => t.due === d && t.status !== 'done');
            return (
              <button type="button" key={d} className="cal-cell" data-out={!inMonth} data-today={d === today()} data-selected={d === selected} onClick={() => setSelected(d)}
                onDoubleClick={() => useUI.getState().editEvent({ id: uid('evt'), title: '', kind: 'exam', date: d, createdAt: Date.now() })}>
                <span className="cal-date">{parseYmd(d).getDate()}</span>
                <div className="cal-items">
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className={`cal-ev ${e.kind}`} style={{ '--c': color(e.subjectId) } as CSSProperties}>{e.title}</span>
                  ))}
                  {ts.length > 0 && <span className="cal-tasks">{ts.slice(0, 5).map((t) => <i key={t.id} style={{ '--c': color(t.subjectId) } as CSSProperties} />)}{ts.length > 5 && <small>+{ts.length - 5}</small>}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <aside className="panel cal-side">
        <div className="panel-head"><h3>{relativeDay(selected)}<span className="faint small" style={{ fontWeight: 500 }}>{formatDate(selected, { weekday: true })}</span></h3></div>
        <div className="panel-body stack">
          <div className="row-wrap">
            <Button size="sm" icon={<CalendarPlus />} onClick={() => useUI.getState().editEvent({ id: uid('evt'), title: '', kind: 'exam', date: selected, createdAt: Date.now() })}>Event</Button>
            <Button size="sm" icon={<Plus />} onClick={() => useUI.getState().editTask(blankTask({ due: selected }))}>Task</Button>
          </div>
          {dayEvents.map((e) => {
            const I = EVENT_KINDS[e.kind].icon;
            const left = daysBetween(today(), e.date);
            return (
              <button type="button" key={e.id} className="event-card" style={{ '--c': color(e.subjectId) } as CSSProperties} onClick={() => useUI.getState().editEvent(e)}>
                <I />
                <div className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontWeight: 620 }}>{e.title}</div>
                  <div className="small muted">{EVENT_KINDS[e.kind].label}{e.time ? ` · ${formatTime(e.time, clock24)}` : ''}{e.location ? ` · ${e.location}` : ''}</div>
                </div>
                {left > 0 && <span className="chip sm">{left}d</span>}
              </button>
            );
          })}
          {dayTasks.length > 0 && <div className="task-list panel flat">{dayTasks.map((t) => <TaskRow key={t.id} task={t} onOpen={useUI.getState().editTask} compact showSubject={false} />)}</div>}
          {dayClasses.length > 0 && (
            <div className="stack-sm">
              <div className="eyebrow">Classes</div>
              {dayClasses.map((c) => {
                const s = subjects.find((x) => x.id === c.subjectId);
                return <div key={c.id} className="row small"><span className="subj-dot" style={{ '--c': subjectHex(s?.color) } as CSSProperties} /><span className="tnum faint">{formatTime(c.start, clock24)}</span><span className="truncate">{c.title || s?.name}</span></div>;
              })}
            </div>
          )}
          {!dayEvents.length && !dayTasks.length && !dayClasses.length && <p className="small muted">Nothing scheduled. Double-click a day to add an event.</p>}
        </div>
      </aside>
    </div>
  );
}

function AgendaView() {
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const subjects = useStore((s) => s.subjects);
  const clock24 = useStore((s) => s.settings.clock24);
  const t = today();
  const days = Array.from({ length: 45 }, (_, i) => addDaysYmd(t, i));
  const rows = days.map((d) => ({ d, evs: events.filter((e) => e.date === d), ts: tasks.filter((x) => x.due === d && x.status !== 'done') })).filter((r) => r.evs.length || r.ts.length);
  if (!rows.length) return <div className="panel"><Empty icon={<CalendarDays />} title="Nothing in the next 6 weeks">Add exams, deadlines and tasks with due dates to fill your agenda.</Empty></div>;
  return (
    <div className="stack">
      {rows.map(({ d, evs, ts }) => (
        <section key={d} className="agenda-day">
          <div className="agenda-date"><div className="display tnum">{parseYmd(d).getDate()}</div><div className="tiny muted">{DAY_SHORT[parseYmd(d).getDay()]}</div></div>
          <div className="panel grow">
            <div className="panel-head"><h3>{relativeDay(d)}<span className="faint small" style={{ fontWeight: 500 }}>{formatDate(d)}</span></h3></div>
            <div className="panel-body stack-sm">
              {evs.map((e) => {
                const I = EVENT_KINDS[e.kind].icon;
                return <button type="button" key={e.id} className="event-card" style={{ '--c': subjectHex(subjects.find((s) => s.id === e.subjectId)?.color) } as CSSProperties} onClick={() => useUI.getState().editEvent(e)}><I /><div className="grow" style={{ textAlign: 'left' }}><b>{e.title}</b><div className="small muted">{EVENT_KINDS[e.kind].label}{e.time ? ` · ${formatTime(e.time, clock24)}` : ''}</div></div></button>;
              })}
              {ts.map((x) => <TaskRow key={x.id} task={x} onOpen={useUI.getState().editTask} compact />)}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function Timetable() {
  const classes = useStore((s) => s.classes);
  const subjects = useStore((s) => s.subjects);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [weekends, setWeekends] = useState(classes.some((c) => c.day === 0 || c.day === 6));
  const [editing, setEditing] = useState<ClassSlot | null>(null);
  const [h0, h1] = settings.timetableHours;
  const order = settings.weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const days = order.filter((d) => weekends || (d !== 0 && d !== 6));
  const HOUR = 56;
  const nowD = new Date();
  const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
  const color = (id?: string) => subjectHex(subjects.find((s) => s.id === id)?.color);
  const weeklyMin = classes.reduce((a, c) => a + (minutesOf(c.end) - minutesOf(c.start)), 0);

  return (
    <div className="stack">
      <div className="row-wrap">
        <Button variant="primary" icon={<Plus />} onClick={() => setEditing({ id: uid('cls'), day: 1, start: '09:00', end: '10:00', subjectId: subjects[0]?.id })}>Add class</Button>
        <label className="row small"><Switch checked={weekends} onChange={setWeekends} label="Show weekends" /> Weekends</label>
        <label className="row small">Hours
          <select className="select sm" style={{ width: 90 }} value={h0} onChange={(e) => update({ timetableHours: [Number(e.target.value), h1] })}>{Array.from({ length: 12 }, (_, i) => i + 5).map((h) => <option key={h} value={h}>{formatTime(hhmm(h * 60), settings.clock24)}</option>)}</select>
          –
          <select className="select sm" style={{ width: 90 }} value={h1} onChange={(e) => update({ timetableHours: [h0, Number(e.target.value)] })}>{Array.from({ length: 12 }, (_, i) => i + 12).map((h) => <option key={h} value={h}>{formatTime(hhmm(h * 60), settings.clock24)}</option>)}</select>
        </label>
        <div className="spacer" />
        {classes.length > 0 && <span className="small muted">{classes.length} classes · {Math.round(weeklyMin / 60)}h a week</span>}
      </div>
      <div className="panel timetable-wrap">
        <div className="timetable" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(110px, 1fr))` }}>
          <div />
          {days.map((d) => <div key={d} className="tt-head" data-today={d === nowD.getDay()}>{DAY_NAMES[d].slice(0, 3)}</div>)}
          <div className="tt-hours" style={{ height: (h1 - h0) * HOUR }}>
            {Array.from({ length: h1 - h0 }, (_, i) => <div key={i} style={{ height: HOUR }}>{formatTime(hhmm((h0 + i) * 60), settings.clock24)}</div>)}
          </div>
          {days.map((d) => (
            <div key={d} className="tt-col" style={{ height: (h1 - h0) * HOUR }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const y = e.nativeEvent.offsetY;
                const start = Math.floor((h0 * 60 + (y / HOUR) * 60) / 30) * 30;
                setEditing({ id: uid('cls'), day: d, start: hhmm(start), end: hhmm(start + 60), subjectId: subjects[0]?.id });
              }}>
              {Array.from({ length: h1 - h0 }, (_, i) => <div key={i} className="tt-line" style={{ top: i * HOUR }} />)}
              {d === nowD.getDay() && nowMin >= h0 * 60 && nowMin <= h1 * 60 && <div className="tt-now" style={{ top: ((nowMin - h0 * 60) / 60) * HOUR }} />}
              {classes.filter((c) => c.day === d).map((c) => {
                const top = ((minutesOf(c.start) - h0 * 60) / 60) * HOUR;
                const height = Math.max(22, ((minutesOf(c.end) - minutesOf(c.start)) / 60) * HOUR - 3);
                const s = subjects.find((x) => x.id === c.subjectId);
                return (
                  <button type="button" key={c.id} className="tt-class" style={{ top, height, '--c': color(c.subjectId) } as CSSProperties} onClick={() => setEditing(c)}>
                    <b className="truncate">{s?.emoji} {c.title || s?.name || 'Class'}</b>
                    {height > 40 && <span className="truncate"><Clock />{formatTime(c.start, settings.clock24)}–{formatTime(c.end, settings.clock24)}</span>}
                    {height > 58 && c.room && <span className="truncate"><MapPin />{c.room}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {classes.length === 0 && <p className="small muted center">Click anywhere on the grid to add a class at that time.</p>}
      <ClassEditor slot={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ClassEditor({ slot, onClose }: { slot: ClassSlot | null; onClose: () => void }) {
  const exists = useStore((s) => (slot ? s.classes.some((c) => c.id === slot.id) : false));
  return (
    <Modal open={!!slot} onClose={onClose} title={exists ? 'Edit class' : 'Add class'}>
      {slot && <ClassForm key={slot.id} initial={slot} exists={exists} onClose={onClose} />}
    </Modal>
  );
}

function ClassForm({ initial, exists, onClose }: { initial: ClassSlot; exists: boolean; onClose: () => void }) {
  const [c, setC] = useState(initial);
  const [repeatDays, setRepeatDays] = useState<number[]>([initial.day]);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const confirm = useConfirm();
  const up = (p: Partial<ClassSlot>) => setC((x) => ({ ...x, ...p }));
  const valid = minutesOf(c.end) > minutesOf(c.start);
  const save = () => {
    if (exists) upsert('classes', c);
    else repeatDays.forEach((day, i) => upsert('classes', { ...c, id: i === 0 ? c.id : uid('cls'), day }));
    onClose();
  };
  return (
    <div className="stack">
      <div className="grid-2">
        <Field label="Subject"><SubjectSelect value={c.subjectId} onChange={(subjectId) => up({ subjectId })} /></Field>
        <Field label="Label (optional)"><input className="input" value={c.title ?? ''} onChange={(e) => up({ title: e.target.value || undefined })} placeholder="e.g. Lab, Tutorial" /></Field>
      </div>
      <Field label={exists ? 'Day' : 'Days'}>
        <div className="row-wrap">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = exists ? c.day === d : repeatDays.includes(d);
            return <button key={d} type="button" className="chip" aria-pressed={on} onClick={() => exists ? up({ day: d }) : setRepeatDays((xs) => (xs.includes(d) ? (xs.length > 1 ? xs.filter((x) => x !== d) : xs) : [...xs, d]))}>{DAY_SHORT[d]}</button>;
          })}
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Starts"><input type="time" className="input" value={c.start} onChange={(e) => up({ start: e.target.value })} /></Field>
        <Field label="Ends"><input type="time" className="input" value={c.end} onChange={(e) => up({ end: e.target.value })} /></Field>
        <Field label="Room"><input className="input" value={c.room ?? ''} onChange={(e) => up({ room: e.target.value || undefined })} /></Field>
        <Field label="Teacher"><input className="input" value={c.teacher ?? ''} onChange={(e) => up({ teacher: e.target.value || undefined })} /></Field>
      </div>
      {!valid && <p className="small danger-text">End time must be after the start.</p>}
      <div className="row">
        {exists && <Button variant="ghost" className="danger" icon={<Trash2 />} onClick={async () => { if (await confirm({ title: 'Remove this class?', danger: true, confirm: 'Remove' })) { remove('classes', c.id); onClose(); } }}>Delete</Button>}
        <div className="spacer" />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!valid} onClick={save}>Save</Button>
      </div>
    </div>
  );
}

