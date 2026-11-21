// Global focus-timer state. Survives navigation and page reloads.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ID } from '../types';
import { useStore } from './store';
import { chime } from '../lib/audio';

export type TimerMode = 'focus' | 'short' | 'long' | 'stopwatch';

interface TimerState {
  mode: TimerMode;
  running: boolean;
  /** countdown: epoch ms when the segment ends (while running) */
  endsAt: number | null;
  /** countdown: remaining ms (while paused/idle) */
  remainingMs: number;
  /** focus/stopwatch: ms of focus accumulated in this segment before the current run */
  accumulatedMs: number;
  /** when the current run started */
  runStartedAt: number | null;
  segmentStartedAt: number | null;
  round: number;
  subjectId?: ID;
  taskId?: ID;
  intention: string;
  stopwatch: boolean;
  lastCompleted?: { mode: TimerMode; at: number; minutes: number };

  setMode: (m: TimerMode) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  finishStopwatch: () => void;
  setLink: (p: { subjectId?: ID; taskId?: ID; intention?: string }) => void;
  tick: () => void;
}

const minutesFor = (mode: TimerMode) => {
  const f = useStore.getState().settings.focus;
  return mode === 'focus' ? f.work : mode === 'short' ? f.short : mode === 'long' ? f.long : 0;
};

function notify(title: string, body: string) {
  const f = useStore.getState().settings.focus;
  if (!f.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: './icons/icon.svg', silent: true }); } catch { /* ignore */ }
}

export const useTimer = create<TimerState>()(
  persist(
    (set, get) => {
      const focusElapsed = () => {
        const s = get();
        return s.accumulatedMs + (s.running && s.runStartedAt ? Date.now() - s.runStartedAt : 0);
      };
      const logFocus = (ms: number) => {
        const minutes = Math.round(ms / 60000);
        if (minutes < 1) return 0;
        const s = get();
        const end = Date.now();
        useStore.getState().logSession({
          start: s.segmentStartedAt ?? end - ms, end, minutes,
          subjectId: s.subjectId, taskId: s.taskId, kind: s.mode === 'stopwatch' ? 'stopwatch' : 'focus',
          note: s.intention || undefined,
        });
        return minutes;
      };
      const goto = (mode: TimerMode, autostart: boolean) => {
        const ms = minutesFor(mode) * 60000;
        set({
          mode, remainingMs: ms, accumulatedMs: 0, running: autostart,
          endsAt: autostart ? Date.now() + ms : null,
          runStartedAt: autostart ? Date.now() : null,
          segmentStartedAt: autostart ? Date.now() : null,
        });
      };
      const completeSegment = (natural: boolean) => {
        const s = get();
        const f = useStore.getState().settings.focus;
        if (s.mode === 'focus') {
          const minutes = logFocus(natural ? minutesFor('focus') * 60000 : focusElapsed());
          const round = s.round + (natural ? 1 : 0);
          set({ round, lastCompleted: { mode: 'focus', at: Date.now(), minutes } });
          if (natural) {
            chime(f.chime, Math.max(0.2, f.volume));
            notify('Focus session complete', `Nice work — ${minutes} minutes logged. Time for a break.`);
          }
          const next: TimerMode = round > 0 && round % f.longEvery === 0 ? 'long' : 'short';
          goto(next, natural && f.autoBreaks);
        } else if (s.mode === 'short' || s.mode === 'long') {
          if (natural) {
            chime(f.chime === 'none' ? 'none' : 'soft', Math.max(0.2, f.volume));
            notify('Break over', 'Ready for the next focus block?');
          }
          set({ lastCompleted: { mode: s.mode, at: Date.now(), minutes: minutesFor(s.mode) } });
          goto('focus', natural && f.autoWork);
        }
      };

      return {
        mode: 'focus', running: false, endsAt: null, remainingMs: 25 * 60000, accumulatedMs: 0,
        runStartedAt: null, segmentStartedAt: null, round: 0, intention: '', stopwatch: false,

        setMode: (m) => {
          const s = get();
          if (s.running && s.mode === 'focus') logFocus(focusElapsed());
          if (m === 'stopwatch') set({ mode: 'stopwatch', running: false, endsAt: null, remainingMs: 0, accumulatedMs: 0, runStartedAt: null, segmentStartedAt: null });
          else goto(m, false);
        },
        start: () => {
          const s = get();
          const now = Date.now();
          if (s.mode === 'stopwatch') {
            set({ running: true, runStartedAt: now, segmentStartedAt: s.segmentStartedAt ?? now });
            return;
          }
          const remaining = s.remainingMs > 0 ? s.remainingMs : minutesFor(s.mode) * 60000;
          set({ running: true, endsAt: now + remaining, remainingMs: remaining, runStartedAt: now, segmentStartedAt: s.segmentStartedAt ?? now });
        },
        pause: () => {
          const s = get();
          if (!s.running) return;
          const now = Date.now();
          set({
            running: false,
            remainingMs: s.endsAt ? Math.max(0, s.endsAt - now) : s.remainingMs,
            endsAt: null,
            accumulatedMs: s.accumulatedMs + (s.runStartedAt ? now - s.runStartedAt : 0),
            runStartedAt: null,
          });
        },
        reset: () => {
          const s = get();
          if (s.mode === 'focus' && focusElapsed() > 60000) logFocus(focusElapsed());
          if (s.mode === 'stopwatch') set({ running: false, accumulatedMs: 0, runStartedAt: null, segmentStartedAt: null });
          else goto(s.mode, false);
        },
        skip: () => completeSegment(false),
        finishStopwatch: () => {
          const ms = focusElapsed();
          const minutes = logFocus(ms);
          set({ running: false, accumulatedMs: 0, runStartedAt: null, segmentStartedAt: null, lastCompleted: { mode: 'stopwatch', at: Date.now(), minutes } });
        },
        setLink: (p) => set(p),
        tick: () => {
          const s = get();
          if (!s.running || s.mode === 'stopwatch' || !s.endsAt) return;
          if (Date.now() >= s.endsAt) completeSegment(true);
        },
      };
    },
    {
      name: 'ss.timer',
      partialize: (s) => ({
        mode: s.mode, running: s.running, endsAt: s.endsAt, remainingMs: s.remainingMs, accumulatedMs: s.accumulatedMs,
        runStartedAt: s.runStartedAt, segmentStartedAt: s.segmentStartedAt, round: s.round, subjectId: s.subjectId,
        taskId: s.taskId, intention: s.intention,
      }),
    },
  ),
);

/** ms shown on the clock for the current state */
export function displayMs(s: Pick<TimerState, 'mode' | 'running' | 'endsAt' | 'remainingMs' | 'accumulatedMs' | 'runStartedAt'>, now = Date.now()): number {
  if (s.mode === 'stopwatch') return s.accumulatedMs + (s.running && s.runStartedAt ? now - s.runStartedAt : 0);
  if (s.running && s.endsAt) return Math.max(0, s.endsAt - now);
  return s.remainingMs;
}
