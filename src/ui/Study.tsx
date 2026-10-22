import { useEffect, useState } from 'react';
import { closeRunIfComplete, ensureRun, getActiveCycle, getCurrentRun, getSubject, listCycles, listExtraSubjects, runProgress, subjectSecondsSince, runSessionTimes, setActiveCycle, updateSubjectNote } from '../db/repo';
import { useVersion } from '../db/store';
import { cancelTimer, startFree, startStep, stopAndSave, togglePause, useNow, useTimerState } from '../core/controller';
import { displaySeconds, finishAt, formatClock, formatDuration, isFree, isRunning, type TimerState } from '../core/timer';
import { Dot, Empty, fmtRange, fmtTime, Modal } from './common';

export default function Study({ goTo }: { goTo: (t: string) => void }) {
  useVersion();
  const timer = useTimerState();
  const cycle = getActiveCycle();
  const run = cycle ? getCurrentRun(cycle.id) : undefined;
  const steps = cycle && run ? runProgress(cycle.id, run.id) : [];
  const times = run ? runSessionTimes(run.id) : new Map<string, { start: number; end: number }[]>();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [noteFor, setNoteFor] = useState<{ id: string; name: string } | null>(null);
  const [hideDone, setHideDone] = useState(() => localStorage.getItem('ciclos.hideDone') === '1');
  const toggleHideDone = () => {
    localStorage.setItem('ciclos.hideDone', hideDone ? '0' : '1');
    setHideDone(!hideDone);
  };

  const allDone = steps.length > 0 && steps.every((s) => s.done);
  useEffect(() => {
    if (!cycle) return;
    if (!run) ensureRun(cycle.id); // cria a volta fora do render
    else if (allDone && !timer) closeRunIfComplete(cycle.id); // completou por edição do ciclo ou sincronização
  }, [cycle?.id, run?.id, allDone, timer]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = steps.reduce((a, s) => a + s.targetSec, 0);
  const done = steps.reduce((a, s) => a + Math.min(s.doneSec, s.targetSec), 0);
  const pctAll = total ? (done / total) * 100 : 0;
  const next = steps.find((s) => !s.done);
  const nextId = next?.id;
  const doneCount = steps.filter((s) => s.done).length;
  const visibleSteps = hideDone ? steps.filter((s) => !s.done) : steps;

  return (
    <>
      <CycleHeader />

      {cycle && steps.length > 0 && (
        <div className="card">
          <div className="row between">
            <strong>Volta nº {run?.number ?? 1}</strong>
            <span className="muted">{formatDuration(done)} de {formatDuration(total)}</span>
          </div>
          <Bar pct={pctAll} />
          {doneCount > 0 && (
            <button className="plain link tiny" onClick={toggleHideDone}>
              {hideDone ? `Mostrar ${doneCount} concluída${doneCount > 1 ? 's' : ''}` : `Ocultar ${doneCount} concluída${doneCount > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}

      {!timer && next && run && (
        <button className="btn primary big block" onClick={() => startStep(next, run.id)}>
          ▶ {next.doneSec > 0 ? 'Continuar' : 'Iniciar'}: {next.subjectName}
          <small> · falta {formatDuration(next.remainingSec)}</small>
        </button>
      )}

      {timer && <TimerCard timer={timer} onCancel={() => setConfirmCancel(true)} />}

      {!cycle && (
        <Empty>
          <p>Você ainda não tem um ciclo.</p>
          <button className="btn primary" onClick={() => goTo('ciclos')}>Criar meu primeiro ciclo</button>
        </Empty>
      )}
      {cycle && steps.length === 0 && (
        <Empty>
          <p>O ciclo “{cycle.name}” ainda não tem etapas.</p>
          <button className="btn primary" onClick={() => goTo('ciclos')}>Adicionar etapas</button>
        </Empty>
      )}

      {steps.length > 0 && (
      <ul className="list">
        {visibleSteps.map((s) => {
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
                {times.get(s.id) && (
                  <div className="tiny muted">⏱ {times.get(s.id)!.map((t) => fmtRange(t.start, t.end)).join(' · ')}</div>
                )}
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
      )}

      <FreeStudy disabled={!!timer} goTo={goTo} onNote={setNoteFor} />

      {confirmCancel && (
        <Modal title="Cancelar contagem?" onClose={() => setConfirmCancel(false)}>
          <p>O tempo desta contagem será descartado e não entrará no histórico.</p>
          <div className="row end gap">
            <button className="btn" onClick={() => setConfirmCancel(false)}>Voltar</button>
            <button className="btn danger" onClick={() => { cancelTimer(); setConfirmCancel(false); }}>Descartar</button>
          </div>
        </Modal>
      )}

      {noteFor && <NoteModal subjectId={noteFor.id} name={noteFor.name} onClose={() => setNoteFor(null)} />}
    </>
  );
}

/** Cartão do cronômetro em andamento. Só ele redesenha a cada tick (não a tela inteira). */
function TimerCard({ timer, onCancel }: { timer: TimerState; onCancel: () => void }) {
  const now = useNow(isRunning(timer));
  const note = getSubject(timer.subjectId)?.note;
  return (
    <div className="card timer" style={{ borderColor: timer.color }}>
      <div className="row center muted"><Dot color={timer.color} /> {timer.subjectName}{!timer.stepId && ' · avulso'}</div>
      {note && <div className="note-box">📝 {note}</div>}
      <div className="clock" aria-live="off">{formatClock(displaySeconds(timer, now))}</div>
      <div className="muted center">
        {isFree(timer) ? 'Livre (sem limite)' : `${timer.mode === 'regressive' ? 'Regressivo' : 'Progressivo'} · meta ${formatDuration(timer.targetSec)}`}
        {!isRunning(timer) && ' · em pausa'}
      </div>
      <div className="tiny muted center">
        início {fmtTime(timer.sessionStartedAt)}
        {isRunning(timer) && finishAt(timer) !== null ? ` · término previsto ${fmtTime(finishAt(timer)!)}` : ''}
      </div>
      <div className="row center gap">
        <button className="btn primary big" onClick={togglePause}>{isRunning(timer) ? '⏸ Pausar' : '▶ Continuar'}</button>
        <button className="btn" onClick={stopAndSave}>⏹ Parar e salvar</button>
        <button className="btn danger" onClick={onCancel}>✕ Cancelar</button>
      </div>
    </div>
  );
}

/** Estudo avulso: matérias fora dos ciclos (ex.: japonês, guitarra), só para controle de tempo. */
function FreeStudy({ disabled, goTo, onNote }: { disabled: boolean; goTo: (t: string) => void; onNote: (n: { id: string; name: string }) => void }) {
  const extras = listExtraSubjects();
  const [subjectId, setSubjectId] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [free, setFree] = useState(false);
  const subject = extras.find((s) => s.id === subjectId) ?? extras[0];
  const weekAgo = Date.now() - 7 * 86_400_000;
  const week = subject ? subjectSecondsSince(subject.id, weekAgo) : 0;

  return (
    <>
      <h3>Estudo avulso</h3>
      {extras.length === 0 ? (
        <div className="card muted small">
          Para registrar o tempo de algo fora do concurso (ex.: japonês, guitarra), cadastre a matéria como <strong>avulsa</strong> na aba{' '}
          <button className="plain link" onClick={() => goTo('materias')}>Matérias</button>. Ela fica fora dos ciclos e das metas.
        </div>
      ) : (
        <div className="card stack">
          <div className="row gap wrap">
            <select className="input grow step-subject" value={subject?.id} onChange={(e) => setSubjectId(e.target.value)} aria-label="Matéria avulsa">
              {extras.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {!free && <><input className="minutes" type="number" min={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Minutos" /> <span className="muted">min</span></>}
          </div>
          <label className="row gap"><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> Livre (sem limite, sem alarme)</label>
          {subject?.note && <div className="note-box small">📝 {subject.note}</div>}
          <div className="row between gap wrap">
            <span className="tiny muted">{subject ? `últimos 7 dias: ${formatDuration(week)}` : ''}</span>
            <div className="row gap">
              {subject && <button className="btn sm" onClick={() => onNote({ id: subject.id, name: subject.name })}>📝 Anotar</button>}
              <button className="btn primary" disabled={disabled || !subject || (!free && !(minutes > 0))} onClick={() => subject && startFree(subject, free ? 0 : minutes)}>▶ Iniciar</button>
            </div>
          </div>
        </div>
      )}
    </>
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
