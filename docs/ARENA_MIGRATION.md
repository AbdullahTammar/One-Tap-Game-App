# Step 3: deferred catalog and Arena migration

Plan: freeze the legacy oracle, hide the three deferred games, then port Arena
physics, inputs, drawing and persistence; validate before each of the two commits.
Dot Paint and the other legacy engines are not migrated. No tuning constants changed.
Risk list: native typed-array/Skia runtime behavior needs device smoke tests;
fixed timestep changes trajectories; pictures/paths still have native allocation
cost; storage failures require a durable outbox and idempotent projections; frame
budgets, thermals and battery cannot be established from an emulator alone.

## Catalog and bundle

Commit 1 is `460b477`: 11 enabled games, 22 visible achievements. The full raw
registry keeps enabled flags and saved keys; deferred metadata/rules/artwork/
achievement strings/sensors are conditionally required. See DEFERRED_GAMES.md.
No original Maze, Duel, Chain or Paint engine or original test file was changed.
All 26 historical achievement definitions remain in source.

Before hiding, Android production JS was 4,786,135 bytes. After hiding it was
4,767,385 (18,750 bytes smaller). The first Arena production export was 4,895,342
bytes: the new scene, engine and durable services add code. These numbers are
uncompressed JS, not APK sizes. Re-run the export for the final current byte size.
Final Arena production JavaScript is 4,895,131 bytes (108,996 above the original
baseline; 127,746 above the hide-only export). Default production searches found no deferred names/achievement titles,
ExpoAccelerometer, foundation harness/probe labels or Arena profiling labels.
The retained legacy Arena is still used by static library previews and the
development comparator; this change does not claim all legacy Arena code is
removed. Public builds cannot select the legacy Arena route through query params.

## Physics and oracle evidence

scripts/freeze-arena.cjs captured the unmodified legacy engine before any engine
port. fixtures/arena-legacy.json is immutable evidence, not an expectation file to
regenerate when a test fails. Eight seeded/scripted cases at 1/60 and 1/120 cover
movement/dash, shield/magnet/surge, kills/respawns, shrinking zone and full match
completion. SHA-256 checkpoints include all numeric orb/pellet/power state, seed,
score, kills, rank, elapsed time and next entity ID. Both the legacy engine and
new preallocated engine match every checkpoint exactly when given the same dt.
Additional tests cover zone floor 170, canEat, entity pool exhaustion/reuse,
latched dash, cancelled input, retained buffer identities, final rank bonus,
event ordering and maximum events per tick.

The new pure module uses 32 orb slots, a Float64 struct-of-arrays block, numeric
resource IDs, a stable active-order array, collision/leaderboard index workspace,
260 compacted pellets and four powers. Dead slots are reused; logical entity IDs
are monotonic. Stable insertion sorting preserves equal-mass order and random
calls occur in the same order as the legacy tick. No spreads, maps, filters, sorts,
new objects/arrays or string formatting occur in a tick. Creation allocates once;
reset reuses storage. Bounded endpoint canEat checks remain intentional to preserve
the oracle; continuous eating would change the rules. At 1/120, movement is smaller
than in legacy clamped frames. General sweep helpers remain available for later
games. The module imports no React Native, zustand or MMKV and can run on Node.

## All known timestep/input/presentation differences

- Production now integrates at 1/120 second. Legacy integrates each JS animation
  delta, capped at 50 ms. Fixed trajectories cannot be promised equal to a
  variable-dt run even with the same initial seed.
- Velocity damping approaches the same target, but integration uses two smaller
  updated velocities rather than one large step. Position and mass-dependent speed
  therefore differ; accumulated rounding can differ too.
- Pellet collection, absorption, storm damage, shield/dash/magnet expiration,
  threat selection, bot retargeting and rank crossings are tested at different
  instants. Contact cascades can diverge after the first threshold crossing.
- Respawn probability still uses dt*0.8. Doubling tick opportunities changes the
  number/timing of RNG draws and potentially later bots/pellets. The probability
  constant and every other tuning number are unchanged. AI's existing randomized
  rethink interval and utility choices remain identical at a matching dt.
- Power interval and match-end boundaries quantize to a fixed tick. They remain
  the same 9-second power interval and 180-second match, not new duration constants.
  Tests are exact for matching dt. For cross-dt comparisons use boundary tolerances
  of the relevant step size, not a fabricated long-run position tolerance: random
  and contact divergence makes long-run positional closeness meaningless.
- Joystick input now arrives on UI and is sampled by fixed ticks instead of RN
  responder callbacks. The same 4-unit deadzone, 40-unit full-speed distance,
  normalization and relative anchor are preserved. Dash remains a latch until
  a physics tick consumes it; pointer-up does not erase it.
- Cancel/pause/background now clear both generic input and Arena's own steering
  fields. Legacy could retain steering after a pause. This is an explicit safety
  correction, not a tuning change. Resume discards background time.
