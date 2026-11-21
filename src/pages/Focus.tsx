import { useEffect, useState, type CSSProperties } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Maximize2, Minimize2, CloudRain, Waves, Flame, Wind, VolumeX, Settings2, ParkingSquare, Plus, Trash2, ListPlus, Check, Square, Coffee, Brain, Timer as TimerIcon, Volume2 } from 'lucide-react';
import type { AmbientId } from '../types';
import { useStore } from '../store/store';
import { useTimer, displayMs, type TimerMode } from '../store/timer';
import { subjectHex } from '../store/defaults';
import { formatClock, formatDuration, formatTime, hhmm, today, ymd } from '../lib/dates';
import { minutesOn } from '../lib/stats';
import { chime } from '../lib/audio';
import { uid } from '../lib/id';
import { Button, Field, IconButton, Modal, Seg, Switch, useNow, toast, SettingRow } from '../components/ui';
import { SubjectSelect } from '../components/pickers';

const PRESETS = [
  { label: 'Classic', work: 25, short: 5, long: 15, blurb: '25 / 5' },
  { label: 'Deep', work: 50, short: 10, long: 20, blurb: '50 / 10' },
  { label: 'Ultradian', work: 90, short: 20, long: 30, blurb: '90 / 20' },
  { label: 'Sprint', work: 15, short: 3, long: 10, blurb: '15 / 3' },
];

const SOUNDS: { id: AmbientId; label: string; icon: React.ReactNode }[] = [
  { id: 'off', label: 'Silence', icon: <VolumeX /> },
  { id: 'rain', label: 'Rain', icon: <CloudRain /> },
  { id: 'waves', label: 'Ocean', icon: <Waves /> },
  { id: 'fire', label: 'Fireplace', icon: <Flame /> },
  { id: 'brown', label: 'Brown noise', icon: <Wind /> },
  { id: 'pink', label: 'Pink noise', icon: <Wind /> },
  { id: 'white', label: 'White noise', icon: <Wind /> },
];

