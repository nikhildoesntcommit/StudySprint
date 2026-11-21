import { useMemo, useState, type CSSProperties } from 'react';
import { List, Columns3, Grid2x2, Search, Plus, ListTodo, Eye, EyeOff, Clock } from 'lucide-react';
import type { Task, TaskStatus } from '../types';
import { useStore } from '../store/store';
import { useUI } from '../store/ui';
import { addDaysYmd, formatDuration, today } from '../lib/dates';
import { sortTasks } from '../lib/stats';
import { getPref, setPref } from '../lib/prefs';
import { subjectHex } from '../store/defaults';
import { Button, Empty, Seg } from '../components/ui';
import { QuickAdd, TaskRow, blankTask } from '../components/tasks';

type View = 'list' | 'board' | 'matrix';

export default function Planner() {
  const tasks = useStore((s) => s.tasks);
  const allSubjects = useStore((s) => s.subjects);
  const subjects = useMemo(() => allSubjects.filter((x) => !x.archived), [allSubjects]);
  const weekStart = useStore((s) => s.settings.weekStart);
  const [view, setView] = useState<View>(() => getPref<View>('plannerView', 'list'));
  const [subject, setSubject] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);
  const setV = (v: View) => { setView(v); setPref('plannerView', v); };
  const open = useUI.getState().editTask;

  const filtered = useMemo(() => tasks.filter((t) =>
    (!subject || t.subjectId === subject) &&
    (!q || t.title.toLowerCase().includes(q.toLowerCase()) || t.tags.some((g) => g.includes(q.toLowerCase())))), [tasks, subject, q]);

  const t = today();
  const openTasks = filtered.filter((x) => x.status !== 'done');
  const totalMin = openTasks.filter((x) => x.due && x.due <= addDaysYmd(t, 6)).reduce((a, x) => a + (x.estimateMin ?? 0), 0);

  return (
    <div className="page wide">
      <div className="page-head">
        <div><h1>Planner</h1><p>{openTasks.length} open task{openTasks.length === 1 ? '' : 's'}{totalMin ? ` · about ${formatDuration(totalMin)} of work this week` : ''}</p></div>
        <div className="page-actions">
          <Seg value={view} onChange={setV} label="View" options={[
            { value: 'list', label: <><List />List</> }, { value: 'board', label: <><Columns3 />Board</> }, { value: 'matrix', label: <><Grid2x2 />Matrix</>, title: 'Urgent × important' },
          ]} />
          <Button variant="primary" icon={<Plus />} onClick={() => open(blankTask({ subjectId: subject ?? undefined }))}>New task</Button>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}><QuickAdd defaults={{ subjectId: subject ?? undefined }} /></div>

      <div className="filter-bar">
        <div className="search-box"><Search /><input className="input sm" placeholder="Filter tasks…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="row-wrap" style={{ flex: 1 }}>
          <button type="button" className="chip" aria-pressed={!subject} onClick={() => setSubject(null)}>All</button>
          {subjects.map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={subject === s.id} onClick={() => setSubject(subject === s.id ? null : s.id)}>
              <span className="subj-dot" style={{ '--c': subjectHex(s.color) } as CSSProperties} />{s.name}
            </button>
          ))}
        </div>
        {view === 'list' && <Button size="sm" variant="ghost" icon={showDone ? <EyeOff /> : <Eye />} onClick={() => setShowDone((v) => !v)}>{showDone ? 'Hide' : 'Show'} completed</Button>}
      </div>

      {filtered.length === 0 && !q ? (
        <div className="panel"><Empty icon={<ListTodo />} title="A clear plan starts here" action={<Button variant="primary" icon={<Plus />} onClick={() => open(blankTask())}>Add a task</Button>}>
          Type naturally in the box above: dates (“tomorrow”, “fri”, “dec 5”), times (“5pm”), subjects (“#maths”), priority (“!high”), time estimates (“~45m”) and repeats (“every week”).
        </Empty></div>
      ) : view === 'list' ? <ListView tasks={filtered} showDone={showDone} weekStart={weekStart} />
        : view === 'board' ? <BoardView tasks={filtered} /> : <MatrixView tasks={filtered} />}
    </div>
  );
}

function Group({ title, tasks, tone, collapsed: initial = false }: { title: string; tasks: Task[]; tone?: 'danger' | 'accent'; collapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initial);
  const open = useUI.getState().editTask;
  if (!tasks.length) return null;
  const mins = tasks.reduce((a, x) => a + (x.status !== 'done' ? x.estimateMin ?? 0 : 0), 0);
  return (
    <section className="task-group">
      <button type="button" className={`task-group-head${tone ? ` ${tone}-text` : ''}`} onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed}>
        <span>{title}</span><span className="count">{tasks.length}</span>
        {mins > 0 && <span className="faint small row" style={{ gap: 4 }}><Clock style={{ width: 13 }} />{formatDuration(mins)}</span>}
      </button>
      {!collapsed && <div className="panel task-list">{tasks.map((t) => <TaskRow key={t.id} task={t} onOpen={open} />)}</div>}
    </section>
  );
}

