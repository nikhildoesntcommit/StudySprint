import type { ModuleId, Settings, StudyData, WidgetId } from '../types';

export const SUBJECT_COLORS: Record<string, { label: string; hex: string }> = {
  red: { label: 'Red', hex: '#e5484d' },
  orange: { label: 'Orange', hex: '#f76b15' },
  amber: { label: 'Amber', hex: '#e2a336' },
  lime: { label: 'Lime', hex: '#7cb342' },
  green: { label: 'Green', hex: '#30a46c' },
  teal: { label: 'Teal', hex: '#12a594' },
  cyan: { label: 'Cyan', hex: '#05a2c2' },
  blue: { label: 'Blue', hex: '#3e63dd' },
  indigo: { label: 'Indigo', hex: '#5b5bd6' },
  violet: { label: 'Violet', hex: '#8e4ec6' },
  pink: { label: 'Pink', hex: '#d6409f' },
  brown: { label: 'Brown', hex: '#a07553' },
  gray: { label: 'Gray', hex: '#8b8d98' },
};

export const subjectHex = (color?: string) => SUBJECT_COLORS[color ?? 'gray']?.hex ?? color ?? '#8b8d98';

export const SUBJECT_PRESETS: { name: string; emoji: string; color: string }[] = [
  { name: 'Mathematics', emoji: '📐', color: 'blue' },
  { name: 'Physics', emoji: '⚛️', color: 'indigo' },
  { name: 'Chemistry', emoji: '🧪', color: 'teal' },
  { name: 'Biology', emoji: '🧬', color: 'green' },
  { name: 'English', emoji: '📚', color: 'violet' },
  { name: 'History', emoji: '🏛️', color: 'amber' },
  { name: 'Geography', emoji: '🌍', color: 'cyan' },
  { name: 'Computer Science', emoji: '💻', color: 'gray' },
  { name: 'Economics', emoji: '📈', color: 'lime' },
  { name: 'Languages', emoji: '🗣️', color: 'pink' },
  { name: 'Art', emoji: '🎨', color: 'orange' },
  { name: 'Music', emoji: '🎵', color: 'red' },
  { name: 'Psychology', emoji: '🧠', color: 'pink' },
  { name: 'Business', emoji: '💼', color: 'brown' },
  { name: 'Science', emoji: '🔬', color: 'teal' },
  { name: 'Literature', emoji: '✒️', color: 'violet' },
];

export const MODULES: { id: ModuleId; label: string; blurb: string; core?: boolean }[] = [
  { id: 'today', label: 'Today', blurb: 'Your daily dashboard', core: true },
  { id: 'planner', label: 'Planner', blurb: 'Tasks, homework and to-dos' },
  { id: 'calendar', label: 'Calendar', blurb: 'Exams, deadlines and class timetable' },
  { id: 'focus', label: 'Focus', blurb: 'Pomodoro timer with ambient sound' },
  { id: 'notes', label: 'Notes', blurb: 'Markdown notes with maths support' },
  { id: 'cards', label: 'Flashcards', blurb: 'Spaced repetition that adapts to you' },
  { id: 'practice', label: 'Practice', blurb: 'Timed mock exams and quizzes' },
  { id: 'grades', label: 'Grades', blurb: 'Track marks and what you need' },
  { id: 'insights', label: 'Insights', blurb: 'Study analytics and streaks' },
  { id: 'tutor', label: 'AI Tutor', blurb: 'Explain, quiz and generate (bring your own key)' },
];

export const WIDGETS: { id: WidgetId; label: string; blurb: string }[] = [
  { id: 'agenda', label: 'Agenda', blurb: 'Tasks due today and overdue' },
  { id: 'focus', label: 'Focus goal', blurb: 'Progress toward today’s focus goal' },
  { id: 'reviews', label: 'Reviews due', blurb: 'Flashcards waiting for you' },
  { id: 'countdown', label: 'Countdowns', blurb: 'Upcoming exams and deadlines' },
  { id: 'nextClass', label: 'Classes today', blurb: 'From your timetable' },
  { id: 'streak', label: 'Streak', blurb: 'Consecutive study days' },
  { id: 'week', label: 'This week', blurb: 'Study minutes per day' },
  { id: 'grades', label: 'Grades', blurb: 'Course averages at a glance' },
  { id: 'notes', label: 'Recent notes', blurb: 'Jump back into notes' },
  { id: 'quote', label: 'Study tip', blurb: 'An evidence-based study tip' },
];