export default function Focus() {
  const timer = useTimer();
  const settings = useStore((s) => s.settings);
  const f = settings.focus;
  const update = useStore((s) => s.updateSettings);
  const tasks = useStore((s) => s.tasks);
  const sessions = useStore((s) => s.sessions);
  const subjects = useStore((s) => s.subjects);
  const [zen, setZen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [manual, setManual] = useState(false);
  useNow(250);

  const ms = displayMs(timer);
  const total = timer.mode === 'stopwatch' ? 0 : (timer.mode === 'focus' ? f.work : timer.mode === 'short' ? f.short : f.long) * 60000;
  const progress = timer.mode === 'stopwatch' ? (ms % 3_600_000) / 3_600_000 : total ? 1 - ms / total : 0;
  const isBreak = timer.mode === 'short' || timer.mode === 'long';
  const subj = subjects.find((s) => s.id === timer.subjectId);
  const ringColor = isBreak ? 'var(--success)' : subj ? subjectHex(subj.color) : 'var(--accent)';
  const todayMin = minutesOn(sessions, today());
  const todays = sessions.filter((s) => ymd(new Date(s.start)) === today()).sort((a, b) => b.start - a.start);
  const openTasks = tasks.filter((t) => t.status !== 'done' && (!timer.subjectId || t.subjectId === timer.subjectId));
  const idleFresh = !timer.running && (timer.mode === 'stopwatch' ? timer.accumulatedMs === 0 : ms === total);

  // keep the idle clock in sync with changed durations
  useEffect(() => {
    if (!timer.running && timer.mode !== 'stopwatch' && timer.accumulatedMs === 0 && !timer.segmentStartedAt) timer.setMode(timer.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.work, f.short, f.long]);

  useEffect(() => {
    if (!zen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZen(false); };
    window.addEventListener('keydown', onKey);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { window.removeEventListener('keydown', onKey); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, [zen]);

  const toggle = () => (timer.running ? timer.pause() : timer.start());
  const label = timer.mode === 'focus' ? 'Focus' : timer.mode === 'short' ? 'Short break' : timer.mode === 'long' ? 'Long break' : 'Stopwatch';
  const roundInCycle = timer.round % f.longEvery;

  const dial = (
    <div className="dial" style={{ '--ring': ringColor } as CSSProperties}>
      <svg viewBox="0 0 300 300" className="dial-svg" aria-hidden>
        <circle cx="150" cy="150" r="136" className="dial-track" />
        <circle cx="150" cy="150" r="136" className="dial-progress" strokeDasharray={2 * Math.PI * 136} strokeDashoffset={2 * Math.PI * 136 * (1 - Math.max(0, Math.min(1, progress)))} />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const r1 = i % 5 === 0 ? 118 : 122;
          return <line key={i} x1={150 + Math.sin(a) * r1} y1={150 - Math.cos(a) * r1} x2={150 + Math.sin(a) * 126} y2={150 - Math.cos(a) * 126} className="dial-tick" />;
        })}
      </svg>
      <div className="dial-center">
        <div className="dial-mode">{isBreak ? <Coffee /> : <Brain />}{label}{!timer.running && !idleFresh && ' · paused'}</div>
        <div className="dial-time display tnum" role="timer" aria-live="off">{formatClock(ms)}</div>
        {timer.intention && <div className="dial-intent truncate">{timer.intention}</div>}
        {timer.mode !== 'stopwatch' && (
          <div className="dial-rounds" title={`Long break after ${f.longEvery} focus sessions`}>
            {Array.from({ length: f.longEvery }, (_, i) => <i key={i} data-on={i < roundInCycle} />)}
          </div>
        )}
      </div>
    </div>
  );

  const controls = (
    <div className="dial-controls">
      <IconButton label="Reset" onClick={timer.reset}><RotateCcw /></IconButton>
      <button type="button" className="play-btn" onClick={toggle} aria-label={timer.running ? 'Pause' : 'Start'} style={{ '--ring': ringColor } as CSSProperties}>
        {timer.running ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
      </button>
      {timer.mode === 'stopwatch'
        ? <IconButton label="Finish and log" onClick={() => { timer.finishStopwatch(); toast('Session logged', { tone: 'success' }); }}><Square /></IconButton>
        : <IconButton label="Skip to next" onClick={timer.skip}><SkipForward /></IconButton>}
    </div>
  );

  if (zen) {
    return (
      <div className="zen" style={{ '--ring': ringColor } as CSSProperties}>
        <button type="button" className="icon-btn zen-exit" aria-label="Exit zen mode" onClick={() => setZen(false)}><Minimize2 /></button>
        {dial}
        {controls}
        <p className="faint small">Press Esc to leave · F to pause</p>
      </div>
    );
  }

  return (
    <div className="page wide">
      <div className="page-head">
        <div><h1>Focus</h1><p>{formatDuration(todayMin)} focused today · goal {formatDuration(f.dailyGoalMin)}</p></div>
        <div className="page-actions">
          <Button variant="ghost" icon={<Settings2 />} onClick={() => setShowSettings(true)}>Timer settings</Button>
          <Button icon={<Maximize2 />} onClick={() => setZen(true)}>Zen mode</Button>
        </div>
      </div>

      <div className="focus-layout">
        <section className="panel focus-main">
          <Seg value={timer.mode} onChange={(m: TimerMode) => timer.setMode(m)} options={[
            { value: 'focus', label: 'Focus' }, { value: 'short', label: 'Short break' }, { value: 'long', label: 'Long break' }, { value: 'stopwatch', label: <><TimerIcon />Stopwatch</> },
          ]} />
          {dial}
          {controls}
          <div className="focus-link">
            <input className="input" placeholder="What are you working on?" value={timer.intention} onChange={(e) => timer.setLink({ intention: e.target.value })} />
            <div className="grid-2">
              <SubjectSelect value={timer.subjectId} onChange={(subjectId) => timer.setLink({ subjectId, taskId: undefined })} placeholder="Any subject" />
              <select className="select" value={timer.taskId ?? ''} onChange={(e) => {
                const t = tasks.find((x) => x.id === e.target.value);
                timer.setLink({ taskId: t?.id, subjectId: t?.subjectId ?? timer.subjectId, intention: t?.title ?? timer.intention });
              }} aria-label="Task">
                <option value="">No linked task</option>
                {openTasks.slice(0, 50).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            {timer.taskId && tasks.find((t) => t.id === timer.taskId)?.status !== 'done' && (
              <Button size="sm" variant="soft" icon={<Check />} onClick={() => { useStore.getState().toggleTask(timer.taskId!); timer.setLink({ taskId: undefined }); toast('Task completed — nice!', { tone: 'success' }); }}>Mark linked task done</Button>
            )}
          </div>
          <div className="presets">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="preset" aria-pressed={f.work === p.work && f.short === p.short}
                onClick={() => update({ focus: { ...f, work: p.work, short: p.short, long: p.long } })}>
                <b>{p.label}</b><span>{p.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h3><Volume2 />Soundscape</h3></div>
            <div className="panel-body stack-sm">
              <div className="sound-grid">
                {SOUNDS.map((s) => (
                  <button key={s.id} type="button" className="sound" aria-pressed={f.ambient === s.id} onClick={() => update({ focus: { ...f, ambient: s.id } })}>{s.icon}<span>{s.label}</span></button>
                ))}
              </div>
              <div className="row"><VolumeX style={{ width: 16, color: 'var(--text-3)' }} /><input type="range" min={0} max={1} step={0.05} value={f.volume} onChange={(e) => update({ focus: { ...f, volume: Number(e.target.value) } })} aria-label="Volume" /><Volume2 style={{ width: 16, color: 'var(--text-3)' }} /></div>
              <p className="tiny faint">Plays during focus sessions. Generated on your device — works offline.</p>
            </div>
          </section>
          <ParkingLot />
          <section className="panel">
            <div className="panel-head"><h3><TimerIcon />Today’s sessions</h3><Button size="xs" variant="ghost" icon={<Plus />} onClick={() => setManual(true)}>Log time</Button></div>
            <div className="list">
              {todays.length === 0 && <p className="small muted" style={{ padding: '4px var(--pad) var(--pad)' }}>Your completed sessions will appear here.</p>}
              {todays.map((s) => {
                const sj = subjects.find((x) => x.id === s.subjectId);
                return (
                  <div key={s.id} className="list-item">
                    <span className="subj-dot" style={{ '--c': subjectHex(sj?.color) } as CSSProperties} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="truncate small" style={{ fontWeight: 560 }}>{s.note || sj?.name || 'Focus session'}</div>
                      <div className="tiny faint">{formatTime(hhmm(new Date(s.start).getHours() * 60 + new Date(s.start).getMinutes()), settings.clock24)}{sj && s.note ? ` · ${sj.name}` : ''}</div>
                    </div>
                    <b className="tnum small">{formatDuration(s.minutes)}</b>
                    <IconButton size="sm" label="Delete session" onClick={() => useStore.getState().remove('sessions', s.id)}><Trash2 /></IconButton>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Timer settings" footer={<Button variant="primary" onClick={() => setShowSettings(false)}>Done</Button>}>
        <FocusSettings />
      </Modal>
      <Modal open={manual} onClose={() => setManual(false)} title="Log study time">
        <ManualLog onDone={() => setManual(false)} />
      </Modal>
    </div>
  );
}

export function FocusSettings() {
  const f = useStore((s) => s.settings.focus);
  const update = useStore((s) => s.updateSettings);
  const set = (p: Partial<typeof f>) => update({ focus: { ...f, ...p } });
  const num = (k: 'work' | 'short' | 'long' | 'longEvery' | 'dailyGoalMin', label: string, min: number, max: number, step = 1) => (
    <Field label={label}><input type="number" className="input" min={min} max={max} step={step} value={f[k]} onChange={(e) => set({ [k]: Math.max(min, Math.min(max, Number(e.target.value) || min)) })} /></Field>
  );
  return (
    <div className="stack">
      <div className="grid-3">
        {num('work', 'Focus (min)', 1, 180)}
        {num('short', 'Short break', 1, 60)}
        {num('long', 'Long break', 1, 90)}
        {num('longEvery', 'Long break every', 2, 10)}
        {num('dailyGoalMin', 'Daily goal (min)', 10, 720, 10)}
      </div>
      <SettingRow title="Auto-start breaks" desc="Start the break as soon as a focus session ends"><Switch checked={f.autoBreaks} onChange={(autoBreaks) => set({ autoBreaks })} /></SettingRow>
      <SettingRow title="Auto-start focus" desc="Start the next focus session when a break ends"><Switch checked={f.autoWork} onChange={(autoWork) => set({ autoWork })} /></SettingRow>
      <SettingRow title="Chime" desc="Sound when a session ends">
        <div className="row">
          <select className="select sm" value={f.chime} onChange={(e) => set({ chime: e.target.value as typeof f.chime })}><option value="bell">Bell</option><option value="soft">Soft</option><option value="digital">Digital</option><option value="none">None</option></select>
          <IconButton size="sm" label="Preview chime" onClick={() => chime(f.chime, Math.max(0.3, f.volume))}><Play /></IconButton>
        </div>
      </SettingRow>
      <SettingRow title="Desktop notifications" desc="Get notified when a session ends, even in another tab">
        <Switch checked={f.notify} onChange={async (notify) => {
          if (notify && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
            const p = await Notification.requestPermission();
            if (p !== 'granted') { toast('Notifications are blocked in your browser settings', { tone: 'warn' }); return; }
          }
          set({ notify });
        }} />
      </SettingRow>
    </div>
  );
}

function ManualLog({ onDone }: { onDone: () => void }) {
  const [minutes, setMinutes] = useState(30);
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const log = useStore((s) => s.logSession);
  return (
    <div className="stack">
      <p className="small muted">Studied away from the app? Log it so your stats stay honest.</p>
      <div className="grid-2">
        <Field label="Minutes"><input type="number" className="input" min={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 1)} /></Field>
        <Field label="Date"><input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Subject"><SubjectSelect value={subjectId} onChange={setSubjectId} /></Field>
      <Field label="What did you do?"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Library revision" /></Field>
      <Button variant="primary" onClick={() => {
        const start = date === today() ? Date.now() - minutes * 60000 : new Date(`${date}T17:00:00`).getTime();
        log({ start, end: start + minutes * 60000, minutes, subjectId, kind: 'manual', note: note || undefined });
        toast('Time logged', { tone: 'success' }); onDone();
      }}>Log {formatDuration(minutes)}</Button>
    </div>
  );
}

function ParkingLot() {
  const parked = useStore((s) => s.parked);
  const set = useStore((s) => s.set);
  const addTask = useStore((s) => s.addTask);
  const [text, setText] = useState('');
  const add = () => { if (!text.trim()) return; set((s) => ({ parked: [...s.parked, { id: uid('pk'), text: text.trim(), at: Date.now() }] })); setText(''); };
  return (
    <section className="panel">
      <div className="panel-head"><h3><ParkingSquare />Parking lot</h3>{parked.length > 0 && <span className="faint small">{parked.length}</span>}</div>
      <div className="panel-body stack-sm">
        <p className="tiny faint">A thought pops up mid-session? Park it here and get back to work. Deal with it later.</p>
        <div className="row"><input className="input sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Remember to…" onKeyDown={(e) => { if (e.key === 'Enter') add(); }} /><Button size="sm" onClick={add}><Plus /></Button></div>
        {parked.map((p) => (
          <div key={p.id} className="row small parked">
            <span className="grow">{p.text}</span>
            <IconButton size="sm" label="Turn into task" onClick={() => { addTask({ title: p.text }); set((s) => ({ parked: s.parked.filter((x) => x.id !== p.id) })); toast('Added to planner'); }}><ListPlus /></IconButton>
            <IconButton size="sm" label="Dismiss" onClick={() => set((s) => ({ parked: s.parked.filter((x) => x.id !== p.id) }))}><Trash2 /></IconButton>
          </div>
        ))}
      </div>
    </section>
  );
}

