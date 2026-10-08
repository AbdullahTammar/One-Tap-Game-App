# Foundation fixes before Step 3

No gameplay migration is included. Acceptance remains **zero frame-driven React
renders**, with discrete event/recovery renders allowed.
Validation: typecheck and lint passed; all 132 tests across 9 suites passed.
Android development and production exports passed; development harness/probe
markers are absent from the production JavaScript.

## Installed source evidence

All line numbers below refer to installed Reanimated 4.5.1 / Worklets 0.10.1 /
Gesture Handler 2.32.0 sources, relative to the app repository.

- `node_modules/react-native-reanimated/src/hook/useFrameCallback.ts:51` registers
  the callback; `:56` unregisters it in cleanup; `:61` has dependency array
  `[callback, autostart]`. Thus a new callback identity restarts registration.
  useFixedEngine now passes a useCallback-memoized worklet. Its dependencies are
  stable shared values, engine methods, scalar budget and memoized configuration /
  RN delivery callbacks. onEvent changes update a ref, never the frame callback.
  Changing the engine/configuration intentionally can still re-register it.
- `node_modules/react-native-reanimated/src/mutables.ts:64` implements get as
  `return mutable.value`; `:95` caches host value; `:101` returns it. A UI host get
  returns the local held object, not a fresh RN snapshot. Direct nested mutation
  would persist in that object, but does **not** invoke the `_value` setter.
- In that same file `:116` sets the dirty flag and `:119` notifies listeners;
  `:125` defines modify with default forceUpdate=true; `:129` invokes the modifier
  on the held value and sends it to valueSetter. In
  `node_modules/react-native-reanimated/src/valueSetter.ts:73`, equal object
  identity is skipped only when forceUpdate is false; `:76` invokes `_value`.
  Therefore scoped modify also publishes in-place mutations to consumers.
- `node_modules/react-native-worklets/src/memory/serializable.native.ts:679`
  defines freezeObjectInDev; `:680` returns unless this is a development bundle
  **and RuntimeKind.ReactNative**. It protects the RN-side serialized originals,
  not UI-held shared values. Do not mutate the original JS initializer after
  sharing it or assume a captured plain object is a shared value.
- `node_modules/react-native-worklets/Common/cpp/worklets/WorkletRuntime/WorkletRuntimeDecorator.cpp:71`
  sets the runtime global `__DEV__` from isDevBundle. It is defined in worklets.
  The foundation additionally captures a module-level boolean DEV_MODE so frame
  code has no dependence on a dynamically looked-up development global.
- `node_modules/react-native-gesture-handler/lib/typescript/handlers/gestureHandlerCommon.d.ts:35`
  lists TouchData fields; `:42` lists GestureTouchEvent fields. Neither exposes a
  timestamp. We retain Date.now() as an arrival-time fallback and smooth velocity
  rather than guessing an undocumented event field.

## Complete mutation inventory

Old locations are pinned to foundation commit `0b06953` (not current line numbers).
These were every mutation of an object obtained from sharedValue.get outside its
own modify scope. Scalar `.set()` calls are not object mutations.

| Shared object | Old file / line(s)                                   | Writes                                                                                | Fix                                                                 |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| clock         | `src/game/core/useFixedEngine.ts:98`                 | pause on delivery failure                                                             | clock.modify                                                        |
| clock         | same file `:124`, `:145`, `:149`, `:154-156`         | tick, planFrame accumulator/alpha/fresh/drop accounting, terminal pause, backpressure | outer clock.modify                                                  |
| clock         | same file `:168`, `:180`, `:189`                     | pause/resume/reset                                                                    | clock.modify                                                        |
| event bus     | same file `:123`                                     | engine event emissions into journal/sequence/flags                                    | outer events.modify enclosing engine                                |
| event bus     | same file `:160`, `:198`, `:206`                     | takeBatch in-flight fields, beginSession, retry flag                                  | events.modify; manual retry now stays in the RN delivery controller |
| input         | same file `:101`, `:125-127`, `:151`, `:171`, `:192` | clearing input, consuming tick latches                                                | input.modify, including around every engine tick                    |
| probe         | same file `:138-139`                                 | sampleFrame arrays/statistics                                                         | probe.modify                                                        |
| probe         | `src/game/core/dev/PerformanceOverlay.tsx:45-49`     | snapshot sorting scratch / percentiles                                                | probe.modify                                                        |

