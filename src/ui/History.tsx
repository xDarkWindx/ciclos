import { useState } from 'react';
import { deleteSession, listSessions, listSubjects, listSteps, getActiveCycle, getCurrentRun, saveSession, type SessionRow } from '../db/repo';
import { useVersion } from '../db/store';
import { dayKey } from '../core/stats';
import { formatDuration } from '../core/timer';
import { Empty, fmtDate, fmtTime, Modal } from './common';

export default function History() {
  useVersion();
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
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
          <button className="btn" onClick={() => exportCsv(all)} disabled={all.length === 0}>⬇ CSV</button>
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
                <div className="grow">
                  <div><strong>{r.subjectName}</strong> <span className="muted">{fmtTime(r.startedAt)}{r.kind === 'manual' && ' · manual'}</span></div>
                  {r.note && <div className="muted note">{r.note}</div>}
                </div>
                <strong>{formatDuration(r.seconds)}</strong>
                <button className="btn sm danger" onClick={() => confirm('Remover este registro?') && deleteSession(r.id)} aria-label="Remover registro">🗑</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {adding && <ManualEntry onClose={() => setAdding(false)} />}
    </>
  );
}

function ManualEntry({ onClose }: { onClose: () => void }) {
  const subjects = listSubjects();
  const cycle = getActiveCycle();
  const run = cycle ? getCurrentRun(cycle.id) : undefined;
  const steps = cycle && run ? listSteps(cycle.id) : [];
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [min, setMin] = useState(30);
  const [date, setDate] = useState(() => dayKey(Date.now()));
  const [note, setNote] = useState('');
  const [countInCycle, setCountInCycle] = useState(true);
  const step = steps.find((s) => s.subjectId === subjectId); // primeira etapa dessa matéria

  const save = () => {
    const [y, m, d] = date.split('-').map(Number);
    const at = new Date(y, m - 1, d, 12, 0).getTime();
    saveSession({
      runId: countInCycle && step && run ? run.id : null,
      stepId: countInCycle && step ? step.id : null,
      subjectId, cycleId: countInCycle && step && cycle ? cycle.id : null,
      startedAt: at, seconds: min * 60, targetSeconds: null, kind: 'manual', note,
    });
    onClose();
  };

  return (
    <Modal title="Registro manual" onClose={onClose}>
      <label>Matéria<select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <div className="row gap">
        <label className="grow">Data<input className="input" type="date" value={date} max={dayKey(Date.now())} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="grow">Minutos<input className="input" type="number" min={1} value={min} onChange={(e) => setMin(Number(e.target.value))} /></label>
      </div>
      <input className="input" placeholder="Anotação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {step && <label className="row gap"><input type="checkbox" checked={countInCycle} onChange={(e) => setCountInCycle(e.target.checked)} /> Contar na volta atual do ciclo</label>}
      <div className="row end gap">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!subjectId || !(min > 0)} onClick={save}>Salvar</button>
      </div>
    </Modal>
  );
}

function exportCsv(rows: SessionRow[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = ['data,hora,materia,minutos,tipo,anotacao', ...rows.map((r) => [dayKey(r.startedAt), fmtTime(r.startedAt), esc(r.subjectName), (r.seconds / 60).toFixed(1), r.kind, esc(r.note ?? '')].join(','))];
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'historico-estudos.csv' });
  a.click();
  URL.revokeObjectURL(url);
}
