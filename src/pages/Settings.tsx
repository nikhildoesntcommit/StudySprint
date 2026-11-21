import { useEffect, useState, type CSSProperties } from 'react';
import { User, Palette, BookMarked, LayoutGrid, Brain, Sparkles, Database, Plus, Trash2, Archive, ArchiveRestore, Download, Upload, Eye, EyeOff, CheckCircle2, Loader2, HardDrive, History, Keyboard, Code2, ExternalLink } from 'lucide-react';
import type { AccentId, FontId, Subject, ThemeId } from '../types';
import { useStore } from '../store/store';
import { useUI } from '../store/ui';
import { MODULES, SUBJECT_PRESETS, subjectHex } from '../store/defaults';
import { useRoute } from '../lib/router';
import { exportBackup, hasLegacyData, importLegacy, parseBackup } from '../lib/backup';
import { demoData } from '../lib/demo';
import { AI_MODELS, loadAi } from '../lib/aiConfig';
import { pickFile, plural, readFileText } from '../lib/id';
import { timeAgo } from '../lib/dates';
import { Button, Field, IconButton, Modal, Seg, SettingRow, Switch, toast, useConfirm } from '../components/ui';
import { ColorPicker, EmojiPicker } from '../components/pickers';
import { FocusSettings } from './Focus';
import { MODULE_ICON } from '../components/Shell';

type Tab = 'profile' | 'appearance' | 'subjects' | 'modules' | 'study' | 'ai' | 'data';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette /> },
  { id: 'subjects', label: 'Subjects', icon: <BookMarked /> },
  { id: 'modules', label: 'Modules', icon: <LayoutGrid /> },
  { id: 'study', label: 'Study', icon: <Brain /> },
  { id: 'ai', label: 'AI', icon: <Sparkles /> },
  { id: 'data', label: 'Data', icon: <Database /> },
];

export default function Settings() {
  const { query } = useRoute();
  const [tab, setTab] = useState<Tab>((query.get('tab') as Tab) || 'profile');
  return (
    <div className="page">
      <div className="page-head"><div><h1>Settings</h1><p>Make StudySprint work the way you study.</p></div></div>
      <div className="settings-layout">
        <nav className="settings-nav" role="tablist">
          {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.icon}<span>{t.label}</span></button>)}
        </nav>
        <div className="settings-body">
          {tab === 'profile' && <Profile />}
          {tab === 'appearance' && <Appearance />}
          {tab === 'subjects' && <Subjects />}
          {tab === 'modules' && <Modules />}
          {tab === 'study' && <Study />}
          {tab === 'ai' && <AiSettings />}
          {tab === 'data' && <DataSettings />}
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="panel settings-section">
      <div className="settings-section-head"><h2>{title}</h2>{desc && <p className="small muted">{desc}</p>}</div>
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

function Profile() {
  const s = useStore((x) => x.settings);
  const update = useStore((x) => x.updateSettings);
  return (
    <div className="stack">
      <Section title="About you" desc="Used to personalise greetings and the AI tutor. Stays on this device.">
        <div className="grid-2">
          <Field label="Your name"><input className="input" value={s.name} onChange={(e) => update({ name: e.target.value })} placeholder="What should we call you?" /></Field>
          <Field label="Level">
            <select className="select" value={s.level} onChange={(e) => update({ level: e.target.value as typeof s.level })}>
              <option value="school">School</option><option value="college">College / sixth form</option><option value="university">University</option><option value="self">Self-learner</option>
            </select>
          </Field>
        </div>
      </Section>
      <Section title="Shortcuts">
        <SettingRow title="Keyboard shortcuts" desc="Work faster with your keyboard"><Button size="sm" icon={<Keyboard />} onClick={() => useUI.getState().setShortcuts(true)}>Show</Button></SettingRow>
      </Section>
      <Section title="About StudySprint">
        <p className="small muted">Version 4.0 · local-first. Everything you create is stored in this browser — no account, no tracking.</p>
        <a className="btn sm ghost" style={{ marginTop: 10, width: 'fit-content' }} href="https://github.com/nikhildoesntcommit/StudySprint" target="_blank" rel="noreferrer"><Code2 />Source code<ExternalLink /></a>
      </Section>
    </div>
  );
}