- Interpolation can display one fixed tick behind the latest simulation. Pause
  snaps alpha to 1, showing the latest state. Camera uses the same zoom formula
  and culling geometry. HUD updates through Skia, not React publication at 30 Hz.
- Skia system font/glyph rasterization differs from SVG typography. Emoji/flag
  paragraphs are pre-rasterized once into images; font fallback must be checked
  visually on Android and iOS, including non-Latin player names. This is a remaining
  typography risk, not a claim of pixel-identical SVG text rendering.
- Kill feedback retains the legacy score-increase/perfect gate. A kill below a
  previous peak is recorded without inventing an extra sound. Game-over miss
  feedback, reporting, coins, share text and achievement toasts retain their flow.

## Drawing and installed API evidence

The scene contains a single Picture node, not React nodes per entity. Reused
PictureRecorder, paints, fonts, emoji images, six pellet PathBuilders and native
scratch rects live outside physics. Camera transforms are separate from world
coordinates. Shield/magnet/dash effects, grid/border/zone and top-three/timer/rank/
mass text draw from shared state. Header mass and dash recharge text also use Skia.

Installed Skia 2.6.2 sources:

- skia/types/Picture/PictureRecorder.ts: beginRecording and finishRecordingAsPicture.
- skia/types/Rect.ts: SkHostRect.setXYWH; skia/types/Skia.ts returns SkHostRect from
  XYWHRect. Read-only x/y/width/height fields are not assigned directly.
- cpp/api/JsiSkRect.h: native setXYWH mutates the cached rect; fromValue accepts
  host rects. This avoids creating a native rectangle for every pellet.
- skia/types/Path/PathBuilder.ts: reusable reset/addOval/build; immutable results
  still allocate natively. Pictures and built paths are drawing allocations,
  not a promise of an allocation-free GPU/renderer.
- skia/types/PathEffect.ts: MakeDash; Paint/Paint.ts: setPathEffect/setStrokeWidth.
- Paragraph/ParagraphBuilder.ts and Paragraph.ts: Make/addText/build/layout/paint;
  Surface/SurfaceFactory.ts: MakeOffscreen; Canvas.ts: drawImageRect/drawText.
- skia/core/Font.ts: matchFont resolves a system typeface once; Font/Font.ts exposes
  setSize and measureText. Name-width measurements are precomputed.

Installed Worklets 0.10.1 serializable.native.ts handles ArrayBuffer.isView and
cloneArrayBufferView, including Float64Array/Uint8Array. Reanimated 4.5.1 shared
modifiers own every simulation write. Frame callback identity stays stable across
discrete owner renders; only engine/configuration changes replace its registration.
Gesture Handler 2.32.0 Manual touch callbacks and Tap.onBegin write UI-owned input.
See FOUNDATION_SAFETY_REVIEW.md for source line evidence for the foundation APIs.

## Persistence, Leave, recovery and results

Run IDs are allocated from a durable monotonic MMKV counter before use; a restart
creates a new keyed session. The event bus takes that ID rather than session=1.
Wire payloads are small primitives, never entity buffers. Cumulative kills travel
in hit events; score/best/achievement hints precede gameOver.

Every RN event is first appended to a durable outbox by (run ID, sequence), then
processed with createAtomicEventStore. The final report is exactly
`{ id: 'arena', score, arenaKills, arenaWin }`; irrelevant legacy report arguments
are zero/false and other counters remain unchanged. Achievement projection computes
the same reportGame counters, day behavior, visible unlocks and coin rates. Its
result plus receipt share the achievements key; coin delta plus receipt share the
progress key. Best is an idempotent maximum. These target receipts bridge a
multi-key failure after the main atomic ledger commit. A retry re-publishes an
already-applied in-memory target receipt if its earlier MMKV write threw.

Core retains unacknowledged batches, tries twice, then exposes Retry / Leave.
Leave or Retain events and restart marks the run for durable handoff: serialization
still must succeed, but final projections can drain at module scope after leaving.
The UI owner stays mounted until pendingEvents reaches zero. A global saving
status exposes queued failures and Retry saving; module drain also runs on startup
and foreground. Results/round-complete display waits for final acknowledgements.
Restart waits for safe handoff instead of resetting a blocked old bus in place.

If MMKV cannot accept even the outbox, the owner deliberately stays on Saving
match and offers Retry; discarding events to force a reset would violate durability.
A permanently unavailable storage device cannot be durably saved to. Main-store
projection failures can be handed off and restarted without losing events.
The queue survives process restart once its outbox write succeeds. No networking
or cloud persistence is added.

Receipt/history maps grow with completed runs (the main ledger prunes intermediate
receipts once terminal). Further retention/compaction needs a replay-safe policy.
Large history JSON writes remain discrete RN work and need profiling; migration
does not pretend shared-value architecture eliminates all JS/storage costs.

