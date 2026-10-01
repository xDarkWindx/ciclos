import type { Database, SqlValue } from 'sql.js';
import { all, getDb } from './sqlite';
import { SYNCED_TABLES } from './schema';

/**
 * Mescla o banco remoto (baixado do Drive) no banco local, linha a linha:
 * vence a linha com maior updated_at (last-write-wins). Exclusões são tombstones (deleted=1),
 * então também propagam. Retorna true se algo mudou localmente.
 */
export function mergeRemote(remote: Database): boolean {
  const local = getDb();
  let changed = false;

  const upsert = (table: string, row: Record<string, SqlValue>, pk: string) => {
    const cols = Object.keys(row);
    const sql = `INSERT INTO ${table}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})
                 ON CONFLICT(${pk}) DO UPDATE SET ${cols.filter((c) => c !== pk).map((c) => `${c}=excluded.${c}`).join(',')}`;
    local.run(sql, cols.map((c) => row[c]));
    changed = true;
  };

  for (const table of [...SYNCED_TABLES, 'settings'] as const) {
    const pk = table === 'settings' ? 'key' : 'id';
    const localTs = new Map(all<{ k: string; u: number }>(`SELECT ${pk} k, updated_at u FROM ${table}`).map((r) => [r.k, r.u]));
    for (const row of all<Record<string, SqlValue>>(`SELECT * FROM ${table}`, [], remote)) {
      const lu = localTs.get(row[pk] as string);
      if (lu === undefined || (row.updated_at as number) > lu) upsert(table, row, pk);
    }
  }
  return changed;
}
