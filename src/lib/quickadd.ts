// Natural-language quick add: "Lab report #chem fri 5pm !high ~45m every week"
import type { Priority, Recurrence, Subject } from '../types';
import { addDays, startOfDay, ymd } from './dates';

export interface Parsed {
  title: string;
  subjectId?: string;
  due?: string;
  dueTime?: string;
  priority: Priority;
  estimateMin?: number;
  recur?: Recurrence;
  tags: string[];
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

function nextWeekday(base: Date, dow: number, forceNext = false): Date {
  let diff = (dow - base.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  if (forceNext) diff += 7;
  return addDays(base, diff);
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

export function matchSubject(token: string, subjects: Subject[]): Subject | undefined {
  const t = norm(token);
  if (!t) return undefined;
  const live = subjects.filter((s) => !s.archived);
  return live.find((s) => norm(s.name) === t)
    ?? live.find((s) => norm(s.name).startsWith(t))
    ?? live.find((s) => norm(s.name).includes(t));
}

export function parseQuickAdd(input: string, subjects: Subject[], now = new Date()): Parsed {
  let text = ` ${input} `;
  const base = startOfDay(now);
  const out: Parsed = { title: '', priority: 0, tags: [] };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = text.match(re);
    if (m && fn(m) !== false) text = text.replace(m[0], ' ');
  };

  // priority
  take(/\s!(high|hi|h|3|!!)\s/i, () => { out.priority = 3; });
  take(/\s!(medium|med|m|2|!)\s/i, () => { out.priority = 2; });
  take(/\s!(low|lo|l|1)\s/i, () => { out.priority = 1; });
  take(/\s!\s/, () => { out.priority = 3; });

  // estimate
  take(/\s~(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)?\s/i, (m) => {
    const n = parseFloat(m[1]);
    out.estimateMin = Math.round(/^h/i.test(m[2] || 'm') ? n * 60 : n);
  });

  // recurrence
  take(new RegExp(`\\s(?:every|each)\\s+${DAY_RE}\\s`, 'i'), (m) => {
    out.recur = 'weekly';
    const dow = DAYS.indexOf(m[1].slice(0, 3).toLowerCase());
    out.due = ymd(addDays(base, (dow - base.getDay() + 7) % 7));
  });
  take(/\s(?:every\s+day|daily|everyday)\s/i, () => { out.recur = 'daily'; });
  take(/\s(?:every\s+weekday|weekdays)\s/i, () => { out.recur = 'weekdays'; });
  take(/\s(?:every\s+week|weekly)\s/i, () => { out.recur = 'weekly'; });
  take(/\s(?:every\s+month|monthly)\s/i, () => { out.recur = 'monthly'; });

  // time
  take(/\s(?:at\s+|@)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s/i, (m) => {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === 'pm') h += 12;
    out.dueTime = `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
  });
  take(/\s(?:at\s+|@)([01]?\d|2[0-3]):([0-5]\d)\s/i, (m) => { out.dueTime = `${m[1].padStart(2, '0')}:${m[2]}`; });
  take(/\s(noon|midday)\s/i, () => { out.dueTime = '12:00'; });

  // dates
  if (!out.due) {
    take(/\s(?:due\s+)?(today|tod|tdy)\s/i, () => { out.due = ymd(base); });
    take(/\s(?:due\s+)?(tonight)\s/i, () => { out.due = ymd(base); out.dueTime ??= '20:00'; });
    take(/\s(?:due\s+)?(tomorrow|tmrw?|tmw)\s/i, () => { out.due = ymd(addDays(base, 1)); });
    take(/\s(?:due\s+)?(?:the\s+)?day\s+after\s+tomorrow\s/i, () => { out.due = ymd(addDays(base, 2)); });
    take(/\sin\s+(\d+)\s*(d|days?|w|wks?|weeks?)\s/i, (m) => {
      const n = Number(m[1]) * (/^w/i.test(m[2]) ? 7 : 1);
      out.due = ymd(addDays(base, n));
    });
    take(/\s(?:due\s+)?next\s+week\s/i, () => { out.due = ymd(nextWeekday(base, 1)); });
    take(new RegExp(`\\s(?:due\\s+|on\\s+|by\\s+)?(next\\s+)?${DAY_RE}\\s`, 'i'), (m) => {
      out.due = ymd(nextWeekday(base, DAYS.indexOf(m[2].slice(0, 3).toLowerCase()), !!m[1]));
    });
    take(/\s(\d{4})-(\d{2})-(\d{2})\s/, (m) => { out.due = `${m[1]}-${m[2]}-${m[3]}`; });
    const fromMonthDay = (mon: string, day: string) => {
      const mi = MONTHS.indexOf(mon.slice(0, 3).toLowerCase());
      let d = new Date(base.getFullYear(), mi, Number(day));
      if (d < base) d = new Date(base.getFullYear() + 1, mi, Number(day));
      out.due = ymd(d);
    };
    take(new RegExp(`\\s(?:on\\s+|by\\s+)?${MON_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s`, 'i'), (m) => fromMonthDay(m[1], m[2]));
    take(new RegExp(`\\s(?:on\\s+|by\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON_RE}\\s`, 'i'), (m) => fromMonthDay(m[2], m[1]));
  }
  if (out.recur && !out.due) out.due = ymd(base);
  if (out.dueTime && !out.due) out.due = ymd(base);

  // subject (#tag matching a subject) and free tags
  for (;;) {
    const m = text.match(/\s#([\p{L}\p{N}_-]+)/u);
    if (!m) break;
    const subj = !out.subjectId ? matchSubject(m[1], subjects) : undefined;
    if (subj) out.subjectId = subj.id;
    else out.tags.push(m[1].toLowerCase());
    text = text.replace(m[0], ' ');
  }

  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}
