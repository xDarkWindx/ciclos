import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { migrate } from './schema';

describe('migrate', () => {
  it('atualiza um banco v1 (sem classificação/anotação) preservando os dados', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    // esquema da v1
    db.run(`CREATE TABLE subjects (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
            INSERT INTO subjects VALUES('s1','Português','#2f6fed',1,0);
            PRAGMA user_version = 1;`);
    migrate(db);
    const row = db.exec("SELECT name,category,note FROM subjects WHERE id='s1'")[0].values[0];
    expect(row).toEqual(['Português', '', '']);
    migrate(db); // idempotente
    expect(db.exec('PRAGMA user_version')[0].values[0][0]).toBe(2);
  });

  it('cria banco novo já com as colunas', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    migrate(db);
    const cols = db.exec('PRAGMA table_info(subjects)')[0].values.map((r) => r[1]);
    expect(cols).toEqual(expect.arrayContaining(['category', 'note']));
  });
});
