import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type {
  Card, CalEvent, ChatThread, ClassSlot, Course, Deck, ExamAttempt, ExamPaper, FocusSession, ID,
  Note, Rating, ReviewLog, Settings, StudyData, Subject, Task,
} from '../types';
import { emptyData, mergeSettings } from './defaults';
import { uid } from '../lib/id';
import { addDaysYmd, parseYmd, today, ymd } from '../lib/dates';
import { clozeOrdinals, newSrs, review as srsReview, seedOf } from '../lib/srs';
import type { ExtractedCard } from '../lib/markdown';

// ---- Debounced IndexedDB storage ----------------------------------------

let pending: { name: string; value: string } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const flush = () => {
  if (!pending) return Promise.resolve();
  const p = pending; pending = null;
  return idbSet(p.name, p.value);
};
export const flushStorage = flush;

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet<string>(name)) ?? null,
  setItem: (name, value) => {
    pending = { name, value };
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void flush(); }, 350);
  },
  removeItem: (name) => idbDel(name),
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void flush(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush(); });
}

// ---- Types ---------------------------------------------------------------

type Collection = Exclude<keyof StudyData, 'settings'>;
type ItemOf<K extends Collection> = StudyData[K] extends (infer T)[] ? T : never;

export interface Store extends StudyData {
  hydrated: boolean;
  set: (fn: (s: StudyData) => Partial<StudyData>) => void;
  upsert: <K extends Collection>(k: K, item: ItemOf<K>) => void;
  patch: <K extends Collection>(k: K, id: ID, p: Partial<ItemOf<K>>) => void;
  remove: <K extends Collection>(k: K, id: ID) => void;
  updateSettings: (p: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => void;

  addSubject: (p: Partial<Subject> & { name: string }) => Subject;
  deleteSubject: (id: ID) => void;

  addTask: (p: Partial<Task> & { title: string }) => Task;
  toggleTask: (id: ID) => void;

  addEvent: (p: Partial<CalEvent> & { title: string; date: string }) => CalEvent;
  addClass: (p: Omit<ClassSlot, 'id'>) => void;

  addNote: (p?: Partial<Note>) => Note;

  addDeck: (p: Partial<Deck> & { name: string }) => Deck;
  deleteDeck: (id: ID) => void;
  addCards: (deckId: ID, cards: ExtractedCard[], extra?: { tags?: string[]; sourceNoteId?: ID }) => number;
  updateCardGroup: (card: Card, front: string, back: string) => void;
  reviewCard: (id: ID, rating: Rating, ms: number) => void;

  logSession: (p: Omit<FocusSession, 'id'>) => void;

  addPaper: (p: ExamPaper) => void;
  saveAttempt: (a: ExamAttempt) => void;

  addCourse: (p: Partial<Course> & { name: string }) => Course;
  saveChat: (t: ChatThread) => void;

  importData: (d: Partial<StudyData>, mode: 'replace' | 'merge') => void;
  resetAll: () => void;
}

const DATA_KEYS: (keyof StudyData)[] = ['subjects', 'tasks', 'events', 'classes', 'notes', 'decks', 'cards', 'reviews', 'sessions', 'papers', 'attempts', 'courses', 'chats', 'parked', 'settings'];

export function pickData(s: StudyData): StudyData {
  const out: any = {};
  for (const k of DATA_KEYS) out[k] = (s as any)[k];
  return out;
}

function nextDue(due: string, recur: NonNullable<Task['recur']>): string {
  let base = due < today() ? today() : due;
  if (recur === 'daily') return addDaysYmd(base, 1);
  if (recur === 'weekly') {
    let n = addDaysYmd(due, 7);
    while (n <= today()) n = addDaysYmd(n, 7);
    return n;
  }
  if (recur === 'weekdays') {
    let n = addDaysYmd(base, 1);
    while ([0, 6].includes(parseYmd(n).getDay())) n = addDaysYmd(n, 1);
    return n;
  }
  const d = parseYmd(due);
  d.setMonth(d.getMonth() + 1);
  return ymd(d);
}

export const useStore = create<Store>()(
  persist(
    (setState, getState) => {
      const set = (fn: (s: StudyData) => Partial<StudyData>) => setState((s) => fn(s) as Partial<Store>);
      return {
        ...emptyData(),
        hydrated: false,
        set,
        upsert: (k, item) => set((s) => {
          const list = s[k] as any[];
          const i = list.findIndex((x) => x.id === (item as any).id);
          const next = i >= 0 ? list.map((x, j) => (j === i ? item : x)) : [...list, item];
          return { [k]: next } as any;
        }),
        patch: (k, id, p) => set((s) => ({ [k]: (s[k] as any[]).map((x) => (x.id === id ? { ...x, ...p } : x)) } as any)),
        remove: (k, id) => set((s) => ({ [k]: (s[k] as any[]).filter((x) => x.id !== id) } as any)),
        updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...(typeof p === 'function' ? p(s.settings) : p) } })),

