import { useMemo, useState, type CSSProperties } from 'react';
import { Clock, Flame, Layers, CheckCircle2, ClipboardCheck, Sun, Moon, Sunrise, TrendingUp, Brain } from 'lucide-react';
import { useStore } from '../store/store';
import { subjectHex } from '../store/defaults';
import { activeDays, minutesByDay, retentionRate, streaks } from '../lib/stats';
import { addDays, DAY_SHORT, formatDate, formatDuration, MONTH_SHORT, startOfWeek, today, ymd } from '../lib/dates';
import { Empty, Seg } from '../components/ui';

type Range = 7 | 30 | 90 | 365;

export default function Insights() {
  const s = useStore();
  const [range, setRange] = useState<Range>(30);
  const since = Date.now() - range * 86_400_000;
  const sessions = s.sessions.filter((x) => x.start >= since);
  const reviews = s.reviews.filter((x) => x.at >= since);
  const tasksDone = s.tasks.filter((t) => t.completedAt && t.completedAt >= since);
  const attempts = s.attempts.filter((a) => a.status === 'done' && (a.finishedAt ?? 0) >= since);
  const totalMin = sessions.reduce((a, x) => a + x.minutes, 0);
  const days = useMemo(() => activeDays(s), [s]);
  const st = streaks(days);
  const ret = retentionRate(s.reviews, range);
  const examAvg = attempts.length ? attempts.reduce((a, x) => a + (x.result && x.result.maxScore ? x.result.score / x.result.maxScore : 0), 0) / attempts.length : null;
  const map = useMemo(() => minutesByDay(s.sessions), [s.sessions]);
  const activeInRange = [...days].filter((d) => d >= ymd(new Date(since))).length;

  const hasAny = s.sessions.length || s.reviews.length || s.tasks.some((t) => t.completedAt);
  if (!hasAny) {
    return (
      <div className="page">
        <div className="page-head"><div><h1>Insights</h1><p>See where your time goes and how well it’s sticking.</p></div></div>
        <div className="panel"><Empty icon={<TrendingUp />} title="Your story starts with one session">Complete a focus session, review some flashcards or finish a task — your study patterns will appear here.</Empty></div>
      </div>
    );
  }

  return (
    <div className="page wide">
      <div className="page-head">
        <div><h1>Insights</h1><p>Patterns from your last {range === 365 ? 'year' : `${range} days`}.</p></div>
        <Seg value={range} onChange={setRange} options={[{ value: 7, label: '7d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 365, label: '1y' }]} />
      </div>

      <div className="kpis">
        <Kpi icon={<Clock />} label="Study time" value={formatDuration(totalMin)} sub={`${formatDuration(totalMin / Math.max(1, Math.min(range, activeInRange || 1)))} per active day`} />
        <Kpi icon={<Flame />} label="Streak" value={`${st.current} day${st.current === 1 ? '' : 's'}`} sub={`Best ${st.best} · ${activeInRange} active days`} />
        <Kpi icon={<Layers />} label="Cards reviewed" value={String(reviews.length)} sub={ret !== null ? `${Math.round(ret * 100)}% recall on mature cards` : 'Recall rate appears after a few reviews'} />
        <Kpi icon={<CheckCircle2 />} label="Tasks done" value={String(tasksDone.length)} sub={`${s.tasks.filter((t) => t.status !== 'done').length} still open`} />
        <Kpi icon={<ClipboardCheck />} label="Practice average" value={examAvg === null ? '—' : `${Math.round(examAvg * 100)}%`} sub={`${attempts.length} paper${attempts.length === 1 ? '' : 's'} completed`} />
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head"><h3>Activity</h3><span className="tiny faint">minutes studied per day · last 6 months</span></div>
        <div className="panel-body"><Heatmap map={map} weekStart={s.settings.weekStart} /></div>
      </section>

      <div className="insight-grid">
        <SubjectSplit sessions={sessions} />
        <HourChart sessions={sessions} />
        <WeeklyTrend map={map} weekStart={s.settings.weekStart} />
        <ReviewChart reviews={s.reviews} range={Math.min(range, 30)} />
        {attempts.length > 0 && <ExamTrend attempts={attempts} />}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="panel panel-pad kpi">
      <div className="kpi-icon">{icon}</div>
      <div className="eyebrow">{label}</div>
      <div className="display tnum kpi-value">{value}</div>
      <div className="tiny muted">{sub}</div>
    </div>
  );
}

function Heatmap({ map, weekStart }: { map: Map<string, number>; weekStart: 0 | 1 }) {
  const weeks = 26;
  const start = startOfWeek(addDays(new Date(), -7 * (weeks - 1)), weekStart);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => ymd(addDays(start, i)));
  const level = (m: number) => (m <= 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4);
  const t = today();
  const months: { label: string; col: number }[] = [];
  cells.forEach((d, i) => { if (i % 7 === 0) { const dt = new Date(d); if (dt.getDate() <= 7) months.push({ label: MONTH_SHORT[dt.getMonth()], col: i / 7 }); } });
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-months" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(10px, 18px))` }}>
        {months.map((m) => <span key={m.col} style={{ gridColumn: m.col + 1 }}>{m.label}</span>)}
      </div>
      <div className="heatmap-row">
        <div className="heatmap-days">{Array.from({ length: 7 }, (_, i) => <span key={i}>{i % 2 ? DAY_SHORT[(i + weekStart) % 7].slice(0, 1) : ''}</span>)}</div>
        <div className="heatmap" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(10px, 18px))` }}>
          {cells.map((d) => d > t ? <i key={d} style={{ visibility: 'hidden' }} /> : <i key={d} data-l={level(map.get(d) ?? 0)} data-today={d === t} title={`${formatDate(d, { weekday: true })}: ${formatDuration(map.get(d) ?? 0)}`} />)}
        </div>
      </div>
      <div className="heatmap-legend tiny faint">Less {[0, 1, 2, 3, 4].map((l) => <i key={l} data-l={l} />)} More</div>
    </div>
  );
}

function SubjectSplit({ sessions }: { sessions: { minutes: number; subjectId?: string }[] }) {
  const subjects = useStore((s) => s.subjects);
  const total = sessions.reduce((a, x) => a + x.minutes, 0) || 1;
  const rows = [...subjects.map((s) => ({ name: `${s.emoji} ${s.name}`, color: subjectHex(s.color), m: sessions.filter((x) => x.subjectId === s.id).reduce((a, x) => a + x.minutes, 0) })),
    { name: 'No subject', color: 'var(--text-3)', m: sessions.filter((x) => !x.subjectId).reduce((a, x) => a + x.minutes, 0) }].filter((r) => r.m > 0).sort((a, b) => b.m - a.m);
  let acc = 0;
  const R = 54, C = 2 * Math.PI * R;
  return (
    <section className="panel">
      <div className="panel-head"><h3>Time by subject</h3></div>
      <div className="panel-body donut-wrap">
        {rows.length === 0 ? <p className="small muted">No focus sessions in this range.</p> : <>
          <svg viewBox="0 0 140 140" width="150" height="150" className="ring" aria-hidden>
            <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="16" />
            {rows.map((r) => {
              const len = (r.m / total) * C;
              const el = <circle key={r.name} cx="70" cy="70" r={R} fill="none" stroke={r.color} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} />;
              acc += len;
              return el;
            })}
          </svg>
          <div className="stack-sm grow" style={{ minWidth: 0 }}>
            {rows.map((r) => (
              <div key={r.name} className="row small"><span className="subj-dot" style={{ '--c': r.color } as CSSProperties} /><span className="grow truncate">{r.name}</span><span className="tnum muted">{formatDuration(r.m)}</span><span className="tnum faint" style={{ width: 36, textAlign: 'right' }}>{Math.round((r.m / total) * 100)}%</span></div>
            ))}
          </div>
        </>}
      </div>
    </section>
  );
}

function HourChart({ sessions }: { sessions: { start: number; minutes: number }[] }) {
  const hours = Array.from({ length: 24 }, () => 0);
  sessions.forEach((s) => { hours[new Date(s.start).getHours()] += s.minutes; });
  const max = Math.max(1, ...hours);
  const best = hours.indexOf(Math.max(...hours));
  const label = best < 12 ? 'morning' : best < 17 ? 'afternoon' : best < 21 ? 'evening' : 'night';
  const Icon = best < 12 ? Sunrise : best < 17 ? Sun : Moon;
  return (
    <section className="panel">
      <div className="panel-head"><h3>When you study</h3></div>
      <div className="panel-body">
        {sessions.length === 0 ? <p className="small muted">No sessions in this range.</p> : <>
          <div className="row small muted" style={{ marginBottom: 10 }}><Icon style={{ width: 16, color: 'var(--accent)', flex: 'none' }} /><span>You’re most productive in the <b style={{ color: 'var(--text)' }}>{label}</b>, around {best % 12 || 12}{best < 12 ? 'am' : 'pm'}.</span></div>
          <div className="bars hours">
            {hours.map((m, h) => <div className="b" key={h} title={`${h}:00 — ${formatDuration(m)}`}><div className={m ? '' : 'dim'} style={{ height: `${(m / max) * 100}%` }} /><span>{h % 6 === 0 ? h : ''}</span></div>)}
          </div>
        </>}
      </div>
    </section>
  );
}

function WeeklyTrend({ map, weekStart }: { map: Map<string, number>; weekStart: 0 | 1 }) {
  const weeks = 12;
  const start = startOfWeek(new Date(), weekStart);
  const data = Array.from({ length: weeks }, (_, i) => {
    const ws = addDays(start, -7 * (weeks - 1 - i));
    let m = 0;
    for (let d = 0; d < 7; d++) m += map.get(ymd(addDays(ws, d))) ?? 0;
    return { ws, m };
  });
  const max = Math.max(60, ...data.map((d) => d.m));
  const last = data[data.length - 1].m, prev = data[data.length - 2].m;
  const change = prev ? Math.round(((last - prev) / prev) * 100) : null;
  return (
    <section className="panel">
      <div className="panel-head"><h3>Weekly trend</h3>{change !== null && <span className={`chip sm ${change >= 0 ? 'success' : 'danger'}`}>{change >= 0 ? '+' : ''}{change}% vs last week</span>}</div>
      <div className="panel-body">
        <div className="bars">
          {data.map((d, i) => <div className="b" key={i} data-today={i === weeks - 1} title={`Week of ${formatDate(ymd(d.ws))}: ${formatDuration(d.m)}`}><div className={d.m ? '' : 'dim'} style={{ height: `${(d.m / max) * 100}%` }} /><span>{i % 3 === 0 || i === weeks - 1 ? `${d.ws.getDate()}/${d.ws.getMonth() + 1}` : ''}</span></div>)}
        </div>
      </div>
    </section>
  );
}

function ReviewChart({ reviews, range }: { reviews: { at: number; rating: number }[]; range: number }) {
  const days = Array.from({ length: range }, (_, i) => ymd(addDays(new Date(), i - range + 1)));
  const by = new Map<string, { n: number; ok: number }>();
  reviews.forEach((r) => { const k = ymd(new Date(r.at)); const v = by.get(k) ?? { n: 0, ok: 0 }; v.n++; if (r.rating > 1) v.ok++; by.set(k, v); });
  const max = Math.max(5, ...days.map((d) => by.get(d)?.n ?? 0));
  const total = days.reduce((a, d) => a + (by.get(d)?.n ?? 0), 0);
  return (
    <section className="panel">
      <div className="panel-head"><h3><Brain />Flashcard reviews</h3><span className="tiny faint">{total} in {range} days</span></div>
      <div className="panel-body">
        {total === 0 ? <p className="small muted">No reviews in this range.</p> : (
          <div className="bars stacked">
            {days.map((d) => {
              const v = by.get(d) ?? { n: 0, ok: 0 };
              return (
                <div className="b" key={d} title={`${formatDate(d)}: ${v.n} reviews, ${v.ok} remembered`}>
                  <div className="stack-bar" style={{ height: `${(v.n / max) * 100}%` }}>
                    <i style={{ flex: v.n - v.ok, background: 'var(--danger)' }} /><i style={{ flex: v.ok }} />
                  </div>
                  <span>{range <= 7 ? DAY_SHORT[new Date(d).getDay()][0] : ''}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function ExamTrend({ attempts }: { attempts: { id: string; paperTitle: string; finishedAt?: number; result?: { score: number; maxScore: number } }[] }) {
  const pts = [...attempts].sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0)).map((a) => ({ id: a.id, title: a.paperTitle, p: a.result && a.result.maxScore ? Math.max(0, a.result.score / a.result.maxScore) : 0, at: a.finishedAt ?? 0 }));
  const W = 320, H = 110, P = 8;
  const x = (i: number) => (pts.length === 1 ? W / 2 : P + (i / (pts.length - 1)) * (W - 2 * P));
  const y = (p: number) => H - P - p * (H - 2 * P);
  return (
    <section className="panel">
      <div className="panel-head"><h3><ClipboardCheck />Practice scores</h3></div>
      <div className="panel-body">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden>
          {[0.5, 0.7].map((g) => <line key={g} x1={0} x2={W} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeDasharray="3 4" />)}
          <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" points={pts.map((p, i) => `${x(i)},${y(p.p)}`).join(' ')} />
          {pts.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(p.p)} r="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2"><title>{`${p.title}: ${Math.round(p.p * 100)}%`}</title></circle>)}
        </svg>
        <div className="row tiny faint"><span>{formatDate(ymd(new Date(pts[0].at)))}</span><div className="spacer" /><span>Latest {Math.round(pts[pts.length - 1].p * 100)}%</span></div>
      </div>
    </section>
  );
}
