import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Layers, Plus, Play, Upload, Sparkles, ArrowLeft, Search, Trash2, Pencil, Flag, PauseCircle, Undo2, X, Zap, ClipboardCheck, Download,
  Brain, CheckCircle2, Loader2, MoreHorizontal, Shuffle, RotateCcw, Eye,
} from 'lucide-react';
import type { Card, Deck, Rating } from '../types';
import { useStore } from '../store/store';
import { subjectHex } from '../store/defaults';
import { navigate, useRoute } from '../lib/router';
import { buildQueue, deckCounts, retentionRate } from '../lib/stats';
import { currentRecall, preview, renderCloze, seedOf, clozeOrdinals } from '../lib/srs';
import { renderMarkdown } from '../lib/markdown';
import { addDays, DAY_SHORT, formatDuration, ymd } from '../lib/dates';
import { download, plural } from '../lib/id';
import { quizFromCards } from '../lib/exam';
import { aiReady, loadAi } from '../lib/aiConfig';
import { Button, Empty, Field, IconButton, Menu, MenuItem, Modal, Ring, Seg, SubjectChip, Switch, toast, useConfirm } from '../components/ui';
import { SubjectSelect } from '../components/pickers';

export default function Cards() {
  const { parts } = useRoute();
  if (parts[1] === 'review') return <Review deckId={parts[2]} />;
  if (parts[1] === 'cram') return <Review deckId={parts[2]} cram />;
  if (parts[1]) return <DeckDetail id={parts[1]} />;
  return <DeckList />;
}

// ---------------------------------------------------------------------------
// Deck list

