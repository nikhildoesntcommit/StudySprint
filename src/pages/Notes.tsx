import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Plus, Search, Pin, PinOff, Trash2, NotebookPen, Bold, Italic, Heading2, List, ListChecks, Sigma, Braces, Layers, Eye, Columns2, PenLine,
  ArrowLeft, Sparkles, Link2, Copy, Download, MoreHorizontal, Quote, Code, Loader2,
} from 'lucide-react';
import type { Note } from '../types';
import { useStore } from '../store/store';
import { subjectHex } from '../store/defaults';
import { extractCards, plainText, renderMarkdown, wordCount } from '../lib/markdown';
import { navigate, useRoute } from '../lib/router';
import { timeAgo } from '../lib/dates';
import { getPref, setPref } from '../lib/prefs';
import { download, plural } from '../lib/id';
import { aiReady, loadAi } from '../lib/aiConfig';
import { Button, Empty, Field, IconButton, Menu, MenuItem, Modal, Seg, SubjectChip, toast, useConfirm } from '../components/ui';
import { SubjectSelect } from '../components/pickers';

export default function Notes() {
  const { parts } = useRoute();
  const notes = useStore((s) => s.notes);
  const subjects = useStore((s) => s.subjects);
  const addNote = useStore((s) => s.addNote);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const id = parts[1];
  const current = notes.find((n) => n.id === id);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return notes
      .filter((n) => (!subject || n.subjectId === subject) && (!s || n.title.toLowerCase().includes(s) || n.body.toLowerCase().includes(s) || n.tags.some((t) => t.includes(s))))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
  }, [notes, q, subject]);

  useEffect(() => {
    if (!id && list.length && window.innerWidth > 860) navigate(`/notes/${list[0].id}`, true);
  }, [id, list]);

  const create = () => { const n = addNote({ subjectId: subject ?? undefined }); navigate(`/notes/${n.id}`); };

  return (
    <div className="page wide notes-page">
      <div className={`notes-layout${id ? ' has-note' : ''}`}>
        <aside className="notes-list panel">
          <div className="notes-list-head">
            <div className="row"><h2 className="grow">Notes</h2><Button size="sm" variant="primary" icon={<Plus />} onClick={create}>New</Button></div>
            <div className="search-box"><Search /><input className="input sm" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="row-wrap">
              <button type="button" className="chip sm" aria-pressed={!subject} onClick={() => setSubject(null)}>All</button>
              {subjects.filter((s) => !s.archived && notes.some((n) => n.subjectId === s.id)).map((s) => (
                <button key={s.id} type="button" className="chip sm" aria-pressed={subject === s.id} onClick={() => setSubject(subject === s.id ? null : s.id)}>{s.emoji} {s.name}</button>
              ))}
            </div>
          </div>
          <div className="notes-items">
            {list.map((n) => {
              const sj = subjects.find((s) => s.id === n.subjectId);
              return (
                <a key={n.id} href={`#/notes/${n.id}`} className="note-item" aria-current={n.id === id ? 'page' : undefined} style={{ '--c': subjectHex(sj?.color) } as CSSProperties}>
                  <div className="row" style={{ gap: 6 }}>
                    {n.pinned && <Pin style={{ width: 12, color: 'var(--accent)' }} />}
                    <b className="truncate grow">{n.title || 'Untitled note'}</b>
                  </div>
                  <div className="tiny muted note-snippet">{plainText(n.body, 110) || 'Empty note'}</div>
                  <div className="tiny faint row" style={{ gap: 6 }}>{sj && <span className="subj-dot" />}{sj?.name}{sj && ' · '}{timeAgo(n.updatedAt)}</div>
                </a>
              );
            })}
            {list.length === 0 && <p className="small muted" style={{ padding: 16 }}>{notes.length ? 'No notes match.' : 'No notes yet.'}</p>}
          </div>
        </aside>
        <section className="notes-editor">
          {current ? <Editor key={current.id} note={current} /> : (
            <div className="panel" style={{ height: '100%' }}>
              <Empty icon={<NotebookPen />} title="Write it down, then make it stick" action={<Button variant="primary" icon={<Plus />} onClick={create}>New note</Button>}>
                Notes support Markdown, LaTeX maths ($E=mc^2$), checklists and [[links]] between notes. Lines like “Term :: Definition” or “{'{{c1::cloze}}'}” become flashcards in one click.
              </Empty>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type Mode = 'edit' | 'split' | 'preview';

function Editor({ note }: { note: Note }) {
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const notes = useStore((s) => s.notes);
  const subject = useStore((s) => s.subjects.find((x) => x.id === note.subjectId));
  const aiEnabled = useStore((s) => s.settings.modules.tutor);
  const confirm = useConfirm();
  const [mode, setMode] = useState<Mode>(() => getPref<Mode>('noteMode', note.body ? 'split' : 'edit'));
  const [cardsOpen, setCardsOpen] = useState(false);
  const [ai, setAi] = useState<{ title: string; text: string; busy: boolean } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const save = (p: Partial<Note>) => upsert('notes', { ...note, ...p, updatedAt: Date.now() });
  const html = useMemo(() => renderMarkdown(note.body), [note.body]);
  const cards = useMemo(() => extractCards(note.body), [note.body]);
  const backlinks = notes.filter((n) => n.id !== note.id && note.title && n.body.includes(`[[${note.title}]]`));
  const setM = (m: Mode) => { setMode(m); setPref('noteMode', m); };

  const wrap = (before: string, after = before, placeholder = '') => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const sel = value.slice(a, b) || placeholder;
    const next = value.slice(0, a) + before + sel + after + value.slice(b);
    save({ body: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + sel.length); });
  };
  const linePrefix = (prefix: string) => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: a, value } = el;
    const start = value.lastIndexOf('\n', a - 1) + 1;
    save({ body: value.slice(0, start) + prefix + value.slice(start) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + prefix.length, a + prefix.length); });
  };

  const onPreviewClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a.wikilink') as HTMLAnchorElement | null;
    if (link) {
      e.preventDefault();
      const title = link.dataset.note!;
      const found = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
      if (found) navigate(`/notes/${found.id}`);
      else { const n = useStore.getState().addNote({ title, subjectId: note.subjectId }); navigate(`/notes/${n.id}`); toast(`Created “${title}”`); }
      return;
    }
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      const boxes = Array.from((e.currentTarget as HTMLElement).querySelectorAll('input[type="checkbox"]'));
      const idx = boxes.indexOf(target);
      let n = -1;
      save({ body: note.body.replace(/^(\s*[-*+]\s+\[)([ xX])(\])/gm, (m, a, x, b) => (++n === idx ? `${a}${x === ' ' ? 'x' : ' '}${b}` : m)) });
    }
  };

  const runAi = async (action: 'summarize' | 'explain' | 'questions' | 'improve', title: string) => {
    if (!aiReady()) { toast('Add your Anthropic API key in Settings → AI first', { tone: 'warn', action: { label: 'Settings', run: () => navigate('/settings?tab=ai') } }); return; }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setAi({ title, text: '', busy: true });
    const { streamNoteAction, friendlyError } = await loadAi();
    try {
      await streamNoteAction(action, `# ${note.title}\n\n${note.body}`, (text) => setAi({ title, text, busy: true }), ac.signal);
      setAi((x) => (x ? { ...x, busy: false } : x));
    } catch (err) {
      setAi({ title, text: `**Couldn’t finish:** ${friendlyError(err)}`, busy: false });
    }
  };

  return (
    <div className="panel editor-panel">
      <div className="editor-top">
        <IconButton label="Back to notes" className="show-mobile" onClick={() => navigate('/notes')}><ArrowLeft /></IconButton>
        <input className="note-title" value={note.title} onChange={(e) => save({ title: e.target.value })} placeholder="Untitled note" aria-label="Note title" />
        <Seg value={mode} onChange={setM} label="Editor mode" options={[
          { value: 'edit', label: <PenLine />, title: 'Write' }, { value: 'split', label: <Columns2 />, title: 'Split view' }, { value: 'preview', label: <Eye />, title: 'Preview' },
        ]} />
        <IconButton label={note.pinned ? 'Unpin' : 'Pin'} active={note.pinned} onClick={() => save({ pinned: !note.pinned })}>{note.pinned ? <PinOff /> : <Pin />}</IconButton>
        <Menu trigger={(open) => <IconButton label="More" onClick={open}><MoreHorizontal /></IconButton>}>
          {(close) => <>
            <MenuItem icon={<Copy />} onClick={() => { navigator.clipboard?.writeText(note.body); toast('Copied Markdown'); close(); }}>Copy Markdown</MenuItem>
            <MenuItem icon={<Download />} onClick={() => { download(`${note.title || 'note'}.md`, `# ${note.title}\n\n${note.body}`, 'text/markdown'); close(); }}>Download .md</MenuItem>
            <div className="menu-sep" />
            <MenuItem danger icon={<Trash2 />} onClick={async () => { close(); if (await confirm({ title: 'Delete this note?', body: 'Flashcards made from it are kept.', danger: true, confirm: 'Delete' })) { remove('notes', note.id); navigate('/notes'); } }}>Delete note</MenuItem>
          </>}
        </Menu>
      </div>
      <div className="editor-meta">
        <SubjectSelect className="select sm" value={note.subjectId} onChange={(subjectId) => save({ subjectId })} />
        <input className="input sm" style={{ maxWidth: 220 }} placeholder="Tags, comma separated" value={note.tags.join(', ')} onChange={(e) => save({ tags: e.target.value.split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean) })} />
        <div className="spacer" />
        <Button size="sm" variant={cards.length ? 'soft' : 'ghost'} icon={<Layers />} onClick={() => setCardsOpen(true)}>{cards.length ? `${plural(cards.length, 'flashcard')} found` : 'Flashcards'}</Button>
        {aiEnabled && (
          <Menu trigger={(open) => <Button size="sm" variant="ghost" icon={<Sparkles />} onClick={open}>AI</Button>}>
            {(close) => <>
              <div className="menu-label">Claude</div>
              <MenuItem icon={<Sparkles />} onClick={() => { close(); void runAi('summarize', 'Revision summary'); }}>Summarise into a revision sheet</MenuItem>
              <MenuItem icon={<Sparkles />} onClick={() => { close(); void runAi('explain', 'Clearer explanation'); }}>Explain the hard parts</MenuItem>
              <MenuItem icon={<Sparkles />} onClick={() => { close(); void runAi('questions', 'Self-test questions'); }}>Write self-test questions</MenuItem>
              <MenuItem icon={<Sparkles />} onClick={() => { close(); void runAi('improve', 'Gaps & improvements'); }}>Find gaps & mistakes</MenuItem>
              <MenuItem icon={<Layers />} onClick={() => { close(); navigate(`/cards?generate=${note.id}`); }}>Generate flashcards…</MenuItem>
            </>}
          </Menu>
        )}
      </div>
      {mode !== 'preview' && (
        <div className="md-toolbar">
          <IconButton size="sm" label="Bold" onClick={() => wrap('**', '**', 'bold')}><Bold /></IconButton>
          <IconButton size="sm" label="Italic" onClick={() => wrap('*', '*', 'italic')}><Italic /></IconButton>
          <IconButton size="sm" label="Heading" onClick={() => linePrefix('## ')}><Heading2 /></IconButton>
          <IconButton size="sm" label="Bullet list" onClick={() => linePrefix('- ')}><List /></IconButton>
          <IconButton size="sm" label="Checklist" onClick={() => linePrefix('- [ ] ')}><ListChecks /></IconButton>
          <IconButton size="sm" label="Quote" onClick={() => linePrefix('> ')}><Quote /></IconButton>
          <IconButton size="sm" label="Code" onClick={() => wrap('`', '`', 'code')}><Code /></IconButton>
          <IconButton size="sm" label="Maths (LaTeX)" onClick={() => wrap('$', '$', 'x^2')}><Sigma /></IconButton>
          <IconButton size="sm" label="Link to note" onClick={() => wrap('[[', ']]', 'Note title')}><Link2 /></IconButton>
          <span className="toolbar-sep" />
          <IconButton size="sm" label="Cloze deletion" onClick={() => wrap('{{c1::', '}}', 'answer')}><Braces /></IconButton>
          <button type="button" className="btn ghost xs" onClick={() => wrap('', ' :: answer', 'Question')} title="Flashcard line">Q :: A</button>
        </div>
      )}
      <div className={`editor-body mode-${mode}`}>
        {mode !== 'preview' && (
          <textarea ref={ta} className="note-text" value={note.body} onChange={(e) => save({ body: e.target.value })} spellCheck
            placeholder={'Start writing…\n\n## Headings, **bold**, lists\nMaths: $a^2 + b^2 = c^2$\nFlashcard: Mitochondria :: Site of respiration\nCloze: The capital of France is {{c1::Paris}}.'}
            onKeyDown={(e) => {
              if (e.key === 'Tab') { e.preventDefault(); wrap('  ', ''); }
              if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); wrap('**', '**', 'bold'); }
              if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); wrap('*', '*', 'italic'); }
            }} />
        )}
        {mode !== 'edit' && (
          <div className="note-preview md" onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: html || '<p class="faint">Nothing to preview yet.</p>' }} />
        )}
      </div>
      {ai && (
        <div className="ai-result">
          <div className="row"><Sparkles style={{ width: 16, color: 'var(--accent)' }} /><b className="grow">{ai.title}</b>
            {ai.busy ? <Button size="xs" variant="ghost" onClick={() => abortRef.current?.abort()}><Loader2 className="spin" />Stop</Button> : <>
              <Button size="xs" onClick={() => { save({ body: `${note.body}\n\n---\n\n## ${ai.title}\n\n${ai.text}` }); setAi(null); toast('Added to the note'); }}>Append to note</Button>
              <Button size="xs" variant="ghost" onClick={() => setAi(null)}>Dismiss</Button>
            </>}
          </div>
          <div className="md small" dangerouslySetInnerHTML={{ __html: renderMarkdown(ai.text || '…') }} />
        </div>
      )}
      <div className="editor-foot">
        {subject && <SubjectChip subject={subject} size="sm" />}
        <span>{wordCount(note.body)} words</span>
        <span>Edited {timeAgo(note.updatedAt)}</span>
        {backlinks.length > 0 && <span className="row" style={{ gap: 6 }}><Link2 style={{ width: 12 }} />Linked from {backlinks.map((b) => <a key={b.id} href={`#/notes/${b.id}`}>{b.title}</a>)}</span>}
      </div>
      <MakeCards open={cardsOpen} onClose={() => setCardsOpen(false)} note={note} />
    </div>
  );
}

