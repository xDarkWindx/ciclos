import type { SessionRow } from '../db/repo';
import { NO_CATEGORY } from './categories';

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function secondsByDay(sessions: SessionRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) m.set(dayKey(s.startedAt), (m.get(dayKey(s.startedAt)) ?? 0) + s.seconds);
  return m;
}

/** Últimos `n` dias (do mais antigo ao de hoje) com total de segundos. */
export function lastDays(sessions: SessionRow[], n: number, today = Date.now()) {
  const by = secondsByDay(sessions);
  const out: { key: string; date: Date; seconds: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(startOfDay(today));
    d.setDate(d.getDate() - i);
    const key = dayKey(d.getTime());
    out.push({ key, date: d, seconds: by.get(key) ?? 0 });
  }
  return out;
}

/** Dias consecutivos com estudo, terminando hoje (ou ontem, se hoje ainda não estudou). */
export function streak(sessions: SessionRow[], today = Date.now()): number {
  const by = secondsByDay(sessions);
  const d = new Date(startOfDay(today));
  if (!by.get(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (by.get(dayKey(d.getTime()))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export interface SubjectTotal { subjectId: string; name: string; color: string; seconds: number }

export function totalsBySubject(sessions: SessionRow[], sinceMs = 0): SubjectTotal[] {
  const m = new Map<string, SubjectTotal>();
  for (const s of sessions) {
    if (s.startedAt < sinceMs) continue;
    const cur = m.get(s.subjectId) ?? { subjectId: s.subjectId, name: s.subjectName, color: s.color, seconds: 0 };
    cur.seconds += s.seconds;
    m.set(s.subjectId, cur);
  }
  return [...m.values()].sort((a, b) => b.seconds - a.seconds);
}

export interface CategoryTotal { category: string; seconds: number }

export function totalsByCategory(sessions: SessionRow[], sinceMs = 0): CategoryTotal[] {
  const m = new Map<string, number>();
  for (const s of sessions) {
    if (s.startedAt < sinceMs) continue;
    const c = s.category || NO_CATEGORY;
    m.set(c, (m.get(c) ?? 0) + s.seconds);
  }
  return [...m].map(([category, seconds]) => ({ category, seconds })).sort((a, b) => b.seconds - a.seconds);
}