function DeckList() {
  const { query } = useRoute();
  const decks = useStore((s) => s.decks);
  const cards = useStore((s) => s.cards);
  const reviews = useStore((s) => s.reviews);
  const subjects = useStore((s) => s.subjects);
  const newPerDay = useStore((s) => s.settings.srs.newPerDay);
  const [creating, setCreating] = useState(query.get('new') === '1');
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState<string | null>(query.get('generate'));
  const all = deckCounts(cards, reviews, newPerDay);
  const totalDue = all.due + all.learning + all.fresh;
  const ret = retentionRate(reviews);
  const todayCount = reviews.filter((r) => ymd(new Date(r.at)) === ymd()).length;

  return (
    <div className="page wide">
      <div className="page-head">
        <div><h1>Flashcards</h1><p>Spaced repetition schedules every card right before you’d forget it.</p></div>
        <div className="page-actions">
          <Button variant="ghost" icon={<Upload />} onClick={() => setImporting(true)}>Import</Button>
          <Button variant="ghost" icon={<Sparkles />} onClick={() => setGenerating('')}>Generate</Button>
          <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>New deck</Button>
        </div>
      </div>

      {decks.length > 0 && (
        <div className="review-hero panel">
          <div className="grow">
            <div className="eyebrow">Today</div>
            <div className="display" style={{ fontSize: '1.9rem', marginTop: 4 }}>{totalDue ? `${totalDue} cards ready` : 'All caught up'}</div>
            <div className="small muted">{all.due} review · {all.learning} learning · {all.fresh} new{todayCount ? ` · ${todayCount} done today` : ''}{ret !== null ? ` · ${Math.round(ret * 100)}% recall rate` : ''}</div>
          </div>
          <Button size="lg" variant="primary" icon={<Play />} disabled={!totalDue} onClick={() => navigate('/cards/review')}>Review all</Button>
        </div>
      )}

      {decks.length === 0 ? (
        <div className="panel"><Empty icon={<Layers />} title="Make your first deck" action={<><Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>New deck</Button><Button icon={<Upload />} onClick={() => setImporting(true)}>Import cards</Button></>}>
          Create cards by hand, paste a list, turn your notes into cards, or let AI write them from your material.
        </Empty></div>
      ) : (
        <div className="deck-grid">
          {decks.map((d) => {
            const c = deckCounts(cards, reviews, newPerDay, d.id);
            const deckCards = cards.filter((x) => x.deckId === d.id);
            const mature = deckCards.filter((x) => x.srs.state === 'review' && x.srs.stability >= 21).length;
            const seen = deckCards.filter((x) => x.srs.state !== 'new').length;
            const subj = subjects.find((s) => s.id === d.subjectId);
            const ready = c.due + c.learning + c.fresh;
            return (
              <div key={d.id} className="panel deck-tile clickable" style={{ '--c': subjectHex(subj?.color) } as CSSProperties} onClick={() => navigate(`/cards/${d.id}`)}>
                <div className="deck-stripe" />
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <h3 className="truncate">{d.name}</h3>
                    <div className="small muted truncate">{d.description || (subj ? subj.name : plural(c.total, 'card'))}</div>
                  </div>
                  <Ring value={c.total ? seen / c.total : 0} size={46} stroke={5} color={subjectHex(subj?.color)}><span className="tiny tnum" style={{ fontWeight: 650 }}>{c.total ? Math.round((seen / c.total) * 100) : 0}%</span></Ring>
                </div>
                <div className="deck-counts">
                  <span><b className="accent-text tnum">{c.due + c.learning}</b> due</span>
                  <span><b className="tnum">{c.fresh}</b> new</span>
                  <span><b className="tnum">{c.total}</b> cards</span>
                  <span title="Interval ≥ 21 days"><b className="tnum">{mature}</b> mature</span>
                </div>
                <Button block variant={ready ? 'primary' : 'default'} disabled={!ready} icon={ready ? <Play /> : <CheckCircle2 />} onClick={(e) => { e.stopPropagation(); navigate(`/cards/review/${d.id}`); }}>
                  {ready ? `Study ${ready}` : 'Done for today'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <NewDeck open={creating} onClose={() => setCreating(false)} />
      <ImportCards open={importing} onClose={() => setImporting(false)} />
      <GenerateCards open={generating !== null} noteId={generating || undefined} onClose={() => setGenerating(null)} />
    </div>
  );
}

function NewDeck({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addDeck = useStore((s) => s.addDeck);
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const create = () => {
    const d = addDeck({ name: name.trim(), subjectId, description: description.trim() || undefined });
    setName(''); setDescription(''); onClose();
    navigate(`/cards/${d.id}`);
  };
  return (
    <Modal open={open} onClose={onClose} title="New deck">
      <div className="stack">
        <Field label="Name"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Organic chemistry reactions" onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) create(); }} /></Field>
        <Field label="Subject"><SubjectSelect value={subjectId} onChange={setSubjectId} /></Field>
        <Field label="Description"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></Field>
        <Button variant="primary" disabled={!name.trim()} onClick={create}>Create deck</Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Import

function parseImport(text: string, sep: string): { front: string; back: string; type: 'basic' | 'cloze' }[] {
  const out: { front: string; back: string; type: 'basic' | 'cloze' }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/\{\{c\d+::/.test(line) && (sep === 'auto' || !line.includes(sep === 'tab' ? '\t' : sep))) { out.push({ front: line, back: '', type: 'cloze' }); continue; }
    let parts: string[] | null = null;
    const seps = sep === 'auto' ? ['\t', ' :: ', '::', ' - ', ';', ','] : [sep === 'tab' ? '\t' : sep];
    for (const s of seps) {
      const i = line.indexOf(s);
      if (i > 0) { parts = [line.slice(0, i), line.slice(i + s.length)]; break; }
    }
    if (parts && parts[1].trim()) out.push({ front: parts[0].trim().replace(/^"|"$/g, ''), back: parts[1].trim().replace(/^"|"$/g, ''), type: 'basic' });
  }
  return out;
}

function ImportCards({ open, onClose, deckId: fixedDeck }: { open: boolean; onClose: () => void; deckId?: string }) {
  const decks = useStore((s) => s.decks);
  const addDeck = useStore((s) => s.addDeck);
  const addCards = useStore((s) => s.addCards);
  const [text, setText] = useState('');
  const [sep, setSep] = useState('auto');
  const [deckId, setDeckId] = useState(fixedDeck ?? decks[0]?.id ?? '__new');
  const [newName, setNewName] = useState('Imported cards');
  const [reverse, setReverse] = useState(false);
  const parsed = useMemo(() => parseImport(text, sep), [text, sep]);
  const go = () => {
    const id = deckId === '__new' ? addDeck({ name: newName.trim() || 'Imported cards' }).id : deckId;
    const n = addCards(id, parsed.map((p) => ({ ...p, reverse: reverse && p.type === 'basic' })));
    toast(`Imported ${plural(n, 'card')}`, { tone: 'success' });
    setText(''); onClose();
    if (!fixedDeck) navigate(`/cards/${id}`);
  };
  return (
    <Modal open={open} onClose={onClose} title="Import cards" size="lg">
      <div className="stack">
        <p className="small muted">Paste one card per line — from a spreadsheet, Quizlet export, Anki text export or your own list. The front and back are split by a tab, “::”, “ - ”, semicolon or comma. Lines with {'{{c1::…}}'} become cloze cards.</p>
        <textarea className="textarea mono" style={{ minHeight: 180, fontSize: '0.85rem' }} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'photosynthesis\tmaking glucose using light energy\nmitochondria :: site of respiration\nThe powerhouse of the cell is the {{c1::mitochondria}}.'} />
        <div className="row-wrap">
          <Button size="sm" icon={<Upload />} onClick={() => {
            const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.txt,.csv,.tsv,text/plain';
            inp.onchange = async () => { const f = inp.files?.[0]; if (f) setText(await f.text()); };
            inp.click();
          }}>Load a file</Button>
          <label className="row small">Separator
            <select className="select sm" style={{ width: 130 }} value={sep} onChange={(e) => setSep(e.target.value)}>
              <option value="auto">Auto-detect</option><option value="tab">Tab</option><option value="::">::</option><option value=",">Comma</option><option value=";">Semicolon</option><option value=" - ">Dash</option>
            </select>
          </label>
          <label className="row small"><Switch checked={reverse} onChange={setReverse} label="Both directions" /> Also create reverse cards</label>
        </div>
        {parsed.length > 0 && (
          <div className="card-preview-list" style={{ maxHeight: 220 }}>
            {parsed.slice(0, 100).map((p, i) => <div key={i} className="card-preview"><span className="chip sm">{p.type === 'cloze' ? 'Cloze' : 'Basic'}</span><span className="grow truncate">{p.front}</span><span className="grow truncate muted">{p.back}</span></div>)}
          </div>
        )}
        {!fixedDeck && (
          <div className="grid-2">
            <Field label="Into deck"><select className="select" value={deckId} onChange={(e) => setDeckId(e.target.value)}>{decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}<option value="__new">+ New deck…</option></select></Field>
            {deckId === '__new' && <Field label="Deck name"><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>}
          </div>
        )}
        <Button variant="primary" disabled={!parsed.length} onClick={go}>Import {parsed.length ? plural(parsed.length, 'card') : ''}</Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// AI generation

function GenerateCards({ open, onClose, noteId, deckId: fixedDeck }: { open: boolean; onClose: () => void; noteId?: string; deckId?: string }) {
  const notes = useStore((s) => s.notes);
  const decks = useStore((s) => s.decks);
  const addDeck = useStore((s) => s.addDeck);
  const addCards = useStore((s) => s.addCards);
  const note = notes.find((n) => n.id === noteId);
  const [source, setSource] = useState('');
  const [count, setCount] = useState(15);
  const [style, setStyle] = useState<'qa' | 'cloze' | 'mixed'>('qa');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ type: 'basic' | 'cloze'; front: string; back: string; keep: boolean }[]>([]);
  const [deckId, setDeckId] = useState(fixedDeck ?? decks.find((d) => d.subjectId && d.subjectId === note?.subjectId)?.id ?? decks[0]?.id ?? '__new');
  useEffect(() => { if (open) { setSource(note ? `# ${note.title}\n\n${note.body}` : ''); setResult([]); setError(''); } }, [open, note]);
  const ready = aiReady();
  const run = async () => {
    setBusy(true); setError('');
    const ai = await loadAi();
    try { setResult((await ai.generateCards(source, count, style)).map((c) => ({ ...c, keep: true }))); }
    catch (e) { setError(ai.friendlyError(e)); }
    finally { setBusy(false); }
  };
  const save = () => {
    const id = deckId === '__new' ? addDeck({ name: note?.title || 'Generated cards', subjectId: note?.subjectId }).id : deckId;
    const n = addCards(id, result.filter((r) => r.keep), { sourceNoteId: note?.id });
    toast(`Added ${plural(n, 'card')}`, { tone: 'success' });
    onClose();
    if (!fixedDeck) navigate(`/cards/${id}`);
  };
  return (
    <Modal open={open} onClose={onClose} title="Generate flashcards with AI" icon={<Sparkles style={{ color: 'var(--accent)' }} />} size="lg">
      {!ready ? (
        <Empty icon={<Sparkles />} title="Connect Claude first" action={<Button variant="primary" onClick={() => { onClose(); navigate('/settings?tab=ai'); }}>Open AI settings</Button>}>
          AI features use your own Anthropic API key, stored only on this device.
        </Empty>
      ) : result.length === 0 ? (
        <div className="stack">
          <Field label="Material" hint="Paste notes, a textbook passage, or just a topic like “causes of the French Revolution”.">
            <textarea className="textarea" style={{ minHeight: 200 }} value={source} onChange={(e) => setSource(e.target.value)} />
          </Field>
          <div className="row-wrap">
            <Seg value={style} onChange={setStyle} options={[{ value: 'qa', label: 'Q & A' }, { value: 'cloze', label: 'Cloze' }, { value: 'mixed', label: 'Mixed' }]} />
            <label className="row small">About <input type="number" className="input sm" style={{ width: 70 }} min={3} max={60} value={count} onChange={(e) => setCount(Math.max(3, Math.min(60, Number(e.target.value) || 10)))} /> cards</label>
          </div>
          {error && <p className="small danger-text">{error}</p>}
          <Button variant="primary" icon={busy ? <Loader2 className="spin" /> : <Sparkles />} disabled={!source.trim() || busy} onClick={run}>{busy ? 'Writing cards…' : 'Generate'}</Button>
        </div>
      ) : (
        <div className="stack">
          <p className="small muted">Review the cards — untick any you don’t want.</p>
          <div className="card-preview-list" style={{ maxHeight: 360 }}>
            {result.map((r, i) => (
              <label key={i} className="card-preview" data-off={!r.keep}>
                <input type="checkbox" checked={r.keep} onChange={() => setResult((xs) => xs.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))} />
                <div className="md small grow" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.front, { inline: true }) }} />
                {r.back && <div className="md small muted grow" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.back, { inline: true }) }} />}
              </label>
            ))}
          </div>
          {!fixedDeck && <Field label="Add to deck"><select className="select" value={deckId} onChange={(e) => setDeckId(e.target.value)}>{decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}<option value="__new">+ New deck…</option></select></Field>}
          <div className="row"><Button onClick={() => setResult([])}>Back</Button><div className="spacer" /><Button variant="primary" onClick={save}>Add {result.filter((r) => r.keep).length} cards</Button></div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Deck detail

function DeckDetail({ id }: { id: string }) {
  const deck = useStore((s) => s.decks.find((d) => d.id === id));
  const allCards = useStore((s) => s.cards);
  const reviews = useStore((s) => s.reviews);
  const newPerDay = useStore((s) => s.settings.srs.newPerDay);
  const subject = useStore((s) => s.subjects.find((x) => x.id === deck?.subjectId));
  const upsert = useStore((s) => s.upsert);
  const deleteDeck = useStore((s) => s.deleteDeck);
  const addPaper = useStore((s) => s.addPaper);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'due' | 'weak' | 'flagged' | 'suspended'>('all');
  const [editing, setEditing] = useState<Card | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cards = useMemo(() => allCards.filter((c) => c.deckId === id), [allCards, id]);
  if (!deck) return <div className="page"><Empty icon={<Layers />} title="Deck not found" action={<Button onClick={() => navigate('/cards')}>Back to decks</Button>} /></div>;
  const counts = deckCounts(allCards, reviews, newPerDay, id);
  const now = Date.now();
  const forecast = Array.from({ length: 14 }, (_, i) => {
    const day = ymd(addDays(new Date(), i));
    return { day, n: cards.filter((c) => !c.suspended && c.srs.state !== 'new' && ymd(new Date(Math.max(c.srs.due, now))) === day).length };
  });
  const maxF = Math.max(5, ...forecast.map((f) => f.n));
  const shown = cards.filter((c) => {
    if (q && !(c.front + ' ' + c.back).toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'new') return c.srs.state === 'new';
    if (filter === 'due') return c.srs.state !== 'new' && c.srs.due <= now + 86_400_000;
    if (filter === 'weak') return c.srs.lapses > 0 || (c.srs.state !== 'new' && currentRecall(c) < 0.8);
    if (filter === 'flagged') return !!c.flagged;
    if (filter === 'suspended') return !!c.suspended;
    return true;
  });
  const states = { new: 0, learning: 0, young: 0, mature: 0 };
  cards.forEach((c) => { if (c.srs.state === 'new') states.new++; else if (c.srs.state !== 'review') states.learning++; else if (c.srs.stability >= 21) states.mature++; else states.young++; });
  const ready = counts.due + counts.learning + counts.fresh;
  const quiz = () => {
    const p = quizFromCards(`${deck.name} — quiz`, cards);
    if (!p) { toast('Need at least 4 basic cards with different answers to make a quiz', { tone: 'warn' }); return; }
    p.subjectId = deck.subjectId;
    addPaper(p);
    navigate(`/practice/run/${p.id}?mode=practice`);
  };
  const exportCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    download(`${deck.name}.csv`, cards.map((c) => `${esc(c.front)},${esc(c.back)}`).join('\n'), 'text/csv');
  };

  return (
    <div className="page wide">
      <button type="button" className="back-link" onClick={() => navigate('/cards')}><ArrowLeft />All decks</button>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="row-wrap">{subject && <SubjectChip subject={subject} size="sm" />}<span className="faint small">{plural(cards.length, 'card')}</span></div>
          <h1 style={{ marginTop: 6 }}>{deck.name}</h1>
          {deck.description && <p>{deck.description}</p>}
        </div>
        <div className="page-actions">
          <Menu trigger={(open) => <Button variant="ghost" icon={<MoreHorizontal />} onClick={open}>More</Button>}>
            {(close) => <>
              <MenuItem icon={<Pencil />} onClick={() => { close(); setSettingsOpen(true); }}>Edit deck</MenuItem>
              <MenuItem icon={<Upload />} onClick={() => { close(); setImporting(true); }}>Import cards</MenuItem>
              <MenuItem icon={<Sparkles />} onClick={() => { close(); setGenerating(true); }}>Generate with AI</MenuItem>
              <MenuItem icon={<Shuffle />} onClick={() => { close(); navigate(`/cards/cram/${id}`); }}>Cram all cards (doesn’t affect schedule)</MenuItem>
              <MenuItem icon={<Download />} onClick={() => { close(); exportCsv(); }}>Export as CSV</MenuItem>
              <div className="menu-sep" />
              <MenuItem danger icon={<Trash2 />} onClick={async () => { close(); if (await confirm({ title: `Delete “${deck.name}”?`, body: `All ${cards.length} cards and their review history will be deleted.`, danger: true, confirm: 'Delete deck' })) { deleteDeck(id); navigate('/cards'); } }}>Delete deck</MenuItem>
            </>}
          </Menu>
          <Button icon={<ClipboardCheck />} onClick={quiz}>Quiz me</Button>
          <Button variant="primary" icon={<Play />} disabled={!ready} onClick={() => navigate(`/cards/review/${id}`)}>{ready ? `Study ${ready}` : 'Done for today'}</Button>
        </div>
      </div>

      <div className="deck-stats">
        <div className="panel panel-pad">
          <div className="eyebrow">Card states</div>
          <div className="state-bar">
            {(['new', 'learning', 'young', 'mature'] as const).map((k) => states[k] > 0 && <i key={k} data-k={k} style={{ flex: states[k] }} title={`${k}: ${states[k]}`} />)}
          </div>
          <div className="state-legend">
            {(['new', 'learning', 'young', 'mature'] as const).map((k) => <span key={k}><i data-k={k} />{k[0].toUpperCase() + k.slice(1)} <b className="tnum">{states[k]}</b></span>)}
          </div>
        </div>
        <div className="panel panel-pad">
          <div className="eyebrow">Due in the next 2 weeks</div>
          <div className="bars" style={{ height: 70, marginTop: 10 }}>
            {forecast.map((f, i) => <div className="b" key={f.day} data-today={i === 0} title={`${f.n} cards`}><div className={f.n ? '' : 'dim'} style={{ height: `${(f.n / maxF) * 100}%` }} /><span>{i === 0 ? 'T' : DAY_SHORT[addDays(new Date(), i).getDay()][0]}</span></div>)}
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box"><Search /><input className="input sm" placeholder="Search cards…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Seg value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'due', label: 'Due' }, { value: 'new', label: 'New' }, { value: 'weak', label: 'Weak' }, { value: 'flagged', label: 'Flagged' }, { value: 'suspended', label: 'Paused' }]} />
        <div className="spacer" />
        <Button variant="soft" icon={<Plus />} onClick={() => setAdding(true)}>Add card</Button>
      </div>

      <div className="panel">
        {shown.length === 0 ? (
          <Empty icon={<Layers />} title={cards.length ? 'No cards match' : 'This deck is empty'} action={!cards.length && <><Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>Add a card</Button><Button icon={<Upload />} onClick={() => setImporting(true)}>Import</Button><Button icon={<Sparkles />} onClick={() => setGenerating(true)}>Generate</Button></>} />
        ) : (
          <div className="card-table">
            {shown.slice(0, 300).map((c) => {
              const recall = currentRecall(c);
              const front = c.type === 'cloze' ? renderCloze(c.front, c.ord ?? 1, false) : c.front;
              return (
                <div key={c.id} className="card-line" data-suspended={c.suspended} onClick={() => setEditing(c)}>
                  <div className="md small grow card-front" dangerouslySetInnerHTML={{ __html: renderMarkdown(front, { inline: true }) }} />
                  <div className="md small muted grow card-back hide-mobile" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.type === 'cloze' ? renderCloze(c.front, c.ord ?? 1, true) : c.back, { inline: true }) }} />
                  <div className="card-state">
                    {c.flagged && <Flag style={{ width: 13, color: 'var(--warning)' }} />}
                    <span className={`chip sm ${c.srs.state === 'new' ? 'accent' : c.srs.lapses > 1 ? 'danger' : ''}`}>{c.srs.state === 'new' ? 'New' : c.srs.state === 'review' ? `${Math.round(recall * 100)}%` : 'Learning'}</span>
                  </div>
                  <Menu trigger={(open) => <IconButton size="sm" label="Card options" onClick={(e) => { e.stopPropagation(); open(); }}><MoreHorizontal /></IconButton>}>
                    {(close) => <div onClick={(e) => e.stopPropagation()}>
                      <MenuItem icon={<Flag />} onClick={() => { patch('cards', c.id, { flagged: !c.flagged }); close(); }}>{c.flagged ? 'Unflag' : 'Flag'}</MenuItem>
                      <MenuItem icon={<PauseCircle />} onClick={() => { patch('cards', c.id, { suspended: !c.suspended }); close(); }}>{c.suspended ? 'Resume' : 'Pause (suspend)'}</MenuItem>
                      <MenuItem icon={<RotateCcw />} onClick={() => { patch('cards', c.id, { srs: { ...c.srs, state: 'new', due: Date.now(), reps: 0, lapses: 0, stability: 0, difficulty: 0, step: 0, lastReview: undefined } }); close(); }}>Reset progress</MenuItem>
                      <MenuItem danger icon={<Trash2 />} onClick={() => { remove('cards', c.id); close(); }}>Delete</MenuItem>
                    </div>}
                  </Menu>
                </div>
              );
            })}
            {shown.length > 300 && <div className="faint small" style={{ padding: 12 }}>Showing 300 of {shown.length}. Search to narrow down.</div>}
          </div>
        )}
      </div>

      <CardEditor open={adding || !!editing} card={editing} deckId={id} onClose={() => { setAdding(false); setEditing(null); }} />
      <ImportCards open={importing} onClose={() => setImporting(false)} deckId={id} />
      <GenerateCards open={generating} onClose={() => setGenerating(false)} deckId={id} />
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Edit deck" footer={<Button variant="primary" onClick={() => setSettingsOpen(false)}>Done</Button>}>
        <div className="stack">
          <Field label="Name"><input className="input" value={deck.name} onChange={(e) => upsert('decks', { ...deck, name: e.target.value })} /></Field>
          <Field label="Subject"><SubjectSelect value={deck.subjectId} onChange={(subjectId) => upsert('decks', { ...deck, subjectId })} /></Field>
          <Field label="Description"><input className="input" value={deck.description ?? ''} onChange={(e) => upsert('decks', { ...deck, description: e.target.value || undefined } as Deck)} /></Field>
        </div>
      </Modal>
    </div>
  );
}