## Emulator smoke and measurement procedure

Use the same installed development build, AVD, refresh rate and Metro session for
both variants. This work used the existing Medium_Phone_API_37.0 AVD; its Android
system server / ADB stalled during the verification attempt. It was restarted
without wiping userdata. No trustworthy native Arena frame measurements were
collected while the AVD was unresponsive; do not infer a performance result from
exports or headless tests. The following procedure is ready for a responsive AVD.

From the workspace root:

```powershell
Set-Location app
npm start -- --localhost --port 8082
```

In another terminal with adb on PATH:

```powershell
adb devices
adb -s emulator-5554 reverse tcp:8082 tcp:8082
adb -s emulator-5554 shell "am start -a android.intent.action.VIEW -d 'lumo://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082' -p com.abdullahtammar.lumo"
adb -s emulator-5554 shell "am start -a android.intent.action.VIEW -d 'lumo://motion?game=arena&engine=worklet&seed=42' -p com.abdullahtammar.lumo"
```

Replace the serial/package with adb devices / APP_BUNDLE_ID if configured differently.
Quote the whole remote command as above so ampersands are not shell operators.

1. Ready: edit the player name; inspect skins, flags/emoji, board and leaderboard.
   Start; drag from anywhere, release to coast-stop, collect pellets, dash after
   growing. Observe mass/cooldown/grow/recharge without React text updates.
2. Pause, wait, resume; background, return, resume; press Android Back during play.
   Check no time jump/stale joystick. Pause then Back to games must retain any best.
3. Play to death/end; verify final score, rank bonus, coins, achievements and share.
   Try again; confirm fresh run and no duplicate rewards. Storage failure/handoff
   behavior is covered by arena-handoff.test.ts; the global save status is the
   visible failure surface for real failures.
4. Open disabled deep links `lumo://motion?game=tilt`, `...game=duel`, `...game=chain`:
   each returns to the 11-game library. Inspect 22 achievement totals; old saved
   disabled scores/unlocks must survive. Build with the deferred flag to restore
   all 14/26 entries, then restore the default flag before release.
5. Use the dev panel's Legacy / Worklet buttons, same seed 42. Each selection gets
   a fresh instance, including selecting Stress twice; a nonce prevents stale
   React state from reusing an old run. Stress uses 11 nearby shielded bots,
   260 nearby pellets, 500 player mass and a 30-second magnet/shield; it is a
   development-only fixture, not changed gameplay constants. Tap/drag/dash during
   the stress window and repeat the same script for both variants.
6. Warm up with Probe off. Turn Probe on, inspect commits/events once, dismiss the
   alert and let UI settle. Run untouched 30 seconds, then snapshot statistics and
   inspect commits/events again. Record p50/p95/p99, late frames vs 1000/60 and
   1000/120 ms, sample count and differences in screen/art commits. Arena probes
   hold 3,600 samples so a 30-second 120 Hz window fits (counts are cumulative;
   start a fresh instance for each measurement).
7. Record React DevTools Profiler simultaneously for a separate run. Native art
   should show zero frame-driven React commits. Native screen commits from best/
   score events, overlays and recovery are allowed; compare event counts with
   screen commits rather than declaring every automatic score change a frame render.
   Legacy caps React publication at 30 Hz; expect many frame-driven screen/art
   commits. Do not use counter/probe button presses inside the measured interval.
8. Repeat with Stress, identical touch script and refresh configuration. Save
   numbers/screenshots with device model, build mode, seed and emulator graphics
   backend. Native traces from Perf Monitor/Perfetto/Flashlight can supplement the
   development probe; explicit snapshots and development tooling perturb timing.

Emulator conclusions: native code loads, input/overlays/persistence behavior,
render counts and relative before/after under the same setup. Not supported:
absolute real-device fps, thermal throttling, battery, physical tilt/multitouch
quality or low-end GPU memory. No stable 60/120 fps claim is made. Physical
mid-range Android and iPhone measurements remain required before release.

## Validation and Step 4 proposal

Original tests remain unchanged. Validation includes typecheck/lint, all original
and new tests (149 across 13 suites), frozen parity, pools/events and handoff replay,
and Android production/development exports. The default production bundle excludes
deferred code markers and all development harness/profiling markers.

Step 4 proposal (not started): freeze Paint traces and ownership-count oracles;
keep its 8 Hz board cadence inside the shared clock; port owner/trail to preallocated
Int16 grids and painters to fixed buffers; update territory counts on every cell
ownership transition; preallocate capture/flood-fill workspace with enqueue-time
visited marking; rebuild batched geometry only on dirty board versions; migrate
UI swipe input; map paintKills/percent/coins to the same durable event/handoff model;
validate captures, cuts, respawns, head collisions, receipts and native frame traces
before a separate Paint commit. Online server authority remains design-only.
