import { useEffect, useState } from 'react';
import { ensureRun, getActiveCycle, getCurrentRun, getSubject, listCycles, runProgress, setActiveCycle, updateSubjectNote } from '../db/repo';
import { useVersion } from '../db/store';
import { cancelTimer, dismissFinished, startStep, stopAndSave, togglePause, useFinished, useNow, useTimerState, type FinishInfo } from '../core/controller';
import { displaySeconds, formatClock, formatDuration, isRunning } from '../core/timer';
import { Dot, Empty, Modal } from './common';

export default function Study({ goTo }: { goTo: (t: string) => void }) {
  useVersion();
  const timer = useTimerState();
  const finished = useFinished();
  const now = useNow(!!timer && isRunning(timer));
  const cycle = getActiveCycle();
  const run = cycle ? getCurrentRun(cycle.id) : undefined;
  const steps = cycle && run ? runProgress(cycle.id, run.id) : [];
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [noteFor, setNoteFor] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (cycle && !run) ensureRun(cycle.id); // cria a volta fora do render
  }, [cycle, run]);

  if (!cycle) {
    return (
      <Empty>
        <p>Você ainda não tem um ciclo.</p>
        <button className="btn primary" onClick={() => goTo('ciclos')}>Criar meu primeiro ciclo</button>
      </Empty>
    );
  }
  if (steps.length === 0) {
    return (
      <>
        <CycleHeader />
        <Empty>
          <p>O ciclo “{cycle.name}” ainda não tem etapas.</p>
          <button className="btn primary" onClick={() => goTo('ciclos')}>Adicionar etapas</button>
        </Empty>
      </>
    );
  }

  const total = steps.reduce((a, s) => a + s.targetSec, 0);
  const done = steps.reduce((a, s) => a + Math.min(s.doneSec, s.targetSec), 0);
  const pctAll = total ? (done / total) * 100 : 0;
  const next = steps.find((s) => !s.done);
  const nextId = next?.id;

  return (
    <>
      <CycleHeader />
      <div className="card">
        <div className="row between">
          <strong>Volta nº {run?.number ?? 1}</strong>
          <span className="muted">{formatDuration(done)} de {formatDuration(total)}</span>
        </div>
        <Bar pct={pctAll} />
      </div>

      {!timer && next && run && (
        <button className="btn primary big block" onClick={() => startStep(next, run.id)}>
          ▶ {next.doneSec > 0 ? 'Continuar' : 'Iniciar'}: {next.subjectName}
          <small> · falta {formatDuration(next.remainingSec)}</small>
        </button>
      )}

      {timer && (
        <div className="card timer" style={{ borderColor: timer.color }}>
          <div className="row center muted"><Dot color={timer.color} /> {timer.subjectName}</div>
          {getSubject(timer.subjectId)?.note && <div className="note-box">📝 {getSubject(timer.subjectId)!.note}</div>}
          <div className="clock" aria-live="off">{formatClock(displaySeconds(timer, now))}</div>
          <div className="muted center">
            {timer.mode === 'regressive' ? 'Regressivo' : 'Progressivo'} · meta {formatDuration(timer.targetSec)}
            {!isRunning(timer) && ' · em pausa'}
          </div>
          <div className="row center gap">
            <button className="btn primary big" onClick={togglePause}>{isRunning(timer) ? '⏸ Pausar' : '▶ Continuar'}</button>
            <button className="btn" onClick={stopAndSave}>⏹ Parar e salvar</button>
            <button className="btn danger" onClick={() => setConfirmCancel(true)}>✕ Cancelar</button>
          </div>
        </div>
      )}

      <ul className="list">
        {steps.map((s) => {
          const pct = Math.min(100, (s.doneSec / s.targetSec) * 100);
          const active = timer?.stepId === s.id;
          return (
            <li key={s.id} className={'step' + (s.id === nextId && !timer ? ' next' : '')} style={{ borderLeftColor: s.color }}>
              <div className="grow">
                <div className="name">{s.subjectName}</div>
                {s.note && <div className="note-box small">📝 {s.note}</div>}
                <div className="sub">
                  {s.done ? <span className="ok">Concluído!</span> : <span className="warn">Falta: {formatDuration(s.remainingSec)}</span>}
                  {' – '}<em>Meta: {formatDuration(s.targetSec)}</em>
                </div>
                <Bar pct={pct} done={s.done} />
              </div>
              <div className="stack tight">
                {!s.done && (
                  <button className="btn" disabled={!!timer} onClick={() => run && startStep(s, run.id)}>
                    {active ? 'Em andamento' : '▶ Iniciar'}
                  </button>
                )}
                <button className="btn sm" onClick={() => setNoteFor({ id: s.subjectId, name: s.subjectName })} title="Onde parei (anotação da matéria)" aria-label={`Anotação de ${s.subjectName}`}>
                  📝 {s.note ? 'Editar' : 'Anotar'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {confirmCancel && (
        <Modal title="Cancelar contagem?" onClose={() => setConfirmCancel(false)}>
          <p>O tempo desta contagem será descartado e não entrará no histórico.</p>
          <div className="row end gap">
            <button className="btn" onClick={() => setConfirmCancel(false)}>Voltar</button>
            <button className="btn danger" onClick={() => { cancelTimer(); setConfirmCancel(false); }}>Descartar</button>
          </div>
        </Modal>
      )}

      {finished && <FinishedModal key={finished.subjectId + finished.seconds} info={finished} onClose={dismissFinished} />}
      {noteFor && <NoteModal subjectId={noteFor.id} name={noteFor.name} onClose={() => setNoteFor(null)} />}
    </>
  );
}

function FinishedModal({ info, onClose }: { info: FinishInfo; onClose: () => void }) {
  const [note, setNote] = useState(() => getSubject(info.subjectId)?.note ?? '');
  const close = () => {
    if (note.trim() !== (getSubject(info.subjectId)?.note ?? '')) updateSubjectNote(info.subjectId, note);
    onClose();
  };
  return (
    <Modal title={info.ringing ? '⏰ Tempo concluído!' : 'Sessão salva'} onClose={info.ringing ? undefined : close}>
      <p><Dot color={info.color} /> <strong>{info.subjectName}</strong> — {formatDuration(info.seconds)} registrados.</p>
      {info.runFinished && <p className="ok">🎉 Você fechou a volta do ciclo! Uma nova já foi iniciada.</p>}
      <label>Onde parei (página, exercício…)
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: cap. 3, pág. 45 · questões até a 12" autoFocus={!info.ringing} />
      </label>
      <div className="row end"><button className="btn primary big" onClick={close}>{info.ringing ? 'Parar alarme' : 'Fechar'}</button></div>
    </Modal>
  );
}

function NoteModal({ subjectId, name, onClose }: { subjectId: string; name: string; onClose: () => void }) {
  const [note, setNote] = useState(() => getSubject(subjectId)?.note ?? '');
  return (
    <Modal title={`Onde parei · ${name}`} onClose={onClose}>
      <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: cap. 3, pág. 45 · questões até a 12" autoFocus />
      <div className="row end gap">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={() => { updateSubjectNote(subjectId, note); onClose(); }}>Salvar</button>
      </div>
    </Modal>
  );
}

function CycleHeader() {
  const cycles = listCycles();
  const cycle = getActiveCycle();
  return (
    <div className="row between gap wrap">
      <h2>Estudar</h2>
      {cycles.length > 1 && (
        <select className="input auto" value={cycle?.id} onChange={(e) => setActiveCycle(e.target.value)} aria-label="Ciclo ativo">
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
    </div>
  );
}

export function Bar({ pct, done }: { pct: number; done?: boolean }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={'fill' + (done ? ' done' : '')} style={{ width: `${pct}%` }} />
      <span>{pct.toFixed(1).replace('.', ',')}%</span>
    </div>
  );
}
