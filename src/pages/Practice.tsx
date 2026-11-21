import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ClipboardCheck, Upload, Plus, Play, Download, Trash2, Pencil, Sparkles, Flag, ChevronLeft, ChevronRight, Pause, Lightbulb, Calculator,
  CheckCircle2, XCircle, MinusCircle, ArrowLeft, Layers, RotateCcw, BookOpen, Loader2, FileJson, Timer, Target, MoreHorizontal, Copy, GripVertical, AlertTriangle,
} from 'lucide-react';
import type { AnswerValue, ExamAttempt, ExamPaper, Question, QuestionType } from '../types';
import { useStore } from '../store/store';
import { subjectHex } from '../store/defaults';
import { navigate, useRoute } from '../lib/router';
import { allQuestions, checkAnswer, EXAM_TEMPLATE, exportExam, formatAnswer, gradeAttempt, isAnswered, newAttempt, parseExam, questionCount, SAMPLE_PAPERS } from '../lib/exam';
import { renderMarkdown } from '../lib/markdown';
import { formatClock, formatDuration, timeAgo } from '../lib/dates';
import { download, pickFile, plural, readFileText, shuffle, uid } from '../lib/id';
import { GUIDES } from '../lib/guides';
import { aiReady, loadAi } from '../lib/aiConfig';
import { Button, Empty, Field, IconButton, Menu, MenuItem, Modal, Seg, SubjectChip, Switch, toast, useConfirm, useNow, Bar } from '../components/ui';
import { SubjectSelect } from '../components/pickers';

export default function Practice() {
  const { parts } = useRoute();
  if (parts[1] === 'run' && parts[2]) return <Runner paperId={parts[2]} />;
  if (parts[1] === 'result' && parts[2]) return <Results attemptId={parts[2]} />;
  if (parts[1] === 'edit' && parts[2]) return <Builder paperId={parts[2]} />;
  return <Library />;
}

const Md = ({ text, className = '' }: { text: string; className?: string }) => <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;

// ---------------------------------------------------------------------------
// Library

/** Questions the student has got wrong in their most recent attempt at them. */
function useMistakes() {
  const attempts = useStore((s) => s.attempts);
  const papers = useStore((s) => s.papers);
  return useMemo(() => {
    const latest = new Map<string, { q: Question; ok: boolean; at: number; paper: string }>();
    for (const a of [...attempts].filter((x) => x.status === 'done').sort((x, y) => (x.finishedAt ?? 0) - (y.finishedAt ?? 0))) {
      const p = papers.find((x) => x.id === a.paperId);
      if (!p) continue;
      for (const { q } of allQuestions(p)) {
        if (!(q.id in a.answers) && a.mode === 'practice') continue;
        const ok = checkAnswer(q, a.answers[q.id]);
        if (ok === null) continue;
        latest.set(q.id, { q, ok: ok && !a.flagged.includes(q.id), at: a.finishedAt ?? 0, paper: p.title });
      }
    }
    return [...latest.values()].filter((x) => !x.ok);
  }, [attempts, papers]);
}

