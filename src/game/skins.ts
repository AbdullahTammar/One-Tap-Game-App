export interface Skin {
  id: string;
  name: string;
  fill: string;
  stroke: string;
  /** Coin price. 0 = owned from the start. */
  price: number;
  /** Soft glow behind the orb in gameplay. */
  glow?: boolean;
}

export const SKINS: readonly Skin[] = [
  { id: 'classic', name: 'Classic', fill: '#FFFFFF', stroke: '#FFFFFF', price: 0 },
  { id: 'volt', name: 'Volt', fill: '#C8F560', stroke: '#C8F560', price: 0 },
  { id: 'tide', name: 'Tide', fill: '#5AC8FA', stroke: '#5AC8FA', price: 0 },
  { id: 'mint', name: 'Mint', fill: '#5CF2B8', stroke: '#5CF2B8', price: 400 },
  { id: 'ember', name: 'Ember', fill: '#FF8A4C', stroke: '#FF8A4C', price: 600 },
  { id: 'violet', name: 'Violet', fill: '#B48CFF', stroke: '#B48CFF', price: 800 },
  { id: 'rose', name: 'Rose', fill: '#FF7FA8', stroke: '#FF7FA8', price: 900 },
  { id: 'ghost', name: 'Ghost', fill: '#0E0F14', stroke: '#FFFFFF', price: 1200 },
  { id: 'gold', name: 'Gold', fill: '#FFD15C', stroke: '#FFD15C', price: 1500, glow: true },
  { id: 'nova', name: 'Nova', fill: '#FFF4D6', stroke: '#FFB84C', price: 2500, glow: true },
  { id: 'abyss', name: 'Abyss', fill: '#1B2B5C', stroke: '#5AC8FA', price: 3500, glow: true },
  { id: 'prism', name: 'Prism', fill: '#F3F3F6', stroke: '#B48CFF', price: 5000, glow: true },
];

export const DEFAULT_SKIN_ID = 'classic';
export const STARTER_SKIN_IDS = SKINS.filter((s) => s.price === 0).map((s) => s.id);

export function getSkin(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

/** Cheapest skin the player does not own yet — drives the "Next unlock" card. */
export function nextUnlock(owned: readonly string[]): Skin | null {
  const locked = SKINS.filter((s) => !owned.includes(s.id)).sort((a, b) => a.price - b.price);
  return locked[0] ?? null;
}
