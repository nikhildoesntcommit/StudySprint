import { useMemo, useState, type CSSProperties } from 'react';
import {
  Play, Layers, Flame, CalendarClock, ListTodo, SlidersHorizontal, ChevronUp, ChevronDown, ArrowRight, Lightbulb,
  GraduationCap, NotebookPen, MapPin, BarChart3, CalendarPlus, CheckCircle2, Timer, Sparkles,
} from 'lucide-react';
import type { WidgetId } from '../types';
import { useStore } from '../store/store';
import { useUI } from '../store/ui';
import { useTimer } from '../store/timer';
import { STUDY_TIPS, WIDGETS, subjectHex } from '../store/defaults';
import { addDays, daysBetween, DAY_SHORT, formatDate, formatDuration, formatTime, greeting, minutesOf, parseYmd, startOfWeek, today, ymd, DAY_NAMES, MONTHS, timeAgo } from '../lib/dates';
import { activeDays, deckCounts, minutesByDay, minutesOn, retentionRate, sortTasks, streaks, taskBuckets } from '../lib/stats';
import { courseStats } from './Grades';
import { plainText } from '../lib/markdown';
import { href, navigate } from '../lib/router';
import { Button, Empty, Modal, Ring, Switch, IconButton, useNow, toast } from '../components/ui';
import { QuickAdd, TaskRow } from '../components/tasks';
import { EVENT_KINDS } from '../components/events';
import { plural } from '../lib/id';