function ListView({ tasks, showDone }: { tasks: Task[]; showDone: boolean; weekStart: 0 | 1 }) {
  const t = today();
  const tom = addDaysYmd(t, 1);
  const week = addDaysYmd(t, 7);
  const open = tasks.filter((x) => x.status !== 'done').sort(sortTasks);
  const done = tasks.filter((x) => x.status === 'done').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  return (
    <div className="stack">
      <Group title="Overdue" tone="danger" tasks={open.filter((x) => x.due && x.due < t)} />
      <Group title="Today" tone="accent" tasks={open.filter((x) => x.due === t)} />
      <Group title="Tomorrow" tasks={open.filter((x) => x.due === tom)} />
      <Group title="Next 7 days" tasks={open.filter((x) => x.due && x.due > tom && x.due <= week).sort((a, b) => a.due!.localeCompare(b.due!) || b.priority - a.priority)} />
      <Group title="Later" tasks={open.filter((x) => x.due && x.due > week).sort((a, b) => a.due!.localeCompare(b.due!))} />
      <Group title="Someday" tasks={open.filter((x) => !x.due)} />
      {showDone && <Group title="Completed" tasks={done.slice(0, 100)} />}
      {open.length === 0 && <div className="panel"><Empty icon={<ListTodo />} title="Everything’s done">Enjoy it. Or plan the next thing.</Empty></div>}
    </div>
  );
}

const COLUMNS: { id: TaskStatus; label: string }[] = [{ id: 'todo', label: 'To do' }, { id: 'doing', label: 'In progress' }, { id: 'done', label: 'Done' }];

function BoardView({ tasks }: { tasks: Task[] }) {
  const patch = useStore((s) => s.patch);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const open = useUI.getState().editTask;
  return (
    <div className="board">
      {COLUMNS.map((col) => {
        const list = tasks.filter((t) => t.status === col.id).sort(col.id === 'done' ? (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0) : sortTasks);
        return (
          <div key={col.id} className="board-col" data-over={over === col.id}
            onDragOver={(e) => { e.preventDefault(); setOver(col.id); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault(); setOver(null);
              const id = e.dataTransfer.getData('text/task');
              if (id) patch('tasks', id, { status: col.id, completedAt: col.id === 'done' ? Date.now() : undefined });
            }}>
            <div className="board-col-head"><b>{col.label}</b><span className="count">{list.length}</span>
              {col.id !== 'done' && <button type="button" className="icon-btn sm" aria-label="Add" onClick={() => open(blankTask({ status: col.id }))}><Plus /></button>}
            </div>
            <div className="board-cards">
              {(col.id === 'done' ? list.slice(0, 30) : list).map((t) => (
                <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/task', t.id)} className="board-card">
                  <TaskRow task={t} onOpen={open} showSubject />
                </div>
              ))}
              {list.length === 0 && <div className="board-empty">Drop tasks here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MatrixView({ tasks }: { tasks: Task[] }) {
  const t = today();
  const soon = addDaysYmd(t, 2);
  const open = tasks.filter((x) => x.status !== 'done');
  const urgent = (x: Task) => !!x.due && x.due <= soon;
  const important = (x: Task) => x.priority >= 2;
  const edit = useUI.getState().editTask;
  const quads = [
    { title: 'Do first', sub: 'Urgent & important', list: open.filter((x) => urgent(x) && important(x)), tone: 'danger' },
    { title: 'Schedule', sub: 'Important, not urgent', list: open.filter((x) => !urgent(x) && important(x)), tone: 'accent' },
    { title: 'Quick wins', sub: 'Urgent, less important', list: open.filter((x) => urgent(x) && !important(x)), tone: 'warn' },
    { title: 'Later', sub: 'Neither', list: open.filter((x) => !urgent(x) && !important(x)), tone: '' },
  ];
  return (
    <div className="matrix">
      {quads.map((q) => (
        <div key={q.title} className={`panel matrix-cell ${q.tone}`}>
          <div className="panel-head"><h3>{q.title}<span className="faint small" style={{ fontWeight: 500 }}>{q.sub}</span></h3><span className="count">{q.list.length}</span></div>
          <div className="task-list">{q.list.sort(sortTasks).map((x) => <TaskRow key={x.id} task={x} onOpen={edit} compact />)}</div>
          {q.list.length === 0 && <div className="board-empty">Nothing here</div>}
        </div>
      ))}
      <p className="faint small" style={{ gridColumn: '1 / -1' }}>Urgent = due within 2 days. Important = medium or high priority.</p>
    </div>
  );
}
