import { describe, expect, it } from 'vitest';
import { colorDistance, pickDistinctColor } from './colors';

describe('pickDistinctColor', () => {
  it('fica longe da cor existente', () => {
    const c = pickDistinctColor(['#e5484d']);
    expect(colorDistance(c, '#e5484d')).toBeGreaterThan(50);
  });
  it('com 20 cores já usadas ainda evita repetir uma delas', () => {
    const used: string[] = [];
    for (let i = 0; i < 20; i++) used.push(pickDistinctColor(used));
    expect(new Set(used).size).toBe(20);
    // distância mínima entre qualquer par continua perceptível
    let min = Infinity;
    for (let i = 0; i < used.length; i++) for (let j = i + 1; j < used.length; j++) min = Math.min(min, colorDistance(used[i], used[j]));
    expect(min).toBeGreaterThan(10);
  });
  it('lida com lista vazia', () => {
    expect(pickDistinctColor([])).toMatch(/^#[0-9a-f]{6}$/);
  });
});
