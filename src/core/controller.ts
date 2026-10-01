import { useEffect, useState, useSyncExternalStore } from 'react';
import { getTimerMode, saveSession, type StepProgress } from '../db/repo';
import { one, run, schedulePersist } from '../db/sqlite';
import { cancelFinishNotification, keepAwake, requestNotifyPermission, scheduleFinishNotification, startAlarm, stopAlarm, unlockAudio, webNotify } from './alarm';
import { finishAt, isFinished, pause, resume, secondsToSave, type TimerState } from './timer';

// Estado do cronômetro vive fora do React e é persistido na tabela local timer_state.
let state: TimerState | null = null;
const subs = new Set<() => void>();

export interface FinishInfo { subjectName: string; color: string; seconds: number; runFinished: boolean }
let finished: FinishInfo | null = null;

const notify = () => subs.forEach((f) => f());
const subscribe = (cb: () => void) => (subs.add(cb), () => subs.delete(cb));

function persist() {
  run('INSERT INTO timer_state(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json', [state ? JSON.stringify(state) : null]);
  schedulePersist();
}

function set(next: TimerState | null) {
  state = next;
  persist();
  notify();
  void keepAwake(!!next && next.startedAtMs !== null);
}

/** Carrega o cronômetro salvo (chamar após abrir o banco). Se já passou do fim, encerra e avisa. */
export function loadTimer() {
  const row = one<{ json: string | null }>('SELECT json FROM timer_state WHERE id=1');
  state = row?.json ? (JSON.parse(row.json) as TimerState) : null;
  finished = null;
  notify();
  if (state && state.startedAtMs && isFinished(state, Date.now())) complete(true);
}

export function startStep(step: StepProgress, runId: string) {
  if (state) return;
  unlockAudio();
  void requestNotifyPermission();
  const t = Date.now();
  const next: TimerState = {
    stepId: step.id, runId, cycleId: step.cycleId, subjectId: step.subjectId, subjectName: step.subjectName, color: step.color,
    targetSec: step.remainingSec, mode: getTimerMode(), accMs: 0, startedAtMs: t, sessionStartedAt: t,
  };
  finished = null;
  set(next);
  void scheduleFinishNotification(finishAt(next)!, next.subjectName);
}

export function togglePause() {
  if (!state) return;
  unlockAudio();
  const t = Date.now();
  if (state.startedAtMs) {
    set(pause(state, t));
    void cancelFinishNotification();
  } else {
    const next = resume(state, t);
    set(next);
    void scheduleFinishNotification(finishAt(next)!, next.subjectName);
  }
}

/** Descarta a contagem atual sem registrar nada. */
export function cancelTimer() {
  void cancelFinishNotification();
  set(null);
}

/** Encerra antes da meta e registra o que foi estudado (progresso parcial). */
export function stopAndSave(): boolean {
  if (!state) return false;
  const t = state;
  const secs = secondsToSave(t, Date.now());
  void cancelFinishNotification();
  set(null);
  return secs > 0 ? commit(t, secs) : false;
}

function commit(t: TimerState, seconds: number): boolean {
  return saveSession({
    runId: t.runId, stepId: t.stepId, subjectId: t.subjectId, cycleId: t.cycleId,
    startedAt: t.sessionStartedAt, seconds, targetSeconds: t.targetSec, kind: 'timer',
  });
}

function complete(silent = false) {
  if (!state) return;
  const t = state;
  void cancelFinishNotification();
  set(null);
  const runFinished = commit(t, t.targetSec);
  finished = { subjectName: t.subjectName, color: t.color, seconds: t.targetSec, runFinished };
  notify();
  startAlarm(); // se o navegador bloquear áudio sem interação prévia, o aviso na tela continua
  if (!silent) webNotify(t.subjectName);
}

export function dismissFinished() {
  stopAlarm();
  finished = null;
  notify();
}

export function useTimerState() {
  return useSyncExternalStore(subscribe, () => state);
}
export function useFinished() {
  return useSyncExternalStore(subscribe, () => finished);
}

/** Relógio de 250 ms enquanto houver cronômetro rodando; também detecta o término. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (state?.startedAtMs && isFinished(state, n)) complete();
    };
    const id = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    tick();
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active]);
  return now;
}
