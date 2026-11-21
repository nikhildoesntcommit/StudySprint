// Optional AI study assistant powered by Claude. The student supplies their own
// Anthropic API key, which is stored only on this device and sent only to the
// Anthropic API. Every request goes straight from the browser to api.anthropic.com.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Question } from '../types';
import { uid } from './id';
import { useStore } from '../store/store';

export { AI_MODELS, aiReady } from './aiConfig';

export class AiNotConfigured extends Error {
  constructor() { super('Add your Anthropic API key in Settings → AI to use this.'); }
}

function client() {
  const { key } = useStore.getState().settings.ai;
  if (!key.trim()) throw new AiNotConfigured();
  // The key belongs to the student and lives only in their browser storage,
  // so calling the API directly from the browser is the intended design here.
  return new Anthropic({ apiKey: key.trim(), dangerouslyAllowBrowser: true, maxRetries: 2 });
}

function model() {
  return useStore.getState().settings.ai.model || 'claude-opus-5-5';
}

/** Server-side refusal fallbacks where the model supports them. */
function fallbackParams(m: string): { betas?: Anthropic.Beta.AnthropicBeta[]; fallbacks?: Anthropic.Beta.Messages.BetaFallbacksParam } {
  if (m.startsWith('claude-haiku')) return {};
  return { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
}


export function friendlyError(e: unknown): string {
  if (e instanceof AiNotConfigured) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return 'Your API key was rejected. Check it in Settings → AI.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key does not have access to that model. Try another model in Settings → AI.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited by the API — wait a moment and try again.';
  if (e instanceof Anthropic.BadRequestError) return `The request was rejected: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API. Are you online?';
  if (e instanceof Anthropic.APIUserAbortError) return 'Stopped.';
  if (e instanceof Anthropic.APIError) return `API error (${e.status ?? 'unknown'}): ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

const TUTOR_SYSTEM = (level: string, name: string) => `You are StudySprint's study tutor for a ${level} student${name ? ` named ${name}` : ''}.
Teach for understanding: explain clearly with concrete examples, check understanding with a short question when it helps, and adapt to the student's level.
When the student asks you to just do their graded homework or essay for them, help them learn to do it instead (outline, hints, worked examples of similar problems) — but answer factual questions and explain concepts directly.
Format with Markdown. Use LaTeX between $...$ (inline) or $$...$$ (display) for maths. Keep answers focused; prefer short paragraphs and lists over walls of text.`;

export const TUTOR_MODES: Record<string, { label: string; instruction: string }> = {
  explain: { label: 'Explain', instruction: '' },
  socratic: { label: 'Socratic', instruction: 'Use the Socratic method: guide with one question at a time rather than giving the answer outright. Give the answer only if the student is stuck after a few tries or asks for it.' },
  eli5: { label: 'Simple', instruction: 'Explain as simply as possible, as if to a curious 12-year-old, using everyday analogies. Avoid jargon or define it immediately.' },
  exam: { label: 'Exam coach', instruction: 'Act as an exam coach: focus on what examiners look for, common mistakes, mark-scheme style answers and time-saving techniques.' },
};

export async function streamTutor(opts: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  mode: keyof typeof TUTOR_MODES;
  context?: string;
  onText: (full: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const s = useStore.getState().settings;
  const m = model();
  const system = [TUTOR_SYSTEM(s.level, s.name), TUTOR_MODES[opts.mode]?.instruction, opts.context ? `The student shared this material for context:\n<material>\n${opts.context}\n</material>` : '']
    .filter(Boolean).join('\n\n');
  const stream = client().beta.messages.stream({
    model: m,
    max_tokens: 16000,
    system,
    messages: opts.messages,
    ...fallbackParams(m),
  }, { signal: opts.signal });
  let full = '';
  stream.on('text', (delta) => { full += delta; opts.onText(full); });
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') {
    full += '\n\n_I can’t help with that request._';
    opts.onText(full);
  }
  return full;
}

const CardsSchema = z.object({
  cards: z.array(z.object({
    front: z.string().describe('Question or prompt side. Concise. Markdown/LaTeX allowed.'),
    back: z.string().describe('Answer side. Concise, atomic. Markdown/LaTeX allowed.'),
  })),
});

export async function generateCards(material: string, count: number, style: 'qa' | 'cloze' | 'mixed'): Promise<{ type: 'basic' | 'cloze'; front: string; back: string }[]> {
  const m = model();
  const styleText = style === 'cloze'
    ? 'Write every card as a cloze deletion: put the full sentence in "front" with the key term wrapped like {{c1::term}} (use c1, c2 for multiple deletions in one sentence) and leave "back" as an empty string or brief extra context.'
    : style === 'mixed'
      ? 'Mix question/answer cards with some cloze cards (cloze: full sentence in "front" with {{c1::term}} deletions, "back" empty).'
      : 'Write question/answer cards.';
  const res = await client().beta.messages.parse({
    model: m,
    max_tokens: 16000,
    system: 'You write excellent spaced-repetition flashcards. Each card tests exactly one idea, is unambiguous, and has a short answer. Prefer "why/how" understanding cards alongside key facts and definitions. Never invent facts not supported by the material; if the material is a topic name, use well-established knowledge.',
    messages: [{ role: 'user', content: `Create about ${count} flashcards from the material below. ${styleText}\n\n<material>\n${material}\n</material>` }],
    output_config: { format: betaZodOutputFormat(CardsSchema) },
    ...fallbackParams(m),
  });
  if (res.stop_reason === 'refusal') throw new Error('The model declined to generate cards for this material.');
  const out = res.parsed_output;
  if (!out) throw new Error('The response could not be read. Try again.');
  return out.cards.map((c) => ({ type: /\{\{c\d+::/.test(c.front) ? 'cloze' : 'basic', front: c.front.trim(), back: c.back.trim() }));
}

const QuizSchema = z.object({
  title: z.string(),
  questions: z.array(z.object({
    type: z.enum(['mcq', 'multi', 'short', 'truefalse']),
    prompt: z.string(),
    options: z.array(z.string()).describe('Answer options for mcq/multi (4 options). Empty array for short and truefalse.'),
    answerIndexes: z.array(z.number().int()).describe('mcq/truefalse: single zero-based index (truefalse: 0 = True, 1 = False). multi: all correct indexes. short: empty.'),
    answerText: z.array(z.string()).describe('short: accepted answers (short, exact). Others: empty.'),
    explanation: z.string(),
    domain: z.string().describe('Sub-topic this question tests'),
  })),
});

export async function generateQuiz(material: string, count: number, difficulty: 'easy' | 'medium' | 'hard'): Promise<{ title: string; questions: Question[] }> {
  const m = model();
  const res = await client().beta.messages.parse({
    model: m,
    max_tokens: 16000,
    system: 'You write high-quality practice exam questions that test understanding, not trivia. Distractors are plausible and reflect common misconceptions. Every question has a clear, unambiguous correct answer and a brief explanation.',
    messages: [{ role: 'user', content: `Write a ${difficulty} practice quiz of ${count} questions on the material below. Mostly multiple choice (mcq), with a few multi-select, true/false and short-answer questions.\n\n<material>\n${material}\n</material>` }],
    output_config: { format: betaZodOutputFormat(QuizSchema) },
    ...fallbackParams(m),
  });
  if (res.stop_reason === 'refusal') throw new Error('The model declined to write a quiz for this material.');
  const out = res.parsed_output;
  if (!out) throw new Error('The response could not be read. Try again.');
  const questions: Question[] = out.questions.map((q): Question => {
    const base = { id: uid('q'), prompt: q.prompt, explanation: q.explanation, domain: q.domain };
    if (q.type === 'short') return { ...base, type: 'short', answer: q.answerText.length ? q.answerText : undefined };
    if (q.type === 'truefalse') return { ...base, type: 'truefalse', options: ['True', 'False'], answer: q.answerIndexes[0] ?? 0 };
    if (q.type === 'multi') return { ...base, type: 'multi', options: q.options, answer: q.answerIndexes };
    return { ...base, type: 'mcq', options: q.options, answer: q.answerIndexes[0] ?? 0 };
  }).filter((q) => (q.type !== 'mcq' && q.type !== 'multi') || (q.options?.length ?? 0) >= 2);
  return { title: out.title, questions };
}

/** One-shot helper for note actions (summarise, explain, simplify…). Streams into onText. */
export async function streamNoteAction(action: 'summarize' | 'explain' | 'questions' | 'improve', note: string, onText: (t: string) => void, signal?: AbortSignal) {
  const prompts = {
    summarize: 'Summarise these notes into a tight revision sheet: key ideas as bullet points, key terms in bold, and a 3-line "if you remember nothing else" section at the end.',
    explain: 'Explain the hardest ideas in these notes more clearly, with an intuitive analogy and a worked example for each.',
    questions: 'Write 8 self-test questions (with brief answers hidden in a details block per question) that check deep understanding of these notes.',
    improve: 'Point out gaps, errors or unclear parts in these notes and suggest specific additions. Be concise and constructive.',
  } as const;
  return streamTutor({ messages: [{ role: 'user', content: `${prompts[action]}\n\n<notes>\n${note}\n</notes>` }], mode: 'explain', onText, signal });
}
