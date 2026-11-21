import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '../quickadd';
import { newSrs, preview, review, retrievability, clozeOrdinals, renderCloze } from '../srs';
import { parseExam, gradeAttempt, newAttempt, checkAnswer, exportExam } from '../exam';
import { streaks } from '../stats';
import { ymd, addDays } from '../dates';
import type { Subject } from '../../types';
import fs from 'node:fs';

const subjects: Subject[] = [
  { id: 's1', name: 'Chemistry', color: 'teal', emoji: '🧪', createdAt: 0 },
  { id: 's2', name: 'Mathematics', color: 'blue', emoji: '📐', createdAt: 0 },
];
// Wednesday 2026-11-18
const NOW = new Date(2026, 10, 18, 10, 0);

describe('quick add', () => {
  it('parses subject, date, time, priority, estimate', () => {
    const p = parseQuickAdd('Lab report #chem tomorrow 5pm !high ~45m', subjects, NOW);
    expect(p).toMatchObject({ title: 'Lab report', subjectId: 's1', due: '2026-11-19', dueTime: '17:00', priority: 3, estimateMin: 45 });
  });
  it('parses weekdays and next', () => {
    expect(parseQuickAdd('Essay fri', subjects, NOW).due).toBe('2026-11-20');
    expect(parseQuickAdd('Essay wed', subjects, NOW).due).toBe('2026-11-25');
    expect(parseQuickAdd('Essay next fri', subjects, NOW).due).toBe('2026-11-27');
  });
  it('parses recurrence and relative dates', () => {
    const p = parseQuickAdd('Flashcards every day #math', subjects, NOW);
    expect(p).toMatchObject({ recur: 'daily', due: '2026-11-18', subjectId: 's2', title: 'Flashcards' });
    expect(parseQuickAdd('Revise in 3 days', subjects, NOW).due).toBe('2026-11-21');
    expect(parseQuickAdd('Mock on dec 5', subjects, NOW).due).toBe('2026-12-05');
    expect(parseQuickAdd('Mock 2 jan', subjects, NOW).due).toBe('2027-01-02');
  });
  it('keeps unknown hashtags as tags and leaves plain words alone', () => {
    const p = parseQuickAdd('Read monday notes #reading', subjects, NOW);
    expect(p.tags).toEqual(['reading']);
    expect(p.title).toBe('Read notes');
  });
  it('does not eat words that merely contain day names', () => {
    const p = parseQuickAdd('Study photosynthesis', subjects, NOW);
    expect(p.title).toBe('Study photosynthesis');
    expect(p.due).toBeUndefined();
  });
});

describe('srs', () => {
  const opts = { retention: 0.9, steps: [1, 10], relearnSteps: [10], maxIntervalDays: 365, fuzz: false };
  it('new cards go through learning steps', () => {
    const p = preview(newSrs(0), 0, opts);
    expect(p[1].srs.state).toBe('learning');
    expect(p[3].label).toBe('10m');
    expect(p[4].srs.state).toBe('review');
  });
  it('intervals grow with successful reviews and increase in rating order', () => {
    let s = newSrs(0);
    let t = 0;
    s = review(s, 3, t, opts); t += 10 * 60000;
    s = review(s, 3, t, opts);
    expect(s.state).toBe('review');
    const first = s.due - t;
    t = s.due;
    const p = preview(s, t, opts);
    expect(p[2].ms).toBeLessThan(p[3].ms);
    expect(p[3].ms).toBeLessThan(p[4].ms);
    expect(p[3].ms).toBeGreaterThan(first);
    expect(p[1].srs.state).toBe('relearning');
    expect(p[1].srs.lapses).toBe(1);
  });
  it('retrievability is 0.9 at t = S', () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 2);
  });
  it('cloze helpers', () => {
    const t = 'The {{c1::mitochondria}} is the {{c2::powerhouse::role}} of the cell';
    expect(clozeOrdinals(t)).toEqual([1, 2]);
    expect(renderCloze(t, 2, false)).toContain('[role]');
    expect(renderCloze(t, 2, false)).toContain('mitochondria');
  });
});

describe('exam', () => {
  it('parses the bundled Test Book samples', () => {
    for (const f of ['public/samples/atse-sample.json', 'public/samples/atse-full-mock.json']) {
      const p = parseExam(fs.readFileSync(f, 'utf8'));
      expect(p.sections.length).toBeGreaterThan(0);
      expect(p.sections[0].questions.length).toBeGreaterThan(0);
    }
  });
  it('grades with negative marking and round-trips', () => {
    const p = parseExam({
      title: 'T', marking: { correct: 4, incorrect: -1, unanswered: 0 },
      sections: [{ title: 'S', questions: [
        { type: 'mcq', prompt: 'a', options: ['x', 'y'], answer: 1 },
        { type: 'multi', prompt: 'b', options: ['x', 'y', 'z'], answer: [0, 2] },
        { type: 'short', prompt: 'c', answer: ['42', 'forty-two'] },
        { type: 'fill', prompt: 'd', answer: '7' },
        { type: 'written', prompt: 'e' },
      ] }],
    });
    const [q1, q2, q3, q4] = p.sections[0].questions;
    const a = newAttempt(p, 'exam');
    a.answers = { [q1.id]: 1, [q2.id]: [2, 0], [q3.id]: ' Forty-Two. ' };
    const r = gradeAttempt(p, a);
    expect(r).toMatchObject({ correct: 3, incorrect: 0, unanswered: 1, score: 12, maxScore: 16, scored: 4 });
    expect(checkAnswer(q4, '7.0')).toBe(true);
    const again = parseExam(exportExam(p));
    expect(again.sections[0].questions.length).toBe(5);
  });
  it('rejects bad files with helpful errors', () => {
    expect(() => parseExam('nope')).toThrow(/valid JSON/);
    expect(() => parseExam({ sections: [{ questions: [{ type: 'mcq', prompt: 'x', options: ['a'] }] }] })).toThrow(/two options/);
  });
});

describe('streaks', () => {
  it('counts consecutive days including yesterday when today not yet done', () => {
    const t = new Date();
    const days = new Set([1, 2, 3].map((n) => ymd(addDays(t, -n))));
    expect(streaks(days).current).toBe(3);
    days.add(ymd(t));
    expect(streaks(days)).toMatchObject({ current: 4, todayDone: true, best: 4 });
  });
});

import { planRevision } from '../plan';
describe('revision planner', () => {
  it('spreads every topic across the window, respects the daily cap and stays before the exam', () => {
    const plan = planRevision(['A', 'B', 'C', 'D'], '2026-11-01', '2026-11-21', 3, 2, false);
    expect(plan).toHaveLength(12);
    const perDay = new Map<string, number>();
    for (const p of plan) perDay.set(p.date, (perDay.get(p.date) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
    expect(plan.every((p) => p.date >= '2026-11-01' && p.date < '2026-11-21')).toBe(true);
    for (const t of ['A', 'B', 'C', 'D']) {
      const dates = plan.filter((p) => p.topic === t).sort((a, b) => a.round - b.round).map((p) => p.date);
      expect(dates[0] < dates[2]).toBe(true);
    }
  });
  it('skips weekends when asked', () => {
    const plan = planRevision(['A'], '2026-11-20', '2026-11-30', 3, 3, true);
    expect(plan.every((p) => ![0, 6].includes(new Date(p.date + 'T12:00').getDay()))).toBe(true);
  });
});
