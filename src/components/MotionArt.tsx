import { memo } from 'react';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { ARENA, leaderboard, PELLET_COLORS, radiusOf, type ArenaState } from '../game/motion/arena';
import { blastRadius, CHAIN, CHAIN_COLORS, type ChainState } from '../game/motion/chain';
import { CHARGE, chargePower, type ChargeState } from '../game/motion/charge';
import { DRIFT, type DriftState } from '../game/motion/drift';
import { cellCenter, FLOW_COLORS, type FlowState } from '../game/motion/flow';
import { createMotion, type AnyMotion, type MotionId } from '../game/motion';
import { SWIPE_COLORS, visibleColor, type SwipeState } from '../game/motion/swipe';
import { inGap, TILT, type TiltState } from '../game/motion/tilt';
import { colors, fonts } from '../theme';

interface Props {
  id: MotionId;
  color: string;
  size: number;
  state?: AnyMotion;
  orbFill?: string;
  orbStroke?: string;
}
interface Orb {
  orbFill: string;
  orbStroke: string;
  color: string;
}

export const MotionArt = memo(function MotionArt({
  id,
  color,
  size,
  state,
  orbFill = colors.white,
  orbStroke = colors.white,
}: Props) {
  const s = state ?? createMotion(id, 7);
  const o = { orbFill, orbStroke, color };
  return (
    <Svg width={size} height={size} viewBox="0 0 320 320">
      <Rect
        x={1}
        y={1}
        width={318}
        height={318}
        rx={28}
        fill={colors.surface}
        stroke={colors.outline}
        strokeWidth={2}
      />
      {id === 'arena' ? (
        <ArenaView s={s as ArenaState} {...o} />
      ) : id === 'drift' ? (
        <DriftView s={s as DriftState} {...o} />
      ) : id === 'charge' ? (
        <ChargeView s={s as ChargeState} {...o} />
      ) : id === 'swipe' ? (
        <SwipeView s={s as SwipeState} {...o} />
      ) : id === 'chain' ? (
        <ChainView s={s as ChainState} {...o} />
      ) : id === 'flow' ? (
        <FlowView s={s as FlowState} {...o} />
      ) : (
        <TiltView s={s as TiltState} {...o} />
      )}
    </Svg>
  );
});

function DriftView({ s, orbFill, orbStroke, color }: { s: DriftState } & Orb) {
  return (
    <>
      <Circle cx={s.gold.x} cy={s.gold.y} r={DRIFT.gold + 6} fill={color} fillOpacity={0.18} />
      <Circle cx={s.gold.x} cy={s.gold.y} r={DRIFT.gold} fill={color} />
      {s.enemies.map((e, i) => (
        <Circle key={i} cx={e.x} cy={e.y} r={DRIFT.enemy} fill={colors.danger} />
      ))}
      <Circle cx={s.x} cy={s.y} r={DRIFT.player} fill={orbFill} stroke={orbStroke} strokeWidth={2} />
    </>
  );
}

