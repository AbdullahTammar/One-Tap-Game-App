export interface RankTier {
  id: string;
  name: string;
  /** Best score needed to reach this tier. */
  min: number;
  color: string;
}

export const RANKS: readonly RankTier[] = [
  { id: 'spark', name: 'Spark', min: 0, color: '#8C8F9C' },
  { id: 'glow', name: 'Glow', min: 10, color: '#5CF2B8' },
  { id: 'flare', name: 'Flare', min: 25, color: '#5AC8FA' },
  { id: 'comet', name: 'Comet', min: 50, color: '#B48CFF' },
  { id: 'nova', name: 'Nova', min: 80, color: '#FF8A4C' },
  { id: 'pulsar', name: 'Pulsar', min: 120, color: '#FFD15C' },
  { id: 'lumo', name: 'Lumo', min: 175, color: '#C8F560' },
];

export function rankFor(best: number): { tier: RankTier; next: RankTier | null; progress: number } {
  let i = 0;
  while (i + 1 < RANKS.length && best >= RANKS[i + 1].min) i++;
  const tier = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  const progress = next ? (best - tier.min) / (next.min - tier.min) : 1;
  return { tier, next, progress: Math.max(0, Math.min(1, progress)) };
}
