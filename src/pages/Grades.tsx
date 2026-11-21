import { useState, type CSSProperties } from 'react';
import { GraduationCap, Plus, Trash2, Target, TrendingUp, ChevronDown, ChevronRight, Calculator } from 'lucide-react';
import type { Assessment, Course } from '../types';
import { useStore } from '../store/store';
import { subjectHex } from '../store/defaults';
import { uid } from '../lib/id';
import { Button, Empty, Field, IconButton, Modal, Seg, useConfirm } from '../components/ui';
import { SubjectSelect } from '../components/pickers';

export function courseStats(c: Course) {
  const totalWeight = c.assessments.reduce((a, x) => a + (x.weight || 0), 0) || 100;
  const graded = c.assessments.filter((x) => x.score !== undefined && x.score !== null && x.max > 0);
  const gradedWeight = graded.reduce((a, x) => a + x.weight, 0);
  const earned = graded.reduce((a, x) => a + (x.score! / x.max) * x.weight, 0);
  const current = gradedWeight > 0 ? (earned / gradedWeight) * 100 : null;
  const remainingWeight = Math.max(0, totalWeight - gradedWeight);
  const needed = remainingWeight > 0 ? ((c.target / 100) * totalWeight - earned) / remainingWeight * 100 : null;
  const guaranteed = (earned / totalWeight) * 100; // if you score 0 on the rest
  const projected = (score: number) => ((earned + (score / 100) * remainingWeight) / totalWeight) * 100;
  return { current, needed, remainingWeight, gradedWeight, totalWeight, guaranteed, projected, earned };
}

export function letter(p: number): string {
  if (p >= 97) return 'A+'; if (p >= 93) return 'A'; if (p >= 90) return 'A−';
  if (p >= 87) return 'B+'; if (p >= 83) return 'B'; if (p >= 80) return 'B−';
  if (p >= 77) return 'C+'; if (p >= 73) return 'C'; if (p >= 70) return 'C−';
  if (p >= 67) return 'D+'; if (p >= 60) return 'D'; return 'F';
}
export function gpa4(p: number): number {
  const map: Record<string, number> = { 'A+': 4, A: 4, 'A−': 3.7, 'B+': 3.3, B: 3, 'B−': 2.7, 'C+': 2.3, C: 2, 'C−': 1.7, 'D+': 1.3, D: 1, F: 0 };
  return map[letter(p)];
}

export function formatGrade(p: number | null, scale: 'percent' | 'us4' | 'letter') {
  if (p === null) return '—';
  if (scale === 'letter') return letter(p);
  if (scale === 'us4') return gpa4(p).toFixed(1);
  return `${p.toFixed(1)}%`;
}

export default function Grades() {
  const courses = useStore((s) => s.courses);
  const subjects = useStore((s) => s.subjects);
  const scale = useStore((s) => s.settings.gradeScale);
  const update = useStore((s) => s.updateSettings);
  const addCourse = useStore((s) => s.addCourse);
  const [open, setOpen] = useState<string | null>(courses[0]?.id ?? null);
  const [adding, setAdding] = useState(false);

  const withGrades = courses.map((c) => ({ c, st: courseStats(c) })).filter((x) => x.st.current !== null);
  const credits = withGrades.reduce((a, x) => a + (x.c.credits || 1), 0);
  const overall = credits ? withGrades.reduce((a, x) => a + x.st.current! * (x.c.credits || 1), 0) / credits : null;
  const gpa = credits ? withGrades.reduce((a, x) => a + gpa4(x.st.current!) * (x.c.credits || 1), 0) / credits : null;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Grades</h1><p>Track every mark, see your average, and know exactly what you need.</p></div>
        <div className="page-actions">
          <Seg value={scale} onChange={(gradeScale) => update({ gradeScale })} options={[{ value: 'percent', label: '%' }, { value: 'letter', label: 'Letter' }, { value: 'us4', label: 'GPA 4.0' }]} />
          <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>Add course</Button>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="panel"><Empty icon={<GraduationCap />} title="No courses yet" action={<Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>Add your first course</Button>}>
          Add each course with its assessments and weightings. StudySprint will work out your current grade and the score you need on what’s left.
        </Empty></div>
      ) : (
        <>
          <div className="stat-cards">
            <div className="panel panel-pad"><div className="eyebrow">Overall average</div><div className="display tnum big-num">{formatGrade(overall, scale === 'us4' ? 'percent' : scale)}</div><div className="small muted">across {withGrades.length} graded course{withGrades.length === 1 ? '' : 's'}</div></div>
            <div className="panel panel-pad"><div className="eyebrow">GPA (4.0)</div><div className="display tnum big-num">{gpa === null ? '—' : gpa.toFixed(2)}</div><div className="small muted">credit-weighted</div></div>
            <div className="panel panel-pad"><div className="eyebrow">On track</div><div className="display tnum big-num">{withGrades.filter((x) => x.st.current! >= x.c.target).length}/{withGrades.length}</div><div className="small muted">courses at or above target</div></div>
          </div>
          <div className="stack" style={{ marginTop: 18 }}>
            {courses.map((c) => <CourseCard key={c.id} course={c} subject={subjects.find((s) => s.id === c.subjectId)} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} scale={scale} />)}
          </div>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add course">
        <NewCourse onDone={(name, subjectId, target) => { const c = addCourse({ name, subjectId, target, assessments: [{ id: uid('as'), name: 'Final exam', weight: 50, max: 100 }, { id: uid('as'), name: 'Coursework', weight: 50, max: 100 }] }); setOpen(c.id); setAdding(false); }} />
      </Modal>
    </div>
  );
}

