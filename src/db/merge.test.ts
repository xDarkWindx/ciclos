import { beforeAll, describe, expect, it, vi } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import { migrate } from './schema';

let local: Database;

// merge.ts só precisa de getDb() e all(); aqui apontamos para um sql.js em memória (Node).
vi.mock('./sqlite', async () => {
  const all = (sql: string, params: any[] = [], target?: Database) => {
    const stmt = (target ?? local).prepare(sql);
    stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };
  return { getDb: () => local, all };
});

const { mergeRemote } = await import('./merge');

describe('mergeRemote', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  const subj = (db: Database, id: string, name: string, t: number, deleted = 0) =>
    db.run('INSERT OR REPLACE INTO subjects(id,name,color,updated_at,deleted) VALUES(?,?,?,?,?)', [id, name, '#000', t, deleted]);
  const names = (db: Database) => db.exec('SELECT id,name,deleted FROM subjects ORDER BY id')[0]?.values ?? [];

  it('une linhas novas, vence o updated_at maior e propaga exclusões', () => {
    local = new SQL.Database();
    migrate(local);
    const remote = new SQL.Database();
    migrate(remote);

    subj(local, 'a', 'local-novo', 200); // local mais recente: mantém
    subj(remote, 'a', 'remoto-velho', 100);
    subj(local, 'b', 'local-velho', 100); // remoto mais recente: sobrescreve
    subj(remote, 'b', 'remoto-novo', 300);
    subj(remote, 'c', 'so-remoto', 50); // só existe no remoto: entra
    subj(local, 'd', 'so-local', 50); // só local: permanece
    subj(local, 'e', 'apagada-no-remoto', 100);
    subj(remote, 'e', 'apagada-no-remoto', 400, 1); // tombstone remoto vence

    expect(mergeRemote(remote)).toEqual({ changed: true, remoteBehind: true }); // 'a' e 'd' são mais novos/só no local
    expect(names(local)).toEqual([
      ['a', 'local-novo', 0], ['b', 'remoto-novo', 0], ['c', 'so-remoto', 0], ['d', 'so-local', 0], ['e', 'apagada-no-remoto', 1],
    ]);
  });

  it('mescla configurações por chave', () => {
    local = new SQL.Database();
    migrate(local);
    const remote = new SQL.Database();
    migrate(remote);
    local.run("INSERT INTO settings VALUES('timer_mode','regressive',100)");
    remote.run("INSERT INTO settings VALUES('timer_mode','progressive',200)");
    remote.run("INSERT INTO settings VALUES('daily_goal_min','90',10)");
    mergeRemote(remote);
    expect(local.exec('SELECT key,value FROM settings ORDER BY key')[0].values).toEqual([['daily_goal_min', '90'], ['timer_mode', 'progressive']]);
  });

  it('não pede reenvio quando local e remoto estão iguais', () => {
    local = new SQL.Database();
    migrate(local);
    subj(local, 'a', 'x', 100);
    const remote = new SQL.Database(local.export());
    expect(mergeRemote(remote)).toEqual({ changed: false, remoteBehind: false });
  });

  it('pede reenvio quando o remoto está atrás (outro aparelho enviou um arquivo sem as mudanças locais)', () => {
    local = new SQL.Database();
    migrate(local);
    const remote = new SQL.Database();
    migrate(remote);
    subj(local, 'a', 'x', 100);
    subj(remote, 'a', 'x', 100);
    subj(local, 'b', 'novo-local', 200); // criado aqui, ainda não está no Drive
    expect(mergeRemote(remote)).toEqual({ changed: false, remoteBehind: true });
  });
});