function MakeCards({ open, onClose, note }: { open: boolean; onClose: () => void; note: Note }) {
  const decks = useStore((s) => s.decks);
  const addDeck = useStore((s) => s.addDeck);
  const addCards = useStore((s) => s.addCards);
  const subject = useStore((s) => s.subjects.find((x) => x.id === note.subjectId));
  const found = extractCards(note.body);
  const preferred = decks.find((d) => d.subjectId && d.subjectId === note.subjectId) ?? decks[0];
  const [deckId, setDeckId] = useState<string>(preferred?.id ?? '__new');
  const [newName, setNewName] = useState(note.title || subject?.name || 'New deck');
  const go = () => {
    const id = deckId === '__new' ? addDeck({ name: newName.trim() || 'New deck', subjectId: note.subjectId }).id : deckId;
    const n = addCards(id, found, { sourceNoteId: note.id, tags: note.tags });
    toast(n ? `Added ${plural(n, 'card')}` : 'Those cards are already in the deck', { tone: n ? 'success' : 'info', action: { label: 'Open deck', run: () => navigate(`/cards/${id}`) } });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Turn this note into flashcards" icon={<Layers style={{ color: 'var(--accent)' }} />}>
      {found.length === 0 ? (
        <div className="stack small">
          <p className="muted">No flashcard lines found yet. Add lines like these anywhere in the note:</p>
          <pre className="code-sample">{`Mitochondria :: Site of aerobic respiration\nPhotosynthesis ::: Making glucose from light   (both directions)\nThe capital of France is {{c1::Paris}}.`}</pre>
          <p className="faint">Or use the AI menu to generate cards automatically.</p>
        </div>
      ) : (
        <div className="stack">
          <div className="card-preview-list">
            {found.slice(0, 50).map((c, i) => (
              <div key={i} className="card-preview">
                <span className="chip sm">{c.type === 'cloze' ? 'Cloze' : c.reverse ? 'Both ways' : 'Basic'}</span>
                <div className="md small grow" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.front, { inline: true }) }} />
                {c.back && <div className="md small muted grow" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.back, { inline: true }) }} />}
              </div>
            ))}
          </div>
          <Field label="Add to deck">
            <select className="select" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
              {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              <option value="__new">+ New deck…</option>
            </select>
          </Field>
          {deckId === '__new' && <Field label="New deck name"><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>}
          <p className="tiny faint">Cards already in the deck are skipped, so you can run this again after adding more lines.</p>
          <Button variant="primary" onClick={go}>Add {plural(found.length, 'card')}</Button>
        </div>
      )}
    </Modal>
  );
}
