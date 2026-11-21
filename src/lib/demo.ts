// Realistic sample data so a new student can explore every feature immediately.
import type { Card, ClassSlot, Course, Deck, FocusSession, Note, ReviewLog, StudyData, Subject, Task, CalEvent } from '../types';
import { addDays, startOfDay, ymd } from './dates';
import { uid } from './id';
import { newSrs } from './srs';

const DAY = 86_400_000;

export function demoData(): Partial<StudyData> {
  const now = Date.now();
  const t0 = startOfDay();
  const d = (n: number) => ymd(addDays(t0, n));
  const mk = (name: string, emoji: string, color: string, weeklyGoalMin: number): Subject => ({ id: uid('sub'), name, emoji, color, weeklyGoalMin, createdAt: now });
  const math = mk('Mathematics', '📐', 'blue', 300);
  const bio = mk('Biology', '🧬', 'green', 240);
  const chem = mk('Chemistry', '🧪', 'teal', 240);
  const hist = mk('History', '🏛️', 'amber', 180);
  const eng = mk('English', '📚', 'violet', 180);
  const subjects = [math, bio, chem, hist, eng];

  let order = 0;
  const task = (title: string, s: Subject, due: number | null, priority: Task['priority'], extra: Partial<Task> = {}): Task => ({
    id: uid('task'), title, subjectId: s.id, due: due === null ? undefined : d(due), priority, status: 'todo',
    subtasks: [], tags: [], createdAt: now - 5 * DAY, order: order++, ...extra,
  });
  const tasks: Task[] = [
    task('Finish quadratic equations worksheet', math, 0, 3, { estimateMin: 40, subtasks: [{ id: uid('st'), title: 'Section A', done: true }, { id: uid('st'), title: 'Section B', done: false }, { id: uid('st'), title: 'Check answers', done: false }] }),
    task('Read Chapter 7: Photosynthesis', bio, 0, 2, { estimateMin: 30 }),
    task('Review flashcards', bio, 0, 1, { recur: 'daily', estimateMin: 15 }),
    task('Draft essay introduction — Macbeth ambition', eng, 1, 3, { estimateMin: 60, dueTime: '20:00' }),
    task('Balance redox equations practice set', chem, 2, 2, { estimateMin: 45 }),
    task('Make timeline of causes of WW1', hist, 3, 2, { estimateMin: 50 }),
    task('Past paper: 2024 Paper 1', math, 5, 3, { estimateMin: 90 }),
    task('Lab report: enzyme activity', bio, -1, 3, { estimateMin: 60 }),
    task('Vocabulary list for poetry unit', eng, 6, 1),
    task('Organise chemistry notes', chem, null, 0),
    task('Watch documentary on the Cold War', hist, null, 1),
    task('Simultaneous equations exercise 4B', math, -3, 2, { status: 'done', completedAt: now - 3 * DAY }),
    task('Cell structure diagram', bio, -2, 2, { status: 'done', completedAt: now - 2 * DAY }),
    task('Read Act 1 of Macbeth', eng, -4, 2, { status: 'done', completedAt: now - 4 * DAY }),
  ];

  const evt = (title: string, kind: CalEvent['kind'], s: Subject, n: number, time?: string, location?: string): CalEvent => ({ id: uid('evt'), title, kind, subjectId: s.id, date: d(n), time, location, createdAt: now });
  const events: CalEvent[] = [
    evt('Chemistry unit test', 'exam', chem, 9, '09:00', 'Hall B'),
    evt('Biology essay due', 'assignment', bio, 4, '23:59'),
    evt('History source analysis test', 'exam', hist, 16, '11:00', 'Room 12'),
    evt('Maths mock exam', 'exam', math, 23, '09:00', 'Main hall'),
    evt('English presentation', 'assignment', eng, 11, '13:30'),
  ];

  const cls = (s: Subject, day: number, start: string, end: string, room: string, teacher: string): ClassSlot => ({ id: uid('cls'), subjectId: s.id, day, start, end, room, teacher });
  const classes: ClassSlot[] = [
    cls(math, 1, '09:00', '10:00', 'M4', 'Mr. Okafor'), cls(bio, 1, '10:15', '11:15', 'Lab 2', 'Dr. Chen'), cls(eng, 1, '13:00', '14:00', 'E1', 'Ms. Patel'),
    cls(chem, 2, '09:00', '10:30', 'Lab 1', 'Mrs. Novak'), cls(hist, 2, '11:00', '12:00', 'H3', 'Mr. Silva'), cls(math, 2, '14:00', '15:00', 'M4', 'Mr. Okafor'),
    cls(bio, 3, '09:00', '10:00', 'Lab 2', 'Dr. Chen'), cls(eng, 3, '10:15', '11:15', 'E1', 'Ms. Patel'), cls(math, 3, '13:00', '14:00', 'M4', 'Mr. Okafor'),
    cls(hist, 4, '09:00', '10:00', 'H3', 'Mr. Silva'), cls(chem, 4, '10:15', '11:45', 'Lab 1', 'Mrs. Novak'), cls(eng, 4, '13:00', '14:00', 'E1', 'Ms. Patel'),
    cls(math, 5, '09:00', '10:00', 'M4', 'Mr. Okafor'), cls(bio, 5, '10:15', '11:15', 'Lab 2', 'Dr. Chen'), cls(hist, 5, '13:00', '14:00', 'H3', 'Mr. Silva'),
  ];

  const note = (title: string, s: Subject, body: string, ago: number, pinned = false): Note => ({ id: uid('note'), title, subjectId: s.id, body, tags: [], pinned, createdAt: now - ago * DAY, updatedAt: now - ago * DAY + 3600_000 });
  const notes: Note[] = [
    note('Photosynthesis', bio, `## Overview
Photosynthesis converts light energy into chemical energy stored in **glucose**.

$$6CO_2 + 6H_2O \\xrightarrow{light} C_6H_{12}O_6 + 6O_2$$

### Two stages
1. **Light-dependent reactions** — in the thylakoid membranes. Water is split (photolysis), releasing $O_2$; ATP and NADPH are made.
2. **Calvin cycle** — in the stroma. $CO_2$ is fixed by the enzyme RuBisCO to make glucose.

### Limiting factors
- Light intensity
- $CO_2$ concentration
- Temperature (enzymes!)

> Tip: link this to [[Cell structure]] — chloroplasts are where it all happens.

## Flashcards
Where do the light-dependent reactions happen? :: Thylakoid membranes of the chloroplast
Where does the Calvin cycle happen? :: The stroma of the chloroplast
The enzyme that fixes carbon dioxide is {{c1::RuBisCO}}.
Photolysis :: The splitting of water using light energy, releasing oxygen`, 2, true),
    note('Cell structure', bio, `## Eukaryotic cell organelles
| Organelle | Function |
|---|---|
| Nucleus | Contains DNA, controls the cell |
| Mitochondria | Aerobic respiration — releases energy |
| Ribosomes | Protein synthesis |
| Chloroplasts | Photosynthesis (plants only) |

Mitochondria ::: Site of aerobic respiration
Ribosome ::: Site of protein synthesis`, 6),
    note('Quadratics — key methods', math, `## Solving $ax^2 + bx + c = 0$

**Quadratic formula**
$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

The **discriminant** $\\Delta = b^2 - 4ac$ tells you how many real roots:
- $\\Delta > 0$: two real roots
- $\\Delta = 0$: one repeated root
- $\\Delta < 0$: no real roots

- [x] Factorising
- [x] Completing the square
- [ ] Graph sketching from vertex form

The discriminant of a quadratic is {{c1::$b^2 - 4ac$}}.`, 1, true),
    note('Causes of WW1 — MAIN', hist, `Remember **MAIN**: Militarism, Alliances, Imperialism, Nationalism. The trigger was the assassination of Archduke Franz Ferdinand (28 June 1914).

MAIN causes of WW1 :: Militarism, Alliances, Imperialism, Nationalism
Date of Franz Ferdinand's assassination :: 28 June 1914`, 4),
  ];

  // Decks with realistic review history
  const deck = (name: string, s: Subject, description: string): Deck => ({ id: uid('deck'), name, subjectId: s.id, description, createdAt: now - 30 * DAY });
  const dBio = deck('Cell biology', bio, 'Organelles, transport and respiration');
  const dChem = deck('Chemistry essentials', chem, 'Atomic structure, bonding and reactions');
  const dHist = deck('20th century dates', hist, 'Key events and their dates');
  const decks = [dBio, dChem, dHist];
  const cards: Card[] = [];
  const reviews: ReviewLog[] = [];
  const add = (deckId: string, front: string, back: string, history: number, type: Card['type'] = 'basic', ord?: number) => {
    const c: Card = { id: uid('card'), deckId, type, front, back, ord, tags: [], createdAt: now - 25 * DAY, srs: newSrs(now) };
    if (history > 0) {
      const stability = 1 + history * 2.5;
      const last = now - Math.round(Math.random() * Math.min(stability, 6)) * DAY - 3600_000;
      c.srs = { state: 'review', due: Math.random() < 0.45 ? now - 3600_000 : last + stability * DAY, stability, difficulty: 4 + Math.random() * 3, reps: history + 1, lapses: Math.random() < 0.2 ? 1 : 0, step: 0, lastReview: last };
      for (let i = 0; i < history + 1; i++) {
        const at = now - (24 - i * 5) * DAY + Math.random() * DAY;
        reviews.push({ id: uid('rev'), cardId: c.id, deckId, rating: (Math.random() < 0.13 ? 1 : Math.random() < 0.15 ? 2 : 3) as ReviewLog['rating'], at: Math.min(at, now - DAY), prevState: i === 0 ? 'new' : 'review', elapsedDays: i * 5, ms: 4000 + Math.random() * 6000 });
      }
    }
    cards.push(c);
  };
  [
    ['What is the function of the mitochondria?', 'Site of aerobic respiration — releases energy as ATP', 3],
    ['What is the function of ribosomes?', 'Protein synthesis', 3],
    ['Define diffusion', 'Net movement of particles from high to low concentration', 2],
    ['Define osmosis', 'Diffusion of water across a partially permeable membrane, from dilute to concentrated solution', 2],
    ['What is active transport?', 'Movement against a concentration gradient using energy from respiration', 1],
    ['Word equation for aerobic respiration', 'glucose + oxygen → carbon dioxide + water', 2],
    ['What does the cell membrane do?', 'Controls what enters and leaves the cell', 1],
    ['Name 3 structures found in plant cells but not animal cells', 'Cell wall, chloroplasts, permanent vacuole', 0],
    ['What is a stem cell?', 'An undifferentiated cell that can divide and become many cell types', 0],
    ['Where is DNA found in a prokaryotic cell?', 'Free in the cytoplasm (single loop) and in plasmids', 0],
  ].forEach(([f, b, h]) => add(dBio.id, f as string, b as string, h as number));
  [
    ['Relative charge of an electron', '−1', 3], ['Relative mass of a proton', '1', 3],
    ['What is an isotope?', 'Atoms of the same element with different numbers of neutrons', 2],
    ['Ionic bonding happens between…', 'A metal and a non-metal (electrons transferred)', 1],
    ['Covalent bonding happens between…', 'Non-metals (electrons shared)', 1],
    ['OIL RIG stands for', 'Oxidation Is Loss, Reduction Is Gain (of electrons)', 0],
    ['pH of a neutral solution', '7', 0],
  ].forEach(([f, b, h]) => add(dChem.id, f as string, b as string, h as number));
  add(dChem.id, 'Avogadro’s constant is {{c1::$6.02 \\times 10^{23}$}} particles per mole.', '', 0, 'cloze', 1);
  [
    ['Start of World War I', '1914', 2], ['End of World War II', '1945', 2], ['Fall of the Berlin Wall', '1989', 1],
    ['Russian Revolution', '1917', 0], ['Moon landing', '1969', 0], ['Treaty of Versailles signed', '1919', 0],
  ].forEach(([f, b, h]) => add(dHist.id, f as string, b as string, h as number));

  // Focus history over ~10 weeks, more on weekdays, ramping up toward exams
  const sessions: FocusSession[] = [];
  for (let back = 70; back >= 0; back--) {
    const day = addDays(t0, -back);
    const dow = day.getDay();
    const p = (dow === 0 || dow === 6 ? 0.45 : 0.78) + (70 - back) / 400;
    if (back === 0 || Math.random() > p) continue;
    const n = 1 + Math.floor(Math.random() * (back < 21 ? 4 : 3));
    let cursor = day.getTime() + (16 + Math.random() * 2) * 3600_000;
    for (let i = 0; i < n; i++) {
      const minutes = [25, 25, 25, 50, 45, 30][Math.floor(Math.random() * 6)];
      const s = subjects[Math.floor(Math.random() * subjects.length)];
      sessions.push({ id: uid('ses'), start: cursor, end: cursor + minutes * 60000, minutes, subjectId: s.id, kind: 'focus' });
      cursor += (minutes + 8) * 60000;
    }
  }
  sessions.push({ id: uid('ses'), start: now - 3 * 3600_000, end: now - 3 * 3600_000 + 25 * 60000, minutes: 25, subjectId: math.id, kind: 'focus', note: 'Quadratics worksheet' });

  const assess = (name: string, weight: number, score: number | undefined, max: number, ago?: number) => ({ id: uid('as'), name, weight, score, max, date: ago !== undefined ? d(-ago) : undefined });
  const courses: Course[] = [
    { id: uid('crs'), name: 'Mathematics', subjectId: math.id, target: 85, credits: 1, createdAt: now, assessments: [assess('Algebra test', 15, 42, 50, 40), assess('Coursework', 20, 78, 100, 20), assess('Mock exam', 25, undefined, 100), assess('Final exam', 40, undefined, 100)] },
    { id: uid('crs'), name: 'Biology', subjectId: bio.id, target: 80, credits: 1, createdAt: now, assessments: [assess('Cells quiz', 10, 17, 20, 30), assess('Lab practical', 20, 31, 40, 12), assess('Essay', 20, undefined, 50), assess('Final exam', 50, undefined, 100)] },
    { id: uid('crs'), name: 'History', subjectId: hist.id, target: 75, credits: 1, createdAt: now, assessments: [assess('Source analysis', 25, 19, 30, 18), assess('Research project', 25, 68, 100, 6), assess('Final exam', 50, undefined, 100)] },
  ];

  return { subjects, tasks, events, classes, notes, decks, cards, reviews, sessions, courses };
}
