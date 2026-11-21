import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Sun, ListTodo, CalendarDays, Timer, NotebookPen, Layers, ClipboardCheck, GraduationCap, BarChart3, Sparkles,
  Settings as SettingsIcon, Search, PanelLeftClose, PanelLeftOpen, MoreHorizontal, Zap,
} from 'lucide-react';
import type { ModuleId } from '../types';
import { useStore } from '../store/store';
import { MODULES } from '../store/defaults';
import { href, navigate, useRoute } from '../lib/router';
import { useTimer, displayMs } from '../store/timer';
import { formatClock, today } from '../lib/dates';
import { deckCounts } from '../lib/stats';
import { useNow, Modal } from './ui';

export const MODULE_ICON: Record<ModuleId | 'settings', (p: { className?: string }) => ReactNode> = {
  today: (p) => <Sun {...p} />, planner: (p) => <ListTodo {...p} />, calendar: (p) => <CalendarDays {...p} />,
  focus: (p) => <Timer {...p} />, notes: (p) => <NotebookPen {...p} />, cards: (p) => <Layers {...p} />,
  practice: (p) => <ClipboardCheck {...p} />, grades: (p) => <GraduationCap {...p} />, insights: (p) => <BarChart3 {...p} />,
  tutor: (p) => <Sparkles {...p} />, settings: (p) => <SettingsIcon {...p} />,
};

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <Zap style={{ width: size * 0.55, height: size * 0.55 }} fill="currentColor" strokeWidth={1.5} />
    </span>
  );
}

function useBadges() {
  const cards = useStore((s) => s.cards);
  const reviews = useStore((s) => s.reviews);
  const tasks = useStore((s) => s.tasks);
  const newPerDay = useStore((s) => s.settings.srs.newPerDay);
  return useMemo(() => {
    const c = deckCounts(cards, reviews, newPerDay);
    const t = today();
    const overdue = tasks.filter((x) => x.status !== 'done' && x.due && x.due < t).length;
    const dueToday = tasks.filter((x) => x.status !== 'done' && x.due === t).length;
    return { cards: c.due + c.learning, overdue, dueToday };
  }, [cards, reviews, tasks, newPerDay]);
}

function TimerPill() {
  const t = useTimer();
  useNow(1000);
  const active = t.running || (t.mode === 'stopwatch' ? t.accumulatedMs > 0 : t.remainingMs < (useStore.getState().settings.focus.work * 60000) && t.mode === 'focus' && t.segmentStartedAt);
  if (!active) return null;
  const label = t.mode === 'focus' ? 'Focus' : t.mode === 'stopwatch' ? 'Stopwatch' : 'Break';
  return (
    <a className="side-timer" href={href('/focus')}>
      {t.running ? <span className="pulse-dot" /> : <Timer style={{ width: 16 }} />}
      <span className="side-timer-text grow">{label}{!t.running && ' · paused'}</span>
      <span className="tnum">{formatClock(displayMs(t))}</span>
    </a>
  );
}

export function Sidebar({ onSearch }: { onSearch: () => void }) {
  const { parts } = useRoute();
  const modules = useStore((s) => s.settings.modules);
  const updateSettings = useStore((s) => s.updateSettings);
  const collapsed = useStore((s) => s.settings.sidebarCollapsed);
  const badges = useBadges();
  const active = parts[0] ?? 'today';
  const enabled = MODULES.filter((m) => modules[m.id]);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const badgeFor = (id: ModuleId) => {
    if (id === 'cards' && badges.cards) return <span className="nav-badge hot">{badges.cards}</span>;
    if (id === 'planner' && badges.overdue) return <span className="nav-badge warn" title="Overdue">{badges.overdue}</span>;
    if (id === 'planner' && badges.dueToday) return <span className="nav-badge">{badges.dueToday}</span>;
    return null;
  };
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <BrandMark />
        <span className="brand-name">Study<span>Sprint</span></span>
      </div>
      <button type="button" className="side-search" onClick={onSearch}>
        <Search style={{ width: 16 }} /><span className="side-search-text">Search or jump to…</span>
        <span className="side-search-text"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd> <kbd>K</kbd></span>
      </button>
      <TimerPill />
      <nav className="stack-sm" style={{ gap: 2 }}>
        {enabled.map((m) => (
          <a key={m.id} className="nav-item" href={href(`/${m.id}`)} aria-current={active === m.id ? 'page' : undefined} title={m.label}>
            {MODULE_ICON[m.id]({})}
            <span className="nav-label">{m.label}</span>
            {badgeFor(m.id)}
          </a>
        ))}
      </nav>
      <div className="side-foot">
        <a className="nav-item" href={href('/settings')} aria-current={active === 'settings' ? 'page' : undefined} title="Settings">
          <SettingsIcon /><span className="nav-label">Settings</span>
        </a>
        <button type="button" className="nav-item" onClick={() => updateSettings({ sidebarCollapsed: !collapsed })} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}<span className="nav-label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileChrome({ onSearch }: { onSearch: () => void }) {
  const { parts } = useRoute();
  const modules = useStore((s) => s.settings.modules);
  const badges = useBadges();
  const [more, setMore] = useState(false);
  const active = parts[0] ?? 'today';
  const enabled = MODULES.filter((m) => modules[m.id]).map((m) => m.id);
  const preferred: ModuleId[] = ['today', 'planner', 'focus', 'cards', 'notes', 'calendar', 'practice'];
  const primary = preferred.filter((id) => enabled.includes(id)).slice(0, 4);
  const rest = enabled.filter((id) => !primary.includes(id));
  useEffect(() => setMore(false), [active]);
  const label = (id: string) => MODULES.find((m) => m.id === id)?.label ?? 'Settings';
  return (
    <>
      <header className="mobile-top">
        <div className="brand"><BrandMark size={26} /><span className="brand-name">Study<span>Sprint</span></span></div>
        <div className="spacer" />
        <button type="button" className="icon-btn" aria-label="Search" onClick={onSearch}><Search /></button>
        <a className="icon-btn" aria-label="Settings" href={href('/settings')}><SettingsIcon /></a>
      </header>
      <nav className="tabbar" aria-label="Main navigation">
        {primary.map((id) => (
          <a key={id} className="tab" href={href(`/${id}`)} aria-current={active === id ? 'page' : undefined}>
            {MODULE_ICON[id]({})}<span>{label(id)}</span>
            {id === 'cards' && badges.cards > 0 && <span className="dot" />}
            {id === 'planner' && badges.overdue > 0 && <span className="dot" />}
          </a>
        ))}
        <button type="button" className="tab" aria-current={rest.includes(active as ModuleId) ? 'page' : undefined} onClick={() => setMore(true)}>
          <MoreHorizontal /><span>More</span>
        </button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="All tools">
        <div className="more-grid">
          {[...rest, 'settings' as const].map((id) => (
            <button key={id} type="button" className="more-tile" onClick={() => navigate(`/${id}`)}>
              {MODULE_ICON[id]({})}<span>{label(id)}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
