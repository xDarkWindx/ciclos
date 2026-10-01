/**
 * Embaralha as etapas de um ciclo deixando as repetições da mesma matéria o mais distantes possível.
 * O ciclo é circular (depois da última etapa vem a primeira da volta seguinte), então a distância
 * entre a última e a primeira ocorrência de uma matéria também conta.
 */

export type Rng = () => number;

/** Menor distância circular entre duas etapas da mesma matéria (Infinity se nenhuma se repete). */
export function minGap(subjects: string[]): number {
  const n = subjects.length;
  const pos = new Map<string, number[]>();
  subjects.forEach((s, i) => pos.set(s, [...(pos.get(s) ?? []), i]));
  let min = Infinity;
  for (const p of pos.values()) {
    if (p.length < 2) continue;
    for (let i = 0; i < p.length; i++) min = Math.min(min, i + 1 < p.length ? p[i + 1] - p[i] : p[0] + n - p[i]);
  }
  return min;
}

/** Quanto as distâncias ficam abaixo do ideal (n/k) — usado para desempatar; menor é melhor. */
function shortfall(subjects: string[]): number {
  const n = subjects.length;
  const pos = new Map<string, number[]>();
  subjects.forEach((s, i) => pos.set(s, [...(pos.get(s) ?? []), i]));
  let total = 0;
  for (const p of pos.values()) {
    if (p.length < 2) continue;
    const ideal = n / p.length;
    for (let i = 0; i < p.length; i++) {
      const gap = i + 1 < p.length ? p[i + 1] - p[i] : p[0] + n - p[i];
      if (gap < ideal) total += (ideal - gap) ** 2;
    }
  }
  return total;
}

/** Uma tentativa: cada matéria recebe posições espaçadas de forma uniforme com um deslocamento aleatório. */
function attempt(subjects: string[], rng: Rng): number[] {
  const offset = new Map<string, number>();
  const seen = new Map<string, number>();
  const total = new Map<string, number>();
  subjects.forEach((s) => total.set(s, (total.get(s) ?? 0) + 1));
  const keyed = subjects.map((s, index) => {
    if (!offset.has(s)) offset.set(s, rng());
    const j = seen.get(s) ?? 0;
    seen.set(s, j + 1);
    return { index, key: (j + offset.get(s)!) / total.get(s)!, tie: rng() };
  });
  keyed.sort((a, b) => a.key - b.key || a.tie - b.tie);
  return keyed.map((k) => k.index);
}

/** Retorna uma permutação de índices (nova ordem) com as repetições bem espalhadas. */
export function spreadOrder(subjects: string[], rng: Rng = Math.random, tries = 400): number[] {
  let best = subjects.map((_, i) => i);
  let bestGap = -1;
  let bestShort = Infinity;
  for (let t = 0; t < tries; t++) {
    const order = attempt(subjects, rng);
    const arranged = order.map((i) => subjects[i]);
    const gap = minGap(arranged);
    const short = shortfall(arranged);
    if (gap > bestGap || (gap === bestGap && short < bestShort)) {
      best = order;
      bestGap = gap;
      bestShort = short;
    }
  }
  return best;
}
