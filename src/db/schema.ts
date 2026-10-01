import type { Database } from 'sql.js';

// Tabelas sincronizadas: todas têm id (TEXT), updated_at (ms) e deleted (tombstone).
export const SYNCED_TABLES = ['subjects', 'cycles', 'cycle_steps', 'runs', 'sessions'] as const;

export const SCHEMA_VERSION = 1;

export function migrate(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS cycles (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS cycle_steps (
      id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, subject_id TEXT NOT NULL,
      position INTEGER NOT NULL, target_min INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
    -- Uma "volta" completa do ciclo. id = '<cycle_id>:<numero>' (determinístico entre dispositivos).
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, number INTEGER NOT NULL,
      started_at INTEGER NOT NULL, finished_at INTEGER,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, run_id TEXT, step_id TEXT, subject_id TEXT NOT NULL, cycle_id TEXT,
      started_at INTEGER NOT NULL, seconds INTEGER NOT NULL, target_seconds INTEGER,
      kind TEXT NOT NULL DEFAULT 'timer', note TEXT,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER NOT NULL);
    -- Somente local (não sincroniza): cronômetro em andamento neste dispositivo.
    CREATE TABLE IF NOT EXISTS timer_state (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT);
    CREATE INDEX IF NOT EXISTS idx_steps_cycle ON cycle_steps(cycle_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_run ON sessions(run_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}