function Library() {
  const papers = useStore((s) => s.papers);
  const attempts = useStore((s) => s.attempts);
  const subjects = useStore((s) => s.subjects);
  const addPaper = useStore((s) => s.addPaper);
  const remove = useStore((s) => s.remove);
  const confirm = useConfirm();
  const mistakes = useMistakes();
  const [importOpen, setImportOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [guide, setGuide] = useState<number | null>(null);
  const active = attempts.filter((a) => a.status === 'active');
  const done = attempts.filter((a) => a.status === 'done').sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));

  const loadSample = async (file: string) => {
    try {
      const res = await fetch(`./${file}`);
      const p = parseExam(await res.text(), 'sample');
      addPaper(p);
      toast(`Added “${p.title}”`, { tone: 'success' });
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not load sample', { tone: 'warn' }); }
  };
  const newPaper = () => {
    const p: ExamPaper = { id: uid('paper'), title: 'Untitled paper', examType: 'Custom', durationMinutes: 30, source: 'builder', createdAt: Date.now(), sections: [{ id: uid('sec'), title: 'Section 1', questions: [{ id: uid('q'), type: 'mcq', prompt: '', options: ['', '', '', ''], answer: 0 }] }] };
    addPaper(p);
    navigate(`/practice/edit/${p.id}`);
  };
  const drill = () => {
    const qs = shuffle(mistakes.map((m) => m.q)).slice(0, 25);
    const p: ExamPaper = { id: uid('paper'), title: `Error book drill · ${new Date().toLocaleDateString()}`, examType: 'Mistakes', source: 'builder', createdAt: Date.now(), sections: [{ id: uid('sec'), title: 'Your mistakes', questions: qs }] };
    addPaper(p);
    navigate(`/practice/run/${p.id}?mode=practice`);
  };

  return (
    <div className="page wide">
      <div className="page-head">
        <div><h1>Practice</h1><p>Timed mock exams, instant-feedback drills, and an error book that remembers your mistakes.</p></div>
        <div className="page-actions">
          <Button variant="ghost" icon={<Upload />} onClick={() => setImportOpen(true)}>Import</Button>
          <Button variant="ghost" icon={<Sparkles />} onClick={() => setAiOpen(true)}>AI quiz</Button>
          <Button variant="primary" icon={<Plus />} onClick={newPaper}>New paper</Button>
        </div>
      </div>

      {active.length > 0 && (
        <div className="stack-sm" style={{ marginBottom: 18 }}>
          {active.map((a) => (
            <div key={a.id} className="panel accent panel-pad row">
              <Timer style={{ color: 'var(--accent)' }} />
              <div className="grow"><b>{a.paperTitle}</b><div className="small muted">In progress · {Object.keys(a.answers).length} answered · {formatClock(a.elapsedMs)} elapsed</div></div>
              <Button size="sm" variant="ghost" onClick={() => remove('attempts', a.id)}>Discard</Button>
              <Button size="sm" variant="primary" icon={<Play />} onClick={() => navigate(`/practice/run/${a.paperId}?resume=${a.id}`)}>Resume</Button>
            </div>
          ))}
        </div>
      )}

      <div className="practice-layout">
        <div className="stack">
          {papers.length === 0 ? (
            <div className="panel">
              <Empty icon={<ClipboardCheck />} title="Your exam room" action={<><Button variant="primary" icon={<Plus />} onClick={newPaper}>Build a paper</Button><Button icon={<Upload />} onClick={() => setImportOpen(true)}>Import JSON</Button></>}>
                Build practice papers, import them as JSON, generate them from your notes with AI, or start with a sample below.
              </Empty>
            </div>
          ) : (
            <div className="paper-grid">
              {papers.slice().sort((a, b) => b.createdAt - a.createdAt).map((p) => {
                const tries = done.filter((a) => a.paperId === p.id);
                const best = tries.reduce((m, a) => Math.max(m, a.result && a.result.maxScore ? a.result.score / a.result.maxScore : 0), 0);
                const subj = subjects.find((s) => s.id === p.subjectId);
                return (
                  <div key={p.id} className="panel paper-card" style={{ '--c': subjectHex(subj?.color) } as CSSProperties}>
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <div className="paper-icon"><FileJson /></div>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <h3 className="truncate">{p.title}</h3>
                        <div className="small muted">{p.examType ?? 'Custom'} · {plural(questionCount(p), 'question')}{p.durationMinutes ? ` · ${formatDuration(p.durationMinutes)}` : ''}</div>
                      </div>
                      <Menu trigger={(open) => <IconButton size="sm" label="Paper options" onClick={open}><MoreHorizontal /></IconButton>}>
                        {(close) => <>
                          <MenuItem icon={<Pencil />} onClick={() => { close(); navigate(`/practice/edit/${p.id}`); }}>Edit</MenuItem>
                          <MenuItem icon={<Download />} onClick={() => { close(); download(`${p.title}.json`, exportExam(p)); }}>Export JSON</MenuItem>
                          <MenuItem icon={<Copy />} onClick={() => { close(); addPaper({ ...structuredClone(p), id: uid('paper'), title: `${p.title} (copy)`, createdAt: Date.now() }); }}>Duplicate</MenuItem>
                          <div className="menu-sep" />
                          <MenuItem danger icon={<Trash2 />} onClick={async () => { close(); if (await confirm({ title: `Delete “${p.title}”?`, body: 'Past attempts at this paper will also be removed.', danger: true, confirm: 'Delete' })) { remove('papers', p.id); useStore.getState().set((s) => ({ attempts: s.attempts.filter((a) => a.paperId !== p.id) })); } }}>Delete</MenuItem>
                        </>}
                      </Menu>
                    </div>
                    <div className="row-wrap">
                      {subj && <SubjectChip subject={subj} size="sm" />}
                      {p.marking && (p.marking.incorrect < 0) && <span className="chip sm warn">Negative marking</span>}
                      {tries.length > 0 && <span className="chip sm success">Best {Math.round(best * 100)}%</span>}
                      {tries.length > 0 && <span className="chip sm">{plural(tries.length, 'attempt')}</span>}
                    </div>
                    <div className="row" style={{ marginTop: 'auto' }}>
                      <Button size="sm" className="grow" icon={<BookOpen />} onClick={() => navigate(`/practice/run/${p.id}?mode=practice`)} title="Instant feedback, no time pressure">Practice</Button>
                      <Button size="sm" variant="primary" className="grow" icon={<Timer />} onClick={() => navigate(`/practice/run/${p.id}?mode=exam`)} title="Timed, results at the end">Exam mode</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {done.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h3><Target />Recent results</h3></div>
              <div className="list">
                {done.slice(0, 8).map((a) => {
                  const pct = a.result && a.result.maxScore ? a.result.score / a.result.maxScore : 0;
                  return (
                    <div key={a.id} className="list-item clickable" onClick={() => navigate(`/practice/result/${a.id}`)}>
                      <div className="grow" style={{ minWidth: 0 }}><div className="truncate" style={{ fontWeight: 560 }}>{a.paperTitle}</div><div className="tiny faint">{a.mode === 'exam' ? 'Exam' : 'Practice'} · {timeAgo(a.finishedAt ?? a.startedAt)} · {formatClock(a.elapsedMs)}</div></div>
                      <div style={{ width: 110 }}><Bar value={pct} color={pct >= 0.7 ? 'var(--success)' : pct >= 0.5 ? 'var(--warning)' : 'var(--danger)'} thin /></div>
                      <b className="tnum" style={{ width: 46, textAlign: 'right' }}>{Math.round(pct * 100)}%</b>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="stack">
          <section className="panel">
            <div className="panel-head"><h3><AlertTriangle />Error book</h3><span className="faint small">{mistakes.length}</span></div>
            <div className="panel-body stack-sm">
              <p className="small muted">{mistakes.length ? `${plural(mistakes.length, 'question')} you got wrong or flagged last time. Drill them until they stick.` : 'Questions you miss or flag will collect here automatically.'}</p>
              {mistakes.slice(0, 3).map((m) => <div key={m.q.id} className="tiny muted truncate">• {m.q.prompt.replace(/[#*_`$]/g, '')}</div>)}
              <Button variant={mistakes.length ? 'primary' : 'default'} disabled={!mistakes.length} icon={<RotateCcw />} onClick={drill}>Drill my mistakes</Button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h3><ClipboardCheck />Sample papers</h3></div>
            <div className="list">
              {SAMPLE_PAPERS.map((s) => (
                <div key={s.file} className="list-item">
                  <div className="grow" style={{ minWidth: 0 }}><div className="small" style={{ fontWeight: 600 }}>{s.title}</div><div className="tiny faint">{s.blurb}</div></div>
                  <Button size="xs" disabled={papers.some((p) => p.source === 'sample' && p.title === s.title)} onClick={() => loadSample(s.file)}>{papers.some((p) => p.source === 'sample' && p.title === s.title) ? 'Added' : 'Add'}</Button>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h3><Lightbulb />Exam craft</h3></div>
            <div className="list">
              {GUIDES.map((g, i) => (
                <button type="button" key={g.title} className="list-item clickable" style={{ textAlign: 'left', width: '100%' }} onClick={() => setGuide(i)}>
                  <div className="grow" style={{ minWidth: 0 }}><div className="tiny faint">{g.tag}</div><div className="small truncate" style={{ fontWeight: 560 }}>{g.title}</div></div>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <ImportPaper open={importOpen} onClose={() => setImportOpen(false)} />
      <AiQuiz open={aiOpen} onClose={() => setAiOpen(false)} />
      <Modal open={guide !== null} onClose={() => setGuide(null)} title={guide !== null ? GUIDES[guide].title : ''}>
        {guide !== null && <div className="stack-sm"><div className="eyebrow">{GUIDES[guide].tag}</div><p style={{ lineHeight: 1.7 }}>{GUIDES[guide].body}</p></div>}
      </Modal>
    </div>
  );
}

function ImportPaper({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addPaper = useStore((s) => s.addPaper);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const doImport = (raw: string) => {
    try {
      const p = parseExam(raw);
      addPaper(p);
      toast(`Imported “${p.title}” · ${plural(questionCount(p), 'question')}`, { tone: 'success' });
      setText(''); setError(''); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Import a practice paper" size="lg">
      <div className="stack">
        <p className="small muted">StudySprint reads the portable exam JSON format (compatible with Test Book files). Question types: <code>mcq</code>, <code>multi</code>, <code>short</code>, <code>truefalse</code> and <code>written</code>, with optional marking, sections, hints, explanations and topic domains.</p>
        <div className="row-wrap">
          <Button icon={<Upload />} onClick={async () => { const f = await pickFile('.json,application/json'); if (f) doImport(await readFileText(f)); }}>Choose a .json file</Button>
          <Button variant="ghost" icon={<Download />} onClick={() => download('studysprint-exam-template.json', EXAM_TEMPLATE)}>Download template</Button>
        </div>
        <Field label="…or paste JSON"><textarea className="textarea mono" style={{ minHeight: 200, fontSize: '0.8rem' }} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAM_TEMPLATE.slice(0, 220) + '…'} /></Field>
        {error && <p className="small danger-text">{error}</p>}
        <Button variant="primary" disabled={!text.trim()} onClick={() => doImport(text)}>Import</Button>
      </div>
    </Modal>
  );
}

function AiQuiz({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notes = useStore((s) => s.notes);
  const addPaper = useStore((s) => s.addPaper);
  const [noteId, setNoteId] = useState('');
  const [material, setMaterial] = useState('');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true); setError('');
    const ai = await loadAi();
    try {
      const n = notes.find((x) => x.id === noteId);
      const res = await ai.generateQuiz(material || (n ? `# ${n.title}\n\n${n.body}` : ''), count, difficulty);
      const p: ExamPaper = { id: uid('paper'), title: res.title, examType: 'AI quiz', source: 'ai', subjectId: n?.subjectId, createdAt: Date.now(), durationMinutes: Math.max(5, Math.round(res.questions.length * 1.2)), sections: [{ id: uid('sec'), title: 'Quiz', questions: res.questions }] };
      addPaper(p);
      toast(`Created “${p.title}”`, { tone: 'success' });
      onClose();
      navigate(`/practice/run/${p.id}?mode=practice`);
    } catch (e) { setError(ai.friendlyError(e)); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Generate a quiz with AI" icon={<Sparkles style={{ color: 'var(--accent)' }} />} size="lg">
      {!aiReady() ? (
        <Empty icon={<Sparkles />} title="Connect Claude first" action={<Button variant="primary" onClick={() => { onClose(); navigate('/settings?tab=ai'); }}>Open AI settings</Button>}>AI features use your own Anthropic API key, stored only on this device.</Empty>
      ) : (
        <div className="stack">
          <Field label="From a note"><select className="select" value={noteId} onChange={(e) => setNoteId(e.target.value)}><option value="">— Paste material instead —</option>{notes.map((n) => <option key={n.id} value={n.id}>{n.title || 'Untitled'}</option>)}</select></Field>
          {!noteId && <Field label="Material or topic"><textarea className="textarea" style={{ minHeight: 160 }} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Paste notes or type a topic, e.g. “GCSE Biology: enzymes and digestion”" /></Field>}
          <div className="row-wrap">
            <Seg value={difficulty} onChange={setDifficulty} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
            <label className="row small"><input type="number" className="input sm" style={{ width: 70 }} min={3} max={40} value={count} onChange={(e) => setCount(Math.max(3, Math.min(40, Number(e.target.value) || 10)))} /> questions</label>
          </div>
          {error && <p className="small danger-text">{error}</p>}
          <Button variant="primary" icon={busy ? <Loader2 className="spin" /> : <Sparkles />} disabled={busy || (!noteId && !material.trim())} onClick={run}>{busy ? 'Writing questions…' : 'Generate quiz'}</Button>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Runner

function Runner({ paperId }: { paperId: string }) {
  const { query } = useRoute();
  const paper = useStore((s) => s.papers.find((p) => p.id === paperId));
  const saveAttempt = useStore((s) => s.saveAttempt);
  const confirm = useConfirm();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(() => {
    const st = useStore.getState();
    const resume = query.get('resume') ? st.attempts.find((a) => a.id === query.get('resume')) : undefined;
    if (resume) return resume;
    if (!paper) return null;
    return newAttempt(paper, (query.get('mode') as ExamAttempt['mode']) || 'exam');
  });
  const [paused, setPaused] = useState(!!query.get('resume'));
  const [calc, setCalc] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const lastTick = useRef(Date.now());
  const finished = useRef(false);
  useNow(1000);

  const flat = useMemo(() => (paper ? allQuestions(paper) : []), [paper]);
  const idx = attempt ? flat.findIndex((x) => x.si === attempt.sectionIdx && x.qi === attempt.qIdx) : 0;
  const cur = flat[Math.max(0, idx)];

  // time accounting
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      if (paused || !cur || finished.current) return;
      setAttempt((a) => (a ? { ...a, elapsedMs: a.elapsedMs + dt, timeOnQ: { ...a.timeOnQ, [cur.q.id]: (a.timeOnQ[cur.q.id] ?? 0) + dt } } : a));
    }, 1000);
    return () => clearInterval(id);
  }, [paused, cur]);

  // autosave
  useEffect(() => { if (attempt && attempt.status === 'active' && !finished.current) saveAttempt(attempt); }, [attempt, saveAttempt]);
  useEffect(() => setShowHint(false), [idx]);

  const limitMs = attempt?.mode === 'exam' && paper?.durationMinutes ? paper.durationMinutes * 60000 : null;
  const remaining = limitMs !== null && attempt ? limitMs - attempt.elapsedMs : null;

  const finish = () => {
    if (!attempt || !paper || finished.current) return;
    finished.current = true;
    const done: ExamAttempt = { ...attempt, status: 'done', finishedAt: Date.now() };
    done.result = gradeAttempt(paper, done);
    saveAttempt(done);
    navigate(`/practice/result/${done.id}`, true);
  };
  useEffect(() => { if (remaining !== null && remaining <= 0 && attempt?.status === 'active') { toast('Time’s up — your paper has been submitted'); finish(); } });

  const go = (i: number) => {
    const t = flat[Math.max(0, Math.min(flat.length - 1, i))];
    if (t) setAttempt((a) => (a ? { ...a, sectionIdx: t.si, qIdx: t.qi } : a));
  };
  const answer = (v: AnswerValue) => setAttempt((a) => (a ? { ...a, answers: { ...a.answers, [cur.q.id]: v } } : a));
  const toggleFlag = () => setAttempt((a) => (a ? { ...a, flagged: a.flagged.includes(cur.q.id) ? a.flagged.filter((x) => x !== cur.q.id) : [...a.flagged, cur.q.id] } : a));
  const reveal = () => setAttempt((a) => (a ? { ...a, revealed: [...new Set([...a.revealed, cur.q.id])] } : a));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
      if (e.key.toLowerCase() === 'f') toggleFlag();
      if (cur?.q.options && /^[1-9]$/.test(e.key) && Number(e.key) <= cur.q.options.length && !(attempt?.mode === 'practice' && attempt.revealed.includes(cur.q.id))) {
        const i = Number(e.key) - 1;
        if (cur.q.type === 'multi') { const v = (attempt?.answers[cur.q.id] as number[]) ?? []; answer(v.includes(i) ? v.filter((x) => x !== i) : [...v, i]); }
        else answer(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!paper || !attempt || !cur) return <div className="page"><Empty icon={<ClipboardCheck />} title="Paper not found" action={<Button onClick={() => navigate('/practice')}>Back to practice</Button>} /></div>;

  const q = cur.q;
  const v = attempt.answers[q.id];
  const isPractice = attempt.mode === 'practice';
  const revealed = isPractice && attempt.revealed.includes(q.id);
  const verdict = revealed ? checkAnswer(q, v) : null;
  const answeredCount = flat.filter((x) => isAnswered(attempt.answers[x.q.id])).length;
  const marking = cur.section.marking ?? paper.marking;

  return (
    <div className="exam-page">
      <header className="exam-top">
        <IconButton label="Exit (progress is saved)" onClick={() => navigate('/practice')}><ArrowLeft /></IconButton>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="truncate" style={{ fontWeight: 650 }}>{paper.title}</div>
          <div className="tiny muted">{isPractice ? 'Practice mode · instant feedback' : 'Exam mode'} · {answeredCount}/{flat.length} answered</div>
        </div>
        <div className={`exam-clock tnum${remaining !== null && remaining < 5 * 60000 ? ' low' : ''}`}><Timer />{remaining !== null ? formatClock(remaining) : formatClock(attempt.elapsedMs)}</div>
        <IconButton label={paused ? 'Resume' : 'Pause'} onClick={() => setPaused((p) => !p)}>{paused ? <Play /> : <Pause />}</IconButton>
        <IconButton label="Calculator" active={calc} onClick={() => setCalc((c) => !c)}><Calculator /></IconButton>
        <Button size="sm" variant="primary" onClick={async () => {
          const left = flat.length - answeredCount;
          if (await confirm({ title: 'Submit paper?', body: left ? `You have ${plural(left, 'unanswered question')}${attempt.flagged.length ? ` and ${attempt.flagged.length} flagged` : ''}.` : 'All questions answered. Good luck!', confirm: 'Submit' })) finish();
        }}>Submit</Button>
      </header>

      <div className="exam-body">
        <main className="exam-main">
          {paused ? (
            <div className="panel exam-paused">
              <Pause /><h2>Paused</h2><p className="muted">The timer is stopped and the question is hidden.</p>
              <Button variant="primary" icon={<Play />} onClick={() => setPaused(false)}>Resume</Button>
            </div>
          ) : (
            <div className="panel exam-q">
              <div className="row-wrap exam-q-meta">
                <span className="chip sm">{cur.section.title}</span>
                <span className="chip sm">Q{idx + 1} of {flat.length}</span>
                {q.domain && <span className="chip sm accent">{q.domain}</span>}
                {marking && <span className="chip sm">+{marking.correct}{marking.incorrect ? ` / ${marking.incorrect}` : ''}</span>}
                <div className="spacer" />
                <Button size="xs" variant={attempt.flagged.includes(q.id) ? 'soft' : 'ghost'} icon={<Flag />} onClick={toggleFlag}>{attempt.flagged.includes(q.id) ? 'Flagged' : 'Flag'}</Button>
              </div>
              <Md text={q.prompt} className="exam-prompt" />
              {q.type === 'multi' && <p className="tiny faint">Select all that apply.</p>}

              {(q.type === 'mcq' || q.type === 'truefalse' || q.type === 'multi') && (
                <div className="options">
                  {q.options!.map((o, i) => {
                    const selected = q.type === 'multi' ? ((v as number[]) ?? []).includes(i) : v === i;
                    const correct = revealed && (q.type === 'multi' ? ((q.answer as number[]) ?? []).includes(i) : q.answer === i);
                    const wrong = revealed && selected && !correct;
                    return (
                      <button key={i} type="button" className="option" aria-pressed={selected} data-correct={correct} data-wrong={wrong} disabled={revealed}
                        onClick={() => q.type === 'multi' ? answer(selected ? ((v as number[]) ?? []).filter((x) => x !== i) : [...((v as number[]) ?? []), i]) : answer(i)}>
                        <span className="option-key">{q.type === 'multi' ? (selected ? '✓' : '') : String.fromCharCode(65 + i)}</span>
                        <span className="md grow" dangerouslySetInnerHTML={{ __html: renderMarkdown(o, { inline: true }) }} />
                        {correct && <CheckCircle2 className="success-text" />}{wrong && <XCircle className="danger-text" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {q.type === 'short' && <input className="input lg-input" value={(v as string) ?? ''} disabled={revealed} onChange={(e) => answer(e.target.value)} placeholder="Type your answer" onKeyDown={(e) => { if (e.key === 'Enter') isPractice ? reveal() : go(idx + 1); }} />}
              {q.type === 'written' && <textarea className="textarea" style={{ minHeight: 180 }} value={(v as string) ?? ''} disabled={revealed} onChange={(e) => answer(e.target.value)} placeholder="Write your answer. You’ll compare it with the model answer and mark it yourself." />}

              {q.hint && !revealed && (showHint ? <div className="hint-box"><Lightbulb /><Md text={q.hint} /></div> : <Button size="sm" variant="ghost" icon={<Lightbulb />} onClick={() => { setShowHint(true); setAttempt((a) => (a ? { ...a, hintsUsed: [...new Set([...a.hintsUsed, q.id])] } : a)); }}>Show hint</Button>)}

              {revealed && (
                <div className={`feedback ${verdict === true ? 'good' : verdict === false ? 'bad' : ''}`}>
                  <div className="row">{verdict === true ? <CheckCircle2 /> : verdict === false ? <XCircle /> : <BookOpen />}<b>{verdict === true ? 'Correct!' : verdict === false ? (isAnswered(v) ? 'Not quite' : 'Skipped') : 'Compare with the model answer'}</b></div>
                  {verdict !== true && q.answer !== undefined && <div className="small"><span className="muted">Answer:</span> <span className="md" style={{ display: 'inline' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(formatAnswer(q), { inline: true }) }} /></div>}
                  {q.explanation && <Md text={q.explanation} className="small" />}
                  {verdict === null && q.type === 'written' && (
                    <div className="row-wrap"><span className="small">Did you get it?</span>
                      <Button size="xs" variant={attempt.selfMarks[q.id] === true ? 'primary' : 'default'} onClick={() => setAttempt((a) => (a ? { ...a, selfMarks: { ...a.selfMarks, [q.id]: true } } : a))}>Yes</Button>
                      <Button size="xs" variant={attempt.selfMarks[q.id] === false ? 'primary' : 'default'} onClick={() => setAttempt((a) => (a ? { ...a, selfMarks: { ...a.selfMarks, [q.id]: false } } : a))}>No</Button>
                    </div>
                  )}
                </div>
              )}

              <div className="exam-nav">
                <Button icon={<ChevronLeft />} disabled={idx === 0} onClick={() => go(idx - 1)}>Previous</Button>
                <div className="spacer" />
                {isPractice && !revealed && <Button variant="soft" onClick={reveal}>Check answer</Button>}
                {idx < flat.length - 1 ? <Button variant={isPractice && !revealed ? 'default' : 'primary'} onClick={() => go(idx + 1)}>Next <ChevronRight /></Button>
                  : <Button variant="primary" onClick={finish}>Finish</Button>}
              </div>
            </div>
          )}
        </main>
        <aside className="exam-side">
          {calc && <CalculatorTool />}
          <div className="panel panel-pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Question map</div>
            {paper.sections.map((s, si) => (
              <div key={s.id} style={{ marginBottom: 10 }}>
                {paper.sections.length > 1 && <div className="tiny muted" style={{ marginBottom: 6 }}>{s.title}</div>}
                <div className="qmap">
                  {s.questions.map((qq, qi) => {
                    const n = flat.findIndex((x) => x.q.id === qq.id);
                    const rv = isPractice && attempt.revealed.includes(qq.id) ? checkAnswer(qq, attempt.answers[qq.id]) : undefined;
                    return (
                      <button key={qq.id} type="button" className="qcell" aria-current={si === attempt.sectionIdx && qi === attempt.qIdx}
                        data-answered={isAnswered(attempt.answers[qq.id])} data-flagged={attempt.flagged.includes(qq.id)} data-result={rv === true ? 'good' : rv === false ? 'bad' : undefined}
                        onClick={() => go(n)}>{n + 1}</button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="qmap-legend tiny muted"><span><i data-answered="true" />Answered</span><span><i data-flagged="true" />Flagged</span></div>
          </div>
          <p className="tiny faint" style={{ padding: '0 4px' }}>Keys: ← → move · 1–9 choose · F flag. Progress is saved automatically.</p>
        </aside>
      </div>
    </div>
  );
}

function CalculatorTool() {
  const [expr, setExpr] = useState('');
  const [out, setOut] = useState('');
  const evaluate = (s: string) => {
    const clean = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/\^/g, '**');
    if (!/^[\d+\-*/().\s,eapisqrtlogncot]*$/i.test(clean)) return 'Error';
    try {
      // eslint-disable-next-line no-new-func
      const r = Function('sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'pi', 'e', `"use strict"; return (${clean || 0});`)(Math.sqrt, Math.sin, Math.cos, Math.tan, Math.log10, Math.log, Math.PI, Math.E);
      return Number.isFinite(r) ? String(Math.round(r * 1e10) / 1e10) : 'Error';
    } catch { return 'Error'; }
  };
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '^', '+', '(', ')', 'sqrt(', 'π'];
  return (
    <div className="panel panel-pad calc">
      <input className="input mono" value={expr} onChange={(e) => { setExpr(e.target.value); setOut(''); }} onKeyDown={(e) => { if (e.key === 'Enter') setOut(evaluate(expr)); }} placeholder="e.g. (3+4)^2" aria-label="Calculator input" />
      <div className="calc-out tnum mono">{out || ' '}</div>
      <div className="calc-keys">
        {keys.map((k) => <button key={k} type="button" onClick={() => setExpr((x) => x + k)}>{k.replace('(', '') || k}</button>)}
        <button type="button" onClick={() => { setExpr(''); setOut(''); }}>C</button>
        <button type="button" onClick={() => setExpr((x) => x.slice(0, -1))}>⌫</button>
        <button type="button" className="eq" onClick={() => setOut(evaluate(expr))}>=</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results

function Results({ attemptId }: { attemptId: string }) {
  const attempt = useStore((s) => s.attempts.find((a) => a.id === attemptId));
  const paper = useStore((s) => s.papers.find((p) => p.id === attempt?.paperId));
  const decks = useStore((s) => s.decks);
  const addDeck = useStore((s) => s.addDeck);
  const addCards = useStore((s) => s.addCards);
  const addPaper = useStore((s) => s.addPaper);
  const saveAttempt = useStore((s) => s.saveAttempt);
  const [filter, setFilter] = useState<'all' | 'wrong' | 'flagged'>('wrong');
  const [deckOpen, setDeckOpen] = useState(false);
  if (!attempt || !paper || !attempt.result) return <div className="page"><Empty icon={<ClipboardCheck />} title="Result not found" action={<Button onClick={() => navigate('/practice')}>Back to practice</Button>} /></div>;
  const r = attempt.result;
  const pct = r.maxScore ? r.score / r.maxScore : 0;
  const flat = allQuestions(paper);
  const verdict = (q: Question) => { const ok = checkAnswer(q, attempt.answers[q.id]); return ok === null ? (q.id in attempt.selfMarks ? attempt.selfMarks[q.id] : null) : ok; };
  const wrong = flat.filter(({ q }) => verdict(q) === false);
  const shown = flat.filter(({ q }) => filter === 'all' || (filter === 'wrong' ? verdict(q) === false : attempt.flagged.includes(q.id)));
  const domains = Object.entries(r.byDomain).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);
  const grade = pct >= 0.85 ? 'Outstanding' : pct >= 0.7 ? 'Strong' : pct >= 0.5 ? 'Getting there' : 'Keep practising';
  const avgMs = r.scored ? attempt.elapsedMs / flat.length : 0;

  const retryWrong = () => {
    const p: ExamPaper = { id: uid('paper'), title: `${paper.title} — retry mistakes`, examType: 'Retry', source: 'builder', subjectId: paper.subjectId, createdAt: Date.now(), marking: paper.marking, sections: [{ id: uid('sec'), title: 'Mistakes', questions: wrong.map((x) => x.q) }] };
    addPaper(p);
    navigate(`/practice/run/${p.id}?mode=practice`);
  };
  const toCards = (deckId: string) => {
    const id = deckId === '__new' ? addDeck({ name: `${paper.title} — mistakes`, subjectId: paper.subjectId }).id : deckId;
    const n = addCards(id, wrong.map(({ q }) => ({ type: 'basic', front: q.prompt + (q.options && q.type !== 'truefalse' ? '\n\n' + q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n') : ''), back: formatAnswer(q) + (q.explanation ? `\n\n${q.explanation}` : '') })), { tags: ['mistake'] });
    toast(`Added ${plural(n, 'card')} from your mistakes`, { tone: 'success', action: { label: 'Open', run: () => navigate(`/cards/${id}`) } });
    setDeckOpen(false);
  };

  return (
    <div className="page">
      <button type="button" className="back-link" onClick={() => navigate('/practice')}><ArrowLeft />Practice</button>
      <div className="result-hero panel">
        <div className="result-score">
          <svg viewBox="0 0 120 120" className="ring" width="148" height="148"><circle cx="60" cy="60" r="52" stroke="var(--surface-3)" strokeWidth="10" fill="none" /><circle cx="60" cy="60" r="52" stroke={pct >= 0.7 ? 'var(--success)' : pct >= 0.5 ? 'var(--warning)' : 'var(--danger)'} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 * (1 - Math.max(0, pct))} /></svg>
          <div className="result-pct"><span className="display tnum">{Math.round(pct * 100)}%</span><small className="tnum">{r.score}/{r.maxScore} marks</small></div>
        </div>
        <div className="grow stack-sm">
          <div className="eyebrow">{attempt.mode === 'exam' ? 'Exam result' : 'Practice result'}</div>
          <h1>{grade}</h1>
          <div className="muted">{paper.title}</div>
          <div className="result-stats">
            <span><CheckCircle2 className="success-text" />{r.correct} correct</span>
            <span><XCircle className="danger-text" />{r.incorrect} wrong</span>
            <span><MinusCircle className="faint" />{r.unanswered} skipped</span>
            <span><Timer className="faint" />{formatClock(attempt.elapsedMs)} · {(avgMs / 1000).toFixed(0)}s per question</span>
          </div>
          <div className="row-wrap" style={{ marginTop: 6 }}>
            {wrong.length > 0 && <Button variant="primary" icon={<RotateCcw />} onClick={retryWrong}>Retry {wrong.length} mistakes</Button>}
            {wrong.length > 0 && <Button icon={<Layers />} onClick={() => setDeckOpen(true)}>Mistakes → flashcards</Button>}
            <Button icon={<Play />} onClick={() => navigate(`/practice/run/${paper.id}?mode=${attempt.mode}`)}>Try again</Button>
          </div>
        </div>
      </div>

      {domains.length > 0 && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head"><h3><Target />By topic</h3><span className="tiny faint">weakest first</span></div>
          <div className="panel-body stack-sm">
            {domains.map(([d, x]) => {
              const p = x.correct / x.total;
              return (
                <div key={d} className="domain-row">
                  <span className="truncate small">{d}</span>
                  <Bar value={p} color={p >= 0.7 ? 'var(--success)' : p >= 0.5 ? 'var(--warning)' : 'var(--danger)'} />
                  <span className="tnum small" style={{ textAlign: 'right' }}>{x.correct}/{x.total}</span>
                  <span className="tnum tiny faint hide-mobile" style={{ textAlign: 'right' }}>{Math.round(x.ms / x.total / 1000)}s avg</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section style={{ marginTop: 18 }}>
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 className="grow">Review</h2>
          <Seg value={filter} onChange={setFilter} options={[{ value: 'wrong', label: `Wrong (${wrong.length})` }, { value: 'flagged', label: `Flagged (${attempt.flagged.length})` }, { value: 'all', label: 'All' }]} />
        </div>
        <div className="stack-sm">
          {shown.map(({ q }) => {
            const n = flat.findIndex((x) => x.q.id === q.id) + 1;
            const ok = verdict(q);
            const given = attempt.answers[q.id];
            const givenText = !isAnswered(given) ? '—' : q.options ? (Array.isArray(given) ? given.map((i) => q.options![i]).join(', ') : q.options[Number(given)]) : String(given);
            return (
              <div key={q.id} className="panel panel-pad review-q" data-ok={ok === true} data-bad={ok === false}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="review-num">{ok === true ? <CheckCircle2 className="success-text" /> : ok === false ? <XCircle className="danger-text" /> : <BookOpen className="faint" />}</span>
                  <div className="grow stack-sm" style={{ minWidth: 0 }}>
                    <div className="tiny faint">Q{n}{q.domain ? ` · ${q.domain}` : ''}{attempt.timeOnQ[q.id] ? ` · ${Math.round(attempt.timeOnQ[q.id] / 1000)}s` : ''}{attempt.flagged.includes(q.id) ? ' · flagged' : ''}</div>
                    <Md text={q.prompt} />
                    <div className="answer-compare small">
                      <div><span className="faint">Your answer</span><div className={ok === false ? 'danger-text' : ''}>{givenText}</div></div>
                      {q.answer !== undefined && <div><span className="faint">{q.type === 'written' ? 'Model answer' : 'Correct answer'}</span><div className="success-text">{formatAnswer(q)}</div></div>}
                    </div>
                    {q.type === 'written' && (
                      <div className="row-wrap small"><span className="muted">Self-mark:</span>
                        <Button size="xs" variant={attempt.selfMarks[q.id] === true ? 'primary' : 'default'} onClick={() => { const a = { ...attempt, selfMarks: { ...attempt.selfMarks, [q.id]: true } }; a.result = gradeAttempt(paper, a); saveAttempt(a); }}>Correct</Button>
                        <Button size="xs" variant={attempt.selfMarks[q.id] === false ? 'primary' : 'default'} onClick={() => { const a = { ...attempt, selfMarks: { ...attempt.selfMarks, [q.id]: false } }; a.result = gradeAttempt(paper, a); saveAttempt(a); }}>Incorrect</Button>
                      </div>
                    )}
                    {q.explanation && <div className="explain"><Lightbulb /><Md text={q.explanation} className="small" /></div>}
                  </div>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <div className="panel"><Empty icon={<CheckCircle2 />} title={filter === 'wrong' ? 'No mistakes 🎉' : 'Nothing here'} /></div>}
        </div>
      </section>

      <Modal open={deckOpen} onClose={() => setDeckOpen(false)} title="Save mistakes as flashcards">
        <div className="stack">
          <p className="small muted">Each wrong answer becomes a card with the correct answer and explanation on the back, so spaced repetition can fix it for good.</p>
          {decks.map((d) => <Button key={d.id} block onClick={() => toCards(d.id)}>{d.name}</Button>)}
          <Button block variant="primary" icon={<Plus />} onClick={() => toCards('__new')}>New deck: “{paper.title} — mistakes”</Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Builder

const TYPE_LABEL: Record<QuestionType, string> = { mcq: 'Multiple choice', multi: 'Multiple answers', truefalse: 'True / false', short: 'Short answer', written: 'Written (self-marked)' };

function Builder({ paperId }: { paperId: string }) {
  const paper = useStore((s) => s.papers.find((p) => p.id === paperId));
  const upsert = useStore((s) => s.upsert);
  const [negative, setNegative] = useState(!!paper?.marking && paper.marking.incorrect < 0);
  if (!paper) return <div className="page"><Empty icon={<ClipboardCheck />} title="Paper not found" /></div>;
  const save = (p: Partial<ExamPaper>) => upsert('papers', { ...paper, ...p });
  const setSection = (si: number, p: Partial<ExamPaper['sections'][number]>) => save({ sections: paper.sections.map((s, i) => (i === si ? { ...s, ...p } : s)) });
  const setQ = (si: number, qi: number, p: Partial<Question>) => setSection(si, { questions: paper.sections[si].questions.map((q, i) => (i === qi ? { ...q, ...p } : q)) });
  const addQ = (si: number, type: QuestionType = 'mcq') => setSection(si, { questions: [...paper.sections[si].questions, blankQ(type)] });
  const total = questionCount(paper);
  const problems = allQuestions(paper).filter(({ q }) => !q.prompt.trim() || ((q.type === 'mcq' || q.type === 'multi') && (q.options ?? []).filter((o) => o.trim()).length < 2)).length;

  return (
    <div className="page">
      <button type="button" className="back-link" onClick={() => navigate('/practice')}><ArrowLeft />Practice</button>
      <div className="page-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <input className="note-title" style={{ fontSize: '1.8rem' }} value={paper.title} onChange={(e) => save({ title: e.target.value })} aria-label="Paper title" />
          <p>{plural(total, 'question')} · autosaved{problems ? ` · ${plural(problems, 'question')} need attention` : ''}</p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" icon={<Download />} onClick={() => download(`${paper.title}.json`, exportExam(paper))}>Export</Button>
          <Button icon={<BookOpen />} onClick={() => navigate(`/practice/run/${paper.id}?mode=practice`)}>Try it</Button>
        </div>
      </div>
      <div className="panel panel-pad grid-3" style={{ marginBottom: 18 }}>
        <Field label="Exam type"><input className="input" value={paper.examType ?? ''} onChange={(e) => save({ examType: e.target.value })} placeholder="e.g. Mock, Quiz, SAT" /></Field>
        <Field label="Subject"><SubjectSelect value={paper.subjectId} onChange={(subjectId) => save({ subjectId })} /></Field>
        <Field label="Time limit (minutes)" hint="Leave empty for untimed"><input type="number" className="input" min={0} value={paper.durationMinutes ?? ''} onChange={(e) => save({ durationMinutes: e.target.value ? Number(e.target.value) : undefined })} /></Field>
        <Field label="Marks per correct"><input type="number" className="input" value={paper.marking?.correct ?? 1} onChange={(e) => save({ marking: { correct: Number(e.target.value) || 1, incorrect: paper.marking?.incorrect ?? 0, unanswered: 0 } })} /></Field>
        <Field label="Negative marking">
          <div className="row"><Switch checked={negative} onChange={(on) => { setNegative(on); save({ marking: { correct: paper.marking?.correct ?? 1, incorrect: on ? -Math.abs(paper.marking?.incorrect || 1) : 0, unanswered: 0 } }); }} />
            {negative && <input type="number" className="input sm" style={{ width: 80 }} value={paper.marking?.incorrect ?? -1} onChange={(e) => save({ marking: { correct: paper.marking?.correct ?? 1, incorrect: -Math.abs(Number(e.target.value)), unanswered: 0 } })} />}</div>
        </Field>
      </div>

      {paper.sections.map((s, si) => (
        <section key={s.id} className="stack" style={{ marginBottom: 24 }}>
          <div className="row">
            <input className="input" style={{ fontWeight: 650, maxWidth: 360 }} value={s.title} onChange={(e) => setSection(si, { title: e.target.value })} aria-label="Section title" />
            <div className="spacer" />
            {paper.sections.length > 1 && <IconButton label="Delete section" onClick={() => save({ sections: paper.sections.filter((_, i) => i !== si) })}><Trash2 /></IconButton>}
          </div>
          {s.questions.map((q, qi) => (
            <div key={q.id} className="panel panel-pad builder-q stack-sm">
              <div className="row">
                <GripVertical style={{ width: 16, color: 'var(--text-3)' }} />
                <b className="tnum">Q{qi + 1}</b>
                <select className="select sm" style={{ width: 190 }} value={q.type} onChange={(e) => {
                  const type = e.target.value as QuestionType;
                  setQ(si, qi, { type, options: type === 'truefalse' ? ['True', 'False'] : type === 'mcq' || type === 'multi' ? (q.options?.length && q.type !== 'truefalse' ? q.options : ['', '', '', '']) : undefined, answer: type === 'multi' ? [] : type === 'mcq' || type === 'truefalse' ? 0 : undefined });
                }}>{(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
                <input className="input sm" style={{ maxWidth: 200 }} placeholder="Topic (optional)" value={q.domain ?? ''} onChange={(e) => setQ(si, qi, { domain: e.target.value || undefined })} />
                <div className="spacer" />
                <IconButton size="sm" label="Move up" disabled={qi === 0} onClick={() => { const qs = [...s.questions]; [qs[qi - 1], qs[qi]] = [qs[qi], qs[qi - 1]]; setSection(si, { questions: qs }); }}><ChevronLeft style={{ transform: 'rotate(90deg)' }} /></IconButton>
                <IconButton size="sm" label="Duplicate" onClick={() => { const qs = [...s.questions]; qs.splice(qi + 1, 0, { ...structuredClone(q), id: uid('q') }); setSection(si, { questions: qs }); }}><Copy /></IconButton>
                <IconButton size="sm" label="Delete question" onClick={() => setSection(si, { questions: s.questions.filter((_, i) => i !== qi) })}><Trash2 /></IconButton>
              </div>
              <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Question (Markdown and $LaTeX$ supported)" value={q.prompt} onChange={(e) => setQ(si, qi, { prompt: e.target.value })} />
              {(q.type === 'mcq' || q.type === 'multi' || q.type === 'truefalse') && (
                <div className="stack-sm">
                  {q.options!.map((o, oi) => {
                    const isAns = q.type === 'multi' ? ((q.answer as number[]) ?? []).includes(oi) : q.answer === oi;
                    return (
                      <div key={oi} className="row">
                        <input type={q.type === 'multi' ? 'checkbox' : 'radio'} name={`ans-${q.id}`} checked={isAns} title="Correct answer"
                          onChange={() => setQ(si, qi, { answer: q.type === 'multi' ? (isAns ? ((q.answer as number[]) ?? []).filter((x) => x !== oi) : [...((q.answer as number[]) ?? []), oi]) : oi })} />
                        <span className="tnum faint small" style={{ width: 16 }}>{String.fromCharCode(65 + oi)}</span>
                        <input className="input sm" value={o} disabled={q.type === 'truefalse'} placeholder={`Option ${oi + 1}`} onChange={(e) => setQ(si, qi, { options: q.options!.map((x, j) => (j === oi ? e.target.value : x)) })} />
                        {q.type !== 'truefalse' && q.options!.length > 2 && <IconButton size="sm" label="Remove option" onClick={() => setQ(si, qi, { options: q.options!.filter((_, j) => j !== oi), answer: q.type === 'multi' ? ((q.answer as number[]) ?? []).filter((x) => x !== oi).map((x) => (x > oi ? x - 1 : x)) : Number(q.answer) === oi ? 0 : Number(q.answer) > oi ? Number(q.answer) - 1 : q.answer })}><Trash2 /></IconButton>}
                      </div>
                    );
                  })}
                  {q.type !== 'truefalse' && q.options!.length < 8 && <Button size="xs" variant="ghost" icon={<Plus />} onClick={() => setQ(si, qi, { options: [...q.options!, ''] })}>Add option</Button>}
                  <span className="tiny faint">Select the {q.type === 'multi' ? 'correct answers' : 'correct answer'}.</span>
                </div>
              )}
              {q.type === 'short' && <Field label="Accepted answers" hint="Separate alternatives with |. Matching ignores case and extra spaces."><input className="input sm" value={Array.isArray(q.answer) ? q.answer.join(' | ') : (q.answer as string) ?? ''} onChange={(e) => setQ(si, qi, { answer: e.target.value.split('|').map((x) => x.trim()).filter(Boolean) })} /></Field>}
              {q.type === 'written' && <Field label="Model answer"><textarea className="textarea" style={{ minHeight: 60 }} value={(q.answer as string) ?? ''} onChange={(e) => setQ(si, qi, { answer: e.target.value || undefined })} /></Field>}
              <div className="grid-2">
                <input className="input sm" placeholder="Explanation (shown after answering)" value={q.explanation ?? ''} onChange={(e) => setQ(si, qi, { explanation: e.target.value || undefined })} />
                <input className="input sm" placeholder="Hint (optional)" value={q.hint ?? ''} onChange={(e) => setQ(si, qi, { hint: e.target.value || undefined })} />
              </div>
            </div>
          ))}
          <div className="row-wrap">
            <Button icon={<Plus />} onClick={() => addQ(si)}>Add question</Button>
            {(['multi', 'truefalse', 'short', 'written'] as QuestionType[]).map((t) => <Button key={t} size="sm" variant="ghost" onClick={() => addQ(si, t)}>+ {TYPE_LABEL[t]}</Button>)}
          </div>
        </section>
      ))}
      <Button variant="soft" icon={<Plus />} onClick={() => save({ sections: [...paper.sections, { id: uid('sec'), title: `Section ${paper.sections.length + 1}`, questions: [blankQ('mcq')] }] })}>Add section</Button>
    </div>
  );
}

function blankQ(type: QuestionType): Question {
  return { id: uid('q'), type, prompt: '', options: type === 'truefalse' ? ['True', 'False'] : type === 'mcq' || type === 'multi' ? ['', '', '', ''] : undefined, answer: type === 'multi' ? [] : type === 'mcq' || type === 'truefalse' ? 0 : undefined };
}
