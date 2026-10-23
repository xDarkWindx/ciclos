import type { Database, SqlValue } from 'sql.js';
import { all, getDb } from './sqlite';
import { SYNCED_TABLES } from './schema';

/**
 * Mescla o banco remoto (baixado do Drive) no banco local, linha a linha:
 * vence a linha com maior updated_at (last-write-wins). Exclusões são tombstones (deleted=1),
 * então também propagam.
 *  - changed: algo mudou no banco local;
 *  - remoteBehind: o local tem linhas que o remoto não tem (ou mais novas) — precisa reenviar.
 *    Sem isso, mudanças de um aparelho podiam ficar fora do Drive se outro aparelho
 *    enviasse o arquivo logo depois (o primeiro não reenviaria por não estar "sujo").
 *
 * Empate de updated_at com conteúdo diferente acontece quando uma versão antiga do app (sem uma
 * coluna nova) copiou a linha: a coluna nasce com o valor padrão de um lado. Nesse caso, campo
 * vazio/padrão (null, '' ou 0) é preenchido com o valor do outro lado. Edição legítima sempre muda
 * o updated_at, então isso nunca sobrescreve um valor de verdade.
 */
export function mergeRemote(remote: Database): { changed: boolean; remoteBehind: boolean } {
  const local = getDb();
  let changed = false;
  let remoteBehind = false;

  const upsert = (table: string, row: Record<string, SqlValue>, pk: string, known: Set<string>) => {
    const cols = Object.keys(row).filter((c) => known.has(c));
    const sql = `INSERT INTO ${table}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})
                 ON CONFLICT(${pk}) DO UPDATE SET ${cols.filter((c) => c !== pk).map((c) => `${c}=excluded.${c}`).join(',')}`;
    local.run(sql, cols.map((c) => row[c]));
    changed = true;
  };

  for (const table of [...SYNCED_TABLES, 'settings'] as const) {
    const pk = table === 'settings' ? 'key' : 'id';
    const known = new Set(all<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name));
    const localRows = new Map(all<Record<string, SqlValue>>(`SELECT * FROM ${table}`).map((r) => [r[pk] as string, r]));
    const localTs = new Map([...localRows].map(([k, r]) => [k, r.updated_at as number]));
    const remoteTs = new Map<string, number>();
    for (const row of all<Record<string, SqlValue>>(`SELECT * FROM ${table}`, [], remote)) {
      const k = row[pk] as string;
      remoteTs.set(k, row.updated_at as number);
      const lu = localTs.get(k);
      if (lu === undefined || (row.updated_at as number) > lu) upsert(table, row, pk, known);
      else if (row.updated_at === lu) {
        const mine = localRows.get(k)!;
        const fill = [...known].filter((c) => c !== pk && isEmpty(mine[c]) && !isEmpty(row[c]));
        if (fill.length) {
          local.run(`UPDATE ${table} SET ${fill.map((c) => `${c}=?`).join(',')} WHERE ${pk}=?`, [...fill.map((c) => row[c]), k]);
          changed = true;
        }
        // o local tem valor onde o remoto só tem o padrão: o arquivo do Drive precisa ser reenviado
        if ([...known].some((c) => c !== pk && !isEmpty(mine[c]) && isEmpty(row[c]))) remoteBehind = true;
      }
    }
    for (const [k, lu] of localTs) {
      const ru = remoteTs.get(k);
      if (ru === undefined || lu > ru) remoteBehind = true;
    }
  }
  return { changed, remoteBehind };
}

const isEmpty = (v: SqlValue | undefined) => v === null || v === undefined || v === '' || v === 0;
