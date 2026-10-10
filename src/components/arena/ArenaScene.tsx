import { Canvas, Picture, PaintStyle, Skia, matchFont, type SkCanvas, type SkImage } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { F, orb, radius, type ArenaBuffers } from '../../game/arena/engine';
import { ARENA_COLORS, ARENA_EMOJI, ARENA_NAMES } from '../../game/arena/resources';
import { ARENA, PELLET_COLORS } from '../../game/motion/arena';
import type { Skin } from '../../game/skins';
/* eslint-disable @typescript-eslint/no-require-imports -- counters are development-only */
const useRenderCounter = __DEV__
  ? (require('../../game/arena/dev/metrics') as typeof import('../../game/arena/dev/metrics')).useArenaRenderCounter
  : () => {};

function bitmap(text: string): SkImage | null {
  const surface = Skia.Surface.MakeOffscreen(96, 96);
  if (!surface) return null;
  const paragraph = Skia.ParagraphBuilder.Make({
    textStyle: { fontSize: 72, fontFamilies: ['Noto Color Emoji', 'Apple Color Emoji', 'sans-serif'] },
  })
    .addText(text)
    .build();
  paragraph.layout(96);
  paragraph.paint(surface.getCanvas(), (96 - paragraph.getLongestLine()) / 2, (96 - paragraph.getHeight()) / 2);
  return surface.makeImageSnapshot();
}
function resources(width: number, height: number, skin: Skin, playerName: string) {
  const paint = (color: string, stroke = 0) => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setAntiAlias(true);
    if (stroke) {
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeWidth(stroke);
    }
    return p;
  };
  const names = [playerName, ...ARENA_NAMES],
    font = matchFont({ fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'bold' });
  const zone = paint('#7A5CFF', 3);
  zone.setPathEffect(Skia.PathEffect.MakeDash([8, 6], 0));
  const magnet = paint('#FFC94D', 1);
  magnet.setPathEffect(Skia.PathEffect.MakeDash([3, 6], 0));
  return {
    recorder: Skia.PictureRecorder(),
    bounds: Skia.XYWHRect(0, 0, width, height),
    world: Skia.XYWHRect(0, 0, ARENA.world, ARENA.world),
    oval: Skia.XYWHRect(0, 0, 0, 0),
    source: Skia.XYWHRect(0, 0, 96, 96),
    destination: Skia.XYWHRect(0, 0, 0, 0),
    builders: PELLET_COLORS.map(() => Skia.PathBuilder.Make()),
    pellets: PELLET_COLORS.map((c) => paint(c)),
    grid: paint('#2E3140', 1),
    border: paint('#8C8F9C', 2),
    zone,
    orbFill: [...ARENA_COLORS.map((c) => paint(c)), paint(skin.fill)],
    orbStroke: [...ARENA_COLORS.map((c) => paint(c, 2)), paint(skin.stroke, 2)],
    white: paint('#FFFFFF'),
    whiteStroke: paint('#FFFFFF', 4),
    shield: paint('#5AC8FA', 2),
    magnet,
    text: paint('#A4A6B3'),
    playerText: paint('#4CE0B3'),
    darkText: paint('#0E0F14'),
    backdrop: paint('#0E0F14'),
    stick: paint('#FFFFFF', 2),
    names,
    font,
    nameWidth: names.map((n) => font.measureText(n).width),
    emoji: [...ARENA_EMOJI.map(bitmap), skin.emoji ? bitmap(skin.emoji) : null],
    drawOrder: new Uint8Array(32),
  };
}
type Resources = ReturnType<typeof resources>;
function draw(s: ArenaBuffers, r: Resources, c: SkCanvas, width: number, height: number, alpha: number) {
  'worklet';
  const meX = orb(s, F.previousX, 0) + (orb(s, F.x, 0) - orb(s, F.previousX, 0)) * alpha;
  const meY = orb(s, F.previousY, 0) + (orb(s, F.y, 0) - orb(s, F.previousY, 0)) * alpha;
  const view = Math.min(320 * Math.max(1, 0.55 + radius(orb(s, F.mass, 0)) / 40), 900),
    k = 320 / view;
  const fieldHeight = (320 * height) / width,
    viewHeight = fieldHeight / k;
  c.save();
  c.scale(width / 320, width / 320);
  c.translate(160, fieldHeight / 2);
  c.scale(k, k);
  c.translate(-meX, -meY);
  r.grid.setStrokeWidth(1 / k);
  r.grid.setAlphaf(0.35);
  for (let x = Math.floor((meX - view / 2) / 100) * 100; x < meX + view / 2; x += 100)
    c.drawLine(x, meY - viewHeight / 2, x, meY + viewHeight / 2, r.grid);
  for (let y = Math.floor((meY - viewHeight / 2) / 100) * 100; y < meY + viewHeight / 2; y += 100)
    c.drawLine(meX - view / 2, y, meX + view / 2, y, r.grid);
  r.border.setStrokeWidth(2 / k);
  c.drawRect(r.world, r.border);
  c.save();
  c.translate(meX, meY);
  c.scale(1 / k, 1 / k);
  c.drawCircle((ARENA.world / 2 - meX) * k, (ARENA.world / 2 - meY) * k, s.zone * k, r.zone);
  c.restore();
  const pr = Math.max(1.5, 3.5 * k) / k;
  for (let color = 0; color < 6; color++) r.builders[color].reset();
  for (let p = 0; p < s.pelletCount; p++) {
    const x = s.pelletX[p],
      y = s.pelletY[p];
    if (Math.abs(x - meX) >= view / 2 + 4 || Math.abs(y - meY) >= viewHeight / 2 + 4) continue;
    r.oval.setXYWH(x - pr, y - pr, pr * 2, pr * 2);
    r.builders[s.pelletColor[p]].addOval(r.oval);
  }
  for (let color = 0; color < 6; color++) c.drawPath(r.builders[color].build(), r.pellets[color]);
  r.font.setSize(11 / k);
  for (let p = 0; p < s.powerCount; p++) {
    const x = s.powerX[p],
      y = s.powerY[p];
    if (Math.abs(x - meX) >= view / 2 + 10 || Math.abs(y - meY) >= viewHeight / 2 + 10) continue;
    r.white.setAlphaf(0.15);
    c.drawCircle(x, y, 9 + 3 / k, r.white);
    r.white.setAlphaf(1);
    c.drawText(s.powerKind[p] === 0 ? 'S' : s.powerKind[p] === 1 ? 'M' : '+', x - 4 / k, y + 4 / k, r.white, r.font);
  }
  // Ascending stable draw order, separate from descending collision / leaderboard ordering.
  for (let i = 0; i < s.count; i++) {
    const slot = s.order[i];
    let j = i;
    while (j > 0 && orb(s, F.mass, r.drawOrder[j - 1]) > orb(s, F.mass, slot)) {
      r.drawOrder[j] = r.drawOrder[j - 1];
      j--;
    }
    r.drawOrder[j] = slot;
  }
  for (let i = 0; i < s.count; i++) {
    const slot = r.drawOrder[i];
    if (!orb(s, F.alive, slot)) continue;
    const x = orb(s, F.previousX, slot) + (orb(s, F.x, slot) - orb(s, F.previousX, slot)) * alpha;
    const y = orb(s, F.previousY, slot) + (orb(s, F.y, slot) - orb(s, F.previousY, slot)) * alpha;
    const rr = radius(orb(s, F.mass, slot));
    if (Math.abs(x - meX) >= view / 2 + rr || Math.abs(y - meY) >= viewHeight / 2 + rr) continue;
    if (orb(s, F.shield, slot) > 0) {
      r.shield.setStrokeWidth(2 / k);
      c.drawCircle(x, y, rr + 5 / k, r.shield);
    }
    if (orb(s, F.magnet, slot) > 0) {
      r.magnet.setAlphaf(0.3);
      c.save();
      c.translate(x, y);
      c.scale(1 / k, 1 / k);
      c.drawCircle(0, 0, (rr + 110) * k, r.magnet);
      c.restore();
    }
    const mine = orb(s, F.id, slot) === 0,
      color = mine ? 7 : s.color[slot];
    const image = mine ? r.emoji[13] : s.emoji[slot] >= 0 ? r.emoji[s.emoji[slot]] : null;
    r.orbFill[color].setAlphaf(image ? 0.35 : 1);
    c.drawCircle(x, y, rr, r.orbFill[color]);
    const stroke = !mine && orb(s, F.dashT, slot) > 0 ? r.whiteStroke : r.orbStroke[color];
    stroke.setStrokeWidth((orb(s, F.dashT, slot) > 0 ? 4 : 2) / k);
    c.drawCircle(x, y, rr, stroke);
    if (image) {
      const size = rr * 1.7;
      r.destination.setXYWH(x - size / 2, y - size / 2, size, size);
      r.white.setAlphaf(1);
      c.drawImageRect(image, r.source, r.destination, r.white);
    }
    if (rr * k > 8) {
      const name = r.names[s.name[slot]],
        fontSize = image ? 11 : Math.min(14, (rr * k * 1.7) / Math.max(3, name.length));
      r.font.setSize(fontSize / k);
      c.drawText(
        name,
        x - (r.nameWidth[s.name[slot]] * fontSize) / 12 / k / 2,
        image ? y + rr + 13 / k : y + 4 / k,
        mine && !image ? r.darkText : r.white,
        r.font,
      );
    }
  }
  c.restore();
  c.save();
  c.scale(width / 320, width / 320);
  if (s.stick) {
    r.stick.setAlphaf(0.25);
    c.drawCircle(s.stickX, s.stickY, 40, r.stick);
  }
  r.font.setSize(12);
  r.backdrop.setAlphaf(0.7);
  r.destination.setXYWH(196, 10, 118, 56);
  c.drawRect(r.destination, r.backdrop);
  for (let i = 0; i < 3; i++) {
    const slot = s.top[i];
    if (slot === 255) continue;
    c.drawText(
      `${i + 1}. ${r.names[s.name[slot]]} ${Math.floor(orb(s, F.mass, slot))}`,
      202,
      24 + i * 16,
      slot === 0 ? r.playerText : r.text,
      r.font,
    );
  }
  c.drawText(`${Math.max(0, Math.ceil(ARENA.matchTime - s.elapsed))}s · #${s.rank}`, 14, 24, r.text, r.font);
  c.drawText(`Mass ${Math.floor(orb(s, F.mass, 0))}`, 14, 42, r.playerText, r.font);
  c.restore();
}
/** One static Picture node. Host paints/builders/fonts/emoji bitmaps are created once, never in physics. */
export const ArenaScene = memo(function ArenaScene({
  state,
  alpha,
  width,
  height,
  skin,
  playerName,
}: {
  state: SharedValue<ArenaBuffers>;
  alpha: SharedValue<number>;
  width: number;
  height: number;
  skin: Skin;
  playerName: string;
}) {
  useRenderCounter('WorkletArenaArt');
  const r = useMemo(() => resources(width, height, skin, playerName), [height, playerName, skin, width]);
  const picture = useDerivedValue(() => {
    const c = r.recorder.beginRecording(r.bounds);
    draw(state.get(), r, c, width, height, alpha.get());
    return r.recorder.finishRecordingAsPicture();
  });
  return (
    <Canvas pointerEvents="none" style={{ width, height, backgroundColor: '#171922' }}>
      <Picture picture={picture} />
    </Canvas>
  );
});
export function ArenaDashText({
  state,
  width = 180,
  mass = false,
}: {
  state: SharedValue<ArenaBuffers>;
  width?: number;
  mass?: boolean;
}) {
  const r = useMemo(
    () => ({
      recorder: Skia.PictureRecorder(),
      bounds: Skia.XYWHRect(0, 0, width, 48),
      font: matchFont({ fontFamily: 'sans-serif', fontSize: 15, fontWeight: 'bold' }),
      paint: Skia.Paint(),
    }),
    [width],
  );
  const enabledColor = useMemo(() => Skia.Color('#4CE0B3'), []),
    disabledColor = useMemo(() => Skia.Color('#8C8F9C'), []);
  const picture = useDerivedValue(() => {
    const s = state.get(),
      cooldown = Math.ceil(orb(s, F.dashCd, 0) * 10) / 10,
      grow = orb(s, F.mass, 0) <= ARENA.startMass;
    const c = r.recorder.beginRecording(r.bounds);
    r.paint.setColor(!mass && (cooldown > 0 || grow) ? disabledColor : enabledColor);
    c.drawText(
      mass
        ? String(Math.floor(orb(s, F.mass, 0)))
        : cooldown > 0
          ? `Recharge ${cooldown.toFixed(1)}s`
          : grow
            ? 'Grow to dash'
            : 'Dash · −12%',
      12,
      30,
      r.paint,
      r.font,
    );
    return r.recorder.finishRecordingAsPicture();
  });
  return (
    <Canvas style={{ width, height: 48 }} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