export default function Today() {
  const s = useStore();
  const [customise, setCustomise] = useState(false);
  useNow(60_000);
  const t = today();
  const now = new Date();
  const buckets = taskBuckets(s.tasks, t);
  const counts = deckCounts(s.cards, s.reviews, s.settings.srs.newPerDay);
  const nextExam = s.events.filter((e) => e.date >= t && (e.kind === 'exam' || e.kind === 'assignment')).sort((a, b) => a.date.localeCompare(b.date))[0];
  const modules = s.settings.modules;

  const summary: string[] = [];
  const dueCount = buckets.today.length + buckets.overdue.length;
  if (modules.planner) summary.push(dueCount ? `${plural(dueCount, 'task')} for today` : 'no tasks due today');
  if (modules.cards && counts.due + counts.learning) summary.push(`${plural(counts.due + counts.learning, 'card')} to review`);
  if (nextExam) summary.push(`${nextExam.title} ${daysBetween(t, nextExam.date) === 0 ? 'is today' : `in ${plural(daysBetween(t, nextExam.date), 'day')}`}`);

  const widgets = s.settings.widgets.filter((w) => w.on && widgetAvailable(w.id, modules));

  return (
    <div className="page wide">
      <div className="page-head">
        <div>
          <div className="eyebrow">{DAY_NAMES[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}</div>
          <h1 style={{ marginTop: 6 }}>{greeting(now)}{s.settings.name ? `, ${s.settings.name.split(' ')[0]}` : ''}.</h1>
          {summary.length > 0 && <p>You have {summary.join(', ').replace(/, ([^,]*)$/, ' and $1')}.</p>}
        </div>
        <div className="page-actions">
          <Button variant="ghost" icon={<SlidersHorizontal />} onClick={() => setCustomise(true)}>Customise</Button>
          {modules.focus && <Button variant="primary" icon={<Play />} onClick={() => { const tm = useTimer.getState(); if (tm.mode !== 'focus' && tm.mode !== 'stopwatch') tm.setMode('focus'); if (!tm.running) tm.start(); navigate('/focus'); }}>Start focus</Button>}
        </div>
      </div>

      {modules.planner && <div style={{ marginBottom: 18 }}><QuickAdd /></div>}

      <div className="widget-grid">
        {widgets.map((w) => <Widget key={w.id} id={w.id} />)}
        {widgets.length === 0 && <div className="panel" style={{ gridColumn: '1 / -1' }}><Empty icon={<SlidersHorizontal />} title="Your dashboard is empty" action={<Button onClick={() => setCustomise(true)}>Choose widgets</Button>}>Pick the widgets you want to see every day.</Empty></div>}
      </div>
      <CustomiseDialog open={customise} onClose={() => setCustomise(false)} />
    </div>
  );
}

function widgetAvailable(id: WidgetId, m: Record<string, boolean>) {
  const need: Partial<Record<WidgetId, string>> = { agenda: 'planner', focus: 'focus', reviews: 'cards', countdown: 'calendar', nextClass: 'calendar', grades: 'grades', notes: 'notes' };
  return !need[id] || m[need[id]!];
}

function Widget({ id }: { id: WidgetId }) {
  switch (id) {
    case 'agenda': return <AgendaWidget />;
    case 'focus': return <FocusWidget />;
    case 'reviews': return <ReviewsWidget />;
    case 'countdown': return <CountdownWidget />;
    case 'streak': return <StreakWidget />;
    case 'nextClass': return <ClassesWidget />;
    case 'week': return <WeekWidget />;
    case 'grades': return <GradesWidget />;
    case 'notes': return <NotesWidget />;
    case 'quote': return <TipWidget />;
  }
}

function W({ title, icon, action, children, className = '', style }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section className={`panel widget ${className}`} style={style}>
      <div className="panel-head"><h3>{icon}{title}</h3>{action}</div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function AgendaWidget() {
  const tasks = useStore((s) => s.tasks);
  const events = useStore((s) => s.events);
  const patch = useStore((s) => s.patch);
  const [showDone, setShowDone] = useState(false);
  const t = today();
  const b = taskBuckets(tasks, t);
  const doneToday = tasks.filter((x) => x.status === 'done' && x.completedAt && ymd(new Date(x.completedAt)) === t);
  const tomorrow = tasks.filter((x) => x.status !== 'done' && x.due === ymd(addDays(new Date(), 1))).sort(sortTasks);
  const todaysEvents = events.filter((e) => e.date === t);
  const open = useUI.getState().editTask;
  const total = b.today.length + doneToday.length;
  return (
    <W title="Today’s agenda" icon={<ListTodo />} className="span-2 row-2"
      action={<a className="btn ghost sm" href={href('/planner')}>Planner <ArrowRight /></a>}>
      {total > 0 && (
        <div className="agenda-progress">
          <div className="bar"><i style={{ width: `${(doneToday.length / Math.max(1, total)) * 100}%` }} /></div>
          <span className="small muted tnum">{doneToday.length}/{total} done</span>
        </div>
      )}
      {todaysEvents.map((e) => {
        const I = EVENT_KINDS[e.kind].icon;
        return <div key={e.id} className="agenda-event" onClick={() => useUI.getState().editEvent(e)}><I /><b>{e.title}</b>{e.time && <span className="muted">{formatTime(e.time, useStore.getState().settings.clock24)}</span>}</div>;
      })}
      {b.overdue.length > 0 && (
        <div className="agenda-group">
          <div className="agenda-label danger-text">Overdue · {b.overdue.length}
            <button type="button" className="link-btn" onClick={() => { b.overdue.forEach((x) => patch('tasks', x.id, { due: t })); toast(`Moved ${plural(b.overdue.length, 'task')} to today`); }}>Move all to today</button>
          </div>
          {b.overdue.sort(sortTasks).map((x) => <TaskRow key={x.id} task={x} onOpen={open} compact />)}
        </div>
      )}
      <div className="agenda-group">
        {b.today.length > 0 && <div className="agenda-label">Due today · {b.today.length}</div>}
        {b.today.sort(sortTasks).map((x) => <TaskRow key={x.id} task={x} onOpen={open} compact />)}
        {b.today.length === 0 && b.overdue.length === 0 && (
          <div className="agenda-clear"><CheckCircle2 /><div><b>{doneToday.length ? 'All done for today!' : 'Nothing due today'}</b><div className="small muted">{tomorrow.length ? `${plural(tomorrow.length, 'task')} due tomorrow — get ahead?` : 'Add something above, or plan ahead in the planner.'}</div></div></div>
        )}
      </div>
      {b.today.length === 0 && tomorrow.length > 0 && (
        <div className="agenda-group">
          <div className="agenda-label">Tomorrow</div>
          {tomorrow.slice(0, 4).map((x) => <TaskRow key={x.id} task={x} onOpen={open} compact />)}
        </div>
      )}
      {doneToday.length > 0 && (
        <div className="agenda-group">
          <button type="button" className="agenda-label link-like" onClick={() => setShowDone((v) => !v)}>Completed today · {doneToday.length} {showDone ? <ChevronUp /> : <ChevronDown />}</button>
          {showDone && doneToday.map((x) => <TaskRow key={x.id} task={x} onOpen={open} compact />)}
        </div>
      )}
    </W>
  );
}

function FocusWidget() {
  const sessions = useStore((s) => s.sessions);
  const goal = useStore((s) => s.settings.focus.dailyGoalMin);
  const timer = useTimer();
  const mins = minutesOn(sessions, today());
  const pct = mins / Math.max(1, goal);
  const todays = sessions.filter((x) => ymd(new Date(x.start)) === today());
  return (
    <W title="Focus goal" icon={<Timer />} action={<a className="btn ghost sm" href={href('/focus')}>Open <ArrowRight /></a>}>
      <div className="row" style={{ gap: 18 }}>
        <Ring value={pct} size={96} stroke={9}>
          <div style={{ textAlign: 'center', lineHeight: 1.1 }}><div className="display tnum" style={{ fontSize: '1.5rem' }}>{Math.round(pct * 100)}%</div></div>
        </Ring>
        <div className="stack-sm grow">
          <div><span className="display tnum" style={{ fontSize: '1.6rem' }}>{formatDuration(mins)}</span> <span className="muted small">of {formatDuration(goal)}</span></div>
          <div className="small muted">{todays.length ? `${plural(todays.length, 'session')} today` : 'No sessions yet today'}</div>
          <Button size="sm" variant={timer.running ? 'soft' : 'primary'} icon={<Play />} onClick={() => { if (timer.mode !== 'focus' && timer.mode !== 'stopwatch') timer.setMode('focus'); if (!timer.running) timer.start(); navigate('/focus'); }}>
            {timer.running ? 'Session running' : `Focus ${useStore.getState().settings.focus.work}m`}
          </Button>
        </div>
      </div>
    </W>
  );
}

function ReviewsWidget() {
  const cards = useStore((s) => s.cards);
  const reviews = useStore((s) => s.reviews);
  const decks = useStore((s) => s.decks);
  const newPerDay = useStore((s) => s.settings.srs.newPerDay);
  const c = deckCounts(cards, reviews, newPerDay);
  const ret = retentionRate(reviews);
  const doneToday = reviews.filter((r) => ymd(new Date(r.at)) === today()).length;
  const waiting = c.due + c.learning;
  if (!decks.length) {
    return <W title="Flashcards" icon={<Layers />}><Empty icon={<Layers />} title="No decks yet" action={<a className="btn sm primary" href={href('/cards')}>Create a deck</a>}>Spaced repetition makes facts stick with less effort.</Empty></W>;
  }
  return (
    <W title="Reviews" icon={<Layers />} action={<a className="btn ghost sm" href={href('/cards')}>Decks <ArrowRight /></a>}>
      <div className="stat-row">
        <div><div className="stat-num accent-text">{waiting}</div><div className="stat-label">due</div></div>
        <div><div className="stat-num">{c.fresh}</div><div className="stat-label">new</div></div>
        <div><div className="stat-num">{doneToday}</div><div className="stat-label">done today</div></div>
      </div>
      {ret !== null && <div className="small muted" style={{ marginTop: 6 }}>30-day recall rate <b className="tnum">{Math.round(ret * 100)}%</b></div>}
      <Button block variant={waiting + c.fresh ? 'primary' : 'default'} style={{ marginTop: 12 }} disabled={!(waiting + c.fresh)} onClick={() => navigate('/cards/review')}>
        {waiting + c.fresh ? `Review ${waiting + c.fresh} cards` : 'All caught up ✓'}
      </Button>
    </W>
  );
}

function CountdownWidget() {
  const events = useStore((s) => s.events);
  const subjects = useStore((s) => s.subjects);
  const t = today();
  const upcoming = events.filter((e) => e.date >= t && e.kind !== 'reminder').sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')).slice(0, 4);
  return (
    <W title="Countdowns" icon={<CalendarClock />} action={<IconButton size="sm" label="Add exam or deadline" onClick={() => useUI.getState().editEvent({ id: crypto.randomUUID(), title: '', kind: 'exam', date: ymd(addDays(new Date(), 7)), createdAt: Date.now() })}><CalendarPlus /></IconButton>}>
      {upcoming.length === 0 && <Empty icon={<CalendarClock />} title="No exams coming up">Add exams and deadlines to see countdowns and build revision plans.</Empty>}
      <div className="countdowns">
        {upcoming.map((e) => {
          const d = daysBetween(t, e.date);
          const subj = subjects.find((x) => x.id === e.subjectId);
          return (
            <button type="button" key={e.id} className="countdown" style={{ '--c': subjectHex(subj?.color) } as CSSProperties} onClick={() => useUI.getState().editEvent(e)}>
              <div className="countdown-days"><span className="display tnum">{d}</span><small>{d === 1 ? 'day' : 'days'}</small></div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 600 }}>{e.title}</div>
                <div className="small muted truncate">{EVENT_KINDS[e.kind].label} · {formatDate(e.date, { weekday: true })}{subj ? ` · ${subj.name}` : ''}</div>
              </div>
            </button>
          );
        })}
      </div>
    </W>
  );
}

