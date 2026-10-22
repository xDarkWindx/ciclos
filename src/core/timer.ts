import type { TimerMode } from '../db/repo';

/** Estado do cronômetro. Calculado a partir de timestamps, então sobrevive a reload/segundo plano. */
export interface TimerState {
  // nulos no estudo avulso (fora do ciclo)
  stepId: string | null;
  runId: string | null;
  cycleId: string | null;
  subjectId: string;
  subjectName: string;
  color: string;
  targetSec: number; // tempo a estudar nesta sessão (o que falta da etapa); 0 = livre, sem limite nem alarme
  mode: TimerMode;
  accMs: number; // tempo acumulado até a última pausa
  startedAtMs: number | null; // quando retomou (null = pausado)
  sessionStartedAt: number; // início da sessão (para histórico)
}

export const elapsedMs = (t: TimerState, now: number) => t.accMs + (t.startedAtMs ? now - t.startedAtMs : 0);

export const isRunning = (t: TimerState) => t.startedAtMs !== null;

export const isFree = (t: TimerState) => t.targetSec <= 0;

export const isFinished = (t: TimerState, now: number) => !isFree(t) && elapsedMs(t, now) >= t.targetSec * 1000;

/** Segundos exibidos: regressivo conta até 0, progressivo conta de 0 até a meta; livre só conta para cima. */
export function displaySeconds(t: TimerState, now: number): number {
  const e = elapsedMs(t, now);
  if (isFree(t)) return Math.floor(e / 1000);
  const capped = Math.min(e, t.targetSec * 1000);
  return t.mode === 'regressive' ? Math.ceil((t.targetSec * 1000 - capped) / 1000) : Math.floor(capped / 1000);
}

export const pause = (t: TimerState, now: number): TimerState =>
  isRunning(t) ? { ...t, accMs: elapsedMs(t, now), startedAtMs: null } : t;

export const resume = (t: TimerState, now: number): TimerState =>
  isRunning(t) ? t : { ...t, startedAtMs: now };

/** Momento (ms epoch) em que o cronômetro em execução atinge a meta. */
export const finishAt = (t: TimerState): number | null =>
  t.startedAtMs && !isFree(t) ? t.startedAtMs + (t.targetSec * 1000 - t.accMs) : null;

/** Segundos a registrar ao encerrar: nunca passa da meta (no modo livre, tudo o que contou). */
export const secondsToSave = (t: TimerState, now: number) =>
  Math.floor((isFree(t) ? elapsedMs(t, now) : Math.min(elapsedMs(t, now), t.targetSec * 1000)) / 1000);

export function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "1h 20m", "39m 45s", "2h" */
export function formatDuration(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}