const THEMES: { id: ThemeId; label: string; colors: [string, string, string] }[] = [
  { id: 'system', label: 'Auto', colors: ['#f6f0e3', '#0d1320', '#c84b31'] },
  { id: 'paper', label: 'Paper', colors: ['#f6f0e3', '#fffdf7', '#101827'] },
  { id: 'ink', label: 'Ink', colors: ['#0d1320', '#151d2e', '#f6f0e3'] },
  { id: 'light', label: 'Clean light', colors: ['#f7f5f0', '#ffffff', '#1c1b18'] },
  { id: 'dark', label: 'Clean dark', colors: ['#0e1014', '#161a20', '#eceef2'] },
  { id: 'midnight', label: 'Midnight', colors: ['#0a0f1e', '#111a2e', '#e8ecf8'] },
  { id: 'sepia', label: 'Sepia', colors: ['#f2e9d8', '#fbf6ec', '#3a2e1f'] },
  { id: 'contrast', label: 'High contrast', colors: ['#ffffff', '#ffffff', '#000000'] },
];
const ACCENTS: { id: AccentId; hex: string }[] = [
  { id: 'rust', hex: '#c84b31' }, { id: 'iris', hex: '#5b4cf0' }, { id: 'ocean', hex: '#2b6fe6' }, { id: 'teal', hex: '#0d9488' }, { id: 'forest', hex: '#2f8a4f' },
  { id: 'amber', hex: '#d97706' }, { id: 'coral', hex: '#e5533d' }, { id: 'rose', hex: '#db2777' }, { id: 'grape', hex: '#9333ea' }, { id: 'slate', hex: '#475569' },
];
const FONTS: { id: FontId; label: string; family: string; blurb: string }[] = [
  { id: 'inter', label: 'Inter', family: "'Inter Variable'", blurb: 'Clean and modern (default)' },
  { id: 'atkinson', label: 'Atkinson Hyperlegible', family: "'Atkinson Hyperlegible'", blurb: 'Designed for low-vision readers' },
  { id: 'lexend', label: 'Lexend', family: "'Lexend Variable'", blurb: 'Built to improve reading fluency' },
  { id: 'dyslexic', label: 'OpenDyslexic', family: "'OpenDyslexic'", blurb: 'Weighted letters for dyslexic readers' },
  { id: 'serif', label: 'Fraunces', family: "'Fraunces Variable'", blurb: 'Bookish serif' },
  { id: 'system', label: 'System', family: 'system-ui', blurb: 'Your device’s font' },
];