function CardEditor({ open, card, deckId, onClose }: { open: boolean; card: Card | null; deckId: string; onClose: () => void }) {
  const addCards = useStore((s) => s.addCards);
  const updateGroup = useStore((s) => s.updateCardGroup);
  const [type, setType] = useState<'basic' | 'cloze'>('basic');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [reverse, setReverse] = useState(false);
  const [added, setAdded] = useState(0);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!open) return;
    setType(card?.type ?? 'basic'); setFront(card?.front ?? ''); setBack(card?.back ?? ''); setReverse(false); setAdded(0);
  }, [open, card]);
  const valid = type === 'cloze' ? clozeOrdinals(front).length > 0 : !!front.trim() && !!back.trim();
  const save = (keepOpen: boolean) => {
    if (!valid) return;
    if (card) { updateGroup(card, front, back); onClose(); return; }
    addCards(deckId, [{ type, front: front.trim(), back: back.trim(), reverse }]);
    setAdded((n) => n + 1);
    if (keepOpen) { setFront(''); setBack(''); frontRef.current?.focus(); } else onClose();
  };
  const makeCloze = () => {
    const el = frontRef.current;
    if (!el) return;
    const n = Math.max(0, ...clozeOrdinals(front)) + 1;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = front.slice(a, b) || 'answer';
    setFront(front.slice(0, a) + `{{c${n}::${sel}}}` + front.slice(b));
  };
  return (
    <Modal open={open} onClose={onClose} title={card ? 'Edit card' : 'Add cards'} size="lg">
      <div className="stack">
        {!card && <Seg value={type} onChange={setType} options={[{ value: 'basic', label: 'Basic' }, { value: 'cloze', label: 'Cloze (fill in the blank)' }]} />}
        <div className="grid-2">
          <Field label={type === 'cloze' ? 'Text with deletions' : 'Front'} hint={type === 'cloze' ? 'Select a word and press “Hide selection”, or type {{c1::answer}}. Each c-number becomes its own card.' : 'Markdown and $LaTeX$ supported'}>
            <textarea ref={frontRef} className="textarea" autoFocus value={front} onChange={(e) => setFront(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(true); } if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); makeCloze(); } }} />
            {type === 'cloze' && <Button size="xs" onClick={makeCloze}>Hide selection</Button>}
          </Field>
          <Field label={type === 'cloze' ? 'Extra (optional)' : 'Back'}>
            <textarea className="textarea" value={back} onChange={(e) => setBack(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(true); } }} />
          </Field>
        </div>
        {(front || back) && (
          <div className="card-mini-preview">
            <div className="eyebrow">Preview</div>
            <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(type === 'cloze' ? renderCloze(front, card?.ord ?? clozeOrdinals(front)[0] ?? 1, false) : front) }} />
          </div>
        )}
        {!card && type === 'basic' && <label className="row small"><Switch checked={reverse} onChange={setReverse} label="Reverse" /> Also add the reverse card (back → front)</label>}
        <div className="row">
          {added > 0 && <span className="small success-text">{plural(added, 'card')} added</span>}
          <div className="spacer" />
          <span className="tiny faint hide-mobile"><kbd>{/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd> <kbd>↵</kbd> to {card ? 'save' : 'add another'}</span>
          {!card && <Button onClick={() => save(false)} disabled={!valid}>Add & close</Button>}
          <Button variant="primary" onClick={() => save(!card)} disabled={!valid}>{card ? 'Save' : 'Add card'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Review session

function Review({ deckId, cram }: { deckId?: string; cram?: boolean }) {
  const cards = useStore((s) => s.cards);
  const reviews = useStore((s) => s.reviews);
  const settings = useStore((s) => s.settings);
  const deck = useStore((s) => s.decks.find((d) => d.id === deckId));
  const reviewCard = useStore((s) => s.reviewCard);
  const patch = useStore((s) => s.patch);
  const [queue, setQueue] = useState<string[]>(() => buildQueue(cards, reviews, settings.srs.newPerDay, deckId ? [deckId] : undefined, { cram }));
  const [revealed, setRevealed] = useState(false);
  const [shownAt, setShownAt] = useState(Date.now());
  const [stats, setStats] = useState({ done: 0, again: 0, ms: 0, start: Date.now() });
  const [history, setHistory] = useState<{ card: Card; queue: string[]; reviewsLen: number }[]>([]);
  const [editing, setEditing] = useState<Card | null>(null);
  const initialSize = useRef(queue.length);

  const card = cards.find((c) => c.id === queue[0]);
  const opts = { ...settings.srs, relearnSteps: [10], fuzz: true };
  const outcomes = card ? preview(card.srs, Date.now(), opts, seedOf(card.id) + card.srs.reps) : null;

  const rate = (r: Rating) => {
    if (!card || !revealed) return;
    const ms = Date.now() - shownAt;
    setHistory((h) => [...h.slice(-20), { card, queue, reviewsLen: useStore.getState().reviews.length }]);
    let rest = queue.slice(1);
    if (cram) {
      if (r === 1) rest = [...rest.slice(0, 3), card.id, ...rest.slice(3)];
    } else {
      reviewCard(card.id, r, ms);
      const updated = useStore.getState().cards.find((c) => c.id === card.id)!;
      // re-queue cards still in (re)learning within this session
      if (updated.srs.state === 'learning' || updated.srs.state === 'relearning') {
        const pos = Math.min(rest.length, r === 1 ? 3 : 6);
        rest = [...rest.slice(0, pos), card.id, ...rest.slice(pos)];
      }
    }
    setStats((s) => ({ ...s, done: s.done + 1, again: s.again + (r === 1 ? 1 : 0), ms: s.ms + ms }));
    setQueue(rest);
    setRevealed(false);
    setShownAt(Date.now());
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    if (!cram) useStore.getState().set((s) => ({ cards: s.cards.map((c) => (c.id === last.card.id ? last.card : c)), reviews: s.reviews.slice(0, last.reviewsLen) }));
    setQueue(last.queue);
    setHistory((h) => h.slice(0, -1));
    setStats((s) => ({ ...s, done: Math.max(0, s.done - 1) }));
    setRevealed(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
      if ((e.key === ' ' || e.key === 'Enter') && !revealed) { e.preventDefault(); setRevealed(true); return; }
      if (e.key === ' ' && revealed) { e.preventDefault(); rate(3); return; }
      if (['1', '2', '3', '4'].includes(e.key) && revealed) { e.preventDefault(); rate(Number(e.key) as Rating); }
      if (e.key.toLowerCase() === 'z' || ((e.metaKey || e.ctrlKey) && e.key === 'z')) { e.preventDefault(); undo(); }
      if (e.key.toLowerCase() === 'e' && card) setEditing(card);
      if (e.key === 'Escape') navigate(deckId ? `/cards/${deckId}` : '/cards');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const back = () => navigate(deckId ? `/cards/${deckId}` : '/cards');
  const progress = initialSize.current ? Math.min(1, stats.done / Math.max(initialSize.current, stats.done + queue.length)) : 1;

  if (!card) {
    const minutes = (Date.now() - stats.start) / 60000;
    return (
      <div className="page narrow">
        <div className="panel review-done">
          <div className="done-burst"><CheckCircle2 /></div>
          <h1>{stats.done ? 'Session complete' : 'Nothing to review'}</h1>
          <p className="muted">{stats.done ? `You reviewed ${plural(stats.done, 'card')} in ${formatDuration(Math.max(1, minutes))}.` : 'No cards are due right now. Come back later — or cram if you want extra practice.'}</p>
          {stats.done > 0 && (
            <div className="stat-row" style={{ justifyContent: 'center', margin: '8px 0 4px' }}>
              <div><div className="stat-num">{stats.done}</div><div className="stat-label">reviews</div></div>
              <div><div className="stat-num">{Math.round(((stats.done - stats.again) / stats.done) * 100)}%</div><div className="stat-label">remembered</div></div>
              <div><div className="stat-num">{(stats.ms / stats.done / 1000).toFixed(1)}s</div><div className="stat-label">per card</div></div>
            </div>
          )}
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Button onClick={back}>Back to {deck ? 'deck' : 'decks'}</Button>
            {deckId && <Button icon={<Shuffle />} onClick={() => navigate(`/cards/cram/${deckId}`)}>Cram anyway</Button>}
            <Button variant="primary" onClick={() => navigate('/today')}>Go to Today</Button>
          </div>
        </div>
      </div>
    );
  }

  const d = cards.find((c) => c.id === card.id)!;
  const frontHtml = renderMarkdown(d.type === 'cloze' ? renderCloze(d.front, d.ord ?? 1, false) : d.front);
  const backHtml = renderMarkdown(d.type === 'cloze' ? renderCloze(d.front, d.ord ?? 1, true) + (d.back ? `\n\n${d.back}` : '') : d.back);
  const deckName = useStore.getState().decks.find((x) => x.id === d.deckId)?.name;
  const labels: Record<Rating, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

  return (
    <div className="review-page">
      <div className="review-top">
        <IconButton label="End session" onClick={back}><X /></IconButton>
        <div className="grow review-progress"><div className="bar thin"><i style={{ width: `${progress * 100}%` }} /></div></div>
        <span className="small muted tnum">{queue.length} left</span>
        <IconButton label="Undo (Z)" disabled={!history.length} onClick={undo}><Undo2 /></IconButton>
        <IconButton label="Flag card" active={d.flagged} onClick={() => patch('cards', d.id, { flagged: !d.flagged })}><Flag /></IconButton>
        <IconButton label="Edit card (E)" onClick={() => setEditing(d)}><Pencil /></IconButton>
      </div>
      <div className="review-stage">
        <div className="flashcard" data-revealed={revealed} onClick={() => !revealed && setRevealed(true)}>
          <div className="flashcard-meta">
            <span>{deckName}</span>
            {cram ? <span className="chip sm"><Shuffle />Cram</span> : d.srs.state === 'new' ? <span className="chip sm accent"><Zap />New</span> : d.srs.lapses > 1 ? <span className="chip sm danger"><Brain />Tricky</span> : null}
          </div>
          <div className="flashcard-front md" dangerouslySetInnerHTML={{ __html: frontHtml }} />
          {revealed && <><div className="flashcard-divider" /><div className="flashcard-back md" dangerouslySetInnerHTML={{ __html: backHtml }} /></>}
        </div>
      </div>
      <div className="review-actions">
        {!revealed ? (
          <Button size="lg" variant="primary" className="reveal-btn" icon={<Eye />} onClick={() => setRevealed(true)}>Show answer <kbd>Space</kbd></Button>
        ) : (
          <div className="rate-row">
            {([1, 2, 3, 4] as Rating[]).map((r) => (
              <button key={r} type="button" className="rate-btn" data-r={r} onClick={() => rate(r)}>
                <span className="rate-ivl">{cram ? (r === 1 ? 'again soon' : '—') : outcomes?.[r].label}</span>
                <b>{labels[r]}</b>
                <kbd>{r}</kbd>
              </button>
            ))}
          </div>
        )}
      </div>
      <CardEditor open={!!editing} card={editing} deckId={d.deckId} onClose={() => setEditing(null)} />
    </div>
  );
}
