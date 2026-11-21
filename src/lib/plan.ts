import { addDaysYmd, parseYmd } from './dates';

/** Spread revision sessions for each topic across the days before an exam, using expanding gaps that end close to the exam. */
export function planRevision(topics: string[], start: string, examDate: string, sessionsPerTopic: number, maxPerDay: number, skipWeekends: boolean): { topic: string; date: string; round: number }[] {
  const days: string[] = [];
  for (let d = start; d < examDate; d = addDaysYmd(d, 1)) {
    const dow = parseYmd(d).getDay();
    if (skipWeekends && (dow === 0 || dow === 6)) continue;
    days.push(d);
  }
  if (!days.length) return [];
  const load = new Map<string, number>();
  const out: { topic: string; date: string; round: number }[] = [];
  const n = days.length;
  const T = Math.max(1, topics.length);
  topics.forEach((topic, ti) => {
    // first pass staggered across the first 40% of the window; final review in the last ~15%
    const first = (ti / T) * 0.4;
    const last = 0.85 + (ti / T) * 0.13;
    for (let r = 0; r < sessionsPerTopic; r++) {
      const frac = sessionsPerTopic === 1 ? first : first + (last - first) * Math.pow(r / (sessionsPerTopic - 1), 0.8);
      let i = Math.min(n - 1, Math.round(frac * (n - 1)));
      // find nearest day with capacity
      for (let k = 0; k < n; k++) {
        const cand = [i + k, i - k].find((x) => x >= 0 && x < n && (load.get(days[x]) ?? 0) < maxPerDay);
        if (cand !== undefined) { i = cand; break; }
      }
      load.set(days[i], (load.get(days[i]) ?? 0) + 1);
      out.push({ topic, date: days[i], round: r + 1 });
    }
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
