import { all, one, run } from './sqlite';
import { markDirty } from './store';
import { pickDistinctColor } from '../core/colors';
import { DEFAULT_CATEGORIES } from '../core/categories';

export const uid = () => crypto.randomUUID();
const now = () => Date.now();

// ---------- Matérias ----------
export interface Subject { id: string; name: string; color: string; category: string; note: string }


export const listSubjects = () =>
  all<Subject>('SELECT id,name,color,category,note FROM subjects WHERE deleted=0 ORDER BY name COLLATE NOCASE');

/** Sugestões + classificações já usadas (sem repetir, ordenadas). */
export function listCategories(): string[] {
  const used = all<{ category: string }>("SELECT DISTINCT category FROM subjects WHERE deleted=0 AND category<>''").map((r) => r.category);
  const lower = new Set(DEFAULT_CATEGORIES.map((c) => c.toLowerCase()));
  return [...DEFAULT_CATEGORIES, ...used.filter((c) => !lower.has(c.toLowerCase())).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
}

export const getSubject = (id: string) =>
  one<Subject>('SELECT id,name,color,category,note FROM subjects WHERE id=?', [id]);

export function updateSubjectCategory(id: string, category: string) {
  run('UPDATE subjects SET category=?,updated_at=? WHERE id=?', [category.trim(), now(), id]);
  markDirty();
}

/** Anotação livre da matéria ("parei na pág. 45 / exercício 12"). */
export function updateSubjectNote(id: string, note: string) {
  run('UPDATE subjects SET note=?,updated_at=? WHERE id=?', [note.trim(), now(), id]);
  markDirty();
}

export function addSubject(name: string, color?: string, category = ''): string {
  const id = uid();
  // Sem cor informada, escolhe a mais distante das já usadas pelas outras matérias.
  const chosen = color ?? pickDistinctColor(listSubjects().map((s) => s.color));
  run('INSERT INTO subjects(id,name,color,category,updated_at) VALUES(?,?,?,?,?)', [id, name.trim(), chosen, category.trim(), now()]);
  markDirty();
  return id;
}

export function updateSubject(id: string, name: string, color: string) {
  run('UPDATE subjects SET name=?,color=?,updated_at=? WHERE id=?', [name.trim(), color, now(), id]);
  markDirty();
}

export function deleteSubject(id: string) {
  const t = now();
  run('UPDATE subjects SET deleted=1,updated_at=? WHERE id=?', [t, id]);
  run('UPDATE cycle_steps SET deleted=1,updated_at=? WHERE subject_id=? AND deleted=0', [t, id]);
  markDirty();
}

// ---------- Configurações (sincronizadas) ----------
export function getSetting(key: string): string | undefined {
  return one<{ value: string }>('SELECT value FROM settings WHERE key=?', [key])?.value;
}

export function setSetting(key: string, value: string) {
  run('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at', [key, value, now()]);
  markDirty();
}

export type TimerMode = 'regressive' | 'progressive';
export const getTimerMode = (): TimerMode => (getSetting('timer_mode') === 'progressive' ? 'progressive' : 'regressive');
export const getDailyGoalMin = () => Number(getSetting('daily_goal_min') ?? 120);

// ---------- Ciclos ----------
export interface Cycle { id: string; name: string }
export interface Step {
  id: string; cycleId: string; subjectId: string; subjectName: string; color: string;
  category: string; note: string; position: number; targetMin: number;
}

export const listCycles = () =>
  all<Cycle>('SELECT id,name FROM cycles WHERE deleted=0 ORDER BY created_at');

export function addCycle(name: string): string {
  const id = uid();
  const t = now();
  run('INSERT INTO cycles(id,name,created_at,updated_at) VALUES(?,?,?,?)', [id, name.trim(), t, t]);
  if (!getSetting('active_cycle_id') || !getActiveCycle()) setSetting('active_cycle_id', id);
  markDirty();
  return id;
}

export function renameCycle(id: string, name: string) {
  run('UPDATE cycles SET name=?,updated_at=? WHERE id=?', [name.trim(), now(), id]);
  markDirty();
}

export function deleteCycle(id: string) {
  const t = now();
  run('UPDATE cycles SET deleted=1,updated_at=? WHERE id=?', [t, id]);
  run('UPDATE cycle_steps SET deleted=1,updated_at=? WHERE cycle_id=? AND deleted=0', [t, id]);
  markDirty();
}

export function getActiveCycle(): Cycle | undefined {
  const id = getSetting('active_cycle_id');
  const list = listCycles();
  return list.find((c) => c.id === id) ?? list[0];
}

export const setActiveCycle = (id: string) => setSetting('active_cycle_id', id);

export function listSteps(cycleId: string): Step[] {
  return all<Step>(
    `SELECT s.id, s.cycle_id AS cycleId, s.subject_id AS subjectId, sub.name AS subjectName,
            sub.color AS color, sub.category AS category, sub.note AS note, s.position, s.target_min AS targetMin
       FROM cycle_steps s JOIN subjects sub ON sub.id = s.subject_id AND sub.deleted=0
      WHERE s.cycle_id=? AND s.deleted=0 ORDER BY s.position, s.id`,
    [cycleId],
  );
}

const clampBlocks = (n: number) => Math.min(50, Math.max(1, Math.round(n) || 1));

/** Adiciona `blocks` etapas (blocos) da matéria ao final do ciclo, cada uma com `targetMin` minutos. */
export function addStep(cycleId: string, subjectId: string, targetMin: number, blocks = 1) {
  let pos = one<{ m: number | null }>('SELECT MAX(position) m FROM cycle_steps WHERE cycle_id=? AND deleted=0', [cycleId])?.m ?? 0;
  const t = now();
  for (let i = 0; i < clampBlocks(blocks); i++) {
    run('INSERT INTO cycle_steps(id,cycle_id,subject_id,position,target_min,updated_at) VALUES(?,?,?,?,?,?)', [uid(), cycleId, subjectId, ++pos, Math.max(1, targetMin), t]);
  }
  markDirty();
}

export function updateStep(id: string, subjectId: string, targetMin: number) {
  run('UPDATE cycle_steps SET subject_id=?,target_min=?,updated_at=? WHERE id=?', [subjectId, Math.max(1, targetMin), now(), id]);
  markDirty();
}

export function deleteStep(id: string) {
  run('UPDATE cycle_steps SET deleted=1,updated_at=? WHERE id=?', [now(), id]);
  markDirty();
}

/** Renumera as etapas na ordem dada (evita posições duplicadas vindas de edições concorrentes). */
function renumber(order: string[]) {
  const t = now();
  order.forEach((sid, idx) => run('UPDATE cycle_steps SET position=?,updated_at=? WHERE id=?', [idx + 1, t, sid]));
  markDirty();
}

export function moveStep(cycleId: string, id: string, dir: -1 | 1) {
  const i = listSteps(cycleId).findIndex((s) => s.id === id);
  moveStepTo(cycleId, id, i + dir);
}

/** Move a etapa para o índice `toIndex` (0-based) da lista, deslocando as demais. */
export function moveStepTo(cycleId: string, id: string, toIndex: number) {
  const order = listSteps(cycleId).map((s) => s.id);
  const from = order.indexOf(id);
  if (from < 0 || toIndex < 0 || toIndex >= order.length || from === toIndex) return;
  order.splice(toIndex, 0, order.splice(from, 1)[0]);
  renumber(order);
}

/** Aplica uma nova ordem (lista de ids de etapas do ciclo). */
export function reorderSteps(cycleId: string, orderedIds: string[]) {
  const current = listSteps(cycleId).map((s) => s.id);
  if (orderedIds.length !== current.length || !orderedIds.every((id) => current.includes(id))) return;
  renumber(orderedIds);
}

/** Adiciona ao ciclo, ao final, as matérias cadastradas que ainda não estão nele (`blocks` etapas cada). Retorna quantas matérias entraram. */
export function addMissingSubjects(cycleId: string, targetMin: number, blocks = 1): number {
  const present = new Set(listSteps(cycleId).map((s) => s.subjectId));
  // Ordem de cadastro (rowid), não alfabética: normalmente reflete a ordem do edital.
  const missing = all<Subject>('SELECT id,name,color,category,note FROM subjects WHERE deleted=0 ORDER BY rowid').filter((s) => !present.has(s.id));
  let pos = one<{ m: number | null }>('SELECT MAX(position) m FROM cycle_steps WHERE cycle_id=? AND deleted=0', [cycleId])?.m ?? 0;
  const t = now();
  for (const s of missing) {
    for (let i = 0; i < clampBlocks(blocks); i++) {
      run('INSERT INTO cycle_steps(id,cycle_id,subject_id,position,target_min,updated_at) VALUES(?,?,?,?,?,?)', [uid(), cycleId, s.id, ++pos, Math.max(1, targetMin), t]);
    }
  }
  if (missing.length) markDirty();
  return missing.length;
}

// ---------- Voltas (runs) ----------
export interface Run { id: string; cycleId: string; number: number; startedAt: number; finishedAt: number | null }

const runCols = 'id, cycle_id AS cycleId, number, started_at AS startedAt, finished_at AS finishedAt';

export const getCurrentRun = (cycleId: string) =>
  one<Run>(`SELECT ${runCols} FROM runs WHERE cycle_id=? AND finished_at IS NULL AND deleted=0 ORDER BY number DESC LIMIT 1`, [cycleId]);

export const listRuns = (cycleId: string) =>
  all<Run>(`SELECT ${runCols} FROM runs WHERE cycle_id=? AND deleted=0 ORDER BY number DESC`, [cycleId]);

/** Garante que exista uma volta em andamento (cria a próxima se necessário). */
export function ensureRun(cycleId: string): Run | undefined {
  const cur = getCurrentRun(cycleId);
  if (cur) return cur;
  if (listSteps(cycleId).length === 0) return undefined;
  const n = (one<{ m: number | null }>('SELECT MAX(number) m FROM runs WHERE cycle_id=?', [cycleId])?.m ?? 0) + 1;
  const t = now();
  run('INSERT OR IGNORE INTO runs(id,cycle_id,number,started_at,updated_at) VALUES(?,?,?,?,?)', [`${cycleId}:${n}`, cycleId, n, t, t]);
  markDirty();
  return getCurrentRun(cycleId);
}

export interface StepProgress extends Step { doneSec: number; targetSec: number; remainingSec: number; done: boolean }

export function runProgress(cycleId: string, runId: string): StepProgress[] {
  const done = new Map(
    all<{ step_id: string; s: number }>('SELECT step_id, SUM(seconds) s FROM sessions WHERE run_id=? AND deleted=0 AND step_id IS NOT NULL GROUP BY step_id', [runId]).map((r) => [r.step_id, r.s]),
  );
  return listSteps(cycleId).map((st) => {
    const doneSec = done.get(st.id) ?? 0;
    const targetSec = st.targetMin * 60;
    return { ...st, doneSec, targetSec, remainingSec: Math.max(0, targetSec - doneSec), done: doneSec >= targetSec };
  });
}

/** Se todas as etapas da volta estão concluídas, fecha a volta e abre a próxima. */
function advanceIfComplete(cycleId: string, runId: string): boolean {
  const steps = runProgress(cycleId, runId);
  if (steps.length === 0 || !steps.every((s) => s.done)) return false;
  const t = now();
  run('UPDATE runs SET finished_at=?,updated_at=? WHERE id=? AND finished_at IS NULL', [t, t, runId]);
  ensureRun(cycleId);
  markDirty();
  return true;
}

/**
 * Fecha a volta atual se já estiver completa sem uma sessão nova — acontece ao reduzir minutos
 * ou remover etapas pendentes, ou quando sessões chegam de outro aparelho pela sincronização.
 */
export function closeRunIfComplete(cycleId: string): boolean {
  const cur = getCurrentRun(cycleId);
  return cur ? advanceIfComplete(cycleId, cur.id) : false;
}

// ---------- Sessões ----------
export interface SessionRow {
  id: string; runId: string | null; stepId: string | null; subjectId: string; subjectName: string; color: string; category: string;
  cycleId: string | null; startedAt: number; endedAt: number; seconds: number; targetSeconds: number | null; kind: string; note: string | null;
}

/** Fim da sessão: o gravado ou, em sessões antigas sem ele, início + tempo estudado. */
const END_SQL = 'COALESCE(s.ended_at, s.started_at + s.seconds * 1000)';

export const listSessions = () =>
  all<SessionRow>(
    `SELECT s.id, s.run_id AS runId, s.step_id AS stepId, s.subject_id AS subjectId, COALESCE(sub.name,'(matéria removida)') AS subjectName,
            COALESCE(sub.color,'#999999') AS color, COALESCE(sub.category,'') AS category, s.cycle_id AS cycleId, s.started_at AS startedAt,
            ${END_SQL} AS endedAt, s.seconds,
            s.target_seconds AS targetSeconds, s.kind, s.note
       FROM sessions s LEFT JOIN subjects sub ON sub.id=s.subject_id
      WHERE s.deleted=0 ORDER BY s.started_at DESC`,
  );

export interface NewSession {
  runId: string | null; stepId: string | null; subjectId: string; cycleId: string | null;
  startedAt: number; endedAt?: number; seconds: number; targetSeconds: number | null; kind: 'timer' | 'manual'; note?: string;
}

/** Salva a sessão e avança o ciclo se necessário. Retorna true se a volta foi concluída. */
export function saveSession(s: NewSession): boolean {
  if (s.seconds <= 0) return false;
  run(
    'INSERT INTO sessions(id,run_id,step_id,subject_id,cycle_id,started_at,ended_at,seconds,target_seconds,kind,note,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    [uid(), s.runId, s.stepId, s.subjectId, s.cycleId, s.startedAt, s.endedAt ?? s.startedAt + Math.round(s.seconds) * 1000,
      Math.round(s.seconds), s.targetSeconds, s.kind, s.note ?? null, now()],
  );
  const finished = s.runId && s.cycleId ? advanceIfComplete(s.cycleId, s.runId) : false;
  markDirty();
  return finished;
}

