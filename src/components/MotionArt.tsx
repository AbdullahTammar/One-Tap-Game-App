/* eslint-disable @typescript-eslint/no-require-imports -- build-time conditional requires exclude deferred modules */
import type { ChainState } from '../game/motion/chain';
import type { DuelState } from '../game/motion/duel';
import type { TiltState } from '../game/motion/tilt';
import { memo } from 'react';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { ARENA, leaderboard, PELLET_COLORS, radiusOf, type ArenaState } from '../game/motion/arena';
import { CHARGE, chargePower, type ChargeState } from '../game/motion/charge';
import { DRIFT, type DriftState } from '../game/motion/drift';
import { PAINT, PAINT_COLORS, paintBoard, type PaintState } from '../game/motion/paint';
import { ceiling, STACK, type StackState } from '../game/motion/stack';
import { cellCenter, FLOW_COLORS, type FlowState } from '../game/motion/flow';
import { createMotion, type AnyMotion, type MotionId } from '../game/motion';
import { SWIPE_COLORS, visibleColor, type SwipeState } from '../game/motion/swipe';
import { colors, fonts } from '../theme';
import { SkinDot } from './SkinDot';

const DeferredView =
  process.env.EXPO_PUBLIC_ENABLE_DEFERRED_GAMES === '1' ||
  (__DEV__ && process.env.EXPO_PUBLIC_DEV_DEFERRED_GAMES === '1') ||
  process.env.NODE_ENV === 'test'
    ? (require('./DeferredMotionArt').default as typeof import('./DeferredMotionArt').default)
    : () => null;
interface Props {
  id: MotionId;
  color: string;
  size: number;
  height?: number;
  state?: AnyMotion;
  orbFill?: string;
  orbStroke?: string;
  orbEmoji?: string;
}
interface Orb {
  orbFill: string;
  orbStroke: string;
  orbEmoji?: string;
  color: string;
}

export const MotionArt = memo(function MotionArt({
  id,
  color,
  size,
  height = size,
  state,
  orbFill = colors.white,
  orbStroke = colors.white,
  orbEmoji,
}: Props) {
  const s = state ?? createMotion(id, 7);
  const o = { orbFill, orbStroke, orbEmoji, color };
  const fieldHeight = id === 'arena' ? (320 * height) / size : 320;
  return (
    <Svg width={size} height={height} viewBox={`0 0 320 ${fieldHeight}`}>
      <Rect
        x={1}
        y={1}
        width={318}
        height={fieldHeight - 2}
        rx={28}
        fill={colors.surface}
        stroke={colors.outline}
        strokeWidth={2}
      />
      {id === 'arena' ? (
        <ArenaView s={s as ArenaState} fieldHeight={fieldHeight} {...o} />
      ) : id === 'drift' ? (
        <DriftView s={s as DriftState} {...o} />
      ) : id === 'charge' ? (
        <ChargeView s={s as ChargeState} {...o} />
      ) : id === 'swipe' ? (
        <SwipeView s={s as SwipeState} {...o} />
      ) : id === 'chain' ? (
        <DeferredView id="chain" s={s as ChainState} {...o} />
      ) : id === 'flow' ? (
        <FlowView s={s as FlowState} {...o} />
      ) : id === 'stack' ? (
        <StackView s={s as StackState} {...o} />
      ) : id === 'duel' ? (
        <DeferredView id="duel" s={s as DuelState} {...o} />
      ) : id === 'paint' ? (
        <PaintView s={s as PaintState} {...o} />
      ) : (
        <DeferredView id="tilt" s={s as TiltState} {...o} />
      )}
    </Svg>
  );
});

function DriftView({ s, orbFill, orbStroke, orbEmoji, color }: { s: DriftState } & Orb) {
  return (
    <>
      <Circle cx={s.gold.x} cy={s.gold.y} r={DRIFT.gold + 6} fill={color} fillOpacity={0.18} />
      <Circle cx={s.gold.x} cy={s.gold.y} r={DRIFT.gold} fill={color} />
      {s.enemies.map((e, i) => (
        <Circle key={i} cx={e.x} cy={e.y} r={DRIFT.enemy} fill={colors.danger} />
      ))}
      <SkinDot
        cx={s.x}
        cy={s.y}
        r={orbEmoji ? DRIFT.player + 3 : DRIFT.player}
        fill={orbFill}
        stroke={orbStroke}
        emoji={orbEmoji}
      />
    </>
  );
}

