# Deferred games: ideas, not shipped features

The default app exposes 11 games and 22 achievements. Maze, Duel and Chain are
disabled in the registry, absent from the library and achievement totals, and
their motion deep links redirect to the library. Saved bests/counters/unlocks are
retained. Historical TOTAL_GAMES and raw achievement definitions remain available
for compatibility; player-facing counts use the enabled catalog instead.

Measured Android production JavaScript before hiding: 4,786,135 bytes. Default
disabled export: 4,767,385 bytes, a reduction of 18,750 bytes (0.39%). Searches
found no Dot Maze / Dot Duel / Dot Chain names, deferred achievement titles or
ExpoAccelerometer module string. Enabled legacy games remain SVG/JS simulations.
This is uncompressed JavaScript, not an APK/installed-size comparison.

Set EXPO_PUBLIC_ENABLE_DEFERRED_GAMES=1 before building to restore all three.
For development-only testing use EXPO_PUBLIC_DEV_DEFERRED_GAMES=1. Restart Metro
with a cleared cache after changing a build flag. These are compile-time flags,
not remotely changeable settings. Conditional requires isolate engines, artwork,
achievement descriptions and the Maze sensor adapter. Jest alone can load the
retained engines to keep the original tests unchanged; that exception is not a
runtime player override. Both enabled and disabled release exports must be checked.

## Dot Maze idea

A ball rolls through three rotating ring gaps to escape before a timer expires.
It is shelved because the current Expo accelerometer path requires physical-device
validation, especially Android versus iOS signs and gravity filtering.

Proposed migration: pure fixed-tick ball/ring buffers, swept circle-versus-wall
contacts, shared-value Skia arcs, UI drag fallback and an active-only
Reanimated GRAVITY sensor. Reanimated 4.5.1 Android ACCELEROMETER maps to linear
acceleration; use GRAVITY for tilt and verify units/signs, not remembered API
behavior. See GAME_FOUNDATION.md and FOUNDATION_SAFETY_REVIEW.md.

Unlock conditions: tested on a physical Android device and iPhone; upright/flat/
left/right tilt verified; sensor unregisters on pause/background; collision spike
tests and zero frame-driven React render measurements pass. An emulator is not
evidence for real accelerometer behavior. Existing engine and tests stay unchanged.

## Dot Duel idea

Two players steer paddles on one phone, or a player competes against a bot; first
to five goals wins. It is shelved pending physical-device multitouch and puck
tunneling tests.

Proposed migration: fixed preallocated puck/paddle buffers, stable finger-to-paddle
ownership on touch-down, continuous relative-motion circle collision, bounded
remaining-time collision resolution and static Skia geometry. Preserve existing
drag feel, restitution and speed constants. The foundation tests cover a puck
moving 28 units plus opposing paddle motion, but native touch and gameplay must
still be tested.

Possible online version: authoritative server simulates ticks, clients send
sequenced paddle inputs, predict their own paddle, interpolate remote snapshots,
and reconcile acknowledged inputs. Server validates speeds/goals; phone-hosted
matches can only be friends-only, not cheat-proof competitive games. No networking
is implemented. See docs/online (design documents, including deferred features).

Unlock conditions: tested on a physical Android device with two simultaneous
fingers, cancellation/crossing-midline cases, continuous-contact stress tests,
pause/back/foreground handling, and zero frame-driven React renders.

## Dot Chain idea

One tap creates a spark; overlapping moving dots detonate and spread a timed blast
until a level goal is met. It is shelved because worst-case blast comparisons are
quadratic and need a dedicated design rather than moving identical hot work onto UI.

Proposed migration: a preallocated 56-slot dot/blast pool, numeric lifetime flags,
bounded spatial candidates, deterministic tick activation order and batched Skia
circle/blast rendering. Keep the legacy tick's snapshot of active blasts: newly
activated dots must not propagate again in the same tick unless explicitly approved.

Small unapplied optimization idea: build an active-blast index list once per tick
in a preallocated workspace, replacing filter/some allocations while retaining
the same index iteration order and short-circuit decisions. Seeded-trace proof:
replay seeds across levels 1..16, tap positions near edges and dense clusters,
and compare every dot position/blast age, score, phase and PRNG seed at every tick,
including frame spikes. Do not replace the snapshot with live flags mid-loop.
No optimization was applied to the legacy source.

Unlock conditions: tested on a physical Android device at maximum population;
seeded parity and boundary cases pass; p95/p99 UI tick cost fits its intended
frame budget; render counters and sustained thermal/memory tests pass.

## Achievement and statistics projection

All 26 historical definitions remain in source. Duellist, Better Together, Chain
Master and Escape Artist are excluded from the default displayed 22. Old unlocks
and awards are not deleted; hidden banners are drained without showing them.
Seen It All targets the enabled 11-game catalog, and distinct-game/progress/plays
UI excludes disabled playedBy entries. Runner ranks use Runner-only statistics
and remain unchanged. Re-enabling automatically restores the extra entries.

The internal reportGame API retains legacy saved-data/test semantics for explicit
deferred-game reports. Player routes never dispatch those reports while disabled.
Normal active-game reports and refresh use the player-visible achievement goals.
Documentation and old screenshots are not app routes; outdated overview and
26-achievement screenshots are removed from the current gallery rather than
presented as the current release. Source screenshot assets remain archived.
