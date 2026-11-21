export type ID = string;

export interface Subject {
  id: ID;
  name: string;
  color: string; // a palette key, see SUBJECT_COLORS
  emoji: string;
  weeklyGoalMin?: number;
  archived?: boolean;
  createdAt: number;
}

export type Priority = 0 | 1 | 2 | 3; // none, low, medium, high
export type TaskStatus = 'todo' | 'doing' | 'done';
export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly' | null;

export interface Subtask { id: ID; title: string; done: boolean }

export interface Task {
  id: ID;
  title: string;
  subjectId?: ID;
  due?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  priority: Priority;
  status: TaskStatus;
  notes?: string;
  subtasks: Subtask[];
  estimateMin?: number;
  recur?: Recurrence;
  tags: string[];
  createdAt: number;
  completedAt?: number;
  order: number;
}

export type EventKind = 'exam' | 'assignment' | 'event' | 'reminder';

export interface CalEvent {
  id: ID;
  title: string;
  kind: EventKind;
  subjectId?: ID;
  date: string; // YYYY-MM-DD
  time?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  createdAt: number;
}

export interface ClassSlot {
  id: ID;
  subjectId?: ID;
  title?: string;
  day: number; // 0 = Sunday
  start: string; // HH:MM
  end: string;
  room?: string;
  teacher?: string;
  week?: 'A' | 'B' | null;
}

