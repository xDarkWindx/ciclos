import { describe, expect, it } from 'vitest';
import { minGap, spreadOrder } from './shuffle';

// PRNG determinístico (mulberry32) para testes reprodutíveis
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const apply = (s: string[], order: number[]) => order.map((i) => s[i]);

describe('spreadOrder', () => {
  it('devolve uma permutação válida', () => {
    const s = ['A', 'B', 'A', 'C', 'B', 'A'];
    const order = spreadOrder(s, seeded(1));
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('atinge a distância ideal quando é possível (3 matérias × 4 etapas → gap 3)', () => {
    const s = ['A', 'A', 'A', 'A', 'B', 'B', 'B', 'B', 'C', 'C', 'C', 'C'];
    for (let seed = 1; seed <= 20; seed++) {
      expect(minGap(apply(s, spreadOrder(s, seeded(seed))))).toBe(3);
    }
  });

  it('espalha repetições desiguais (A×3, B×2, C, D, E, F em 9 etapas → gap 3)', () => {
    const s = ['A', 'A', 'A', 'B', 'B', 'C', 'D', 'E', 'F'];
    for (let seed = 1; seed <= 20; seed++) {
      expect(minGap(apply(s, spreadOrder(s, seeded(seed))))).toBeGreaterThanOrEqual(3);
    }
  });

  it('considera o ciclo circular: duas etapas iguais ficam do lado oposto', () => {
    const s = ['A', 'A', 'B', 'C', 'D', 'E'];
    for (let seed = 1; seed <= 10; seed++) expect(minGap(apply(s, spreadOrder(s, seeded(seed))))).toBe(3);
  });

  it('funciona sem repetições e com listas pequenas', () => {
    expect(spreadOrder([], seeded(1))).toEqual([]);
    expect(spreadOrder(['A'], seeded(1))).toEqual([0]);
    expect(spreadOrder(['A', 'B', 'C'], seeded(1)).length).toBe(3);
  });

  it('varia o resultado a cada chamada (é um embaralhar)', () => {
    const s = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D'];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 15; seed++) seen.add(apply(s, spreadOrder(s, seeded(seed))).join(''));
    expect(seen.size).toBeGreaterThan(3);
  });
});
