import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from './store/store';
import { useUI } from './store/ui';
import { useTimer, displayMs } from './store/timer';
import { MODULES } from './store/defaults';
import { navigate, useRoute } from './lib/router';
import { formatClock, today } from './lib/dates';
import { Sidebar, MobileChrome, BrandMark } from './components/Shell';
import { CommandPalette } from './components/CommandPalette';
import { ConfirmProvider, Modal, Toasts, useHotkey } from './components/ui';
import { TaskEditor, blankTask } from './components/tasks';
import { EventEditor } from './components/events';
import { startAmbient, stopAmbient } from './lib/audio';

const Today = lazy(() => import('./pages/Today'));
const Planner = lazy(() => import('./pages/Planner'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Focus = lazy(() => import('./pages/Focus'));
const Notes = lazy(() => import('./pages/Notes'));
const Cards = lazy(() => import('./pages/Cards'));
const Practice = lazy(() => import('./pages/Practice'));
const Grades = lazy(() => import('./pages/Grades'));
const Insights = lazy(() => import('./pages/Insights'));
const Tutor = lazy(() => import('./pages/Tutor'));
const Settings = lazy(() => import('./pages/Settings'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

const PAGES: Record<string, React.LazyExoticComponent<() => React.JSX.Element>> = {
  today: Today, planner: Planner, calendar: Calendar, focus: Focus, notes: Notes, cards: Cards,
  practice: Practice, grades: Grades, insights: Insights, tutor: Tutor, settings: Settings,
};

function useThemeAttributes() {
  const s = useStore((x) => x.settings);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setSystemDark(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    const theme = s.theme === 'system' ? (systemDark ? 'dark' : 'light') : s.theme;
    el.dataset.theme = theme;
    el.dataset.accent = s.accent;
    el.dataset.font = s.font;
    el.dataset.serif = s.serifHeadings ? 'on' : 'off';
    el.dataset.density = s.density;
    el.dataset.round = s.roundness;
    el.dataset.motion = s.reduceMotion ? 'reduce' : 'full';
    el.style.setProperty('--scale', String(s.fontScale));
    try { localStorage.setItem('ss.theme', JSON.stringify({ theme, accent: s.accent })); } catch { /* private mode */ }
    const bg = getComputedStyle(el).getPropertyValue('--bg').trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg));
  }, [s.theme, s.accent, s.font, s.serifHeadings, s.density, s.roundness, s.reduceMotion, s.fontScale, systemDark]);
}

function useGlobalTimer() {
  const tick = useTimer((t) => t.tick);
  const ambient = useStore((s) => s.settings.focus.ambient);
  const volume = useStore((s) => s.settings.focus.volume);
  const running = useTimer((t) => t.running);
  const mode = useTimer((t) => t.mode);
  useEffect(() => {
    const id = setInterval(() => {
      tick();
      const t = useTimer.getState();
      if (t.running) document.title = `${formatClock(displayMs(t))} · ${t.mode === 'focus' || t.mode === 'stopwatch' ? 'Focus' : 'Break'} — StudySprint`;
      else if (!document.title.startsWith('StudySprint')) document.title = 'StudySprint';
    }, 500);
    return () => clearInterval(id);
  }, [tick]);
  // ambient sound follows focus sessions
  useEffect(() => {
    if (running && (mode === 'focus' || mode === 'stopwatch') && ambient !== 'off') startAmbient(ambient, volume * 0.6);
    else stopAmbient();
  }, [running, mode, ambient, volume]);
}

function Shortcuts() {
  const open = useUI((s) => s.shortcuts);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? '⌘' : 'Ctrl';
  const rows: [string, string][] = [
    [`${mod} K`, 'Search & command palette'], ['N', 'New task'], ['F', 'Start / pause focus timer'], ['R', 'Review flashcards'],
    ['1 – 9', 'Jump to a module'], ['?', 'Show shortcuts'],
    ['Space / Enter', 'Flip card (while reviewing)'], ['1 2 3 4', 'Rate card: again, hard, good, easy'],
    ['← →', 'Previous / next question (practice)'], ['Esc', 'Close dialogs'],
  ];
  return (
    <Modal open={open} onClose={() => useUI.getState().setShortcuts(false)} title="Keyboard shortcuts">
      {rows.map(([k, v]) => <div className="kbd-row" key={k}><span>{v}</span><span className="row" style={{ gap: 4 }}>{k.split(' ').map((x) => <kbd key={x}>{x}</kbd>)}</span></div>)}
    </Modal>
  );
}

function QuickAddDialog() {
  const open = useUI((s) => s.quickAdd);
  useEffect(() => { if (open) { useUI.getState().setQuickAdd(false); useUI.getState().editTask(blankTask({ due: today() })); } }, [open]);
  return null;
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.settings.onboarded);
  const modules = useStore((s) => s.settings.modules);
  const collapsed = useStore((s) => s.settings.sidebarCollapsed);
  const editingTask = useUI((s) => s.editingTask);
  const { parts } = useRoute();
  useThemeAttributes();
  useGlobalTimer();

  useHotkey('mod+k', (e) => { e.preventDefault(); useUI.getState().setPalette(!useUI.getState().palette); }, [], { allowInInput: true });
  useHotkey('/', (e) => { e.preventDefault(); useUI.getState().setPalette(true); });
  useHotkey('n', (e) => { e.preventDefault(); useUI.getState().editTask(blankTask({ due: today() })); });
  useHotkey('?', () => useUI.getState().setShortcuts(true));
  useHotkey('r', () => { if (parts[0] !== 'cards') navigate('/cards/review'); }, [parts[0]]);
  useHotkey('f', () => { if (parts[0] === 'cards' || parts[0] === 'practice') return; const t = useTimer.getState(); t.running ? t.pause() : t.start(); }, [parts[0]]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      if (['cards', 'practice'].includes(parts[0] ?? '') && parts[1]) return; // keys are used inside review/exam
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const list = MODULES.filter((m) => modules[m.id]);
        if (list[n - 1]) navigate(`/${list[n - 1].id}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modules, parts]);

  if (!hydrated) return <div className="splash"><BrandMark size={54} /></div>;

  if (!onboarded) {
    return <Suspense fallback={<div className="splash"><BrandMark size={54} /></div>}><ConfirmProvider><Onboarding /><Toasts /></ConfirmProvider></Suspense>;
  }

  const id = parts[0] ?? 'today';
  const Page = PAGES[id] && (id === 'settings' || modules[id as keyof typeof modules]) ? PAGES[id] : Today;

  return (
    <ConfirmProvider>
      <div className="shell" data-collapsed={collapsed ? 'true' : 'false'}>
        <Sidebar onSearch={() => useUI.getState().setPalette(true)} />
        <div className="main">
          <MobileChrome onSearch={() => useUI.getState().setPalette(true)} />
          <Suspense fallback={<div className="page"><div className="skeleton" style={{ height: 40, width: 220, marginBottom: 20 }} /><div className="skeleton" style={{ height: 240 }} /></div>}>
            <Page key={id} />
          </Suspense>
        </div>
      </div>
      <CommandPalette />
      <TaskEditor task={editingTask} onClose={() => useUI.getState().editTask(null)} />
      <EventEditor />
      <QuickAddDialog />
      <Shortcuts />
      <Toasts />
    </ConfirmProvider>
  );
}
