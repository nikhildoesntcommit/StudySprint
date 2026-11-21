import type { Card, FocusSession, ID, ReviewLog, StudyData, Task } from '../types';
import { addDays, startOfDay, today, ymd } from './dates';
import { endOfToday, isDue } from './srs';

export function minutesByDay(sessions: FocusSession[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) {
    const k = ymd(new Date(s.start));
    m.set(k, (m.get(k) ?? 0) + s.minutes);
  }
  return m;
}

export function minutesOn(sessions: FocusSession[], day = today()): number {
  return sessions.reduce((a, s) => a + (ymd(new Date(s.start)) === day ? s.minutes : 0), 0);
}

/** Days on which the student did something meaningful (focus, reviews, completed tasks, exams). */
export function activeDays(d: Pick<StudyData, 'sessions' | 'reviews' | 'tasks' | 'attempts'>): Set<string> {
  const set = new Set<string>();
  for (const s of d.sessions) set.add(ymd(new Date(s.start)));
  for (const r of d.reviews) set.add(ymd(new Date(r.at)));
  for (const t of d.tasks) if (t.completedAt) set.add(ymd(new Date(t.completedAt)));
  for (const a of d.attempts) if (a.finishedAt) set.add(ymd(new Date(a.finishedAt)));
  return set;
}

export function streaks(days: Set<string>): { current: number; best: number; todayDone: boolean } {
  const todayDone = days.has(today());
  let current = 0;
  let cursor = startOfDay();
  if (!todayDone) cursor = addDays(cursor, -1);
  while (days.has(ymd(cursor))) { current++; cursor = addDays(cursor, -1); }
  const sorted = [...days].sort();
  let best = 0, run = 0, prev = '';
  for (const d of sorted) {
    run = prev && ymd(addDays(new Date(prev + 'T00:00:00'), 1)) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), todayDone };
}

export function newIntroducedToday(reviews: ReviewLog[], deckId?: ID): number {
  const t = today();
  const seen = new Set<string>();
  for (const r of reviews) {
    if (r.prevState === 'new' && ymd(new Date(r.at)) === t && (!deckId || r.deckId === deckId)) seen.add(r.cardId);
  }
  return seen.size;
}

export interface DeckCounts { due: number; learning: number; fresh: number; total: number }

export function deckCounts(cards: Card[], reviews: ReviewLog[], newPerDay: number, deckId?: ID, now = Date.now()): DeckCounts {
  const pool = deckId ? cards.filter((c) => c.deckId === deckId) : cards;
  let due = 0, learning = 0, newTotal = 0;
  for (const c of pool) {
    if (c.suspended) continue;
    if (c.srs.state === 'new') newTotal++;
    else if (isDue(c, now)) (c.srs.state === 'review' ? due++ : learning++);
  }
  const allowance = Math.max(0, newPerDay - newIntroducedToday(reviews, deckId));
  return { due, learning, fresh: Math.min(newTotal, allowance), total: pool.length };
}

/** Build a study queue: learning first (by due), then reviews (most overdue first), with new cards interleaved. */
export function buildQueue(cards: Card[], reviews: ReviewLog[], newPerDay: number, deckIds?: ID[], opts: { cram?: boolean; flaggedOnly?: boolean } = {}, now = Date.now()): ID[] {
  let pool = deckIds?.length ? cards.filter((c) => deckIds.includes(c.deckId)) : cards;
  pool = pool.filter((c) => !c.suspended);
  if (opts.flaggedOnly) pool = pool.filter((c) => c.flagged);
  if (opts.cram) return pool.map((c) => c.id).sort(() => Math.random() - 0.5);
  const learning = pool.filter((c) => (c.srs.state === 'learning' || c.srs.state === 'relearning') && isDue(c, now)).sort((a, b) => a.srs.due - b.srs.due);
  const due = pool.filter((c) => c.srs.state === 'review' && c.srs.due <= endOfToday(now)).sort((a, b) => a.srs.due - b.srs.due);
  const perDeckNew = new Map<string, number>();
  const fresh: Card[] = [];
  const sortedNew = pool.filter((c) => c.srs.state === 'new').sort((a, b) => a.createdAt - b.createdAt || a.srs.due - b.srs.due);
  for (const c of sortedNew) {
    const used = perDeckNew.get(c.deckId) ?? newIntroducedToday(reviews, c.deckId);
    if (used >= newPerDay) continue;
    perDeckNew.set(c.deckId, used + 1);
    fresh.push(c);
  }
  // interleave: one new card after every 3 reviews
  const mixed: Card[] = [];
  let ni = 0;
  due.forEach((c, i) => { mixed.push(c); if ((i + 1) % 3 === 0 && ni < fresh.length) mixed.push(fresh[ni++]); });
  while (ni < fresh.length) mixed.push(fresh[ni++]);
  return [...learning, ...mixed].map((c) => c.id);
}

export function retentionRate(reviews: ReviewLog[], sinceDays = 30): number | null {
  const since = Date.now() - sinceDays * 86_400_000;
  const mature = reviews.filter((r) => r.at >= since && r.prevState === 'review');
  if (mature.length < 5) return null;
  return mature.filter((r) => r.rating > 1).length / mature.length;
}

export function taskBuckets(tasks: Task[], t = today()) {
  const open = tasks.filter((x) => x.status !== 'done');
  return {
    overdue: open.filter((x) => x.due && x.due < t),
    today: open.filter((x) => x.due === t),
    upcoming: open.filter((x) => x.due && x.due > t),
    someday: open.filter((x) => !x.due),
  };
}

/** Sorting: priority high→low, then due time, then manual order. */
export function sortTasks(a: Task, b: Task): number {
  return (b.priority - a.priority) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') || a.order - b.order;
}