function StreakWidget() {
  const sessions = useStore((s) => s.sessions);
  const reviews = useStore((s) => s.reviews);
  const tasks = useStore((s) => s.tasks);
  const attempts = useStore((s) => s.attempts);
  const days = useMemo(() => activeDays({ sessions, reviews, tasks, attempts }), [sessions, reviews, tasks, attempts]);
  const st = streaks(days);
  const last7 = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i - 6)));
  return (
    <W title="Streak" icon={<Flame />}>
      <div className="row" style={{ gap: 14 }}>
        <div className={`flame${st.todayDone ? ' lit' : ''}`}><Flame /></div>
        <div>
          <div><span className="display tnum" style={{ fontSize: '2rem' }}>{st.current}</span> <span className="muted">day{st.current === 1 ? '' : 's'}</span></div>
          <div className="small muted">{st.todayDone ? 'Today counts ✓' : st.current ? 'Study today to keep it going' : 'Start a streak today'} · best {st.best}</div>
        </div>
      </div>
      <div className="week-dots">
        {last7.map((d) => <div key={d} className="week-dot" data-on={days.has(d)} data-today={d === today()}><i /><span>{DAY_SHORT[parseYmd(d).getDay()][0]}</span></div>)}
      </div>
    </W>
  );
}

function ClassesWidget() {
  const classes = useStore((s) => s.classes);
  const subjects = useStore((s) => s.subjects);
  const clock24 = useStore((s) => s.settings.clock24);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todays = classes.filter((c) => c.day === now.getDay()).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <W title="Classes today" icon={<GraduationCap />} action={<a className="btn ghost sm" href={href('/calendar?view=timetable')}>Timetable <ArrowRight /></a>}>
      {classes.length === 0 ? <Empty icon={<GraduationCap />} title="No timetable yet" action={<a className="btn sm" href={href('/calendar?view=timetable')}>Add classes</a>}>Add your weekly classes to see what’s next.</Empty>
        : todays.length === 0 ? <p className="muted small">No classes today. Enjoy the free time — or use it well 😉</p>
          : (
            <div className="class-list">
              {todays.map((c) => {
                const subj = subjects.find((x) => x.id === c.subjectId);
                const state = nowMin >= minutesOf(c.end) ? 'past' : nowMin >= minutesOf(c.start) ? 'now' : 'next';
                return (
                  <div key={c.id} className="class-item" data-state={state} style={{ '--c': subjectHex(subj?.color) } as CSSProperties}>
                    <div className="tnum small class-time">{formatTime(c.start, clock24)}</div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontWeight: 600 }}>{subj?.emoji} {c.title || subj?.name || 'Class'}</div>
                      <div className="tiny muted truncate">{c.room && <><MapPin style={{ width: 11, display: 'inline', verticalAlign: -1 }} /> {c.room}</>}{c.teacher ? ` · ${c.teacher}` : ''}</div>
                    </div>
                    {state === 'now' && <span className="chip sm accent">Now</span>}
                  </div>
                );
              })}
            </div>
          )}
    </W>
  );
}

