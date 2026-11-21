// Spaced repetition scheduler based on FSRS-4.5 (Free Spaced Repetition Scheduler)
// with short-term learning steps. Intervals target the user's desired retention.
import type { Card, Rating, SrsData } from '../types';

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY = 86_400_000;
const MIN = 60_000;

export interface SrsOptions {
  retention: number; // 0.7 .. 0.97
  steps: number[]; // learning steps in minutes, e.g. [1, 10]
  relearnSteps?: number[];
  maxIntervalDays: number;
  fuzz?: boolean;
}

export const DEFAULT_SRS: SrsOptions = { retention: 0.9, steps: [1, 10], relearnSteps: [10], maxIntervalDays: 365, fuzz: true };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function newSrs(now = Date.now()): SrsData {
  return { state: 'new', due: now, stability: 0, difficulty: 0, reps: 0, lapses: 0, step: 0 };
}

export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

function initStability(g: Rating) { return Math.max(W[g - 1], 0.1); }
function initDifficulty(g: Rating) { return clamp(W[4] - (g - 3) * W[5], 1, 10); }
function nextDifficulty(d: number, g: Rating) {
  const next = d - W[6] * (g - 3);
  return clamp(W[7] * initDifficulty(3) + (1 - W[7]) * next, 1, 10);
}
function recallStability(d: number, s: number, r: number, g: Rating) {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
}
function forgetStability(d: number, s: number, r: number) {
  return Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
}

export function intervalDays(stability: number, opts: SrsOptions, seed = 0): number {
  const raw = (stability / FACTOR) * (Math.pow(opts.retention, 1 / DECAY) - 1);
  let ivl = Math.max(1, Math.round(raw));
  if (opts.fuzz && ivl > 2) {
    // deterministic per-card fuzz of up to ±5% to avoid review pile-ups
    const f = ((Math.sin(seed * 9301 + 49297) + 1) / 2) * 0.1 - 0.05;
    ivl = Math.max(1, Math.round(ivl * (1 + f)));
  }
  return Math.min(ivl, opts.maxIntervalDays);
}

export interface Outcome { srs: SrsData; label: string; ms: number }

