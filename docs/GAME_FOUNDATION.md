# Step 2: game performance foundation

Acceptance criterion: **zero frame-driven React renders**. Discrete score, pause,
game-over, achievement and new-best renders are allowed. No game is migrated here.
Gate Runner's engine, hook, renderer and constants remain untouched.

## Baseline

The real application repository is `app/.git`; `app/` is not a new untracked app.
Commit `2715fb0` captures the pre-existing changes in `__tests__/motion.test.ts`,
`src/app/{arcade,motion,play}.tsx`, `src/components/MotionArt.tsx`, and the new
`src/components/GameSession.tsx`, plus credential/environment ignore rules.
Baseline validation: typecheck, lint, 7 suites / 105 tests passed.
Foundation validation: typecheck and lint passed; 8 suites / 121 tests passed.
The pre-Step-3 corrections and source audit are in [Foundation safety review](FOUNDATION_SAFETY_REVIEW.md).
Android development and production exports passed. Development harness/probe
markers occur in the development JS and are absent from production JS.
No Git identity existed; a command-local Codex identity was used without changing
user configuration. Nothing was pushed.

The outer workspace's new `.gitignore` excludes `/work/`. That directory contains
local emulator screenshots, XML, logs, development preferences and scratch
scripts; it is preserved locally and excluded from commits. The application
ignores node_modules, generated Android/iOS projects, build exports, real env
files, private keys, signing files, credentials.json and service account files.
`.env.example` contains placeholders/public configuration only and stays tracked.
A private-key/common-token pattern scan found no matches in eligible app files;
this is a targeted scan, not a certification that arbitrary secrets cannot exist.

## API verification

Installed package sources and declaration files, not remembered APIs, were checked:

| Package         | Installed        | Evidence                                                                                                                                              |
| --------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reanimated      | 4.5.1            | `lib/typescript/index.d.ts`, `commonTypes.d.ts`, `src/hook/useFrameCallback.ts`: frame callback, shared value get/set/modify, animated sensors        |
| Worklets        | 0.10.1           | `lib/typescript/threads.d.ts`: `scheduleOnRN(fn, ...args)` and `scheduleOnUI(fn, ...args)`; `src/memory/serializable.native.ts` supports typed arrays |
| Gesture Handler | 2.32.0           | Manual gesture, touch callbacks and state manager declarations; local-coordinate touch IDs in `gestureHandlerCommon.d.ts`                             |
| Skia            | 2.6.2            | `src/external/reanimated/interpolators.ts`, `skia/types/Path/PathBuilder.ts`, drawing prop declarations                                               |
| Expo / RN       | 57.0.26 / 0.86.3 | package manifests, SDK 57 docs; existing `AppState.addEventListener` pattern and RN declarations                                                      |