        addSubject: (p) => {
          const subj: Subject = { id: uid('sub'), color: 'blue', emoji: '📘', createdAt: Date.now(), ...p };
          set((s) => ({ subjects: [...s.subjects, subj] }));
          return subj;
        },
        deleteSubject: (id) => set((s) => {
          const strip = <T extends { subjectId?: ID }>(xs: T[]) => xs.map((x) => (x.subjectId === id ? { ...x, subjectId: undefined } : x));
          return {
            subjects: s.subjects.filter((x) => x.id !== id),
            tasks: strip(s.tasks), events: strip(s.events), classes: strip(s.classes), notes: strip(s.notes),
            decks: strip(s.decks), sessions: strip(s.sessions), papers: strip(s.papers), courses: strip(s.courses),
          };
        }),

        addTask: (p) => {
          const t: Task = {
            id: uid('task'), priority: 0, status: 'todo', subtasks: [], tags: [], createdAt: Date.now(),
            order: Date.now(), ...p,
          };
          set((s) => ({ tasks: [...s.tasks, t] }));
          return t;
        },
        toggleTask: (id) => set((s) => {
          const t = s.tasks.find((x) => x.id === id);
          if (!t) return {};
          if (t.status === 'done') {
            return { tasks: s.tasks.map((x) => (x.id === id ? { ...x, status: 'todo' as const, completedAt: undefined } : x)) };
          }
          const done = { ...t, status: 'done' as const, completedAt: Date.now() };
          const tasks = s.tasks.map((x) => (x.id === id ? done : x));
          if (t.recur && t.due) {
            tasks.push({
              ...t, id: uid('task'), status: 'todo', completedAt: undefined, createdAt: Date.now(),
              due: nextDue(t.due, t.recur), subtasks: t.subtasks.map((st) => ({ ...st, done: false })),
            });
            // the completed instance no longer repeats
            done.recur = null;
          }
          return { tasks };
        }),

        addEvent: (p) => {
          const e: CalEvent = { id: uid('evt'), kind: 'event', createdAt: Date.now(), ...p };
          set((s) => ({ events: [...s.events, e] }));
          return e;
        },
        addClass: (p) => set((s) => ({ classes: [...s.classes, { ...p, id: uid('cls') }] })),

        addNote: (p = {}) => {
          const n: Note = { id: uid('note'), title: '', body: '', tags: [], createdAt: Date.now(), updatedAt: Date.now(), ...p };
          set((s) => ({ notes: [n, ...s.notes] }));
          return n;
        },

