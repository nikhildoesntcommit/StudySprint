// Practice exam format. Accepts the Test Book exam file format v2 (and a few
// friendly variations), normalises it, and grades attempts.
import type { AnswerValue, AttemptResult, Card, ExamAttempt, ExamPaper, ExamSection, Marking, Question, QuestionType } from '../types';
import { shuffle, uid } from './id';

export const DEFAULT_MARKING: Marking = { correct: 1, incorrect: 0, unanswered: 0 };

const TYPES: QuestionType[] = ['mcq', 'multi', 'short', 'written', 'truefalse'];

function toMarking(m: any): Marking | undefined {
  if (!m || typeof m !== 'object') return undefined;
  return {
    correct: Number.isFinite(+m.correct) ? +m.correct : 1,
    incorrect: Number.isFinite(+m.incorrect) ? +m.incorrect : 0,
    unanswered: Number.isFinite(+m.unanswered) ? +m.unanswered : 0,
  };
}

function letterToIndex(v: any, options?: string[]): any {
  if (typeof v === 'string' && /^[A-Za-z]$/.test(v) && options && options.length <= 26) return v.toUpperCase().charCodeAt(0) - 65;
  if (typeof v === 'string' && options) {
    const i = options.findIndex((o) => o.trim().toLowerCase() === v.trim().toLowerCase());
    if (i >= 0) return i;
  }
  return v;
}

function normQuestion(q: any, i: number): Question {
  if (!q || typeof q !== 'object') throw new Error(`Question ${i + 1} is not an object.`);
  const prompt = String(q.prompt ?? q.question ?? q.text ?? '').trim();
  if (!prompt) throw new Error(`Question ${i + 1} needs a "prompt".`);
  let type = String(q.type ?? (Array.isArray(q.options) ? 'mcq' : 'short')).toLowerCase() as QuestionType;
  if ((type as string) === 'fill') type = 'short';
  if ((type as string) === 'tf' || (type as string) === 'boolean') type = 'truefalse';
  if (!TYPES.includes(type)) throw new Error(`Question ${i + 1} has unknown type "${q.type}".`);
  let options: string[] | undefined = Array.isArray(q.options) ? q.options.map(String) : undefined;
  if (type === 'truefalse') options = ['True', 'False'];
  if ((type === 'mcq' || type === 'multi') && (!options || options.length < 2)) throw new Error(`Question ${i + 1} needs at least two options.`);
  let answer: Question['answer'] = q.answer;
  if (type === 'mcq') answer = Number(letterToIndex(q.answer, options));
  if (type === 'truefalse') answer = typeof q.answer === 'boolean' ? (q.answer ? 0 : 1) : Number(letterToIndex(q.answer, options));
  if (type === 'multi') answer = (Array.isArray(q.answer) ? q.answer : [q.answer]).map((a: any) => Number(letterToIndex(a, options)));
  if (type === 'short') answer = Array.isArray(q.answer) ? q.answer.map(String) : q.answer != null ? String(q.answer) : undefined;
  if (type === 'written') answer = q.answer != null ? String(q.answer) : undefined;
  return {
    id: String(q.id ?? uid('q')),
    type, prompt, options, answer,
    explanation: q.explanation ? String(q.explanation) : undefined,
    hint: q.hint ? String(q.hint) : undefined,
    domain: q.domain ? String(q.domain) : q.topic ? String(q.topic) : undefined,
  };
}