export interface Note {
  id: ID;
  title: string;
  body: string;
  subjectId?: ID;
  tags: string[];
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type CardType = 'basic' | 'cloze';
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface SrsData {
  state: CardState;
  due: number; // epoch ms
  stability: number; // days
  difficulty: number; // 1..10
  reps: number;
  lapses: number;
  step: number;
  lastReview?: number;
}

export interface Card {
  id: ID;
  deckId: ID;
  type: CardType;
  front: string;
  back: string;
  /** cloze ordinal (1-based) when type === 'cloze' */
  ord?: number;
  /** cards created together (reverse pair, cloze siblings) share a group */
  groupId?: ID;
  tags: string[];
  srs: SrsData;
  createdAt: number;
  suspended?: boolean;
  flagged?: boolean;
  sourceNoteId?: ID;
}

export interface Deck {
  id: ID;
  name: string;
  subjectId?: ID;
  description?: string;
  createdAt: number;
}

export type Rating = 1 | 2 | 3 | 4; // again, hard, good, easy

export interface ReviewLog {
  id: ID;
  cardId: ID;
  deckId: ID;
  rating: Rating;
  at: number;
  prevState: CardState;
  elapsedDays: number;
  ms: number;
}

export type SessionKind = 'focus' | 'stopwatch' | 'manual';

export interface FocusSession {
  id: ID;
  start: number;
  end: number;
  minutes: number;
  subjectId?: ID;
  taskId?: ID;
  kind: SessionKind;
  note?: string;
  rating?: number; // 1..5 self-rated focus quality
}

// ---- Practice exams (compatible with Test Book exam file format v2) ----

export type QuestionType = 'mcq' | 'multi' | 'short' | 'written' | 'truefalse';

export interface Marking { correct: number; incorrect: number; unanswered: number }

export interface Question {
  id: ID;
  type: QuestionType;
  prompt: string;
  options?: string[];
  /** mcq/truefalse: index; multi: index[]; short: string | string[] (accepted answers) */
  answer?: number | number[] | string | string[];
  explanation?: string;
  hint?: string;
  domain?: string;
}

export interface ExamSection {
  id: ID;
  title: string;
  durationMinutes?: number;
  marking?: Marking;
  questions: Question[];
}

export interface ExamPaper {
  id: ID;
  title: string;
  examType?: string;
  description?: string;
  durationMinutes?: number;
  marking?: Marking;
  sections: ExamSection[];
  subjectId?: ID;
  source: 'import' | 'builder' | 'sample' | 'ai' | 'deck';
  createdAt: number;
  shuffle?: boolean;
}

export type AnswerValue = number | number[] | string | undefined;

export interface ExamAttempt {
  id: ID;
  paperId: ID;
  paperTitle: string;
  mode: 'exam' | 'practice';
  startedAt: number;
  finishedAt?: number;
  status: 'active' | 'done';
  answers: Record<ID, AnswerValue>;
  flagged: ID[];
  revealed: ID[];
  hintsUsed: ID[];
  timeOnQ: Record<ID, number>; // ms
  elapsedMs: number;
  sectionIdx: number;
  qIdx: number;
  /** self-marked written answers */
  selfMarks: Record<ID, boolean>;
  result?: AttemptResult;
}

export interface AttemptResult {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  scored: number;
  byDomain: Record<string, { correct: number; total: number; ms: number }>;
}

// ---- Grades ----

export interface Assessment {
  id: ID;
  name: string;
  weight: number; // percent of course
  score?: number;
  max: number;
  date?: string;
}

export interface Course {
  id: ID;
  name: string;
  subjectId?: ID;
  target: number; // percent goal
  credits: number;
  assessments: Assessment[];
  createdAt: number;
}

// ---- AI tutor ----

export interface ChatMessage { role: 'user' | 'assistant'; content: string; at: number }
export interface ChatThread { id: ID; title: string; messages: ChatMessage[]; subjectId?: ID; createdAt: number; updatedAt: number }

// ---- Settings ----

export type ModuleId =
  | 'today' | 'planner' | 'calendar' | 'focus' | 'notes' | 'cards'
  | 'practice' | 'grades' | 'insights' | 'tutor';

export type ThemeId = 'light' | 'dark' | 'sepia' | 'midnight' | 'contrast' | 'system';
export type AccentId = 'iris' | 'ocean' | 'teal' | 'forest' | 'amber' | 'coral' | 'rose' | 'grape' | 'slate';
export type FontId = 'inter' | 'atkinson' | 'lexend' | 'dyslexic' | 'serif' | 'system';

export type WidgetId =
  | 'agenda' | 'focus' | 'reviews' | 'countdown' | 'streak'
  | 'nextClass' | 'week' | 'quote' | 'grades' | 'notes';

export interface WidgetPref { id: WidgetId; on: boolean }

export type AmbientId = 'off' | 'rain' | 'brown' | 'pink' | 'white' | 'waves' | 'fire';

export interface Settings {
  name: string;
  level: 'school' | 'college' | 'university' | 'self';
  onboarded: boolean;
  theme: ThemeId;
  accent: AccentId;
  font: FontId;
  serifHeadings: boolean;
  fontScale: number; // 0.9 .. 1.25
  density: 'cozy' | 'compact';
  roundness: 'soft' | 'sharp';
  reduceMotion: boolean;
  weekStart: 0 | 1;
  clock24: boolean;
  modules: Record<ModuleId, boolean>;
  widgets: WidgetPref[];
  focus: {
    work: number; short: number; long: number; longEvery: number;
    autoBreaks: boolean; autoWork: boolean;
    chime: 'bell' | 'soft' | 'digital' | 'none';
    ambient: AmbientId; volume: number;
    dailyGoalMin: number;
    notify: boolean;
  };
  srs: { retention: number; newPerDay: number; maxIntervalDays: number; steps: number[] };
  ai: { key: string; model: string };
  timetableWeeks: boolean; // A/B week rotation
  timetableHours: [number, number];
  gradeScale: 'percent' | 'us4' | 'letter';
  sidebarCollapsed?: boolean;
  lastBackupAt?: number;
}

export interface StudyData {
  subjects: Subject[];
  tasks: Task[];
  events: CalEvent[];
  classes: ClassSlot[];
  notes: Note[];
  decks: Deck[];
  cards: Card[];
  reviews: ReviewLog[];
  sessions: FocusSession[];
  papers: ExamPaper[];
  attempts: ExamAttempt[];
  courses: Course[];
  chats: ChatThread[];
  parked: { id: ID; text: string; at: number }[];
  settings: Settings;
}
