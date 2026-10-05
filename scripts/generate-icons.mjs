#!/usr/bin/env node
/**
 * Renders the app icon, Android adaptive layers, splash mark and favicon from
 * the Lumo ring artwork (SVG -> PNG via headless Chromium).
 *
 * Run: `node scripts/generate-icons.mjs` (needs Playwright: `npx playwright --version`).
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const out = join(import.meta.dirname, '..', 'assets');
const GROUND = '#0E0F14';
const TRACK = '#1F212B';
const ACCENT = '#C8F560';

/** Ring artwork in a 300-unit box; `scale` shrinks it toward the centre. */
function ring({ scale = 1, mono = false, track = TRACK }) {
  const c = 150;
  const r = 104;
  const p = (a) => `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
  const gate = -Math.PI / 2 + 1.18;
  const orb = -Math.PI * 0.62;
  const fg = mono ? '#FFFFFF' : ACCENT;
  return `
  <g transform="translate(${c} ${c}) scale(${scale}) translate(${-c} ${-c})">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${mono ? '#FFFFFF' : track}" stroke-opacity="${mono ? 0.35 : 1}" stroke-width="26"/>
    <path d="M ${p(gate - 0.42)} A ${r} ${r} 0 0 1 ${p(gate + 0.42)}" fill="none" stroke="${fg}" stroke-width="26" stroke-linecap="round"/>
    ${mono ? '' : `<path d="M ${p(orb - 0.6)} A ${r} ${r} 0 0 1 ${p(orb)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.2" stroke-width="26" stroke-linecap="round"/>`}
    <circle cx="${p(orb).split(' ')[0]}" cy="${p(orb).split(' ')[1]}" r="25" fill="#FFFFFF" stroke="${mono ? 'none' : GROUND}" stroke-width="6"/>
  </g>`;
}

const svg = (body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="1024" height="1024">${
    bg ? `<rect width="300" height="300" fill="${bg}"/>` : ''
  }${body}</svg>`;

const targets = [
  { file: 'icon.png', size: 1024, svg: svg(ring({ scale: 0.98 }), GROUND) },
  // Adaptive icon: art must sit inside the central 66% safe zone.
  { file: 'android-icon-foreground.png', size: 1024, svg: svg(ring({ scale: 0.72 })) },
  { file: 'android-icon-background.png', size: 1024, svg: svg('', GROUND) },
  { file: 'android-icon-monochrome.png', size: 1024, svg: svg(ring({ scale: 0.72, mono: true })) },
  { file: 'splash-icon.png', size: 1024, svg: svg(ring({ scale: 1.2 })) },
  { file: 'favicon.png', size: 64, svg: svg(ring({ scale: 1.25 }), GROUND) },
];

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${t.svg.replace('width="1024" height="1024"', `width="${t.size}" height="${t.size}"`)}</body></html>`,
  );
  await page.screenshot({
    path: join(out, t.file),
    omitBackground: true,
    clip: { x: 0, y: 0, width: t.size, height: t.size },
  });
  console.log(`wrote assets/${t.file}`);
}
await browser.close();