/** Parse an exam file (Test Book v2, or a bare array of questions). Throws with a friendly message. */
export function parseExam(raw: unknown, source: ExamPaper['source'] = 'import'): ExamPaper {
  let data: any = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { throw new Error('That file is not valid JSON.'); }
  }
  if (Array.isArray(data)) data = { title: 'Imported questions', sections: [{ title: 'Questions', questions: data }] };
  if (!data || typeof data !== 'object') throw new Error('The exam file is empty.');
  let sectionsRaw: any[] = Array.isArray(data.sections) ? data.sections : [];
  if (!sectionsRaw.length && Array.isArray(data.questions)) sectionsRaw = [{ title: 'Questions', questions: data.questions }];
  if (!sectionsRaw.length) throw new Error('The exam needs at least one section with questions.');
  let count = 0;
  const sections: ExamSection[] = sectionsRaw.map((s: any, si: number) => {
    const qs = Array.isArray(s?.questions) ? s.questions : [];
    if (!qs.length) throw new Error(`Section ${si + 1} has no questions.`);
    return {
      id: String(s.id ?? uid('sec')),
      title: String(s.title ?? `Section ${si + 1}`),
      durationMinutes: Number(s.durationMinutes) > 0 ? Number(s.durationMinutes) : undefined,
      marking: toMarking(s.marking),
      questions: qs.map((q: any) => normQuestion(q, count++)),
    };
  });
  let marking = toMarking(data.marking);
  if (!marking && data.rules?.negativeMarking === false) marking = undefined;
  return {
    id: uid('paper'),
    title: String(data.title ?? 'Untitled exam'),
    examType: data.examType ? String(data.examType) : undefined,
    description: data.description ? String(data.description) : undefined,
    durationMinutes: Number(data.durationMinutes) > 0 ? Number(data.durationMinutes) : sections.reduce((a, s) => a + (s.durationMinutes ?? 0), 0) || undefined,
    marking,
    sections,
    source,
    createdAt: Date.now(),
  };
}

/** Serialise a paper back to the portable Test Book v2 format. */
export function exportExam(p: ExamPaper): string {
  return JSON.stringify({
    title: p.title,
    examType: p.examType ?? 'Custom',
    description: p.description,
    durationMinutes: p.durationMinutes,
    marking: p.marking,
    sections: p.sections.map((s) => ({
      title: s.title,
      durationMinutes: s.durationMinutes,
      marking: s.marking,
      questions: s.questions.map(({ id: _id, ...q }) => q),
    })),
  }, null, 2);
}

export function allQuestions(p: ExamPaper): { q: Question; section: ExamSection; si: number; qi: number }[] {
  return p.sections.flatMap((section, si) => section.questions.map((q, qi) => ({ q, section, si, qi })));
}

export function questionCount(p: ExamPaper) {
  return p.sections.reduce((a, s) => a + s.questions.length, 0);
}

