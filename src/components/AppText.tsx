import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts } from '../theme';

type Variant =
  'logo' | 'hero' | 'title' | 'heading' | 'stat' | 'button' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'overline';

const variants: Record<Variant, TextStyle> = {
  logo: { fontFamily: fonts.displayHeavy, fontSize: 26, letterSpacing: -0.5 },
  hero: { fontFamily: fonts.displayHeavy, fontSize: 120, lineHeight: 128, letterSpacing: -4.8 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.56 },
  heading: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.48 },
  stat: { fontFamily: fonts.display, fontSize: 20 },
  button: { fontFamily: fonts.display, fontSize: 18 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textFaint },
  caption: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textFaint },
  overline: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.44, color: colors.textFaint },
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
}

export function AppText({ variant = 'body', color, style, ...rest }: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[{ color: colors.text }, variants[variant], color ? { color } : null, style]}
    />
  );
}