function ChargeView({ s, orbFill, orbStroke, orbEmoji, color }: { s: ChargeState } & Orb) {
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
      <SkinDot
        cx={bx}
        cy={s.phase === 'over' && s.mode !== 'aim' ? by + 40 : by}
        r={(orbEmoji ? 14 : 10) - (s.mode === 'charging' ? p * 2 : 0)}
        fill={over ? colors.danger : orbFill}
        stroke={over ? colors.danger : orbStroke}
        emoji={orbEmoji}
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

function ArenaView({ s, orbFill, orbStroke, orbEmoji, fieldHeight }: { s: ArenaState; fieldHeight: number } & Orb) {
  const me = s.orbs[0];
  const r = radiusOf(me.mass);
  // Zoom out as you grow so big orbs still see danger coming.
  const view = Math.min(320 * Math.max(1, 0.55 + r / 40), 900);
  const k = 320 / view;
  const tx = (x: number) => (x - me.x) * k + 160;
  const ty = (y: number) => (y - me.y) * k + fieldHeight / 2;
  const viewHeight = fieldHeight / k;
  const visible = (x: number, y: number, rr: number) =>
    Math.abs(x - me.x) < view / 2 + rr && Math.abs(y - me.y) < viewHeight / 2 + rr;
  const grid = 100;
  const lines: number[] = [];
  for (let g = Math.floor((me.x - view / 2) / grid) * grid; g < me.x + view / 2; g += grid) lines.push(g);
  const rows: number[] = [];
  for (let g = Math.floor((me.y - viewHeight / 2) / grid) * grid; g < me.y + viewHeight / 2; g += grid) rows.push(g);
  const top = leaderboard(s, 3);
  // Batch equal-color pellets into six native paths instead of a native view per pellet.
  const pelletPaths = PELLET_COLORS.map(() => '');
  const pr = Math.max(1.5, 3.5 * k);
  for (const p of s.pellets) {
    if (!visible(p.x, p.y, 4)) continue;
    const x = tx(p.x),
      y = ty(p.y);
    pelletPaths[p.color] += `M${x - pr},${y}a${pr},${pr} 0 1,0 ${pr * 2},0a${pr},${pr} 0 1,0 ${-pr * 2},0Z`;
  }
  const gridPath =
    lines.map((g) => `M${tx(g)},0V${fieldHeight}`).join('') + rows.map((g) => `M0,${ty(g)}H320`).join('');
  return (
    <>
      <Path d={gridPath} fill="none" stroke={colors.outline} strokeWidth={1} opacity={0.35} />
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
      {pelletPaths.map((d, i) => (d ? <Path key={i} d={d} fill={PELLET_COLORS[i]} /> : null))}
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
              <SkinDot
                cx={tx(o.x)}
                cy={ty(o.y)}
                r={rr * k}
                fill={mine ? orbFill : o.color}
                stroke={mine ? orbStroke : o.dashT > 0 ? colors.white : o.color}
                emoji={mine ? orbEmoji : o.emoji}
                strokeWidth={o.dashT > 0 ? 4 : 2}
              />
              {rr * k > 8 && (
                <SvgText
                  fontFamily={fonts.bodyBold}
                  x={tx(o.x)}
                  y={(mine ? orbEmoji : o.emoji) ? ty(o.y) + rr * k + 13 : ty(o.y) + 4}
                  fontSize={
                    (mine ? orbEmoji : o.emoji) ? 11 : Math.min(14, (rr * k * 1.7) / Math.max(3, o.name.length))
                  }
                  fill={mine && !orbEmoji ? colors.ground : colors.white}
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

const STACK_COLORS = ['#7A9CFF', '#B48CFF', '#FF7AD9', '#FF8A4C', '#FFC94D', '#C8F560', '#4CE0B3', '#5AC8FA'];
function StackView({ s, orbFill, orbStroke, orbEmoji, color }: { s: StackState } & Orb) {
  const room = ceiling(s);
  return (
    <>
      <Circle cx={160} cy={160} r={STACK.outer + 4} stroke={colors.outline} strokeWidth={2} fill="none" />
      {s.rings.map((r, i) => (
        <Circle
          key={i}
          cx={160}
          cy={160}
          r={r + STACK.thick / 2}
          stroke={STACK_COLORS[i % STACK_COLORS.length]}
          strokeWidth={STACK.thick}
          strokeDasharray={i % 2 ? '14 6' : undefined}
          fill="none"
          transform={`rotate(${(s.spin * (i % 2 ? -40 : 40)) % 360} 160 160)`}
        />
      ))}
      {/* The danger line: the inside edge of the last ring. */}
      <Circle
        cx={160}
        cy={160}
        r={room}
        stroke={colors.danger}
        strokeOpacity={0.35}
        strokeDasharray="2 6"
        fill="none"
      />
      {s.cur > 0 && (
        <Circle
          cx={160}
          cy={160}
          r={s.cur + STACK.thick / 2}
          stroke={s.phase === 'over' ? colors.danger : color}
          strokeWidth={STACK.thick}
          fill="none"
        />
      )}
      <SkinDot cx={160} cy={160} r={orbEmoji ? 11 : 7} fill={orbFill} stroke={orbStroke} emoji={orbEmoji} />
      <SvgText fontFamily={fonts.bodyBold} x={20} y={30} fill={colors.textMuted} fontSize={15}>
        {`LV ${s.level}`}
      </SvgText>
    </>
  );
}

function PaintView({ s, orbFill, orbStroke, orbEmoji }: { s: PaintState } & Orb) {
  const N = PAINT.size;
  const c = PAINT.cell;
  // Merge runs of equal cells per row so a full board is a few dozen rects, not a thousand.
  const runs: { x: number; y: number; w: number; o: number; trail: boolean }[] = [];
  for (const [grid, trail] of [
    [s.owner, false],
    [s.trail, true],
  ] as const)
    for (let y = 0; y < N; y++) {
      let x = 0;
      while (x < N) {
        const o = grid[y * N + x];
        let w = 1;
        while (x + w < N && grid[y * N + x + w] === o) w++;
        if (o >= 0) runs.push({ x, y, w, o, trail });
        x += w;
      }
    }
  const colorOf = (id: number) => (id === 0 ? orbFill : PAINT_COLORS[id % PAINT_COLORS.length]);
  const regions = new Map<string, { owner: number; trail: boolean; path: string }>();
  for (const r of runs) {
    const key = `${r.o}:${r.trail}`;
    const region = regions.get(key) ?? { owner: r.o, trail: r.trail, path: '' };
    region.path += `M${r.x * c},${r.y * c}h${r.w * c}v${c}h${-r.w * c}Z`;
    regions.set(key, region);
  }
  const board = paintBoard(s).slice(0, 3);
  return (
    <>
      {[...regions.entries()].map(([key, region]) => (
        <Path
          key={key}
          d={region.path}
          fill={colorOf(region.owner)}
          fillOpacity={region.trail ? 0.45 : region.owner === 0 ? 0.55 : 0.4}
        />
      ))}
      {s.painters.map((p) =>
        p.alive ? (
          <SkinDot
            key={p.id}
            cx={p.x * c + c / 2}
            cy={p.y * c + c / 2}
            r={p.id === 0 ? 8 : 7}
            fill={colorOf(p.id)}
            stroke={p.id === 0 ? orbStroke : colors.white}
            emoji={p.id === 0 ? orbEmoji : p.emoji}
            strokeWidth={p.id === 0 ? 2.5 : 1}
          />
        ) : null,
      )}
      <Rect x={200} y={6} width={114} height={52} rx={10} fill={colors.ground} fillOpacity={0.7} />
      {board.map(({ p, pct }, i) => (
        <SvgText
          fontFamily={fonts.bodyBold}
          key={p.id}
          x={306}
          y={22 + i * 15}
          fontSize={11}
          textAnchor="end"
          fill={p.id === 0 ? '#FF7AD9' : colors.textMuted}
        >
          {`${i + 1}. ${p.name} ${pct}%`}
        </SvgText>
      ))}
      <SvgText fontFamily={fonts.bodyBold} x={10} y={20} fontSize={12} fill={colors.textMuted}>
        {`${Math.max(0, Math.ceil(s.timeLeft))}s · ${s.pct}%`}
      </SvgText>
    </>
  );
}