export function deleteSession(id: string) {
  run('UPDATE sessions SET deleted=1,updated_at=? WHERE id=?', [now(), id]);
  markDirty();
}

/** Corrige horários e tempo estudado de uma sessão (o tempo nunca passa do intervalo início–fim). */
export function updateSession(id: string, startedAt: number, endedAt: number, seconds: number, note: string) {
  const secs = Math.max(1, Math.min(Math.round(seconds), Math.round((endedAt - startedAt) / 1000)));
  run('UPDATE sessions SET started_at=?,ended_at=?,seconds=?,note=?,updated_at=? WHERE id=?', [startedAt, endedAt, secs, note.trim() || null, now(), id]);
  markDirty();
}

/** Intervalos (início–fim) estudados em cada etapa da volta, em ordem cronológica. */
export function runSessionTimes(runId: string): Map<string, { start: number; end: number }[]> {
  const m = new Map<string, { start: number; end: number }[]>();
  for (const r of all<{ stepId: string; start: number; end: number }>(
    `SELECT s.step_id AS stepId, s.started_at AS start, ${END_SQL} AS end FROM sessions s
      WHERE s.run_id=? AND s.deleted=0 AND s.step_id IS NOT NULL ORDER BY s.started_at`,
    [runId],
  )) m.set(r.stepId, [...(m.get(r.stepId) ?? []), { start: r.start, end: r.end }]);
  return m;
}

export function updateSessionNote(id: string, note: string) {
  run('UPDATE sessions SET note=?,updated_at=? WHERE id=?', [note || null, now(), id]);
  markDirty();
}