export const STYLE_REV = 1;

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  level: 'school',
  onboarded: false,
  theme: 'system',
  accent: 'rust',
  font: 'inter',
  serifHeadings: true,
  fontScale: 1,
  density: 'cozy',
  roundness: 'sharp',
  styleRev: STYLE_REV,
  reduceMotion: false,
  weekStart: 1,
  clock24: false,
  modules: { today: true, planner: true, calendar: true, focus: true, notes: true, cards: true, practice: true, grades: true, insights: true, tutor: true },
  widgets: WIDGETS.map((w) => ({ id: w.id, on: w.id !== 'notes' })),
  focus: {
    work: 25, short: 5, long: 15, longEvery: 4,
    autoBreaks: true, autoWork: false,
    chime: 'bell', ambient: 'off', volume: 0.5,
    dailyGoalMin: 120, notify: false,
  },
  srs: { retention: 0.9, newPerDay: 20, maxIntervalDays: 365, steps: [1, 10] },
  ai: { key: '', model: 'claude-opus-5-5' },
  timetableWeeks: false,
  timetableHours: [8, 18],
  gradeScale: 'percent',
};

export function emptyData(): StudyData {
  return {
    subjects: [], tasks: [], events: [], classes: [], notes: [], decks: [], cards: [],
    reviews: [], sessions: [], papers: [], attempts: [], courses: [], chats: [], parked: [],
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

/** Merge persisted settings with defaults so new options get sane values after upgrades. */
export function mergeSettings(s: Partial<Settings> | undefined): Settings {
  const d = structuredClone(DEFAULT_SETTINGS);
  if (!s) return d;
  if ((s.styleRev ?? 0) < STYLE_REV) {
    // v4.1 brought back the paper & ink look: move v4.0's light/dark onto it once.
    const theme = s.theme === 'light' ? 'paper' : s.theme === 'dark' ? 'ink' : s.theme;
    s = { ...s, theme, accent: 'rust', roundness: 'sharp', styleRev: STYLE_REV };
  }
  const widgets = [...(s.widgets ?? [])].filter((w) => d.widgets.some((x) => x.id === w.id));
  for (const w of d.widgets) if (!widgets.some((x) => x.id === w.id)) widgets.push(w);
  return {
    ...d, ...s,
    modules: { ...d.modules, ...(s.modules ?? {}) },
    focus: { ...d.focus, ...(s.focus ?? {}) },
    srs: { ...d.srs, ...(s.srs ?? {}) },
    ai: { ...d.ai, ...(s.ai ?? {}) },
    widgets,
  };
}

export const STUDY_TIPS: { title: string; body: string }[] = [
  { title: 'Test yourself, don’t re-read', body: 'Retrieval practice — recalling without looking — beats re-reading for long-term memory. Close the book and write what you remember.' },
  { title: 'Space it out', body: 'Spreading study over days beats cramming the same hours into one night. Your flashcards are scheduled to do exactly this.' },
  { title: 'Interleave topics', body: 'Mixing problem types in one session feels harder but improves your ability to pick the right method in an exam.' },
  { title: 'Explain it simply', body: 'If you can explain a concept to a 12-year-old, you understand it. If you can’t, you’ve found exactly what to study next.' },
  { title: 'Sleep is study', body: 'Memories consolidate during sleep. An all-nighter before an exam trades long-term memory for short-term panic.' },
  { title: 'Make it concrete', body: 'Pair every abstract idea with a specific example. Examples are the hooks memory hangs ideas on.' },
  { title: 'Phone in another room', body: 'Even a silent phone on your desk reduces working memory. Distance beats willpower.' },
  { title: 'Start with five minutes', body: 'Procrastinating? Commit to just five minutes. Starting is the hardest part; momentum does the rest.' },
  { title: 'Review your mistakes', body: 'Every wrong answer is a free lesson. Practice mode sends missed questions straight to your flashcards.' },
  { title: 'Dual coding', body: 'Combine words with visuals — sketch a diagram, timeline or flowchart alongside your notes.' },
  { title: 'Elaborate', body: 'Ask “why?” and “how?” about facts and connect them to what you already know. Connected ideas are easier to recall.' },
  { title: 'Take real breaks', body: 'Short breaks away from screens restore attention. A walk beats scrolling.' },
];