export function isAnswered(v: AnswerValue): boolean {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

function normText(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?'"`]+$/g, '');
}

/** true = correct, false = wrong, null = not auto-markable */
export function checkAnswer(q: Question, v: AnswerValue): boolean | null {
  if (q.type === 'written' || (q.type === 'short' && q.answer == null)) return null;
  if (!isAnswered(v)) return false;
  switch (q.type) {
    case 'mcq':
    case 'truefalse':
      return Number(v) === Number(q.answer);
    case 'multi': {
      const want = new Set((q.answer as number[]) ?? []);
      const got = new Set(v as number[]);
      return want.size === got.size && [...want].every((x) => got.has(x));
    }
    case 'short': {
      if (q.answer == null) return null;
      const accepted = (Array.isArray(q.answer) ? q.answer : [q.answer]).map((a) => normText(String(a)));
      const given = normText(String(v));
      const asNum = (s: string) => (/^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN);
      return accepted.some((a) => a === given || (!Number.isNaN(asNum(a)) && asNum(a) === asNum(given)));
    }
  }
}

export function formatAnswer(q: Question): string {
  if (q.answer == null) return '—';
  if (q.type === 'mcq' || q.type === 'truefalse') return q.options?.[Number(q.answer)] ?? String(q.answer);
  if (q.type === 'multi') return (q.answer as number[]).map((i) => q.options?.[i]).join(', ');
  if (Array.isArray(q.answer)) return q.answer.join(' / ');
  return String(q.answer);
}

export function gradeAttempt(p: ExamPaper, a: ExamAttempt): AttemptResult {
  const res: AttemptResult = { score: 0, maxScore: 0, correct: 0, incorrect: 0, unanswered: 0, scored: 0, byDomain: {} };
  for (const { q, section } of allQuestions(p)) {
    const m = section.marking ?? p.marking ?? DEFAULT_MARKING;
    const v = a.answers[q.id];
    let ok = checkAnswer(q, v);
    if (ok === null && q.id in a.selfMarks) ok = a.selfMarks[q.id];
    if (ok === null) continue;
    res.scored++;
    res.maxScore += m.correct;
    const dom = q.domain || section.title;
    res.byDomain[dom] ??= { correct: 0, total: 0, ms: 0 };
    res.byDomain[dom].total++;
    res.byDomain[dom].ms += a.timeOnQ[q.id] ?? 0;
    if (!isAnswered(v)) { res.unanswered++; res.score += m.unanswered; }
    else if (ok) { res.correct++; res.score += m.correct; res.byDomain[dom].correct++; }
    else { res.incorrect++; res.score += m.incorrect; }
  }
  return res;
}

export function newAttempt(p: ExamPaper, mode: ExamAttempt['mode']): ExamAttempt {
  return {
    id: uid('att'), paperId: p.id, paperTitle: p.title, mode,
    startedAt: Date.now(), status: 'active',
    answers: {}, flagged: [], revealed: [], hintsUsed: [], timeOnQ: {}, selfMarks: {},
    elapsedMs: 0, sectionIdx: 0, qIdx: 0,
  };
}

/** Build a multiple-choice quiz from a flashcard deck, using other cards' answers as distractors. */
export function quizFromCards(title: string, cards: Card[], n = 20): ExamPaper | null {
  const basics = cards.filter((c) => c.type === 'basic' && c.front.trim() && c.back.trim());
  const uniqueBacks = [...new Set(basics.map((c) => c.back.trim()))];
  if (basics.length < 4 || uniqueBacks.length < 4) return null;
  const picked = shuffle(basics).slice(0, Math.min(n, basics.length));
  const questions: Question[] = picked.map((c) => {
    const distractors = shuffle(uniqueBacks.filter((b) => b !== c.back.trim())).slice(0, 3);
    const options = shuffle([c.back.trim(), ...distractors]);
    return { id: uid('q'), type: 'mcq', prompt: c.front, options, answer: options.indexOf(c.back.trim()), domain: c.tags[0] };
  });
  return {
    id: uid('paper'), title, examType: 'Deck quiz', source: 'deck', createdAt: Date.now(),
    durationMinutes: Math.max(5, Math.round(questions.length * 0.75)),
    sections: [{ id: uid('sec'), title: 'Quiz', questions }],
  };
}

export const SAMPLE_PAPERS = [
  { file: 'samples/atse-sample.json', title: 'ATSE Sample Test', blurb: 'A short 30-minute taster paper.' },
  { file: 'samples/atse-full-mock.json', title: 'ATSE Full Syllabus Mock Test 1', blurb: 'Full-length, sectioned, 2-hour mock.' },
];

export const EXAM_TEMPLATE = `{
  "title": "My Practice Paper",
  "examType": "Custom",
  "durationMinutes": 30,
  "marking": { "correct": 4, "incorrect": -1, "unanswered": 0 },
  "sections": [{
    "title": "Section 1",
    "questions": [
      { "type": "mcq", "domain": "Topic", "prompt": "Question text", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "Why A is correct." },
      { "type": "multi", "prompt": "Pick all that apply", "options": ["A", "B", "C"], "answer": [0, 2] },
      { "type": "short", "prompt": "What is 6 × 7?", "answer": ["42", "forty-two"] },
      { "type": "truefalse", "prompt": "Water boils at 100 °C at sea level.", "answer": true },
      { "type": "written", "prompt": "Explain photosynthesis in two sentences.", "answer": "Model answer for self-marking." }
    ]
  }]
}`;