The previous ack path already used events.modify and the previous simulation
state used state.modify. Touch callbacks in useInput already used input.modify.
Remaining get calls in useFixedEngine read only terminal/scalar flags; useInput
reads active slots to count remaining fingers; drawing components read geometry.
There are now **no object writes through get outside the owning modify scope**.
Nested modifiers operate on parameters, retain preallocated data buffers and
notify consumers. Engine step itself still allocates no arrays/objects; modifier
wrappers and library/transport/rendering machinery are not an allocation-free
runtime guarantee. No buffers or whole engine states are forwarded to RN.

## Recovery and idempotency

Initial failure pauses at alpha=1, exposes deliveryError (shared boolean) and
deliveryFailure (discrete owner-visible status/message), and logs the actual error
on RN in development. The identical batch retries after 250 ms and 500 ms, then
stops with a recoverable panel. Retry starts a new user-requested bounded budget;
Leave is supplied by the owner. Successful recovery resumes only when no pause or
background transition intervened. Failure status changes do not restart the
frame callback. Strict Mode effect cleanup/replay reactivates the controller;
actual unmount cancels retry timers.

Persisting handlers must use `(session, sequence)` within a durable game/run
namespace. createAtomicEventStore is a synchronous, single-writer receipt adapter:
read one snapshot; if its receipt exists, return; otherwise write an immutable
effect plus receipt together under one key. The reducer must have no side effects.
The write-then-throw regression test proves replay does not double-award effects.
Choose unique persistent session IDs before integrating actual persistence;
the harness's session=1 is ephemeral. Do not publish independent zustand/MMKV
effects before the atomic commit. A real Leave must preserve/handoff pending
durable events; the harness can exit because its score has no durable effects.

Pause/terminal/backpressure use alpha=1. Resume keeps the latest state through its
discarded first frame and any fractional frame until a fixed tick executes.
Reset sets alpha=0 and requires previous/current state geometry to reset together.
Reset is blocked while events/failures remain, to avoid replacing unsaved runs.

## Minimal physical-device harness checklist

From the workspace root, run `Set-Location app`, then `npm start -- --localhost`.
Use an installed compatible development client on a USB-debugging Android phone.
In a second terminal, with adb on PATH:

```powershell
adb devices
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "lumo://foundation-probe" com.abdullahtammar.lumo
```

Use the package configured in APP_BUNDLE_ID if it differs from the default above.
Connect the development client to Metro's displayed URL first.

1. Tap Resume: the green dot moves smoothly. Observe for at least 10 seconds.
2. Put a finger down and hold: score increments once on down, before release.
   Release and tap again: exactly one more increment.
3. Pause: the dot holds the latest position (no one-tick backward jump). Wait
   10 seconds; Resume: first frame holds that position, then ordinary movement
   continues. Reset returns to the initial position and stays paused.
4. While running, press Home, wait 10 seconds, return: the dot is paused at the
   latest position. Resume has no accumulated-time jump. Repeat while touching:
   no stale finger input should remain after returning.
5. Inspect screen/art commit counts after mount and modal dismissal settles.
   Wait 30 seconds without touches, controls, probe snapshots or alerts; inspect
   again. Counts must be unchanged while the dot moved. A touch-down score change
   may add a discrete commit. Confirm the same interval with React DevTools
   Profiler: no frame-driven screen/art commits.
6. Tap Fail next delivery, then touch down. See Retrying, followed by Retry / Leave
   after three failed attempts total; the development log shows each error.
   Retry succeeds (the injected failures are consumed) and resumes unless you
   paused/backgrounded. Repeat, background during retry, return: recovery must
   leave the game paused until explicit Resume. Leave exits this ephemeral harness.

No connected-device results are claimed. The mocked hook tests prove callback
identity/lifecycle and no physics-driven React commits in the test environment;
native rendering, touch recognition and runtime mutation still need this smoke
test. The harness alone does not prove Arena's frame budget.

## Re-author before pushing (commands only; not executed)

The existing repository history records your identity as Abdullah Tammar with
the GitHub noreply email below. Replace those two values if you want another
identity. Run from the workspace root with a clean app working tree. The backup
branch keeps the original commits; the rebase rewrites all commits after the
pre-baseline merge, including any later foundation fix commit, without changing
file contents.

```powershell
Set-Location app
git status --short
git config --local user.name "Abdullah Tammar"
git config --local user.email "113012630+AbdullahTammar@users.noreply.github.com"
git branch codex/step2-before-reauthor HEAD
git rebase --force-rebase --exec 'git commit --amend --no-edit --reset-author' 6d1eb6b
git log 6d1eb6b..HEAD --format='%h %an <%ae> | %cn <%ce> | %s'
```

If rebase stops, inspect its reason; `git rebase --abort` restores the starting
branch. No push or history rewrite has been performed in this task. The original
baseline/foundation hashes will change when you execute these commands.
