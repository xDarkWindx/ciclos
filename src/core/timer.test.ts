import { describe, expect, it } from 'vitest';
import { displaySeconds, elapsedMs, finishAt, formatDuration, isFinished, pause, resume, secondsToSave, type TimerState } from './timer';
import { lastDays, streak } from './stats';
import type { SessionRow } from '../db/repo';

const base: TimerState = {
  stepId: 's', runId: 'r', cycleId: 'c', subjectId: 'x', subjectName: 'X', color: '#000',
  targetSec: 40 * 60, mode: 'regressive', accMs: 0, startedAtMs: 1000, sessionStartedAt: 1000,
};

describe('timer', () => {
  it('conta regressivo e progressivo', () => {
    expect(displaySeconds(base, 1000 + 60_000)).toBe(39 * 60);
    expect(displaySeconds({ ...base, mode: 'progressive' }, 1000 + 60_000)).toBe(60);
  });
  it('pausa e retoma sem perder tempo', () => {
    const p = pause(base, 11_000);
    expect(p.startedAtMs).toBeNull();
    expect(elapsedMs(p, 999_999)).toBe(10_000);
    const r = resume(p, 50_000);
    expect(elapsedMs(r, 55_000)).toBe(15_000);
    expect(finishAt(r)).toBe(50_000 + 2400_000 - 10_000);
  });
  it('termina na meta e não registra além dela', () => {
    const late = 1000 + 3 * 3600_000;
    expect(isFinished(base, late)).toBe(true);
    expect(secondsToSave(base, late)).toBe(2400);
    expect(displaySeconds(base, late)).toBe(0);
  });
  it('formata duração', () => {
    expect(formatDuration(2385)).toBe('39m 45s');
    expect(formatDuration(4800)).toBe('1h 20m');
    expect(formatDuration(7200)).toBe('2h');
  });
});

describe('stats', () => {
  const at = (d: number, h = 12) => new Date(2026, 0, d, h).getTime();
  const sess = (ms: number, seconds = 600) => ({ startedAt: ms, seconds }) as SessionRow;
  it('sequência considera hoje ou ontem', () => {
    const today = at(10);
    expect(streak([sess(at(9)), sess(at(8)), sess(at(6))], today)).toBe(2);
    expect(streak([sess(at(10)), sess(at(9))], today)).toBe(2);
    expect(streak([], today)).toBe(0);
  });
  it('lastDays preenche dias sem estudo', () => {
    const d = lastDays([sess(at(10), 60)], 3, at(10));
    expect(d.map((x) => x.seconds)).toEqual([0, 0, 60]);
  });
});