Official references: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Expo accelerometer](https://docs.expo.dev/versions/v57.0.0/sdk/accelerometer/),
[Reanimated frame callback](https://docs.swmansion.com/react-native-reanimated/docs/advanced/useFrameCallback/),
[animated sensor](https://docs.swmansion.com/react-native-reanimated/docs/device/useAnimatedSensor/),
[RN scheduling](https://docs.swmansion.com/react-native-worklets/docs/threading/scheduleOnRN/),
[manual gesture](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/manual-gesture/),
[Expo CLI](https://docs.expo.dev/more/expo-cli/).
Worklets online docs default to a newer version; a 0.10 URL was unavailable.
Skia animation URLs returned unavailable/404 results. The installed implementation
is the version-specific authority for those APIs; typecheck and both Android
bundle modes validate imports, but do not replace a physical-device smoke test.

## Clock and pure engine

`clock.ts` separates deterministic scheduling from React/native APIs.
Default physics step is 1/120 second, clamped frame delta 50 ms, maximum 8 ticks.
The accumulator retains fractional time and exposes alpha in [0,1). Excess whole
ticks are discarded rather than accumulating an unbounded catch-up backlog;
`dropped` records discarded seconds. The first frame after resume contributes no
time. Backgrounding pauses; foregrounding requires an explicit resume, avoiding
accidental gameplay while an overlay or system screen is open.

`useFixedEngine` wires this to `useFrameCallback`. AppState sends only lifecycle
transitions to UI, not frame traffic. Input and simulation live on UI; RN reads
only event packets. A stable frame callback mutates shared objects inside their
own `modify` scopes. Alpha can animate Skia between ticks without React. Pause
holds alpha=1 (latest state), including resumed frames before the first tick;
reset uses alpha=0 and resets previous/current positions to the same initial value.
The callback stays
registered while paused to drain pending event batches; it performs no physics.
Future integrations can deactivate it once paused and fully acknowledged if idle
battery measurements justify this, preserving the flush-on-exit contract.

`WorkletEngine.create` allocates initial buffers on RN. `reset` and `step` must be
worklets. Keep the engine descriptor and its create function stable (module scope
is preferred); initial buffers are memoized so score renders do not allocate them.
Reset reuses buffers and starts paused. `step` receives state, latched
input, constant dt, monotonically increasing tick and the event journal. Declare
`maxEventsPerStep`; its product with maxSubsteps must fit the 256-entry journal.
Do not import economy, zustand, MMKV, feedback, or React into engines. Do not use
spread/map/filter/sort/new/string formatting in a simulation tick.

Determinism means the same seed and **tick-indexed input stream** produce the same
state. Live touches are sampled at fixed ticks; record those samples for replay.
Different real-time input arrival or clamped/discarded time is not the same input
stream and is not promised identical results. Interpolation is presentation only.

## Continuous collision conventions

`sweepCircles` accepts both bodies' linear displacement and returns first contact
fraction; `sweepSegment` sweeps against a capsule including endpoints;
`sweepAABB` sweeps against exact rounded corners rather than an expanded-box
approximation. Infinity means no hit; initial overlap returns 0. Coordinates,
radii and bounds must be finite, radii nonnegative, and AABB bounds ordered.

At collision, a game advances to contact, resolves its existing response, then
sweeps the remaining time with a bounded collision-iteration count. Helpers find
contact, not a complete physics solver. Resolve overlap and zero-time contact to
avoid an infinite loop. Duel tests include a 28-unit puck step plus a moving
paddle, with both endpoints outside collision range. Gameplay coefficients stay
unchanged during migration.

## UI-owned memory

Initialize typed arrays once; transfer into a shared value once; mutate only on
UI via `state.modify`. Never read large shared buffers on RN during render and
never replace them every tick. JS-to-UI serialization is not a cross-runtime
shared-memory ownership guarantee. Flat state stores offsets, counts and flags;
static names/skin resources are initialized separately. Tests run the same pure
functions on ordinary arrays without requiring native modules.

`memory.ts` supplies a fixed-capacity entity slot pool with double-release
protection and a strided ring. Full returns -1, never overwrites unread data.
Use stable slot IDs, a separate monotonically increasing entity ID and a bounded
index workspace for ordering; do not allocate a sorted array each frame.

Proposed Arena layout, **design only**:

| Buffer                            | Capacity / fields                                                                  | Bytes  |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| Pellets                           | 260 × 4 Float64 (x,y,previousX,previousY), Uint8 color, Int32 free + Uint8 active  | 9,880  |
| Orbs                              | 32 × 16 Float64 motion/mass/cooldown/AI fields, 5 Int32 metadata fields, slot pool | 4,896  |
| Powers                            | 4 × 4 Float64, Uint8 kind, slot pool                                               | 152    |
| Commands                          | 32 × 3 Float64 heading/dash                                                        | 768    |
| Ordering workspace                | 32 Int32 indices                                                                   | 128    |
| Event journal + achievement flags | 256 × 5 Float64 + 256 Uint8                                                        | 10,496 |

These are proposed payload bytes (26,320 total), excluding scalar state, object
headers, renderer resources and input/probe buffers. 32 is a storage ceiling,
not a new bot-count tuning value; preserve ARENA.bots=11 and pellets=260. Float64
avoids introducing float32 rounding changes during migration. Spatial indexing
may reduce pellet/orb candidate checks, but must preserve collision ordering and
seeded respawn behavior. Pools remove spawn allocations; names use numeric IDs.

Proposed Paint layout, **design only**:

- owner/trail: two Int16Array(1024), 4,096 bytes; -1 remains empty.
- Territory counts: Uint16Array(5), 10 bytes; total cells 1,024 fits Uint16.
- Capture seen: Uint8Array(1024), 1,024 bytes; queue/workspace Uint16Array(1024),
  2,048 bytes. Mark on enqueue so each cell occupies at most one queue slot.
- Five painters: preallocated position/direction/respawn/AI/kill fields.
- Keep the existing 1/8-second board tick accumulator inside the fixed engine;
  do not change Paint's movement cadence or smooth grid hops without approval.

Every ownership mutation must go through one primitive: decrement the previous
owner's count, assign the new owner, increment its count. Capture, kill, spawn and
respawn use that primitive; no per-frame recount. Tests may recount independently
as an oracle. Dirty board/version counters trigger geometry rebuilds only when
ownership/trails change. Percent/rank reads counts, not a scan of both grids.

## Event delivery and persistence boundary

Wire entries contain sequence, session, kind, a, b: five numbers. Typed decoded
events are score, combo, hit, newBest, achievementUnlocked and gameOver. Numeric
achievement IDs are 0..255. No names, entity buffers or game states are sent.

Unsent score/combo updates coalesce; critical newBest/achievement/gameOver entries
retain order. Duplicate achievement IDs, non-increasing bests and repeated
gameOver emissions are suppressed within a session. At most one batch of up to
32 entries is in flight. It is copied only when events exist, acknowledged on
UI after synchronous RN handlers complete, and retained until acknowledged.
Engine tick capacity is reserved before simulation; a full journal freezes
physics with `blocked=true` and discards wall-time backlog rather than losing
events. An engine exceeding its declared event budget violates the contract:
check false emissions and fail closed, never proceed with an unrecorded terminal
or persistence event. Emit all final score/newBest/achievement events **before**
gameOver; terminal sessions intentionally refuse further emissions.

RN receiver watermarks suppress repeated successful deliveries. A thrown handler
logs its error on RN in development, sets the shared deliveryError flag, retains
the journal and pauses physics at the latest state. deliveryFailure is a discrete
React-visible status with the error message and retry count. The RN controller
retries the same immutable batch twice (250 ms, then 500 ms); exhaustion exposes
a recoverable Retry / Leave panel through DeliveryRecovery. Retry restarts that
bounded budget. Success resumes only if the game was running before the failure
and no explicit pause/background intervened; otherwise the owner must Resume.
Timers are cancelled on unmount; Strict Mode effect replay reactivates the
controller. Reset waits until failures clear and pendingEvents reaches zero.
It then opens a new session. Integrations must wait for `pendingEvents==0` before unmount/navigation;
keep the owner mounted behind the results screen while acknowledgments drain.
Never navigate from an earlier hit/newBest event before final events arrive.

The in-memory guarantee is no dropped/duplicate deliveries for a mounted owner,
declared bounded emissions and successfully completing synchronous handlers.
No in-memory bus can guarantee durable exactly-once effects across process death.
Persisting handlers must be idempotent by **(session, sequence)**, even when a
write succeeds and then throws. createAtomicEventStore commits the effect and
receipt together through a single synchronous snapshot write; createPersistingHandler
adapts that store to the event receiver. The reducer must be pure/immutable and
storage must be single-writer and atomic (for MMKV, one JSON value under one key;
publish zustand state from that committed snapshot). Never store the receipt and
effect under separate keys. Allocate persistent session IDs/ranges uniquely
within the store's game/run namespace; the demo's default session=1 is only for
ephemeral owners and must not collide with a previous durable run. Keep receipts
until every event from those sessions is acknowledged. A Leave handler must
preserve/handoff the pending durable journal before unmounting its owner; the
harness has no durable effects, so its Leave only exits the test route.
Async writes need a future explicit
async-ack adapter; do not return a Promise from this synchronous handler contract.
No existing persistence code changes in this step.

Frequently changing timer, cooldown and score text can use `SharedNumber` on a
Skia Canvas. Numeric-to-text formatting belongs in a derived drawing value,
not an engine tick or React setState. Accessibility summaries can update on
discrete events; avoid speaking every timer sample.

## Inputs and Maze sensor design

`useUIInput` uses one Manual gesture with worklet touch callbacks, activating on
touch-down. Attach with GestureDetector to a non-collapsible field View under the
existing GestureHandlerRootView. Scale converts local coordinates to game units.
Ten preallocated slots retain native finger IDs, coordinates, smoothed velocity,
down/up bit latches, swipe origin and fling velocity. Fixed ticks consume latches
once; touches continuing into later substeps retain positions. Cancel/pause/reset
clear active touches. Gesture callbacks do not schedule RN. The installed Gesture
Handler touch types do not expose a timestamp. Date.now() is retained for arrival
time, but velocity aggregates displacement over at least 8 ms and applies a 24 ms
time-constant EMA. Equal/backward timestamps never divide by a tiny delta.
Positions remain immediate, velocity resets on a new finger slot and release
retains the smoothed fling. Deterministic replay records the resulting tick samples.

Sort calls swipeDirection on release; gameplay tuning chooses its threshold and
whether fling velocity matters. Duel assigns a stable finger ID to a paddle on
initial down, retaining ownership until up (not reassigned when it crosses the
midline). Link opts into recordPath and consumes the preallocated x/y/sample-time
ring, including movement before the next physics tick. Sampling velocity/time is
not physics time. On path overflow, cancel that stroke or pause with a discrete
warning; do not connect across lost points. More than ten touches are ignored;
the adapter coalesces high-frequency positions, not a lossless raw-event replay.
Multiple tap transitions in one fixed tick require a game-specific queued-command
adapter if they must remain distinct rather than a down/up latch.

For Maze, prefer `useAnimatedSensor(SensorType.GRAVITY, { interval: 16,
adjustToInterfaceOrientation: false })` in a sensor child mounted only while
running. Read `sensor.get().x/y` directly in UI simulation. `isAvailable` is set
by the registration effect in this installed hook, so do not capture its initial
false value forever in a worklet; availability must be refreshed after mounting.
Unavailable sensors and web use the existing drag fallback.

GRAVITY is the appropriate tilt signal; Android ACCELEROMETER in this version
maps to TYPE_LINEAR_ACCELERATION, which excludes gravity. Installed Android
sensor listener negates gravity axes; installed iOS source reports gravity ×9.81.
Thus normalize both with x/9.81 and -y/9.81 (then the existing 1.6 gain/clamping),
without repeating the old Platform.OS sign flip. Keep portrait orientation
handling explicit; verify upright/flat/right/left tilts on Android and iOS before
adopting. Gravity filtering differs from Expo's raw accelerometer: compare feel
and explain any difference; do not silently change constants. expo-sensors
addListener executes RN callbacks and cannot meet the no-sample-JS-traffic goal.
Unmount the sensor child on pause/background to unregister native sampling; an
interval alone does not implement battery lifecycle. This is a design, not a
Maze implementation change.

## Skia conventions

Keep Canvas child count and React props static during animation. Scalar drawing
props read shared/derived values. `SharedCanvas`, `SharedNumber`,
`InterpolatedCircle`, and `useBatchedPath` provide small reusable conventions.
Initialize fonts, paints, shaders, source images and geometry builders once.
For repeated sprites prefer Atlas; for same-color primitives use bounded paths;
for stable board regions cache Picture/path resources and rebuild only on dirty
versions. Keep camera transforms separate from world geometry.

Skia 2.6.2 usePathValue creates one PathBuilder, resets it in the drawing worklet,
and publishes builder.build() as an immutable path. This necessarily creates a
native path result; it is not a claim of zero renderer allocations. It avoids
new builders/paints/shaders in physics and SVG d-string construction. Prefer
Atlas or dirty caching if path builds dominate profiling. Engine ticks remain
allocation-free; framework transport/rendering may allocate. SVG stays for
static icons, ranks, skins and library artwork.

## Physical Android verification

The separate `/foundation-probe` route is development-only. It moves a test dot,
accepts touch-down score events and exposes controls; it does not alter any game.

1. From the workspace root in PowerShell, `Set-Location app`; run `npm run typecheck`,
   `npm run lint`, `npm test -- --runInBand`.
2. Install an existing SDK-57-compatible development build on your physical
   Android phone. If none exists, `npx eas-cli@latest build --profile development
--platform android`, then install the resulting build. Expo Go is insufficient
   for the app's native dependencies. This task did not build/upload an APK.
3. Enable USB debugging; connect USB; `adb devices` must show the physical device.
   Run `adb reverse tcp:8081 tcp:8081`, then `npm start -- --localhost`. Connect
   the development client using the URL shown by Expo CLI.
4. Open the harness with `adb shell am start -a android.intent.action.VIEW -d
"lumo://foundation-probe" com.abdullahtammar.lumo` while connected. If your
   APP_BUNDLE_ID differs, replace the last argument with the installed package.
5. Press Resume. Inspect screen/art commits, dismiss the inspection alert, allow
   its discrete modal lifecycle to settle, wait 30 seconds with no touches, then
   inspect again. Counts must stay constant during movement. Tap the field:
   score should increase on down, with discrete React commits allowed. Strict
   Mode initial effect replays are excluded by taking a post-mount baseline.
6. In React Native DevTools (press `j` in Expo CLI), record a React Profiler trace
   for the same untouched interval. No simulation-driven screen/art commits may
   appear. Counter reading does not call setState; probe toggles/snapshots do.
7. Toggle Probe on, run untouched for 10 seconds, tap the statistics area to
   Snapshot. Record p50/p95/p99, late-frame counts at 60/120 Hz. Percentiles use
   the last 600 samples; counts are cumulative since mount. Deadlines use exact
   1000/60 and 1000/120 ms, not rounded values. At 60 Hz, most frames naturally
   exceed the 120 Hz threshold: that does not indicate missed 60 Hz deadlines.
8. Pause/resume; Home the app for 10 seconds; reopen. Physics must remain paused
   until Resume and must not jump. Reset starts paused with the same initial dot.
   Check two fingers and cancellation; future Duel/Link tests validate their
   adapters separately. The basic harness awards one score per latched tick.
9. Repeat for 10 minutes, record thermal state, memory/GC behavior, refresh-rate
   setting and device model. Compare native Perf Monitor/Perfetto or Flashlight
   traces from a release build separately: development overhead and explicit
   percentile snapshots perturb UI timing. The probe measures frame intervals,
   not engine CPU execution duration or GPU duration.
10. Confirm release pruning: `npx expo export --platform android --no-bytecode
--output-dir .foundation-export`; searching exported JS for `Foundation only`,
    `Inspect art commits` and `Tap Snapshot for frame statistics` must find no
    matches. A release deep link renders no harness. Use Hermes bytecode normally;
    no-bytecode is only for inspecting this verification export.

No physical device was available in this session. Device results, zero frame-driven
React renders and stable 60/120 fps remain measurements to collect, not claims.
The harness has no production gameplay workload. Pure tests validate clock,
collision, event, pool/ring, input and probe behavior, not native serialization.

## Step 3 proposal: Arena first, awaiting approval

1. Freeze current seeded traces/tuning and add score/kill/respawn/dash/zone oracles.
2. Port Arena state into the described buffers and fixed slot pools; preserve
   existing bot decisions, collision ordering, random calls, 260 pellets and
   11 bots. Resolve fixed-step differences explicitly against traces.
3. Implement a pure worklet step with declared event budget, bounded contact
   handling and discrete mass/kill/best/end events. Keep UI mass/cooldown shared.
4. Add UI joystick and dash-command adapter; retain accessibility labels, back
   handling, pause overlays, skins, SFX/haptics and all economy effects in RN
   handlers. Wait for event acknowledgments before navigation.
5. Add a static Skia field with camera transform, pellet batching/Atlas,
   preloaded emoji/name resources, zone geometry and shared-value HUD. Do not
   transfer Arena state to JS or create React nodes for live entities.
6. Compare frame traces and render counters on the target Android device; test
   storm/dash/magnet, frame spikes, pause, rapid retries, new best, kills, coins,
   persistence, achievements and screenshots. Run all gates, then make one Arena
   migration commit. Keep online Arena/Paint work design-only.

Remaining risks: native typed-array mutation/notification and font/emoji handling
need device smoke tests; Skia path build costs and UI-thread physics can still
miss deadlines; thermal throttling, high refresh rates and low-end memory require
measurement. Critical persistence requires synchronous idempotent handlers and
acknowledged navigation. No universal device FPS guarantee follows from this
foundation alone. Step 3 is not started.
