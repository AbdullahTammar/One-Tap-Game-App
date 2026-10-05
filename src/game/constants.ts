/**
 * Gameplay tuning. Values match the Lumo design prototype; tweak here only.
 * Angles are radians, speeds are radians per second.
 */
export const GAME = {
  /** Orb angular speed at the start of a run. */
  startSpeed: 2.2,
  /** Each hit multiplies speed by this factor. */
  speedGrowth: 1.05,
  /** Hard ceiling so the game stays humanly playable. */
  maxSpeed: 6.5,
  /** Gate half-width at score 0. */
  gateHalfStart: 0.34,
  /** Gate half-width shrink per gate cleared. */
  gateHalfShrink: 0.006,
  /** Smallest gate half-width. */
  gateHalfMin: 0.16,
  /** Extra forgiveness on taps (visual arc is drawn with round caps). */
  tapTolerance: 0.08,
  /** How far past the gate the orb may travel before the run ends. */
  slipTolerance: 0.1,
  /** A tap within this fraction of the half-width counts as "perfect". */
  perfectFraction: 0.35,
  /** Next gate is placed this far ahead (min + random * range). */
  nextGateMin: 1.5,
  nextGateRange: 2.4,
  /** Gates per level. */
  gatesPerLevel: 5,
  /** Physics sub-step so fast orbs can never tunnel through a gate. */
  maxStep: 1 / 240,
  /** Frame delta clamp (s) — protects against hitches / backgrounding. */
  maxFrameDelta: 0.05,
  /** Continues allowed per run (rewarded ad). */
  maxContinues: 1,
} as const;

export const ECONOMY = {
  /** Coins per gate cleared. 42 gates -> 21 coins, as in the design. */
  coinsPerGate: 0.5,
  /** Bonus coins per perfect hit. */
  coinsPerPerfect: 0,
  /** Daily goal (gates) and its reward. */
  dailyGoalGates: 30,
  dailyGoalReward: 50,
  /** Coins granted to a fresh install so the shop feels alive. */
  starterCoins: 150,
} as const;

export const RING = {
  /** Geometry in the 300x300 design viewBox. */
  view: 300,
  center: 150,
  radius: 130,
  stroke: 18,
  orbRadius: 17,
  orbOutline: 4,
} as const;