function label(ms: number): string {
  if (ms < MIN * 60) return `${Math.max(1, Math.round(ms / MIN))}m`;
  if (ms < DAY) return `${Math.round(ms / (MIN * 60))}h`;
  const d = ms / DAY;
  if (d < 30) return `${Math.round(d)}d`;
  if (d < 365) return `${(d / 30).toFixed(d < 60 ? 1 : 0)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

/** Compute the outcome for every rating so the UI can preview intervals. */
export function preview(srs: SrsData, now: number, opts: SrsOptions = DEFAULT_SRS, seed = 0): Record<Rating, Outcome> {
  const steps = opts.steps.length ? opts.steps : [10];
  const relearn = opts.relearnSteps?.length ? opts.relearnSteps : [10];
  const out = {} as Record<Rating, Outcome>;
  const mk = (patch: Partial<SrsData>, dueMs: number): Outcome => ({
    srs: { ...srs, ...patch, due: now + dueMs, lastReview: now, reps: srs.reps + 1 },
    ms: dueMs,
    label: label(dueMs),
  });

  if (srs.state === 'new') {
    for (const g of [1, 2, 3, 4] as Rating[]) {
      const s = initStability(g);
      const d = initDifficulty(g);
      if (g === 1) out[g] = mk({ state: 'learning', step: 0, stability: s, difficulty: d }, steps[0] * MIN);
      else if (g === 2) out[g] = mk({ state: 'learning', step: 0, stability: s, difficulty: d }, (steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[0] * 1.5) * MIN);
      else if (g === 3 && steps.length > 1) out[g] = mk({ state: 'learning', step: 1, stability: s, difficulty: d }, steps[1] * MIN);
      else {
        const ivl = intervalDays(s, opts, seed);
        out[g] = mk({ state: 'review', step: 0, stability: s, difficulty: d }, (g === 4 ? Math.max(ivl, 2) : ivl) * DAY);
      }
    }
    return out;
  }

  if (srs.state === 'learning' || srs.state === 'relearning') {
    const st = srs.state === 'learning' ? steps : relearn;
    const step = Math.min(srs.step, st.length - 1);
    const goodIvl = intervalDays(srs.stability, opts, seed);
    out[1] = mk({ step: 0, difficulty: nextDifficulty(srs.difficulty, 1) }, st[0] * MIN);
    out[2] = mk({ step, difficulty: nextDifficulty(srs.difficulty, 2) }, st[step] * (step === 0 && st.length > 1 ? 1.5 : 1) * MIN);
    if (step + 1 < st.length) out[3] = mk({ step: step + 1 }, st[step + 1] * MIN);
    else out[3] = mk({ state: 'review', step: 0 }, goodIvl * DAY);
    const easyS = srs.stability * (srs.state === 'learning' ? 1.5 : 1.2);
    out[4] = mk({ state: 'review', step: 0, stability: easyS, difficulty: nextDifficulty(srs.difficulty, 4) }, Math.max(goodIvl + 1, intervalDays(easyS, opts, seed)) * DAY);
    return out;
  }

  // review
  const elapsed = Math.max(0, (now - (srs.lastReview ?? now)) / DAY);
  const r = retrievability(elapsed, srs.stability);
  const d = srs.difficulty;
  const sAgain = forgetStability(d, srs.stability, r);
  const sHard = recallStability(d, srs.stability, r, 2);
  const sGood = recallStability(d, srs.stability, r, 3);
  const sEasy = recallStability(d, srs.stability, r, 4);
  let hard = intervalDays(sHard, opts, seed);
  let good = intervalDays(sGood, opts, seed);
  let easy = intervalDays(sEasy, opts, seed);
  hard = Math.min(hard, good);
  good = Math.max(good, hard + 1);
  easy = Math.max(easy, good + 1);
  out[1] = mk({ state: 'relearning', step: 0, stability: sAgain, difficulty: nextDifficulty(d, 1), lapses: srs.lapses + 1 }, relearn[0] * MIN);
  out[2] = mk({ stability: sHard, difficulty: nextDifficulty(d, 2) }, Math.min(hard, opts.maxIntervalDays) * DAY);
  out[3] = mk({ stability: sGood, difficulty: nextDifficulty(d, 3) }, Math.min(good, opts.maxIntervalDays) * DAY);
  out[4] = mk({ stability: sEasy, difficulty: nextDifficulty(d, 4) }, Math.min(easy, opts.maxIntervalDays) * DAY);
  return out;
}

export function review(srs: SrsData, rating: Rating, now = Date.now(), opts: SrsOptions = DEFAULT_SRS, seed = 0): SrsData {
  return preview(srs, now, opts, seed)[rating].srs;
}

/** Hash a string id into a stable numeric seed for fuzzing. */
export function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h % 10_000);
}

export function endOfToday(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function isDue(card: Card, now = Date.now()): boolean {
  if (card.suspended || card.srs.state === 'new') return false;
  if (card.srs.state === 'review') return card.srs.due <= endOfToday(now);
  return card.srs.due <= now + 20 * MIN; // learning cards: allow 20 minutes learn-ahead
}

/** Current estimated recall probability for a card, 0..1 (1 for unseen). */
export function currentRecall(card: Card, now = Date.now()): number {
  if (card.srs.state === 'new' || !card.srs.lastReview) return 1;
  return retrievability((now - card.srs.lastReview) / DAY, card.srs.stability);
}

// ---- Cloze helpers -------------------------------------------------------

const CLOZE_RE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;

export function clozeOrdinals(text: string): number[] {
  const set = new Set<number>();
  for (const m of text.matchAll(CLOZE_RE)) set.add(Number(m[1]));
  return [...set].sort((a, b) => a - b);
}

/** Render cloze text for a given ordinal: hidden as [...] (or [hint]) on the front, highlighted on the back. */
export function renderCloze(text: string, ord: number, reveal: boolean): string {
  return text.replace(CLOZE_RE, (_all, n: string, answer: string, hint?: string) => {
    if (Number(n) !== ord) return answer;
    if (reveal) return `<mark class="cloze">${answer}</mark>`;
    return `<span class="cloze-blank">[${hint ? hint : '…'}]</span>`;
  });
}
