// Escolha de cor para nova matéria: a candidata mais distante (perceptualmente) das já usadas.

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToLab(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** Distância de cor (CIE76 ΔE): ~2 quase imperceptível, >30 claramente diferentes. */
export function colorDistance(a: string, b: string): number {
  const [l1, a1, b1] = hexToLab(a), [l2, a2, b2] = hexToLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

// Candidatas legíveis tanto no tema claro quanto no escuro (saturadas, luminosidade média).
const CANDIDATES: string[] = [];
for (let h = 0; h < 360; h += 8) for (const [s, l] of [[70, 48], [62, 38], [78, 58]]) CANDIDATES.push(hslToHex(h, s, l));

export function pickDistinctColor(used: string[]): string {
  if (used.length === 0) return CANDIDATES[Math.floor(CANDIDATES.length / 3)];
  let best = CANDIDATES[0], bestScore = -1;
  for (const c of CANDIDATES) {
    const score = Math.min(...used.map((u) => colorDistance(c, u)));
    if (score > bestScore) (best = c), (bestScore = score);
  }
  return best;
}
