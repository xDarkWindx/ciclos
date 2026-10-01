import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { idbGet, idbSet } from './idb';
import { migrate } from './schema';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let dbKey = '';
let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function engine(): Promise<SqlJsStatic> {
  SQL ??= await initSqlJs({ locateFile: () => wasmUrl });
  return SQL;
}

/** Abre (ou cria) o banco local do usuário. */
export async function openDb(userKey: string): Promise<void> {
  const sql = await engine();
  dbKey = `db:${userKey}`;
  const bytes = await idbGet(dbKey);
  db = bytes ? new sql.Database(bytes) : new sql.Database();
  migrate(db);
  if (!bytes) await persistNow();
}

export function closeDb() {
  clearTimeout(saveTimer);
  db?.close();
  db = null;
}

/** Abre um banco temporário a partir de bytes (ex.: arquivo baixado do Drive). */
export async function openTemp(bytes: Uint8Array): Promise<Database> {
  const sql = await engine();
  const tmp = new sql.Database(bytes);
  migrate(tmp);
  return tmp;
}

export function getDb(): Database {
  if (!db) throw new Error('Banco não inicializado');
  return db;
}

export function exportBytes(): Uint8Array {
  return getDb().export();
}

export async function persistNow() {
  clearTimeout(saveTimer);
  if (db) await idbSet(dbKey, db.export());
}

export function schedulePersist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persistNow(), 400);
}

export function all<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = [], target: Database = getDb()): T[] {
  const stmt = target.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export function one<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T | undefined {
  return all<T>(sql, params)[0];
}

export function run(sql: string, params: SqlValue[] = []) {
  getDb().run(sql, params);
}
