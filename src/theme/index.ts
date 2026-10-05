/** Design tokens lifted 1:1 from the Lumo design canvas. */
export const colors = {
  ground: '#0E0F14',
  surface: '#171922',
  surfaceRaised: '#181A23',
  surfaceMuted: '#22242E',
  track: '#1F212B',
  trackDim: '#262833',
  ringSlot: '#2A2C36',
  divider: '#1C1E27',
  outline: '#2E3140',
  text: '#F3F3F6',
  textSoft: '#C9CBD4',
  textMuted: '#A4A6B3',
  textFaint: '#8C8F9C',
  white: '#FFFFFF',
  danger: '#FF6B6B',
} as const;

export const ACCENTS = [
  { id: 'lime', name: 'Lime', color: '#C8F560' },
  { id: 'blue', name: 'Blue', color: '#5AC8FA' },
  { id: 'orange', name: 'Orange', color: '#FF8A4C' },
  { id: 'violet', name: 'Violet', color: '#B48CFF' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];
export const DEFAULT_ACCENT: AccentId = 'lime';

export function accentColor(id: AccentId): string {
  return ACCENTS.find((a) => a.id === id)?.color ?? ACCENTS[0].color;
}

export const fonts = {
  display: 'Unbounded_700Bold',
  displayHeavy: 'Unbounded_800ExtraBold',
  displayMedium: 'Unbounded_500Medium',
  displaySemi: 'Unbounded_600SemiBold',
  body: 'Manrope_500Medium',
  bodyRegular: 'Manrope_400Regular',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const;

export const radii = { sm: 18, md: 20, lg: 28, pill: 999 } as const;

export const spacing = { gutter: 24, gap: 12 } as const;
