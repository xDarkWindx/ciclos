/**
 * Embaralha as etapas de um ciclo deixando as repetições da mesma matéria o mais distantes possível.
 * O ciclo é circular (depois da última etapa vem a primeira da volta seguinte), então a distância
 * entre a última e a primeira ocorrência de uma matéria também conta.
 *
 * Critérios, em ordem de prioridade:
 *  1. maximizar a menor distância entre etapas da mesma matéria;
 *  2. minimizar etapas vizinhas da mesma classificação (ex.: duas de Direito seguidas);
 *  3. aproximar as distâncias do ideal (n/k) para cada matéria.
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

interface Score { gap: number; adj: number; short: number }

/** Quanto as distâncias ficam abaixo do ideal (n/k); menor é melhor. */
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

/** Pares vizinhos (circular) com a mesma classificação; classificação vazia nunca conta. */
export function adjacentSameCategory(cats: string[]): number {
  const n = cats.length;
  if (n < 2) return 0;
  let c = 0;
  for (let i = 0; i < n; i++) if (cats[i] !== '' && cats[i] === cats[(i + 1) % n]) c++;
  return c;
}

const better = (a: Score, b: Score) => a.gap !== b.gap ? a.gap > b.gap : a.adj !== b.adj ? a.adj < b.adj : a.short < b.short;

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

export interface SpreadOptions {
  /** Classificação de cada etapa (mesmo tamanho de `subjects`); '' = sem classificação. */
  categories?: string[];
  rng?: Rng;
  tries?: number;
}

/** Retorna uma permutação de índices (nova ordem) com as repetições bem espalhadas. */
export function spreadOrder(subjects: string[], opts: SpreadOptions = {}): number[] {
  const { categories = subjects.map(() => ''), rng = Math.random, tries = 80 } = opts;
  const score = (order: number[]): Score => ({
    gap: minGap(order.map((i) => subjects[i])),
    adj: adjacentSameCategory(order.map((i) => categories[i])),
    short: shortfall(order.map((i) => subjects[i])),
  });

  let best = subjects.map((_, i) => i);
  let bestScore: Score = { gap: -1, adj: Infinity, short: Infinity };
  for (let t = 0; t < tries; t++) {
    let order = attempt(subjects, rng);
    let sc = score(order);
    // refinamento: trocas de pares que melhoram a pontuação (nunca pioram a distância mínima)
    for (let pass = 0; pass < 3; pass++) {
      let improved = false;
      for (let i = 0; i < order.length; i++) {
        for (let j = i + 1; j < order.length; j++) {
          [order[i], order[j]] = [order[j], order[i]];
          const cand = score(order);
          if (better(cand, sc)) {
            sc = cand;
            improved = true;
          } else [order[i], order[j]] = [order[j], order[i]];
        }
      }
      if (!improved) break;
    }
    if (better(sc, bestScore)) {
      best = order;
      bestScore = sc;
    }
  }
  return best;
}
