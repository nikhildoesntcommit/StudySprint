import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Square, Plus, Trash2, Copy, NotebookPen, KeyRound, Paperclip, X, MessageSquare, ShieldCheck } from 'lucide-react';
import type { ChatThread } from '../types';
import { useStore } from '../store/store';
import { navigate } from '../lib/router';
import { renderMarkdown } from '../lib/markdown';
import { timeAgo } from '../lib/dates';
import { uid } from '../lib/id';
import { aiReady, friendlyError, streamTutor, TUTOR_MODES } from '../lib/ai';
import { Button, Empty, IconButton, Seg, toast, useConfirm } from '../components/ui';

const STARTERS = [
  'Explain the difference between mitosis and meiosis',
  'Quiz me on quadratic equations, one question at a time',
  'Help me plan an essay on the causes of World War I',
  'What’s the intuition behind derivatives?',
  'Give me a memory trick for the order of the planets',
  'How should I revise for a chemistry exam in 2 weeks?',
];

export default function Tutor() {
  const chats = useStore((s) => s.chats);
  const notes = useStore((s) => s.notes);
  const saveChat = useStore((s) => s.saveChat);
  const remove = useStore((s) => s.remove);
  const hasKey = useStore((s) => !!s.settings.ai.key.trim());
  const confirm = useConfirm();
  const [activeId, setActiveId] = useState<string | null>(chats[0]?.id ?? null);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<keyof typeof TUTOR_MODES>('explain');
  const [noteId, setNoteId] = useState<string>('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const thread = chats.find((c) => c.id === activeId) ?? null;

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread?.messages.length, streaming]);

  if (!hasKey) {
    return (
      <div className="page narrow">
        <div className="page-head"><div><h1>AI Tutor</h1><p>A patient tutor that explains, quizzes and coaches — on your terms.</p></div></div>
        <div className="panel">
          <Empty icon={<KeyRound />} title="Connect your Claude API key" action={<Button variant="primary" onClick={() => navigate('/settings?tab=ai')}>Set up AI</Button>}>
            StudySprint’s AI features run on Claude using your own Anthropic API key. The key is stored only in this browser and requests go directly to Anthropic — StudySprint has no server.
          </Empty>
          <div className="tutor-features">
            <div><Sparkles /><b>Tutor chat</b><span>Explain, Socratic, simple and exam-coach modes</span></div>
            <div><NotebookPen /><b>Note actions</b><span>Summaries, explanations and self-tests from your notes</span></div>
            <div><ShieldCheck /><b>Private by design</b><span>No account, no StudySprint server, your key stays local</span></div>
          </div>
        </div>
      </div>
    );
  }

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || streaming !== null) return;
    const now = Date.now();
    const base: ChatThread = thread ?? { id: uid('chat'), title: content.slice(0, 60), messages: [], createdAt: now, updatedAt: now };
    const t: ChatThread = { ...base, messages: [...base.messages, { role: 'user', content, at: now }], updatedAt: now };
    saveChat(t);
    setActiveId(t.id);
    setInput('');
    setStreaming('');
    const ac = new AbortController();
    abortRef.current = ac;
    const note = notes.find((n) => n.id === noteId);
    let full = '';
    try {
      full = await streamTutor({
        messages: t.messages.map((m) => ({ role: m.role, content: m.content })),
        mode, context: note ? `# ${note.title}\n\n${note.body}` : undefined,
        onText: (x) => { full = x; setStreaming(x); }, signal: ac.signal,
      });
    } catch (e) {
      full = (full ? `${full}\n\n` : '') + `_${friendlyError(e)}_`;
    }
    saveChat({ ...t, messages: [...t.messages, { role: 'assistant', content: full || '_No response._', at: Date.now() }], updatedAt: Date.now() });
    setStreaming(null);
    abortRef.current = null;
    taRef.current?.focus();
  };

  const saveToNote = (text: string) => {
    const n = useStore.getState().addNote({ title: thread?.title ?? 'From AI tutor', body: text });
    toast('Saved as a note', { tone: 'success', action: { label: 'Open', run: () => navigate(`/notes/${n.id}`) } });
  };

  return (
    <div className="page wide tutor-page">
      <div className="tutor-layout">
        <aside className="panel tutor-threads hide-mobile">
          <div className="panel-head"><h3><MessageSquare />Chats</h3><IconButton size="sm" label="New chat" onClick={() => setActiveId(null)}><Plus /></IconButton></div>
          <div className="notes-items">
            {chats.map((c) => (
              <button key={c.id} type="button" className="note-item" aria-current={c.id === activeId ? 'page' : undefined} onClick={() => setActiveId(c.id)} style={{ textAlign: 'left', width: '100%' }}>
                <b className="truncate small">{c.title}</b>
                <div className="tiny faint">{timeAgo(c.updatedAt)} · {c.messages.length} messages</div>
              </button>
            ))}
            {chats.length === 0 && <p className="small muted" style={{ padding: 16 }}>Your conversations are saved on this device.</p>}
          </div>
        </aside>
        <section className="panel tutor-chat">
          <div className="tutor-head">
            <Seg value={mode} onChange={setMode} options={Object.entries(TUTOR_MODES).map(([k, v]) => ({ value: k as keyof typeof TUTOR_MODES, label: v.label }))} />
            <div className="spacer" />
            <Button size="sm" variant="ghost" className="show-mobile" icon={<Plus />} onClick={() => setActiveId(null)}>New</Button>
            {thread && <IconButton size="sm" label="Delete chat" onClick={async () => { if (await confirm({ title: 'Delete this chat?', danger: true, confirm: 'Delete' })) { remove('chats', thread.id); setActiveId(null); } }}><Trash2 /></IconButton>}
          </div>
          <div className="chat-scroll">
            {!thread && streaming === null ? (
              <div className="chat-welcome">
                <div className="empty-icon"><Sparkles /></div>
                <h2>What are we learning today?</h2>
                <p className="muted small">{TUTOR_MODES[mode].instruction ? TUTOR_MODES[mode].instruction.split('.')[0] + '.' : 'Ask anything — concepts, worked examples, essay structure, revision plans.'}</p>
                <div className="starters">{STARTERS.map((s) => <button key={s} type="button" className="starter" onClick={() => void send(s)}>{s}</button>)}</div>
              </div>
            ) : (
              <div className="messages">
                {thread?.messages.map((m, i) => (
                  <div key={i} className={`msg ${m.role}`}>
                    {m.role === 'assistant' ? <>
                      <div className="msg-avatar"><Sparkles /></div>
                      <div className="msg-body">
                        <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                        <div className="msg-actions">
                          <button type="button" onClick={() => { navigator.clipboard?.writeText(m.content); toast('Copied'); }}><Copy />Copy</button>
                          <button type="button" onClick={() => saveToNote(m.content)}><NotebookPen />Save to notes</button>
                        </div>
                      </div>
                    </> : <div className="msg-body">{m.content}</div>}
                  </div>
                ))}
                {streaming !== null && (
                  <div className="msg assistant">
                    <div className="msg-avatar"><Sparkles /></div>
                    <div className="msg-body">{streaming ? <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(streaming) }} /> : <div className="typing"><i /><i /><i /></div>}</div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>
          <div className="composer">
            {noteId && <div className="chip accent attach"><Paperclip />{notes.find((n) => n.id === noteId)?.title || 'Note'}<button type="button" aria-label="Remove" onClick={() => setNoteId('')}><X style={{ width: 12 }} /></button></div>}
            <div className="composer-row">
              <select className="select sm attach-select" value={noteId} onChange={(e) => setNoteId(e.target.value)} title="Attach a note as context" aria-label="Attach a note">
                <option value="">📎 Attach note</option>
                {notes.map((n) => <option key={n.id} value={n.id}>{n.title || 'Untitled'}</option>)}
              </select>
              <textarea ref={taRef} className="composer-input" rows={1} value={input} placeholder="Ask your tutor…" onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
              {streaming !== null
                ? <IconButton label="Stop" onClick={() => abortRef.current?.abort()}><Square /></IconButton>
                : <button type="button" className="send-btn" aria-label="Send" disabled={!input.trim() || !aiReady()} onClick={() => void send()}><Send /></button>}
            </div>
            <div className="tiny faint" style={{ textAlign: 'center' }}>AI can make mistakes — check important facts against your course materials.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