function Appearance() {
  const s = useStore((x) => x.settings);
  const update = useStore((x) => x.updateSettings);
  return (
    <div className="stack">
      <Section title="Theme">
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button key={t.id} type="button" className="theme-tile" aria-pressed={s.theme === t.id} onClick={() => update({ theme: t.id })}>
              <div className="theme-swatch" style={{ background: t.id === 'system' ? `linear-gradient(135deg, ${t.colors[0]} 50%, ${t.colors[1]} 50%)` : t.colors[0] }}>
                {t.id !== 'system' && <><i style={{ background: t.colors[1] }} /><b style={{ background: t.colors[2] }} /></>}
              </div>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Accent colour">
        <div className="swatches big">
          {ACCENTS.map((a) => <button key={a.id} type="button" className="swatch" role="radio" aria-checked={s.accent === a.id} aria-label={a.id} title={a.id} style={{ '--c': a.hex } as CSSProperties} onClick={() => update({ accent: a.id })} />)}
        </div>
      </Section>
      <Section title="Reading & text" desc="Fonts designed for readability and dyslexia are built in and work offline.">
        <div className="font-grid">
          {FONTS.map((f) => (
            <button key={f.id} type="button" className="font-tile" aria-pressed={s.font === f.id} onClick={() => update({ font: f.id })}>
              <span className="font-sample" style={{ fontFamily: f.family }}>Aa</span>
              <span className="grow" style={{ minWidth: 0 }}><b className="truncate" style={{ display: 'block', fontFamily: f.family }}>{f.label}</b><span className="tiny muted">{f.blurb}</span></span>
            </button>
          ))}
        </div>
        <SettingRow title="Text size" desc={`${Math.round(s.fontScale * 100)}%`}>
          <input type="range" min={0.85} max={1.3} step={0.05} value={s.fontScale} onChange={(e) => update({ fontScale: Number(e.target.value) })} style={{ width: 180 }} aria-label="Text size" />
        </SettingRow>
        <SettingRow title="Serif headings" desc="Use the Fraunces display face for titles"><Switch checked={s.serifHeadings} onChange={(serifHeadings) => update({ serifHeadings })} /></SettingRow>
      </Section>
      <Section title="Layout">
        <SettingRow title="Density"><Seg value={s.density} onChange={(density) => update({ density })} options={[{ value: 'cozy', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} /></SettingRow>
        <SettingRow title="Corners"><Seg value={s.roundness} onChange={(roundness) => update({ roundness })} options={[{ value: 'soft', label: 'Rounded' }, { value: 'sharp', label: 'Sharp' }]} /></SettingRow>
        <SettingRow title="Reduce motion" desc="Turn off animations and transitions"><Switch checked={s.reduceMotion} onChange={(reduceMotion) => update({ reduceMotion })} /></SettingRow>
      </Section>
      <Section title="Date & time">
        <SettingRow title="Week starts on"><Seg value={s.weekStart} onChange={(weekStart) => update({ weekStart })} options={[{ value: 1, label: 'Monday' }, { value: 0, label: 'Sunday' }]} /></SettingRow>
        <SettingRow title="24-hour clock"><Switch checked={s.clock24} onChange={(clock24) => update({ clock24 })} /></SettingRow>
      </Section>
    </div>
  );
}

function Subjects() {
  const subjects = useStore((s) => s.subjects);
  const addSubject = useStore((s) => s.addSubject);
  const upsert = useStore((s) => s.upsert);
  const deleteSubject = useStore((s) => s.deleteSubject);
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Subject | null>(null);
  const live = subjects.filter((s) => !s.archived);
  const archived = subjects.filter((s) => s.archived);
  const presets = SUBJECT_PRESETS.filter((p) => !subjects.some((s) => s.name.toLowerCase() === p.name.toLowerCase()));
  return (
    <div className="stack">
      <Section title="Your subjects" desc="Subjects colour-code everything: tasks, notes, decks, sessions and your timetable.">
        <div className="stack-sm">
          {live.map((s) => (
            <div key={s.id} className="subject-row" style={{ '--c': subjectHex(s.color) } as CSSProperties}>
              <span className="subject-emoji">{s.emoji}</span>
              <div className="grow" style={{ minWidth: 0 }}><b className="truncate" style={{ display: 'block' }}>{s.name}</b><span className="tiny muted">{s.weeklyGoalMin ? `Goal ${Math.round(s.weeklyGoalMin / 60 * 10) / 10}h / week` : 'No weekly goal'}</span></div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Edit</Button>
              <IconButton size="sm" label="Archive" onClick={() => upsert('subjects', { ...s, archived: true })}><Archive /></IconButton>
            </div>
          ))}
          {live.length === 0 && <p className="small muted">No subjects yet — add some below.</p>}
          <Button icon={<Plus />} onClick={() => setEditing({ id: '', name: '', emoji: '📘', color: 'blue', createdAt: Date.now() })}>Add subject</Button>
        </div>
      </Section>
      {presets.length > 0 && (
        <Section title="Quick add">
          <div className="row-wrap">{presets.map((p) => <button key={p.name} type="button" className="chip" onClick={() => { addSubject(p); toast(`Added ${p.name}`); }}>{p.emoji} {p.name}</button>)}</div>
        </Section>
      )}
      {archived.length > 0 && (
        <Section title="Archived" desc="Hidden from pickers but kept with all their history.">
          <div className="stack-sm">
            {archived.map((s) => (
              <div key={s.id} className="subject-row" style={{ '--c': subjectHex(s.color), opacity: 0.75 } as CSSProperties}>
                <span className="subject-emoji">{s.emoji}</span><b className="grow">{s.name}</b>
                <IconButton size="sm" label="Restore" onClick={() => upsert('subjects', { ...s, archived: false })}><ArchiveRestore /></IconButton>
                <IconButton size="sm" label="Delete" onClick={async () => { if (await confirm({ title: `Delete ${s.name}?`, body: 'Items in this subject are kept, just without a subject.', danger: true, confirm: 'Delete' })) deleteSubject(s.id); }}><Trash2 /></IconButton>
              </div>
            ))}
          </div>
        </Section>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit subject' : 'New subject'}>
        {editing && <SubjectForm initial={editing} onDone={(s) => { if (s.id) upsert('subjects', s); else addSubject(s); setEditing(null); }} onDelete={editing.id ? async () => { if (await confirm({ title: `Delete ${editing.name}?`, body: 'Items in this subject are kept, just without a subject.', danger: true, confirm: 'Delete' })) { deleteSubject(editing.id); setEditing(null); } } : undefined} />}
      </Modal>
    </div>
  );
}

function SubjectForm({ initial, onDone, onDelete }: { initial: Subject; onDone: (s: Subject) => void; onDelete?: () => void }) {
  const [s, setS] = useState(initial);
  return (
    <div className="stack">
      <div className="row">
        <span className="subject-emoji big" style={{ '--c': subjectHex(s.color) } as CSSProperties}>{s.emoji}</span>
        <input className="input" autoFocus value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Subject name" />
      </div>
      <Field label="Colour"><ColorPicker value={s.color} onChange={(color) => setS({ ...s, color })} /></Field>
      <Field label="Icon"><EmojiPicker value={s.emoji} onChange={(emoji) => setS({ ...s, emoji })} /></Field>
      <Field label="Weekly study goal (hours)" hint="Shown on your dashboard’s weekly progress">
        <input type="number" className="input" min={0} step={0.5} value={s.weeklyGoalMin ? s.weeklyGoalMin / 60 : ''} onChange={(e) => setS({ ...s, weeklyGoalMin: e.target.value ? Math.round(Number(e.target.value) * 60) : undefined })} />
      </Field>
      <div className="row">
        {onDelete && <Button variant="ghost" className="danger" icon={<Trash2 />} onClick={onDelete}>Delete</Button>}
        <div className="spacer" />
        <Button variant="primary" disabled={!s.name.trim()} onClick={() => onDone({ ...s, name: s.name.trim() })}>Save</Button>
      </div>
    </div>
  );
}

function Modules() {
  const modules = useStore((s) => s.settings.modules);
  const update = useStore((s) => s.updateSettings);
  return (
    <Section title="Modules" desc="Only use what helps. Hidden modules disappear from navigation and the dashboard — your data is kept.">
      <div className="stack-sm">
        {MODULES.map((m) => (
          <div key={m.id} className="module-row">
            <div className="module-icon">{MODULE_ICON[m.id]({})}</div>
            <div className="grow"><b>{m.label}</b><div className="tiny muted">{m.blurb}</div></div>
            <Switch checked={modules[m.id]} label={m.label} onChange={(on) => { if (m.core) return; update({ modules: { ...modules, [m.id]: on } }); }} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function Study() {
  const srs = useStore((s) => s.settings.srs);
  const update = useStore((s) => s.updateSettings);
  const set = (p: Partial<typeof srs>) => update({ srs: { ...srs, ...p } });
  const [steps, setSteps] = useState(srs.steps.join(' '));
  return (
    <div className="stack">
      <Section title="Flashcard scheduling" desc="StudySprint uses FSRS, a modern spaced-repetition algorithm that models how memory decays and schedules each card individually.">
        <SettingRow title={`Target recall: ${Math.round(srs.retention * 100)}%`} desc="Higher means more frequent reviews and better memory. 85–92% suits most students.">
          <input type="range" min={0.75} max={0.97} step={0.01} value={srs.retention} onChange={(e) => set({ retention: Number(e.target.value) })} style={{ width: 180 }} aria-label="Target recall" />
        </SettingRow>
        <SettingRow title="New cards per day" desc="Per deck. Lower this during busy weeks.">
          <input type="number" className="input sm" style={{ width: 90 }} min={0} max={500} value={srs.newPerDay} onChange={(e) => set({ newPerDay: Math.max(0, Number(e.target.value) || 0) })} />
        </SettingRow>
        <SettingRow title="Maximum interval (days)" desc="Cap how far apart reviews can get — useful before a big exam.">
          <input type="number" className="input sm" style={{ width: 90 }} min={7} max={3650} value={srs.maxIntervalDays} onChange={(e) => set({ maxIntervalDays: Math.max(7, Number(e.target.value) || 365) })} />
        </SettingRow>
        <SettingRow title="Learning steps (minutes)" desc="Short-term repeats for new cards, e.g. “1 10”.">
          <input className="input sm" style={{ width: 120 }} value={steps} onChange={(e) => setSteps(e.target.value)} onBlur={() => { const v = steps.split(/[\s,]+/).map(Number).filter((n) => n > 0); if (v.length) set({ steps: v }); else setSteps(srs.steps.join(' ')); }} />
        </SettingRow>
      </Section>
      <Section title="Focus timer"><FocusSettings /></Section>
    </div>
  );
}

function AiSettings() {
  const ai = useStore((s) => s.settings.ai);
  const update = useStore((s) => s.updateSettings);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState<'idle' | 'busy' | 'ok' | string>('idle');
  const test = async () => {
    setTesting('busy');
    const { streamTutor, friendlyError } = await loadAi();
    try {
      await streamTutor({ messages: [{ role: 'user', content: 'Reply with just the word: ready' }], mode: 'explain', onText: () => {} });
      setTesting('ok');
    } catch (e) { setTesting(friendlyError(e)); }
  };
  return (
    <div className="stack">
      <Section title="Claude API key" desc="AI features (tutor, note summaries, flashcard and quiz generation) use Claude with your own Anthropic API key.">
        <Field label="API key" hint={<>Create one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>. Usage is billed to your Anthropic account.</>}>
          <div className="row">
            <input className="input mono" type={show ? 'text' : 'password'} value={ai.key} autoComplete="off" spellCheck={false} placeholder="sk-ant-…" onChange={(e) => { update({ ai: { ...ai, key: e.target.value } }); setTesting('idle'); }} />
            <IconButton label={show ? 'Hide key' : 'Show key'} onClick={() => setShow((v) => !v)}>{show ? <EyeOff /> : <Eye />}</IconButton>
          </div>
        </Field>
        <div className="row-wrap">
          <Button size="sm" disabled={!ai.key.trim() || testing === 'busy'} icon={testing === 'busy' ? <Loader2 className="spin" /> : testing === 'ok' ? <CheckCircle2 /> : undefined} onClick={test}>{testing === 'ok' ? 'Connected' : 'Test connection'}</Button>
          {ai.key && <Button size="sm" variant="ghost" className="danger" onClick={() => { update({ ai: { ...ai, key: '' } }); setTesting('idle'); }}>Remove key</Button>}
          {testing !== 'idle' && testing !== 'busy' && testing !== 'ok' && <span className="small danger-text">{testing}</span>}
        </div>
        <div className="privacy-note small">
          <b>How your key is handled</b>
          <ul>
            <li>Stored only in this browser’s local storage — never in backups unless you choose to include it.</li>
            <li>Sent only to Anthropic’s API (api.anthropic.com) with each request. StudySprint has no server.</li>
            <li>Anyone with access to this browser profile could read it — don’t add it on a shared computer.</li>
          </ul>
        </div>
      </Section>
      <Section title="Model">
        <div className="stack-sm">
          {AI_MODELS.map((m) => (
            <label key={m.id} className="module-row" style={{ cursor: 'pointer' }}>
              <input type="radio" name="model" checked={ai.model === m.id} onChange={() => update({ ai: { ...ai, model: m.id } })} />
              <div className="grow"><b>{m.label}</b><div className="tiny muted">{m.blurb}</div></div>
              <code className="tiny faint">{m.id}</code>
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}

function DataSettings() {
  const data = useStore();
  const importData = useStore((s) => s.importData);
  const resetAll = useStore((s) => s.resetAll);
  const update = useStore((s) => s.updateSettings);
  const confirm = useConfirm();
  const [usage, setUsage] = useState<string>('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [includeKey, setIncludeKey] = useState(false);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage(`${((e.usage ?? 0) / 1024 / 1024).toFixed(1)} MB used`)).catch(() => {});
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    void hasLegacyData().then(setLegacy);
  }, []);
  const counts = [
    plural(data.tasks.length, 'task'), plural(data.notes.length, 'note'), plural(data.cards.length, 'card'),
    plural(data.sessions.length, 'session'), plural(data.papers.length, 'paper'),
  ].join(' · ');
  const [pending, setPending] = useState<ReturnType<typeof parseBackup> | null>(null);
  const doImport = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try { setPending(parseBackup(await readFileText(f))); }
    catch (e) { toast(e instanceof Error ? e.message : 'Import failed', { tone: 'warn' }); }
  };
  const finishImport = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    importData(pending, mode);
    setPending(null);
    toast(mode === 'replace' ? 'Backup restored' : 'Backup merged', { tone: 'success' });
  };
  return (
    <div className="stack">
      <Section title="Your data" desc="Everything lives in this browser on this device. Back up regularly, especially before clearing browser data or switching devices.">
        <p className="small muted">{counts}{usage ? ` · ${usage}` : ''}</p>
        <SettingRow title="Download a backup" desc={data.settings.lastBackupAt ? `Last backup ${timeAgo(data.settings.lastBackupAt)}` : 'You haven’t made a backup yet'}>
          <Button size="sm" variant="primary" icon={<Download />} onClick={() => { exportBackup(includeKey); update({ lastBackupAt: Date.now() }); }}>Download</Button>
        </SettingRow>
        <SettingRow title="Include AI key in backup" desc="Off by default so the key isn’t shared by accident"><Switch checked={includeKey} onChange={setIncludeKey} /></SettingRow>
        <SettingRow title="Restore or merge a backup" desc="Move your data to another device with a backup file"><Button size="sm" icon={<Upload />} onClick={doImport}>Import</Button></SettingRow>
        {persisted === false && (
          <SettingRow title="Protect from automatic cleanup" desc="Ask the browser not to delete StudySprint data when storage runs low">
            <Button size="sm" icon={<HardDrive />} onClick={async () => { const ok = await navigator.storage?.persist?.(); setPersisted(!!ok); toast(ok ? 'Storage is now protected' : 'The browser declined — keep regular backups', { tone: ok ? 'success' : 'warn' }); }}>Protect</Button>
          </SettingRow>
        )}
        {persisted && <p className="tiny success-text">✓ Storage is protected from automatic cleanup.</p>}
      </Section>
      {legacy && (
        <Section title="Previous StudySprint" desc="We found tasks saved by the older version of StudySprint in this browser.">
          <SettingRow title="Import old tasks" desc="Copies tasks from every saved profile. Your old data is left untouched.">
            <Button size="sm" icon={<History />} onClick={async () => { try { const n = await importLegacy(); toast(n ? `Imported ${plural(n, 'task')}` : 'No tasks found', { tone: n ? 'success' : 'info' }); } catch (e) { toast(e instanceof Error ? e.message : 'Import failed', { tone: 'warn' }); } }}>Import</Button>
          </SettingRow>
        </Section>
      )}
      <Section title="Sample data">
        <SettingRow title="Add sample data" desc="Fill StudySprint with example subjects, tasks, notes, decks and history to explore every feature">
          <Button size="sm" onClick={async () => { if (await confirm({ title: 'Add sample data?', body: 'Sample subjects, tasks, notes, flashcards and study history will be added alongside your own.', confirm: 'Add samples' })) { importData(demoData(), 'merge'); toast('Sample data added', { tone: 'success' }); } }}>Add samples</Button>
        </SettingRow>
      </Section>
      <Modal open={!!pending} onClose={() => setPending(null)} title="Import backup"
        footer={<><Button onClick={() => setPending(null)}>Cancel</Button><Button variant="danger" onClick={() => finishImport('replace')}>Replace everything</Button><Button variant="primary" onClick={() => finishImport('merge')}>Merge</Button></>}>
        <p className="small muted"><b>Merge</b> adds anything new from the backup and keeps your current data. <b>Replace</b> wipes this device and restores the backup exactly.</p>
        {pending && <p className="small" style={{ marginTop: 10 }}>Backup contains {plural(pending.tasks?.length ?? 0, 'task')}, {plural(pending.notes?.length ?? 0, 'note')} and {plural(pending.cards?.length ?? 0, 'card')}.</p>}
      </Modal>
      <Section title="Danger zone">
        <SettingRow title="Erase everything" desc="Permanently delete all StudySprint data on this device">
          <Button size="sm" variant="danger" icon={<Trash2 />} onClick={async () => {
            if (await confirm({ title: 'Erase all data?', body: 'This deletes every subject, task, note, card, session and setting on this device. Download a backup first if you might want it back.', confirm: 'Erase everything', danger: true })) {
              resetAll(); localStorage.removeItem('ss.timer'); location.hash = '#/today'; toast('All data erased');
            }
          }}>Erase</Button>
        </SettingRow>
      </Section>
    </div>
  );
}
