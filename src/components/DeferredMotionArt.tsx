import { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { blastRadius, CHAIN, CHAIN_COLORS, type ChainState } from '../game/motion/chain';
import { DUEL, type DuelState } from '../game/motion/duel';
import { inGap, TILT, type TiltState } from '../game/motion/tilt';
import { colors, fonts } from '../theme';
import { SkinDot } from './SkinDot';
interface Orb {
  orbFill: string;
  orbStroke: string;
  orbEmoji?: string;
  color: string;
}

function ChainView({ s, color }: { s: ChainState } & Orb) {
  return (
    <>
      {s.dots.map((d, i) =>
        d.blast >= 0 ? (
          <Circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={blastRadius(d.blast)}
            fill={d.color < 0 ? color : CHAIN_COLORS[d.color]}
            fillOpacity={0.35}
            stroke={d.color < 0 ? colors.white : CHAIN_COLORS[d.color]}
            strokeWidth={1.5}
          />
        ) : (
          <Circle key={i} cx={d.x} cy={d.y} r={CHAIN.dot} fill={CHAIN_COLORS[d.color]} />
        ),
      )}
      <SvgText fontFamily={fonts.bodyBold} x={300} y={30} fill={colors.textMuted} fontSize={15} textAnchor="end">
        {`${s.popped}/${s.goal}`}
      </SvgText>
      <SvgText fontFamily={fonts.bodyBold} x={20} y={30} fill={colors.textMuted} fontSize={15}>
        {`LV ${s.level}`}
      </SvgText>
    </>
  );
}

function TiltView({ s, orbFill, orbStroke, orbEmoji, color }: { s: TiltState } & Orb) {
  return (
    <>
      <Circle
        cx={160}
        cy={160}
        r={TILT.exit}
        stroke={color}
        strokeOpacity={0.25}
        strokeWidth={2}
        strokeDasharray="4 8"
        fill="none"
      />
      {s.rings.map((g, i) => {
        // Draw the wall as a single arc that skips the gap.
        const h = TILT.gapHalf;
        const a0 = g.gap + h;
        const a1 = g.gap + Math.PI * 2 - h;
        const p0 = { x: 160 + g.r * Math.cos(a0), y: 160 + g.r * Math.sin(a0) };
        const p1 = { x: 160 + g.r * Math.cos(a1), y: 160 + g.r * Math.sin(a1) };
        const open = inGap(g, Math.atan2(s.y - 160, s.x - 160));
        return (
          <Path
            key={i}
            d={`M${p0.x} ${p0.y} A${g.r} ${g.r} 0 1 1 ${p1.x} ${p1.y}`}
            stroke={open ? color : colors.textFaint}
            strokeWidth={TILT.wall * 2}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}
      <SkinDot
        cx={s.x}
        cy={s.y}
        r={orbEmoji ? TILT.ball + 3 : TILT.ball}
        fill={orbFill}
        stroke={orbStroke}
        emoji={orbEmoji}
      />
    </>
  );
}

function DuelView({ s, orbFill, orbStroke, orbEmoji }: { s: DuelState } & Orb) {
  const g = DUEL.goalHalf;
  const bot = s.mode === 'bot';
  return (
    <>
      <Line x1={0} y1={160} x2={320} y2={160} stroke={colors.outline} strokeWidth={2} strokeDasharray="6 6" />
      <Circle cx={160} cy={160} r={36} stroke={colors.outline} strokeWidth={2} fill="none" />
      <Rect x={160 - g} y={-4} width={g * 2} height={10} rx={5} fill="#FF5E7E" />
      <Rect x={160 - g} y={314} width={g * 2} height={10} rx={5} fill="#5AC8FA" />
      <SvgText fontFamily={fonts.bodyBold} x={18} y={150} fill="#FF5E7E" fontSize={22}>
        {s.goals[1]}
      </SvgText>
      <SvgText fontFamily={fonts.bodyBold} x={18} y={186} fill="#5AC8FA" fontSize={22}>
        {s.goals[0]}
      </SvgText>
      <SvgText fontFamily={fonts.bodyBold} x={302} y={150} fill={colors.textFaint} fontSize={11} textAnchor="end">
        {bot ? 'BOT' : 'PLAYER 2'}
      </SvgText>
      <SvgText fontFamily={fonts.bodyBold} x={302} y={180} fill={colors.textFaint} fontSize={11} textAnchor="end">
        {bot ? 'YOU' : 'PLAYER 1'}
      </SvgText>
      <Circle
        cx={s.paddles[1].x}
        cy={s.paddles[1].y}
        r={DUEL.paddle}
        fill="#FF5E7E"
        fillOpacity={0.25}
        stroke="#FF5E7E"
        strokeWidth={4}
      />
      <Circle
        cx={s.paddles[0].x}
        cy={s.paddles[0].y}
        r={DUEL.paddle}
        fill="#5AC8FA"
        fillOpacity={0.25}
        stroke="#5AC8FA"
        strokeWidth={4}
      />
      <SkinDot cx={s.puck.x} cy={s.puck.y} r={DUEL.puck} fill={orbFill} stroke={orbStroke} emoji={orbEmoji} />
    </>
  );
}

export default function DeferredMotionArt(p: { id: string; s: ChainState | DuelState | TiltState } & Orb) {
  return p.id === 'chain' ? (
    <ChainView {...p} s={p.s as ChainState} />
  ) : p.id === 'duel' ? (
    <DuelView {...p} s={p.s as DuelState} />
  ) : (
    <TiltView {...p} s={p.s as TiltState} />
  );
}
