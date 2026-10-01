import { useState } from 'react';
import { getActiveCycle, getCurrentRun, getDailyGoalMin, listRuns, listSessions, runProgress } from '../db/repo';
import { useVersion } from '../db/store';
import { lastDays, startOfDay, streak, totalsByCategory, totalsBySubject } from '../core/stats';
import { formatDuration } from '../core/timer';
import { Dot, Empty } from './common';
import { Bar } from './Study';

const DAY = 86_400_000;

export default function Dashboard() {
  useVersion();
  const [period, setPeriod] = useState<7 | 30 | 0>(30);
  const sessions = listSessions();
  const goalSec = getDailyGoalMin() * 60;
  const today = Date.now();
  const days = lastDays(sessions, 14, today);
  const todaySec = days[days.length - 1].seconds;
  const weekSec = days.slice(-7).reduce((a, d) => a + d.seconds, 0);
  const cycle = getActiveCycle();
  const runs = cycle ? listRuns(cycle.id) : [];
  const finishedRuns = runs.filter((r) => r.finishedAt);
  const avgRun = finishedRuns.length ? finishedRuns.reduce((a, r) => a + (r.finishedAt! - r.startedAt), 0) / finishedRuns.length : 0;
  const run = cycle ? getCurrentRun(cycle.id) : undefined;
  const progress = cycle && run ? runProgress(cycle.id, run.id) : [];
  const since = period ? startOfDay(today) - (period - 1) * DAY : 0;
  const totals = totalsBySubject(sessions, since);
  const maxTotal = Math.max(1, ...totals.map((t) => t.seconds));
  const catTotals = totalsByCategory(sessions, since);
  const catSum = catTotals.reduce((a, c) => a + c.seconds, 0) || 1;

  if (sessions.length === 0 && progress.length === 0) {
    return (<><h2>Dashboard</h2><Empty>Os gráficos aparecem assim que você registrar o primeiro estudo.</Empty></>);
  }

  const pctToday = goalSec ? Math.min(100, (todaySec / goalSec) * 100) : 0;

  return (
    <>
      <h2>Dashboard</h2>
      <div className="tiles">
        <div className="tile">
          <span className="muted">Hoje</span>
          <strong>{formatDuration(todaySec)}</strong>
          <Bar pct={pctToday} done={pctToday >= 100} />
          <span className="muted">meta {formatDuration(goalSec)}</span>
        </div>
        <div className="tile"><span className="muted">Últimos 7 dias</span><strong>{formatDuration(weekSec)}</strong><span className="muted">média {formatDuration(weekSec / 7)}/dia</span></div>
        <div className="tile"><span className="muted">Sequência</span><strong>{streak(sessions, today)} {streak(sessions, today) === 1 ? 'dia' : 'dias'}</strong><span className="muted">estudando seguido</span></div>
        <div className="tile"><span className="muted">Voltas concluídas</span><strong>{finishedRuns.length}</strong><span className="muted">{avgRun ? `média ${(avgRun / DAY).toFixed(1).replace('.', ',')} dias/volta` : 'ciclo ativo'}</span></div>
      </div>

      <h3>Últimos 14 dias</h3>
      <div className="card"><DayChart days={days} goalSec={goalSec} /></div>

      {progress.length > 0 && (
        <>
          <h3>Volta atual · {cycle?.name} (nº {run?.number})</h3>
          <div className="card">
            {aggregate(progress).map((p) => (
              <div key={p.name} className="hrow">
                <div className="row between"><span><Dot color={p.color} /> {p.name}</span><span className="muted">{formatDuration(p.done)} / {formatDuration(p.target)}</span></div>
                <Bar pct={Math.min(100, p.target ? (p.done / p.target) * 100 : 0)} done={p.done >= p.target} />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="row between wrap gap">
        <h3>Tempo por matéria</h3>
        <div className="seg" role="group" aria-label="Período">
          {([[7, '7 dias'], [30, '30 dias'], [0, 'Tudo']] as const).map(([v, label]) => (
            <button key={v} className={period === v ? 'on' : ''} onClick={() => setPeriod(v)}>{label}</button>
          ))}
        </div>
      </div>
      {catTotals.length > 0 && (
        <div className="card">
          <strong>Por classificação</strong>
          {catTotals.map((c) => (
            <div key={c.category} className="hrow">
              <div className="row between"><span>{c.category}</span><span><strong>{formatDuration(c.seconds)}</strong> <span className="muted">· {Math.round((c.seconds / catSum) * 100)}%</span></span></div>
              <div className="hbar"><div style={{ width: `${(c.seconds / catSum) * 100}%`, background: 'var(--primary)' }} /></div>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        {totals.length === 0 && <span className="muted">Sem estudo no período.</span>}
        {totals.map((t) => (
          <div key={t.subjectId} className="hrow">
            <div className="row between"><span><Dot color={t.color} /> {t.name}</span><strong>{formatDuration(t.seconds)}</strong></div>
            <div className="hbar"><div style={{ width: `${(t.seconds / maxTotal) * 100}%`, background: t.color }} /></div>
          </div>
        ))}
      </div>
    </>
  );
}

function aggregate(p: ReturnType<typeof runProgress>) {
  const m = new Map<string, { name: string; color: string; done: number; target: number }>();
  p.forEach((s) => {
    const c = m.get(s.subjectId) ?? { name: s.subjectName, color: s.color, done: 0, target: 0 };
    c.done += Math.min(s.doneSec, s.targetSec);
    c.target += s.targetSec;
    m.set(s.subjectId, c);
  });
  return [...m.values()];
}

function DayChart({ days, goalSec }: { days: { key: string; date: Date; seconds: number }[]; goalSec: number }) {
  const W = 560, H = 180, pad = { l: 8, r: 8, t: 14, b: 26 };
  const max = Math.max(goalSec, ...days.map((d) => d.seconds), 3600);
  const bw = (W - pad.l - pad.r) / days.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Horas estudadas por dia nos últimos 14 dias">
      {goalSec > 0 && (
        <>
          <line x1={pad.l} x2={W - pad.r} y1={y(goalSec)} y2={y(goalSec)} className="goal" />
          <text x={W - pad.r} y={y(goalSec) - 4} textAnchor="end" className="axis">meta</text>
        </>
      )}
      {days.map((d, i) => {
        const h = H - pad.b - y(d.seconds);
        const isToday = i === days.length - 1;
        return (
          <g key={d.key}>
            <title>{d.date.toLocaleDateString('pt-BR')} — {formatDuration(d.seconds)}</title>
            <rect x={pad.l + i * bw + bw * 0.15} y={y(d.seconds)} width={bw * 0.7} height={Math.max(0, h)} rx={3} className={isToday ? 'bar-today' : 'bar-day'} />
            {d.seconds > 0 && <text x={pad.l + i * bw + bw / 2} y={y(d.seconds) - 3} textAnchor="middle" className="axis">{(d.seconds / 3600).toFixed(1).replace('.', ',')}</text>}
            <text x={pad.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" className="axis">{d.date.getDate()}</text>
          </g>
        );
      })}
    </svg>
  );
}
