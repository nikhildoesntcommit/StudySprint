import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowLeft, Sparkles, Upload, History, Check, Plus, Timer, Layers, ListTodo, CalendarDays, NotebookPen, ClipboardCheck, ShieldCheck } from 'lucide-react';
import type { AccentId, FontId, ModuleId, Settings, ThemeId } from '../types';
import { useStore } from '../store/store';
import { MODULES, SUBJECT_PRESETS, subjectHex } from '../store/defaults';
import { demoData } from '../lib/demo';
import { hasLegacyData, importLegacy, parseBackup } from '../lib/backup';
import { pickFile, readFileText } from '../lib/id';
import { Button, Switch, toast } from '../components/ui';
import { BrandMark, MODULE_ICON } from '../components/Shell';

const ACCENTS: { id: AccentId; hex: string }[] = [
  { id: 'iris', hex: '#5b4cf0' }, { id: 'ocean', hex: '#2b6fe6' }, { id: 'teal', hex: '#0d9488' }, { id: 'forest', hex: '#2f8a4f' },
  { id: 'amber', hex: '#d97706' }, { id: 'coral', hex: '#e5533d' }, { id: 'rose', hex: '#db2777' }, { id: 'grape', hex: '#9333ea' },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Settings['level']>('school');
  const [picked, setPicked] = useState<string[]>(['Mathematics', 'English', 'Biology', 'Chemistry', 'History']);
  const [custom, setCustom] = useState('');
  const [extra, setExtra] = useState<string[]>([]);
  const [legacy, setLegacy] = useState(false);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const addSubject = useStore((s) => s.addSubject);
  const importData = useStore((s) => s.importData);
  useEffect(() => { void hasLegacyData().then(setLegacy); }, []);

  const finish = (withSubjects = true) => {
    if (withSubjects) {
      const colors = ['blue', 'violet', 'green', 'teal', 'amber', 'pink', 'cyan', 'orange', 'indigo', 'red', 'lime', 'brown'];
      [...picked, ...extra].forEach((n, i) => {
        const preset = SUBJECT_PRESETS.find((p) => p.name === n);
        addSubject(preset ? { ...preset } : { name: n, emoji: '📘', color: colors[i % colors.length] });
      });
    }
    update({ name: name.trim(), level, onboarded: true });
    location.hash = '#/today';
  };
  const sample = () => {
    importData(demoData(), 'merge');
    update({ name: name.trim(), onboarded: true });
    location.hash = '#/today';
    toast('Sample data loaded — explore away. Add your own anytime.', { tone: 'success' });
  };
  const restore = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try { importData(parseBackup(await readFileText(f)), 'replace'); toast('Backup restored', { tone: 'success' }); location.hash = '#/today'; }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not read that backup', { tone: 'warn' }); }
  };
  const fromLegacy = async () => {
    try {
      const n = await importLegacy();
      update({ onboarded: true });
      toast(`Imported ${n} tasks from the old StudySprint`, { tone: 'success' });
      location.hash = '#/today';
    } catch (e) { toast(e instanceof Error ? e.message : 'Import failed', { tone: 'warn' }); }
  };

  const steps = ['Welcome', 'You', 'Subjects', 'Style', 'Tools'];

  return (
    <div className="onboard">
      <div className="onboard-card">
        {step > 0 && (
          <div className="onboard-progress">
            {steps.slice(1).map((s, i) => <i key={s} data-on={i < step} />)}
          </div>
        )}

        {step === 0 && (
          <div className="onboard-step welcome">
            <BrandMark size={64} />
            <h1 className="display">Study<span className="accent-text">Sprint</span></h1>
            <p className="lead">Plan, focus and remember — everything you need to study, in one calm place that lives on your device.</p>
            <div className="feature-pills">
              <span><ListTodo />Planner</span><span><CalendarDays />Timetable</span><span><Timer />Focus timer</span>
              <span><NotebookPen />Notes</span><span><Layers />Flashcards</span><span><ClipboardCheck />Mock exams</span><span><Sparkles />AI tutor</span>
            </div>
            <div className="stack-sm" style={{ width: '100%', maxWidth: 340 }}>
              <Button size="lg" variant="primary" block onClick={() => setStep(1)}>Set up my space <ArrowRight /></Button>
              <Button size="lg" block icon={<Sparkles />} onClick={sample}>Explore with sample data</Button>
              <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
                <Button size="sm" variant="ghost" icon={<Upload />} onClick={restore}>Restore a backup</Button>
                {legacy && <Button size="sm" variant="ghost" icon={<History />} onClick={fromLegacy}>Import old StudySprint tasks</Button>}
              </div>
            </div>
            <p className="tiny faint row" style={{ gap: 6 }}><ShieldCheck style={{ width: 14 }} />No account. No tracking. Your data never leaves this device.</p>
          </div>
        )}

        {step === 1 && (
          <div className="onboard-step">
            <h2 className="display">Hi there 👋 What should we call you?</h2>
            <input className="input lg-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" onKeyDown={(e) => { if (e.key === 'Enter') setStep(2); }} />
            <div className="label" style={{ marginTop: 8 }}>Where are you studying?</div>
            <div className="choice-grid">
              {([['school', '🏫', 'School'], ['college', '📘', 'College / sixth form'], ['university', '🎓', 'University'], ['self', '🧭', 'Self-learning']] as const).map(([id, e, l]) => (
                <button key={id} type="button" className="choice" aria-pressed={level === id} onClick={() => setLevel(id)}><span className="choice-emoji">{e}</span>{l}</button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboard-step">
            <h2 className="display">What are you studying?</h2>
            <p className="muted">Pick your subjects — they colour-code your tasks, notes, cards and timetable. You can change them any time.</p>
            <div className="subject-picks">
              {SUBJECT_PRESETS.map((p) => {
                const on = picked.includes(p.name);
                return (
                  <button key={p.name} type="button" className="subject-pick" aria-pressed={on} style={{ '--c': subjectHex(p.color) } as CSSProperties}
                    onClick={() => setPicked((xs) => (on ? xs.filter((x) => x !== p.name) : [...xs, p.name]))}>
                    <span>{p.emoji}</span>{p.name}{on && <Check className="pick-check" />}
                  </button>
                );
              })}
              {extra.map((n) => <button key={n} type="button" className="subject-pick" aria-pressed onClick={() => setExtra((xs) => xs.filter((x) => x !== n))}><span>📘</span>{n}<Check className="pick-check" /></button>)}
            </div>
            <div className="row">
              <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add another subject…" onKeyDown={(e) => { if (e.key === 'Enter' && custom.trim()) { setExtra((x) => [...x, custom.trim()]); setCustom(''); } }} />
              <Button icon={<Plus />} disabled={!custom.trim()} onClick={() => { setExtra((x) => [...x, custom.trim()]); setCustom(''); }}>Add</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboard-step">
            <h2 className="display">Make it yours</h2>
            <div className="label">Theme</div>
            <div className="choice-grid three">
              {([['system', '🌗', 'Auto'], ['light', '☀️', 'Light'], ['dark', '🌙', 'Dark'], ['midnight', '🌌', 'Midnight'], ['sepia', '📜', 'Sepia'], ['contrast', '◐', 'High contrast']] as [ThemeId, string, string][]).map(([id, e, l]) => (
                <button key={id} type="button" className="choice" aria-pressed={settings.theme === id} onClick={() => update({ theme: id })}><span className="choice-emoji">{e}</span>{l}</button>
              ))}
            </div>
            <div className="label">Accent</div>
            <div className="swatches big">
              {ACCENTS.map((a) => <button key={a.id} type="button" className="swatch" role="radio" aria-checked={settings.accent === a.id} aria-label={a.id} style={{ '--c': a.hex } as CSSProperties} onClick={() => update({ accent: a.id })} />)}
            </div>
            <div className="label">Reading font</div>
            <div className="choice-grid">
              {([['inter', 'Inter', 'Default'], ['atkinson', 'Atkinson Hyperlegible', 'Extra legible'], ['lexend', 'Lexend', 'Reading fluency'], ['dyslexic', 'OpenDyslexic', 'Dyslexia-friendly']] as [FontId, string, string][]).map(([id, l, d]) => (
                <button key={id} type="button" className="choice left" aria-pressed={settings.font === id} onClick={() => update({ font: id })}>
                  <b style={{ fontFamily: id === 'inter' ? "'Inter Variable'" : id === 'atkinson' ? "'Atkinson Hyperlegible'" : id === 'lexend' ? "'Lexend Variable'" : "'OpenDyslexic'" }}>{l}</b><span className="tiny muted">{d}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="onboard-step">
            <h2 className="display">Pick your tools</h2>
            <p className="muted">Turn off anything you won’t use — StudySprint stays as simple or as powerful as you want. Change this later in Settings.</p>
            <div className="stack-sm">
              {MODULES.map((m) => (
                <div key={m.id} className="module-row">
                  <div className="module-icon">{MODULE_ICON[m.id]({})}</div>
                  <div className="grow"><b>{m.label}</b><div className="tiny muted">{m.blurb}</div></div>
                  <Switch checked={settings.modules[m.id]} label={m.label} onChange={(on) => { if (!m.core) update({ modules: { ...settings.modules, [m.id as ModuleId]: on } }); }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {step > 0 && (
          <div className="onboard-foot">
            <Button variant="ghost" icon={<ArrowLeft />} onClick={() => setStep((s) => s - 1)}>Back</Button>
            <div className="spacer" />
            {step < 4 ? <Button variant="primary" onClick={() => setStep((s) => s + 1)}>Continue <ArrowRight /></Button>
              : <Button variant="primary" onClick={() => finish()}>Start studying <ArrowRight /></Button>}
          </div>
        )}
      </div>
    </div>
  );
}