        addDeck: (p) => {
          const d: Deck = { id: uid('deck'), createdAt: Date.now(), ...p };
          set((s) => ({ decks: [...s.decks, d] }));
          return d;
        },
        deleteDeck: (id) => set((s) => ({
          decks: s.decks.filter((d) => d.id !== id),
          cards: s.cards.filter((c) => c.deckId !== id),
          reviews: s.reviews.filter((r) => r.deckId !== id),
        })),
        addCards: (deckId, items, extra = {}) => {
          const now = Date.now();
          const created: Card[] = [];
          const existing = new Set(getState().cards.filter((c) => c.deckId === deckId).map((c) => `${c.type}|${c.front.trim()}|${c.ord ?? 0}`));
          for (const it of items) {
            const base = { deckId, tags: extra.tags ?? [], createdAt: now, sourceNoteId: extra.sourceNoteId };
            if (it.type === 'cloze') {
              const ords = clozeOrdinals(it.front);
              const groupId = uid('grp');
              for (const ord of ords) {
                const key = `cloze|${it.front.trim()}|${ord}`;
                if (existing.has(key)) continue;
                created.push({ ...base, id: uid('card'), type: 'cloze', front: it.front, back: it.back, ord, groupId, srs: newSrs(now) });
              }
            } else {
              const key = `basic|${it.front.trim()}|0`;
              if (existing.has(key)) continue;
              const groupId = it.reverse ? uid('grp') : undefined;
              created.push({ ...base, id: uid('card'), type: 'basic', front: it.front, back: it.back, groupId, srs: newSrs(now) });
              if (it.reverse) created.push({ ...base, id: uid('card'), type: 'basic', front: it.back, back: it.front, groupId, srs: newSrs(now + 1) });
            }
          }
          if (created.length) set((s) => ({ cards: [...s.cards, ...created] }));
          return created.length;
        },
        updateCardGroup: (card, front, back) => set((s) => {
          if (card.type === 'cloze' && card.groupId) {
            const siblings = s.cards.filter((c) => c.groupId === card.groupId);
            const ords = clozeOrdinals(front);
            const keep = siblings.filter((c) => ords.includes(c.ord ?? 0)).map((c) => ({ ...c, front, back }));
            const have = new Set(keep.map((c) => c.ord));
            const added: Card[] = ords.filter((o) => !have.has(o)).map((ord) => ({ ...card, id: uid('card'), ord, front, back, srs: newSrs() }));
            return { cards: [...s.cards.filter((c) => c.groupId !== card.groupId), ...keep, ...added] };
          }
          if (card.groupId) {
            return { cards: s.cards.map((c) => (c.id === card.id ? { ...c, front, back } : c.groupId === card.groupId ? { ...c, front: back, back: front } : c)) };
          }
          return { cards: s.cards.map((c) => (c.id === card.id ? { ...c, front, back } : c)) };
        }),
        reviewCard: (id, rating, ms) => set((s) => {
          const card = s.cards.find((c) => c.id === id);
          if (!card) return {};
          const now = Date.now();
          const opts = { ...s.settings.srs, relearnSteps: [10], fuzz: true };
          const srs = srsReview(card.srs, rating, now, opts, seedOf(card.id) + card.srs.reps);
          const log: ReviewLog = {
            id: uid('rev'), cardId: id, deckId: card.deckId, rating, at: now, prevState: card.srs.state,
            elapsedDays: card.srs.lastReview ? (now - card.srs.lastReview) / 86_400_000 : 0, ms,
          };
          return { cards: s.cards.map((c) => (c.id === id ? { ...c, srs } : c)), reviews: [...s.reviews, log] };
        }),

        logSession: (p) => set((s) => ({ sessions: [...s.sessions, { ...p, id: uid('ses') }] })),

        addPaper: (p) => set((s) => ({ papers: [...s.papers, p] })),
        saveAttempt: (a) => set((s) => {
          const i = s.attempts.findIndex((x) => x.id === a.id);
          return { attempts: i >= 0 ? s.attempts.map((x) => (x.id === a.id ? a : x)) : [...s.attempts, a] };
        }),

        addCourse: (p) => {
          const c: Course = { id: uid('crs'), target: 80, credits: 1, assessments: [], createdAt: Date.now(), ...p };
          set((s) => ({ courses: [...s.courses, c] }));
          return c;
        },
        saveChat: (t) => set((s) => {
          const i = s.chats.findIndex((x) => x.id === t.id);
          return { chats: i >= 0 ? s.chats.map((x) => (x.id === t.id ? t : x)) : [t, ...s.chats] };
        }),

        importData: (d, mode) => set((s) => {
          if (mode === 'replace') {
            const base = emptyData();
            return { ...base, ...d, settings: mergeSettings({ ...d.settings, onboarded: true }) };
          }
          const out: any = {};
          for (const k of DATA_KEYS) {
            if (k === 'settings') continue;
            const incoming = (d as any)[k] as { id: string }[] | undefined;
            if (!incoming?.length) continue;
            const have = new Set(((s as any)[k] as { id: string }[]).map((x) => x.id));
            out[k] = [...(s as any)[k], ...incoming.filter((x) => !have.has(x.id))];
          }
          return out;
        }),
        resetAll: () => set(() => emptyData()),
      };
    },
    {
      name: 'studysprint-v4',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => pickData(s),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StudyData>;
        return { ...current, ...p, settings: mergeSettings(p.settings) };
      },
      onRehydrateStorage: () => () => { useStore.setState({ hydrated: true }); },
    },
  ),
);

// convenient selectors
export const useSettings = () => useStore((s) => s.settings);
export const useSubjects = () => useStore((s) => s.subjects);
export const subjectById = (id?: ID) => (id ? useStore.getState().subjects.find((s) => s.id === id) : undefined);