function WeekWidget() {
  const sessions = useStore((s) => s.sessions);
  const weekStart = useStore((s) => s.settings.weekStart);
  const subjects = useStore((s) => s.subjects);
  const map = minutesByDay(sessions);
  const start = startOfWeek(new Date(), weekStart);
  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(start, i)));
  const vals = days.map((d) => map.get(d) ?? 0);
  const max = Math.max(60, ...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  const weekSessions = sessions.filter((x) => ymd(new Date(x.start)) >= days[0]);
  const bySubj = subjects.map((s) => ({ s, m: weekSessions.filter((x) => x.subjectId === s.id).reduce((a, x) => a + x.minutes, 0) })).filter((x) => x.m > 0).sort((a, b) => b.m - a.m);
  return (
    <W title="This week" icon={<BarChart3 />} className="span-2" action={<a className="btn ghost sm" href={href('/insights')}>Insights <ArrowRight /></a>}>
      <div className="week-wrap">
        <div style={{ flex: '1 1 260px' }}>
          <div className="row" style={{ alignItems: 'baseline', marginBottom: 10 }}><span className="display tnum" style={{ fontSize: '1.7rem' }}>{formatDuration(total)}</span><span className="muted small">studied this week</span></div>
          <div className="bars">
            {days.map((d, i) => (
              <div className="b" key={d} data-today={d === today()} title={`${formatDuration(vals[i])}`}>
                <div className={vals[i] ? '' : 'dim'} style={{ height: `${(vals[i] / max) * 100}%` }} />
                <span>{DAY_SHORT[parseYmd(d).getDay()].slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="stack-sm" style={{ flex: '1 1 200px', minWidth: 0 }}>
          {bySubj.length === 0 && <p className="small muted">Link focus sessions to subjects to see where your time goes.</p>}
          {bySubj.slice(0, 5).map(({ s, m }) => (
            <div key={s.id} className="stack-sm" style={{ gap: 4 }}>
              <div className="row small"><span className="grow truncate">{s.emoji} {s.name}</span><span className="tnum muted">{formatDuration(m)}{s.weeklyGoalMin ? ` / ${formatDuration(s.weeklyGoalMin)}` : ''}</span></div>
              <div className="bar thin"><i style={{ width: `${Math.min(1, m / (s.weeklyGoalMin || Math.max(...bySubj.map((x) => x.m)))) * 100}%`, '--c': subjectHex(s.color) } as CSSProperties} /></div>
            </div>
          ))}
        </div>
      </div>
    </W>
  );
}

function GradesWidget() {
  const courses = useStore((s) => s.courses);
  const subjects = useStore((s) => s.subjects);
  return (
    <W title="Grades" icon={<GraduationCap />} action={<a className="btn ghost sm" href={href('/grades')}>All <ArrowRight /></a>}>
      {courses.length === 0 ? <Empty icon={<GraduationCap />} title="Track your marks" action={<a className="btn sm" href={href('/grades')}>Add a course</a>}>See your average and what you need on the final.</Empty> : (
        <div className="stack-sm">
          {courses.slice(0, 4).map((c) => {
            const st = courseStats(c);
            const subj = subjects.find((x) => x.id === c.subjectId);
            return (
              <div key={c.id} className="stack-sm" style={{ gap: 4 }}>
                <div className="row small"><span className="grow truncate">{subj?.emoji} {c.name}</span><b className="tnum">{st.current === null ? '—' : `${st.current.toFixed(0)}%`}</b></div>
                <div className="bar thin"><i style={{ width: `${st.current ?? 0}%`, '--c': st.current !== null && st.current >= c.target ? 'var(--success)' : subjectHex(subj?.color) } as CSSProperties} /></div>
              </div>
            );
          })}
        </div>
      )}
    </W>
  );
}

function NotesWidget() {
  const notes = useStore((s) => s.notes);
  const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  return (
    <W title="Recent notes" icon={<NotebookPen />} action={<a className="btn ghost sm" href={href('/notes')}>All <ArrowRight /></a>}>
      {recent.length === 0 ? <p className="small muted">No notes yet.</p> : (
        <div className="stack-sm">
          {recent.map((n) => (
            <a key={n.id} href={href(`/notes/${n.id}`)} className="note-mini">
              <div className="truncate" style={{ fontWeight: 600 }}>{n.title || 'Untitled'}</div>
              <div className="tiny muted truncate">{timeAgo(n.updatedAt)} · {plainText(n.body, 80)}</div>
            </a>
          ))}
        </div>
      )}
    </W>
  );
}

function TipWidget() {
  const idx = Math.floor(Date.now() / 86_400_000) % STUDY_TIPS.length;
  const [i, setI] = useState(idx);
  const tip = STUDY_TIPS[i % STUDY_TIPS.length];
  return (
    <W title="Study tip" icon={<Lightbulb />} className="tip-widget" action={<button type="button" className="btn ghost sm" onClick={() => setI((x) => x + 1)}>Next</button>}>
      <h3 style={{ fontSize: '1.08rem', marginBottom: 6 }}>{tip.title}</h3>
      <p className="small muted">{tip.body}</p>
    </W>
  );
}

function CustomiseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const widgets = useStore((s) => s.settings.widgets);
  const modules = useStore((s) => s.settings.modules);
  const update = useStore((s) => s.updateSettings);
  const move = (i: number, d: number) => {
    const next = [...widgets];
    const [w] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + d)), 0, w);
    update({ widgets: next });
  };
  return (
    <Modal open={open} onClose={onClose} title="Customise your dashboard" icon={<Sparkles style={{ color: 'var(--accent)' }} />} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <p className="small muted" style={{ marginBottom: 12 }}>Turn widgets on or off and change their order. Widgets for modules you’ve hidden in Settings won’t appear.</p>
      <div className="stack-sm">
        {widgets.map((w, i) => {
          const meta = WIDGETS.find((x) => x.id === w.id)!;
          const avail = widgetAvailable(w.id, modules);
          return (
            <div key={w.id} className="widget-pref" data-off={!w.on || !avail}>
              <div className="grow"><div style={{ fontWeight: 600 }}>{meta.label}</div><div className="tiny muted">{avail ? meta.blurb : 'Module hidden in Settings'}</div></div>
              <IconButton size="sm" label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp /></IconButton>
              <IconButton size="sm" label="Move down" disabled={i === widgets.length - 1} onClick={() => move(i, 1)}><ChevronDown /></IconButton>
              <Switch checked={w.on} label={meta.label} onChange={(on) => update({ widgets: widgets.map((x) => (x.id === w.id ? { ...x, on } : x)) })} />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