function ChargeView({ s, orbFill, orbStroke, color }: { s: ChargeState } & Orb) {
  const y = CHARGE.groundY;
  const x0 = CHARGE.startX;
  const target = x0 + s.gap;
  const t = Math.min(s.t / CHARGE.flyTime, 1);
  const flying = s.mode === 'flying' || s.mode === 'falling';
  const bx = flying ? x0 + s.jump * t : x0;
  const by = flying ? y - 10 - Math.sin(Math.PI * t) * (40 + s.jump * 0.35) : y - 10 + chargePower(s.charge) * 2;
  const p = chargePower(s.charge);
  const over = s.charge > 1;
  return (
    <>
      <Line x1={0} y1={y + 18} x2={320} y2={y + 18} stroke={colors.outline} strokeWidth={2} strokeDasharray="4 8" />
      <Rect x={x0 - 18} y={y} width={36} height={8} rx={4} fill={colors.textFaint} />
      <Rect x={target - s.padR} y={y} width={s.padR * 2} height={8} rx={4} fill={color} />
      <Circle cx={target} cy={y + 4} r={3} fill={colors.white} />
      {s.mode === 'charging' && (
        <Line
          x1={x0}
          y1={y + 30}
          x2={x0 + p * CHARGE.maxJump}
          y2={y + 30}
          stroke={over ? colors.danger : color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeOpacity={0.8}
        />
      )}
      <Circle
        cx={bx}
        cy={s.phase === 'over' && s.mode !== 'aim' ? by + 40 : by}
        r={10 - (s.mode === 'charging' ? p * 2 : 0)}
        fill={over ? colors.danger : orbFill}
        stroke={orbStroke}
        strokeWidth={2}
      />
      <SvgText fontFamily={fonts.bodyBold} x={160} y={60} fill={colors.textMuted} fontSize={16} textAnchor="middle">
        {s.mode === 'charging' ? `${Math.round(p * 100)}%` : ''}
      </SvgText>
    </>
  );
}

const GATE_POS = [
  { x: 160, y: 22 },
  { x: 298, y: 160 },
  { x: 160, y: 298 },
  { x: 22, y: 160 },
];
function SwipeView({ s, orbStroke }: { s: SwipeState } & Orb) {
  const c = SWIPE_COLORS[visibleColor(s)];
  const frac = s.window ? Math.max(0, s.timer / s.window) : 1;
  const r = 70;
  const a = frac * Math.PI * 2;
  const arc = `M160 ${160 - r} A${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${160 + r * Math.sin(a)} ${160 - r * Math.cos(a)}`;
  const fling = s.fling ? GATE_POS[s.fling.dir] : null;
  const ft = s.fling ? s.fling.t / 0.25 : 0;
  return (
    <>
      {GATE_POS.map((g, i) => (
        <Rect
          key={i}
          x={g.x - (i % 2 ? 10 : 46)}
          y={g.y - (i % 2 ? 46 : 10)}
          width={i % 2 ? 20 : 92}
          height={i % 2 ? 92 : 20}
          rx={10}
          fill={SWIPE_COLORS[s.gates[i]]}
        />
      ))}
      <Circle cx={160} cy={160} r={r} stroke={colors.outline} strokeWidth={6} fill="none" />
      {frac > 0.001 && frac < 0.999 && <Path d={arc} stroke={c} strokeWidth={6} fill="none" strokeLinecap="round" />}
      {fling && (
        <Circle
          cx={160 + (fling.x - 160) * ft}
          cy={160 + (fling.y - 160) * ft}
          r={14}
          fill={colors.white}
          opacity={1 - ft}
        />
      )}
      <Circle
        cx={160}
        cy={160}
        r={26}
        fill={c}
        stroke={orbStroke}
        strokeWidth={s.trickTo !== null ? 4 : 0}
        strokeDasharray="5 5"
      />
    </>
  );
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

function FlowView({ s }: { s: FlowState } & Orb) {
  const pts = s.path.map((i) => cellCenter(i));
  const pathColor = s.path.length ? FLOW_COLORS[s.grid[s.path[0]]] : colors.white;
  const W = 300 * (s.timeLeft / 45);
  return (
    <>
      <Rect x={10} y={4} width={300} height={4} rx={2} fill={colors.outline} />
      <Rect x={10} y={4} width={Math.max(0, W)} height={4} rx={2} fill={s.timeLeft < 10 ? colors.danger : pathColor} />
      {pts.length > 1 && (
        <Polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          stroke={pathColor}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {s.grid.map((c, i) => {
        const p = cellCenter(i);
        const on = s.path.includes(i) || (s.loop && c === s.grid[s.path[0]]);
        return <Circle key={i} cx={p.x} cy={p.y} r={on ? 14 : 11} fill={FLOW_COLORS[c]} />;
      })}
    </>
  );
}

function TiltView({ s, orbFill, orbStroke, color }: { s: TiltState } & Orb) {
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
      <Circle cx={s.x} cy={s.y} r={TILT.ball} fill={orbFill} stroke={orbStroke} strokeWidth={2} />
    </>
  );
}

function ArenaView({ s, orbFill, orbStroke }: { s: ArenaState } & Orb) {
  const me = s.orbs[0];
  const r = radiusOf(me.mass);
  // Zoom out as you grow so big orbs still see danger coming.
  const view = Math.min(320 * Math.max(1, 0.55 + r / 40), 900);
  const k = 320 / view;
  const tx = (x: number) => (x - me.x) * k + 160;
  const ty = (y: number) => (y - me.y) * k + 160;
  const visible = (x: number, y: number, rr: number) =>
    Math.abs(x - me.x) < view / 2 + rr && Math.abs(y - me.y) < view / 2 + rr;
  const grid = 100;
  const lines: number[] = [];
  for (let g = Math.floor((me.x - view / 2) / grid) * grid; g < me.x + view / 2; g += grid) lines.push(g);
  const rows: number[] = [];
  for (let g = Math.floor((me.y - view / 2) / grid) * grid; g < me.y + view / 2; g += grid) rows.push(g);
  const top = leaderboard(s, 3);
  return (
    <>
      <G opacity={0.35}>
        {lines.map((g) => (
          <Line key={`x${g}`} x1={tx(g)} y1={0} x2={tx(g)} y2={320} stroke={colors.outline} strokeWidth={1} />
        ))}
        {rows.map((g) => (
          <Line key={`y${g}`} x1={0} y1={ty(g)} x2={320} y2={ty(g)} stroke={colors.outline} strokeWidth={1} />
        ))}
      </G>
      <Rect
        x={tx(0)}
        y={ty(0)}
        width={ARENA.world * k}
        height={ARENA.world * k}
        stroke={colors.textFaint}
        strokeWidth={2}
        fill="none"
      />
      <Circle
        cx={tx(ARENA.world / 2)}
        cy={ty(ARENA.world / 2)}
        r={s.zone * k}
        stroke="#7A5CFF"
        strokeWidth={3}
        strokeDasharray="8 6"
        fill="none"
      />
      {s.pellets.map((p, i) =>
        visible(p.x, p.y, 4) ? (
          <Circle key={i} cx={tx(p.x)} cy={ty(p.y)} r={Math.max(1.5, 3.5 * k)} fill={PELLET_COLORS[p.color]} />
        ) : null,
      )}
      {s.powers.map((p, i) =>
        visible(p.x, p.y, 10) ? (
          <G key={`p${i}`}>
            <Circle cx={tx(p.x)} cy={ty(p.y)} r={9 * k + 3} fill={colors.white} fillOpacity={0.15} />
            <SvgText x={tx(p.x)} y={ty(p.y) + 4} fontSize={11} fill={colors.white} textAnchor="middle">
              {p.kind === 'shield' ? 'S' : p.kind === 'magnet' ? 'M' : '+'}
            </SvgText>
          </G>
        ) : null,
      )}
      {s.orbs
        .slice()
        .sort((a, b) => a.mass - b.mass)
        .map((o) => {
          const rr = radiusOf(o.mass);
          if (!o.alive || !visible(o.x, o.y, rr)) return null;
          const mine = o.id === 0;
          return (
            <G key={o.id}>
              {o.shield > 0 && (
                <Circle cx={tx(o.x)} cy={ty(o.y)} r={rr * k + 5} stroke="#5AC8FA" strokeWidth={2} fill="none" />
              )}
              {o.magnet > 0 && (
                <Circle
                  cx={tx(o.x)}
                  cy={ty(o.y)}
                  r={(rr + 110) * k}
                  stroke="#FFC94D"
                  strokeOpacity={0.3}
                  strokeDasharray="3 6"
                  fill="none"
                />
              )}
              <Circle
                cx={tx(o.x)}
                cy={ty(o.y)}
                r={rr * k}
                fill={mine ? orbFill : o.color}
                fillOpacity={mine ? 1 : 0.9}
                stroke={mine ? orbStroke : colors.white}
                strokeOpacity={mine ? 1 : 0.25}
                strokeWidth={o.dashT > 0 ? 4 : 2}
              />
              {rr * k > 9 && (
                <SvgText
                  fontFamily={fonts.bodyBold}
                  x={tx(o.x)}
                  y={ty(o.y) + 4}
                  fontSize={Math.min(14, rr * k * 0.55)}
                  fill={mine ? colors.ground : colors.white}
                  textAnchor="middle"
                >
                  {o.name}
                </SvgText>
              )}
            </G>
          );
        })}
      {s.stick && (
        <Circle
          cx={s.stick.x}
          cy={s.stick.y}
          r={40}
          stroke={colors.white}
          strokeOpacity={0.25}
          strokeWidth={2}
          fill="none"
        />
      )}
      <Rect x={196} y={10} width={118} height={56} rx={10} fill={colors.ground} fillOpacity={0.7} />
      {top.map((o, i) => (
        <SvgText
          fontFamily={fonts.bodyBold}
          key={o.id}
          x={308}
          y={24 + i * 16}
          fontSize={12}
          textAnchor="end"
          fill={o.id === 0 ? '#4CE0B3' : colors.textMuted}
        >
          {`${i + 1}. ${o.name} ${Math.floor(o.mass)}`}
        </SvgText>
      ))}
      <SvgText fontFamily={fonts.bodyBold} x={14} y={24} fontSize={12} fill={colors.textMuted}>
        {`${Math.max(0, Math.ceil(ARENA.matchTime - s.elapsed))}s · #${s.rank}`}
      </SvgText>
    </>
  );
}
