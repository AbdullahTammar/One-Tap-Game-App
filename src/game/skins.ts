export interface Skin {
  id: string;
  name: string;
  fill: string;
  stroke: string;
  /** Coin price. 0 = owned from the start. */
  price: number;
  /** Soft glow behind the orb in gameplay. */
  glow?: boolean;
  /** Character, flag or object drawn on top of the dot. Dot Runner's Skia ring falls back to the colors. */
  emoji?: string;
  category: SkinCategory;
}

export const SKIN_CATEGORIES = [
  'Classic',
  'Characters',
  'Monsters',
  'Animals',
  'Food',
  'Sports',
  'Space',
  'Flags',
] as const;
export type SkinCategory = (typeof SKIN_CATEGORIES)[number];

type Fun = [id: string, name: string, emoji: string, fill: string, price: number];
const fun = (category: SkinCategory, list: Fun[]): Skin[] =>
  list.map(([id, name, emoji, fill, price]) => ({ id, name, emoji, fill, stroke: fill, price, category }));

/** A flag skin for every Arab League country plus the most-played countries worldwide. */
const FLAGS: [code: string, name: string][] = [
  ['SA', 'Saudi Arabia'],
  ['AE', 'UAE'],
  ['KW', 'Kuwait'],
  ['QA', 'Qatar'],
  ['BH', 'Bahrain'],
  ['OM', 'Oman'],
  ['YE', 'Yemen'],
  ['IQ', 'Iraq'],
  ['JO', 'Jordan'],
  ['PS', 'Palestine'],
  ['LB', 'Lebanon'],
  ['SY', 'Syria'],
  ['EG', 'Egypt'],
  ['SD', 'Sudan'],
  ['LY', 'Libya'],
  ['TN', 'Tunisia'],
  ['DZ', 'Algeria'],
  ['MA', 'Morocco'],
  ['MR', 'Mauritania'],
  ['SO', 'Somalia'],
  ['DJ', 'Djibouti'],
  ['KM', 'Comoros'],
  ['TR', 'Türkiye'],
  ['PK', 'Pakistan'],
  ['IN', 'India'],
  ['ID', 'Indonesia'],
  ['MY', 'Malaysia'],
  ['US', 'USA'],
  ['GB', 'UK'],
  ['FR', 'France'],
  ['DE', 'Germany'],
  ['ES', 'Spain'],
  ['IT', 'Italy'],
  ['BR', 'Brazil'],
  ['AR', 'Argentina'],
  ['MX', 'Mexico'],
  ['CA', 'Canada'],
  ['JP', 'Japan'],
  ['KR', 'Korea'],
  ['CN', 'China'],
  ['NG', 'Nigeria'],
  ['PH', 'Philippines'],
];
/** Regional-indicator pair, e.g. "SA" -> the Saudi flag emoji. */
export const flagEmoji = (code: string) =>
  String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const CLASSIC: Omit<Skin, 'category'>[] = [
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

export const SKINS: readonly Skin[] = [
  ...CLASSIC.map((sk) => ({ ...sk, category: 'Classic' as const })),
  ...fun('Characters', [
    ['smile', 'Smiley', '😄', '#FFD15C', 500],
    ['cool', 'Cool Dot', '😎', '#FFD15C', 900],
    ['nerd', 'Brainy', '🤓', '#FFD15C', 900],
    ['party', 'Party', '🥳', '#FF7FA8', 1200],
    ['robot', 'Robo', '🤖', '#5AC8FA', 1500],
    ['ninja', 'Ninja', '🥷', '#22242E', 2000],
    ['clown', 'Clowny', '🤡', '#FF5E7E', 1200],
    ['king', 'Royal', '🤴', '#FFD15C', 3000],
  ]),
  ...fun('Monsters', [
    ['ghostie', 'Boo', '👻', '#F3F3F6', 800],
    ['invader', 'Invader', '👾', '#B48CFF', 1200],
    ['alien', 'Alien', '👽', '#5CF2B8', 1500],
    ['skull', 'Skully', '💀', '#C9CBD4', 1800],
    ['ogre', 'Oni', '👹', '#FF5E7E', 2200],
    ['devil', 'Imp', '😈', '#7A5CFF', 2200],
    ['dragon', 'Dragon', '🐲', '#4CE0B3', 4000],
  ]),
  ...fun('Animals', [
    ['cat', 'Kitty', '🐱', '#FFC94D', 700],
    ['dog', 'Pup', '🐶', '#FFC94D', 700],
    ['frog', 'Froggy', '🐸', '#C8F560', 900],
    ['panda', 'Panda', '🐼', '#F3F3F6', 1200],
    ['fox', 'Foxy', '🦊', '#FF8A4C', 1200],
    ['lion', 'Lion', '🦁', '#FFC94D', 1800],
    ['octo', 'Octo', '🐙', '#FF7FA8', 1500],
    ['unicorn', 'Unicorn', '🦄', '#B48CFF', 3500],
  ]),
  ...fun('Food', [
    ['donut', 'Donut', '🍩', '#FF7FA8', 600],
    ['pizza', 'Pizza', '🍕', '#FFC94D', 600],
    ['melon', 'Melon', '🍉', '#5CF2B8', 600],
    ['cookie', 'Cookie', '🍪', '#C08552', 600],
    ['burger', 'Burger', '🍔', '#FF8A4C', 800],
    ['date', 'Dates', '🌴', '#4CE0B3', 800],
  ]),
  ...fun('Sports', [
    ['football', 'Football', '⚽', '#F3F3F6', 700],
    ['basket', 'Hoops', '🏀', '#FF8A4C', 700],
    ['tennis', 'Ace', '🎾', '#C8F560', 700],
    ['eight', 'Eight Ball', '🎱', '#22242E', 900],
    ['trophy', 'Champion', '🏆', '#FFD15C', 5000],
  ]),
  ...fun('Space', [
    ['earth', 'Earth', '🌍', '#5AC8FA', 1000],
    ['moon', 'Moon', '🌕', '#FFF4D6', 1000],
    ['saturn', 'Saturn', '🪐', '#FFC94D', 1500],
    ['star', 'Star', '⭐', '#FFD15C', 1500],
    ['fire', 'Blaze', '🔥', '#FF8A4C', 2500],
    ['bolt', 'Volt Strike', '⚡', '#FFD15C', 2500],
  ]),
  ...FLAGS.map(([code, name]) => ({
    id: `flag-${code.toLowerCase()}`,
    name,
    emoji: flagEmoji(code),
    fill: '#F3F3F6',
    stroke: '#F3F3F6',
    price: 500,
    category: 'Flags' as const,
  })),
];

export const MYSTERY_PRICE = 800;
/** Random locked fun skin (never a flag: players pick their own country). `roll` is in [0, 1). */
export function mysteryPick(owned: readonly string[], roll: number): Skin | null {
  const pool = SKINS.filter((s) => s.emoji && s.category !== 'Flags' && !owned.includes(s.id));
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))] : null;
}

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
