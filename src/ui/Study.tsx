import { useEffect, useState } from 'react';
import { ensureRun, getActiveCycle, getCurrentRun, listCycles, listSessions, runProgress, setActiveCycle, updateSessionNote } from '../db/repo';
import { useVersion } from '../db/store';
import { cancelTimer, dismissFinished, startStep, stopAndSave, togglePause, useFinished, useNow, useTimerState } from '../core/controller';
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
  const [lastWasRunEnd, setLastWasRunEnd] = useState(false);

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
  const nextId = steps.find((s) => !s.done)?.id;

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

      {timer && (
        <div className="card timer" style={{ borderColor: timer.color }}>
          <div className="row center muted"><Dot color={timer.color} /> {timer.subjectName}</div>
          <div className="clock" aria-live="off">{formatClock(displaySeconds(timer, now))}</div>
          <div className="muted center">
            {timer.mode === 'regressive' ? 'Regressivo' : 'Progressivo'} · meta {formatDuration(timer.targetSec)}
            {!isRunning(timer) && ' · em pausa'}
          </div>
          <div className="row center gap">
            <button className="btn primary big" onClick={togglePause}>{isRunning(timer) ? '⏸ Pausar' : '▶ Continuar'}</button>
            <button className="btn" onClick={() => setLastWasRunEnd(stopAndSave())}>⏹ Parar e salvar</button>
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
                <div className="sub">
                  {s.done ? <span className="ok">Concluído!</span> : <span className="warn">Falta: {formatDuration(s.remainingSec)}</span>}
                  {' – '}<em>Meta: {formatDuration(s.targetSec)}</em>
                </div>
                <Bar pct={pct} done={s.done} />
              </div>
              {!s.done && (
                <button className="btn" disabled={!!timer} onClick={() => run && startStep(s, run.id)}>
                  {active ? 'Em andamento' : '▶ Iniciar'}
                </button>
              )}
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

      {finished && <FinishedModal info={finished} onClose={dismissFinished} />}
      {lastWasRunEnd && (
        <Modal title="Ciclo concluído! 🎉" onClose={() => setLastWasRunEnd(false)}>
          <p>Você completou a volta. Uma nova volta já foi iniciada.</p>
          <div className="row end"><button className="btn primary" onClick={() => setLastWasRunEnd(false)}>Seguir</button></div>
        </Modal>
      )}
    </>
  );
}

function FinishedModal({ info, onClose }: { info: { subjectName: string; color: string; seconds: number; runFinished: boolean }; onClose: () => void }) {
  const [note, setNote] = useState('');
  const close = () => {
    if (note.trim()) {
      const last = listSessions()[0];
      if (last) updateSessionNote(last.id, note.trim());
    }
    onClose();
  };
  return (
    <Modal title="⏰ Tempo concluído!">
      <p><Dot color={info.color} /> <strong>{info.subjectName}</strong> — {formatDuration(info.seconds)} registrados.</p>
      {info.runFinished && <p className="ok">🎉 Você fechou a volta do ciclo! Uma nova já foi iniciada.</p>}
      <input className="input" placeholder="Anotação (opcional): o que estudou?" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row end"><button className="btn primary big" onClick={close}>Parar alarme</button></div>
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
