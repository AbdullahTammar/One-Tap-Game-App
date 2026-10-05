import Svg, { Circle, Path } from 'react-native-svg';

export type IconName =
  | 'play'
  | 'playOutline'
  | 'skins'
  | 'ranks'
  | 'settings'
  | 'pause'
  | 'back'
  | 'share'
  | 'retry'
  | 'coin'
  | 'lock'
  | 'check'
  | 'close'
  | 'film'
  | 'bag';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Stroke icons drawn on the design's 24px grid. */
export function Icon({ name, size = 24, color = '#F3F3F6', strokeWidth = 2 }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'play' && <Path d="M8 5.5v13l11-6.5z" fill={color} />}
      {name === 'playOutline' && <Path d="M8 5.5v13l11-6.5z" {...stroke} />}
      {name === 'skins' && (
        <>
          <Circle cx={12} cy={13} r={7.5} {...stroke} />
          <Circle cx={12} cy={5.5} r={2.5} fill={color} />
        </>
      )}
      {name === 'ranks' && <Path d="M6 20v-8M12 20V5M18 20v-5" {...stroke} />}
      {name === 'settings' && (
        <>
          <Path d="M4 7h9M19 7h1M4 17h3M13 17h7" {...stroke} />
          <Circle cx={16} cy={7} r={2.5} {...stroke} />
          <Circle cx={10} cy={17} r={2.5} {...stroke} />
        </>
      )}
      {name === 'pause' && <Path d="M9 6v12M15 6v12" {...stroke} />}
      {name === 'back' && <Path d="M15 6l-6 6 6 6" {...stroke} />}
      {name === 'share' && <Path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" {...stroke} />}
      {name === 'retry' && <Path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" {...stroke} />}
      {name === 'coin' && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Circle cx={12} cy={12} r={4} {...stroke} />
        </>
      )}
      {name === 'lock' && <Path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" {...stroke} />}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...stroke} />}
      {name === 'film' && <Path d="M4 6h16v12H4zM10 9.5v5l4-2.5z" {...stroke} />}
      {name === 'bag' && <Path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" {...stroke} />}
    </Svg>
  );
}
