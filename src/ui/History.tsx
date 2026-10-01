import { useState } from 'react';
import {
  deleteSession, getActiveCycle, getCurrentRun, listSessions, listSubjects, runProgress, saveSession, updateSession, type SessionRow,
} from '../db/repo';
import { isNative } from '../auth/auth';
import { useVersion } from '../db/store';
import { dayKey } from '../core/stats';
import { formatDuration } from '../core/timer';
import { combineDateTime, Empty, fmtDate, fmtRange, fmtTime, Modal, timeValue } from './common';

const DAY_MS = 86_400_000;

export default function History() {
  useVersion();
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SessionRow | null>(null);
  const subjects = listSubjects();
  const all = listSessions();
  const sessions = filter ? all.filter((s) => s.subjectId === filter) : all;

  const groups = new Map<string, SessionRow[]>();
  sessions.forEach((s) => groups.set(dayKey(s.startedAt), [...(groups.get(dayKey(s.startedAt)) ?? []), s]));

  return (
    <>
      <div className="row between gap wrap">
        <h2>Histórico</h2>
        <div className="row gap">
          <button className="btn" onClick={() => setAdding(true)} disabled={subjects.length === 0}>+ Registro manual</button>
          {!isNative() && <button className="btn" onClick={() => exportCsv(all)} disabled={all.length === 0}>⬇ CSV</button>}
        </div>
      </div>
      <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por matéria">
        <option value="">Todas as matérias</option>
        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {sessions.length === 0 && <Empty>Nada registrado ainda. As sessões aparecem aqui quando você conclui ou salva uma contagem.</Empty>}
      {[...groups.entries()].map(([day, rows]) => (
        <section key={day}>
          <h4 className="row between">
            <span>{fmtDate(rows[0].startedAt)}</span>
            <span className="muted">{formatDuration(rows.reduce((a, r) => a + r.seconds, 0))}</span>
          </h4>
          <ul className="list">
            {rows.map((r) => (
              <li key={r.id} className="row gap" style={{ borderLeft: `4px solid ${r.color}` }}>
                <button className="plain grow" onClick={() => setEditing(r)} aria-label={`Editar registro de ${r.subjectName}`}>
                  <div><strong>{r.subjectName}</strong></div>
                  <div className="tiny muted">{fmtRange(r.startedAt, r.endedAt)}{r.kind === 'manual' && ' · manual'}</div>
                  {r.note && <div className="muted note">{r.note}</div>}
                </button>
                <strong>{formatDuration(r.seconds)}</strong>
                <button className="btn sm" onClick={() => setEditing(r)} aria-label="Editar horários">✏️</button>
                <button className="btn sm danger" onClick={() => confirm('Remover este registro?') && deleteSession(r.id)} aria-label="Remover registro">🗑</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {adding && <ManualEntry onClose={() => setAdding(false)} />}
      {editing && <EditSession row={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Estado dos campos data / início / fim / tempo estudado, com o tempo acompanhando o intervalo. */
function useTimeFields(start: number, end: number, seconds: number) {
  const [date, setDate] = useState(dayKey(start));
  const [from, setFrom] = useState(timeValue(start));
  const [to, setTo] = useState(timeValue(end));
  const [secs, setSecs] = useState(seconds);
  // Campos de hora não têm segundos: sem alteração, mantém os horários exatos originais.
  const untouched = date === dayKey(start) && from === timeValue(start) && to === timeValue(end);
  const startMs = untouched ? start : combineDateTime(date, from);
  let endMs = untouched ? end : combineDateTime(date, to);
  if (endMs <= startMs) endMs += DAY_MS; // passou da meia-noite
  const interval = Math.round((endMs - startMs) / 1000);
  // ao mexer no início/fim, o tempo estudado passa a ser o intervalo inteiro (dá para reduzir depois, ex.: pausas)
  const onTimes = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    const s = combineDateTime(date, f);
    let e = combineDateTime(date, t);
    if (e <= s) e += DAY_MS;
    setSecs(Math.round((e - s) / 1000));
  };
  const valid = endMs > startMs && secs > 0 && secs <= interval;
  const fields = (
    <>
      <div className="row gap">
        <label className="grow">Data<input className="input" type="date" value={date} max={dayKey(Date.now())} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="grow">Início<input className="input" type="time" value={from} onChange={(e) => onTimes(e.target.value, to)} /></label>
        <label className="grow">Fim<input className="input" type="time" value={to} onChange={(e) => onTimes(from, e.target.value)} /></label>
      </div>
      <label>Tempo estudado (min) <span className="tiny">— intervalo de {formatDuration(interval)}; reduza se houve pausas</span>
        <input className="input" type="number" min={1} max={Math.ceil(interval / 60)} value={Math.round(secs / 60)} onChange={(e) => setSecs(Math.min(interval, Math.max(0, Number(e.target.value)) * 60))} />
      </label>
    </>
  );
  return { fields, startMs, endMs, secs, valid };
}

function EditSession({ row, onClose }: { row: SessionRow; onClose: () => void }) {
  const t = useTimeFields(row.startedAt, row.endedAt, row.seconds);
  const [note, setNote] = useState(row.note ?? '');
  return (
    <Modal title={`Editar · ${row.subjectName}`} onClose={onClose}>
      {t.fields}
      <input className="input" placeholder="Anotação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row end gap">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!t.valid} onClick={() => { updateSession(row.id, t.startMs, t.endMs, t.secs, note); onClose(); }}>Salvar</button>
      </div>
    </Modal>
  );
}

function ManualEntry({ onClose }: { onClose: () => void }) {
  const subjects = listSubjects();
  const cycle = getActiveCycle();
  const run = cycle ? getCurrentRun(cycle.id) : undefined;
  const steps = cycle && run ? runProgress(cycle.id, run.id) : [];
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [now] = useState(() => Math.floor(Date.now() / 60_000) * 60_000);
  const t = useTimeFields(now - 40 * 60_000, now, 40 * 60);
  const [note, setNote] = useState('');
  const [countInCycle, setCountInCycle] = useState(true);
  // primeira etapa ainda pendente dessa matéria na volta atual (ou a primeira dela, se todas concluídas)
  const step = steps.find((s) => s.subjectId === subjectId && !s.done) ?? steps.find((s) => s.subjectId === subjectId);

  const save = () => {
    saveSession({
      runId: countInCycle && step && run ? run.id : null,
      stepId: countInCycle && step ? step.id : null,
      subjectId, cycleId: countInCycle && step && cycle ? cycle.id : null,
      startedAt: t.startMs, endedAt: t.endMs, seconds: t.secs, targetSeconds: null, kind: 'manual', note,
    });
    onClose();
  };

  return (
    <Modal title="Registro manual" onClose={onClose}>
      <label>Matéria<select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {t.fields}
      <input className="input" placeholder="Anotação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {step && <label className="row gap"><input type="checkbox" checked={countInCycle} onChange={(e) => setCountInCycle(e.target.checked)} /> Contar na volta atual do ciclo</label>}
      <div className="row end gap">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!subjectId || !t.valid} onClick={save}>Salvar</button>
      </div>
    </Modal>
  );
}

function exportCsv(rows: SessionRow[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    'data,inicio,fim,materia,minutos,tipo,anotacao',
    ...rows.map((r) => [dayKey(r.startedAt), fmtTime(r.startedAt), fmtTime(r.endedAt), esc(r.subjectName), (r.seconds / 60).toFixed(1), r.kind, esc(r.note ?? '')].join(',')),
  ];
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'historico-estudos.csv' });
  a.click();
  URL.revokeObjectURL(url);
}