function NewCourse({ onDone }: { onDone: (name: string, subjectId: string | undefined, target: number) => void }) {
  const subjects = useStore((s) => s.subjects);
  const [subjectId, setSubjectId] = useState<string | undefined>(subjects[0]?.id);
  const [name, setName] = useState(subjects[0]?.name ?? '');
  const [target, setTarget] = useState(80);
  return (
    <div className="stack">
      <Field label="Subject"><SubjectSelect value={subjectId} onChange={(id) => { setSubjectId(id); const s = subjects.find((x) => x.id === id); if (s) setName(s.name); }} /></Field>
      <Field label="Course name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AP Biology" autoFocus /></Field>
      <Field label={`Target grade: ${target}%`}><input type="range" min={40} max={100} value={target} onChange={(e) => setTarget(Number(e.target.value))} /></Field>
      <Button variant="primary" disabled={!name.trim()} onClick={() => onDone(name.trim(), subjectId, target)}>Create course</Button>
    </div>
  );
}

function CourseCard({ course: c, subject, open, onToggle, scale }: { course: Course; subject?: { emoji: string; color: string; name: string }; open: boolean; onToggle: () => void; scale: 'percent' | 'us4' | 'letter' }) {
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const confirm = useConfirm();
  const st = courseStats(c);
  const [whatIf, setWhatIf] = useState(75);
  const color = subjectHex(subject?.color);
  const save = (p: Partial<Course>) => upsert('courses', { ...c, ...p });
  const setA = (id: string, p: Partial<Assessment>) => save({ assessments: c.assessments.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const status = st.current === null ? null : st.current >= c.target ? 'good' : st.needed !== null && st.needed <= 100 ? 'ok' : 'risk';
  return (
    <div className="panel course" style={{ '--c': color } as CSSProperties}>
      <button type="button" className="course-head" onClick={onToggle} aria-expanded={open}>
        {open ? <ChevronDown /> : <ChevronRight />}
        <div className="course-emoji">{subject?.emoji ?? '🎓'}</div>
        <div className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
          <div className="truncate" style={{ fontWeight: 650, fontSize: '1.02rem' }}>{c.name}</div>
          <div className="small muted">
            {st.needed === null ? 'All assessments graded' : st.needed <= 0 ? 'Target already secured 🎉' : st.needed > 100 ? `Target of ${c.target}% is out of reach — aim for ${Math.min(100, st.projected(100)).toFixed(0)}% max` : `Need ${st.needed.toFixed(0)}% on the remaining ${st.remainingWeight}% to reach ${c.target}%`}
          </div>
        </div>
        <div className="course-grade">
          <div className="display tnum" style={{ fontSize: '1.6rem' }}>{formatGrade(st.current, scale)}</div>
          {status && <span className={`chip sm ${status === 'good' ? 'success' : status === 'ok' ? 'warn' : 'danger'}`}>{status === 'good' ? 'On target' : status === 'ok' ? 'Reachable' : 'At risk'}</span>}
        </div>
      </button>
      <div className="course-bar">
        <div className="course-bar-inner">
          <div className="bar"><i style={{ width: `${st.current ?? 0}%`, '--c': color } as CSSProperties} /></div>
          <div className="course-target" style={{ left: `${c.target}%` }} title={`Target ${c.target}%`} />
        </div>
      </div>
      {open && (
        <div className="course-body">
          <div className="assess-table">
            <div className="assess-row head"><span>Assessment</span><span>Weight %</span><span>Score</span><span>Out of</span><span>Result</span><span /></div>
            {c.assessments.map((a) => (
              <div className="assess-row" key={a.id}>
                <input className="input sm" value={a.name} onChange={(e) => setA(a.id, { name: e.target.value })} aria-label="Assessment name" />
                <input className="input sm" type="number" min={0} value={a.weight} onChange={(e) => setA(a.id, { weight: Number(e.target.value) })} aria-label="Weight" />
                <input className="input sm" type="number" min={0} placeholder="—" value={a.score ?? ''} onChange={(e) => setA(a.id, { score: e.target.value === '' ? undefined : Number(e.target.value) })} aria-label="Score" />
                <input className="input sm" type="number" min={1} value={a.max} onChange={(e) => setA(a.id, { max: Number(e.target.value) || 1 })} aria-label="Out of" />
                <span className="tnum small">{a.score !== undefined ? `${((a.score / a.max) * 100).toFixed(0)}%` : <span className="faint">pending</span>}</span>
                <IconButton size="sm" label="Remove" onClick={() => save({ assessments: c.assessments.filter((x) => x.id !== a.id) })}><Trash2 /></IconButton>
              </div>
            ))}
          </div>
          <div className="row-wrap" style={{ marginTop: 10 }}>
            <Button size="sm" icon={<Plus />} onClick={() => save({ assessments: [...c.assessments, { id: uid('as'), name: 'New assessment', weight: 10, max: 100 }] })}>Add assessment</Button>
            <span className={`small ${Math.abs(st.totalWeight - 100) > 0.01 ? 'warn-text' : 'faint'}`}>Weights total {st.totalWeight}%{Math.abs(st.totalWeight - 100) > 0.01 ? ' (usually 100%)' : ''}</span>
          </div>
          <div className="grid-2" style={{ marginTop: 16 }}>
            <div className="panel tint panel-pad stack-sm">
              <div className="row"><Calculator style={{ width: 16, color: 'var(--accent)' }} /><b>What if…</b></div>
              {st.remainingWeight > 0 ? <>
                <div className="small muted">If you average <b className="tnum">{whatIf}%</b> on what’s left, you’ll finish with</div>
                <div className="display tnum" style={{ fontSize: '1.8rem' }}>{formatGrade(st.projected(whatIf), scale)}</div>
                <input type="range" min={0} max={100} value={whatIf} onChange={(e) => setWhatIf(Number(e.target.value))} aria-label="What-if score" />
              </> : <div className="small muted">Every assessment is graded. Final: <b>{formatGrade(st.current, scale)}</b></div>}
            </div>
            <div className="panel tint panel-pad stack-sm">
              <div className="row"><Target style={{ width: 16, color: 'var(--accent)' }} /><b>Target</b></div>
              <div className="row"><input type="range" min={40} max={100} value={c.target} onChange={(e) => save({ target: Number(e.target.value) })} aria-label="Target" /><b className="tnum">{c.target}%</b></div>
              <div className="small muted"><TrendingUp style={{ width: 13, display: 'inline', verticalAlign: -2 }} /> Guaranteed so far: <b className="tnum">{st.guaranteed.toFixed(1)}%</b> of the final grade.</div>
              <div className="row small">Credits <input className="input sm" style={{ width: 70 }} type="number" min={0} step={0.5} value={c.credits} onChange={(e) => save({ credits: Number(e.target.value) })} /></div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <input className="input sm" style={{ maxWidth: 260 }} value={c.name} onChange={(e) => save({ name: e.target.value })} aria-label="Course name" />
            <div className="spacer" />
            <Button size="sm" variant="ghost" className="danger" icon={<Trash2 />} onClick={async () => { if (await confirm({ title: `Delete ${c.name}?`, body: 'Its assessments and marks will be removed.', danger: true, confirm: 'Delete' })) remove('courses', c.id); }}>Delete course</Button>
          </div>
        </div>
      )}
    </div>
  );
}
