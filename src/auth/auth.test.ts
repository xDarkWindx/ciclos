import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { getAccessToken } = await import('./auth');

describe('getAccessToken', () => {
  beforeEach(() => store.clear());

  it('reaproveita um token salvo ainda válido (sem abrir pop-up do Google)', async () => {
    store.set('ciclos.token', JSON.stringify({ value: 'abc', exp: Date.now() + 30 * 60_000 }));
    expect(await getAccessToken()).toBe('abc');
  });

  it('ignora token salvo prestes a expirar e tenta renovar', async () => {
    store.set('ciclos.token', JSON.stringify({ value: 'velho', exp: Date.now() + 10_000 }));
    // sem client id configurado no teste, a renovação falha — prova que não devolveu o token velho
    await expect(getAccessToken()).rejects.toThrow();
  });
});
