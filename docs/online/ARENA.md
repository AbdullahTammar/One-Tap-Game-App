# Dot Arena Online

Dot Arena is the flagship online mode: an agar-style battle with dash, power-ups and a shrinking storm. This document specifies how it runs online. The goals are:

- It feels instant on a mid-range phone on 4G.
- It stays fair against modified clients.
- It costs little to host.

## 1. Experience targets

| Target                                | Value                                     |
| ------------------------------------- | ----------------------------------------- |
| Tap "Play online" to playing          | under 3 s (bots fill empty seats)         |
| Own dot responds to the thumb         | next frame (client-side prediction)       |
| Other dots look smooth                | 60 fps, interpolated, no visible snapping |
| Playable round-trip time              | up to 250 ms. Best under 120 ms.          |
| Downstream bandwidth per player       | under 6 KB/s average, under 12 KB/s peak  |
| Battery and heat                      | No worse than the offline Arena           |
| A disconnect in the middle of a match | Rejoin the same dot within 20 s           |

## 2. Match format

- **Room size: 20 players** (12–30 configurable). Bots fill the room up to 12 bodies so it never feels empty, and leave as humans join.
- **Round: 3 minutes**, the same as offline, with the storm shrinking after 45 s. Rounds end on time and are ranked by final mass.
- **Players drop in until the storm begins.** After that, new joiners spectate and enter the next round. This stops late joiners from hiding outside the action.
- **Respawn**: off in ranked rounds. In casual public rooms, players respawn after 3 s with the spawn shield. Each room chooses one rule.
- **World size scales with players**: `side = 1400 × sqrt(max(players, 12) / 12)` world units. This keeps density, and therefore fun, constant.

## 3. Authority model

The server runs the real match. Each phone runs a copy for prediction only.

```
client                          server (authoritative, 20 Hz)
──────                          ─────────────────────────────
read thumb → ArenaCommand
apply locally (predict) ──input#n──▶ queue per player
render own dot now              each tick: apply latest input per player,
                                stepArena(world, 1/20), eat/zone/power-ups
                      ◀─snapshot── ack input#n, world state near the player
reconcile own dot to server
interpolate everyone else 100 ms behind
```

The phone never sends position, mass or "I ate X". It only sends `ArenaCommand`, which is `{ dx, dy, dash }`. The server clamps it: the direction is normalised, and dash is honoured only if its cooldown has expired on the server. Nothing the client says can make it faster, bigger or invincible.

## 4. Tick and update rates

| Loop                      | Rate                                   | Notes                                                                                                                 |
| ------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Server simulation         | **20 Hz** (50 ms)                      | Fixed step. `stepArena(state, 0.05)`. Dot speeds (~110–260 u/s) move only 5–13 u per tick, so collisions stay stable. |
| Server → client snapshots | **20 Hz**                              | Drops to 10 Hz for players far outside the action (see area of interest).                                             |
| Client → server input     | **20 Hz**, only when the input changes | Plus a 5 Hz keep-alive. Sent unreliably in order; the latest input wins.                                              |
| Client render             | 60 fps (120 on ProMotion)              | Independent of the network.                                                                                           |

**Why 20 Hz and not 60:** the Arena is about steering and positioning, not split-second shooting. 20 Hz with prediction and interpolation looks perfectly smooth, and it uses a third of the CPU and bandwidth of 60 Hz. Fast competitive titles in the same genre run at similar rates.

## 5. Making it feel instant

### 5.1 Prediction and reconciliation (your own dot)

1. Each input carries a sequence number `n`. The client applies it straight away to a _local_ copy of its own dot, using the same `move()` rule as the server, and keeps the unacknowledged inputs in a ring buffer.
2. Each snapshot says "processed your inputs up to `n`". The client rewinds its dot to the server's position, replays inputs `n+1…latest`, and compares the result with what it showed.
3. Small error (under 4 u): blend the drawn position toward the corrected one over about 100 ms. The player sees no jump.
   Large error (over 40 u, for example after a dash denied by the server): snap immediately.
4. Mass, eaten state, shield and power-ups are _never_ predicted. They come only from the server. Pellets are the exception: the client may hide a pellet it is about to swallow, and brings it back if the server disagrees, which is rare.

### 5.2 Interpolation (everyone else)

Other dots are drawn **100 ms in the past**, between the two snapshots that surround `now − 100 ms`. Positions use linear interpolation and radius changes are eased. If a snapshot is late, the client extrapolates for up to 150 ms, then freezes rather than invents motion.

### 5.3 Eating fairness

Eating happens on the server using current positions. We deliberately do **not** rewind time for eating, unlike shooters. Agar-style games feel fair when "if I'm on top of you, I eat you" matches the bigger player's screen, and the 100 ms interpolation means the smaller player already sees the danger.

To stop a single lag spike from killing a victim, a dot that the server has not heard from for more than 250 ms keeps its last command for up to 1 s. After that it coasts to a stop. It is never instantly eaten for being frozen.

## 6. Bandwidth: what goes over the wire

### 6.1 Encoding

Messages are binary. The first byte gives the message type, and integers are little-endian. Everything is quantised to the precision a phone can actually show:

| Field           | Encoding                                        | Precision    |
| --------------- | ----------------------------------------------- | ------------ |
| Position x, y   | `u16` each over the world side                  | about 0.03 u |
| Mass            | `u16` (mass × 4)                                | 0.25         |
| Flags           | `u8`: dash, shield, magnet, alive, spawn-shield | —            |
| Entity id       | `u16`                                           | —            |
| Direction input | `i8` dx, `i8` dy (−127…127)                     | about 0.8°   |

Per visible dot: `id 2 + x 2 + y 2 + mass 2 + flags 1 = 9 bytes`.

### 6.2 Pellets are free

Pellet positions come from the room seed using the shared PRNG (`rand()` in `common.ts`). Both sides generate the same layout, so it is never sent. The server sends only **pellet events**: "pellet i eaten" and "pellet i respawned at slot k". The new position is derived from the seed and the counter, so each event costs about 3 bytes. A busy tick has fewer than 20 events.

### 6.3 Area of interest

The server keeps a uniform grid of 200 u cells. Each player receives only the dots inside their camera view plus a 300 u margin. The view grows with mass, as it does offline. A typical player sees 8–20 dots.

### 6.4 Delta snapshots

Each snapshot is relative to the last one the client acknowledged:

- Unchanged dots send nothing.
- Dots that moved send position only (5 bytes).
- New dots, or dots whose mass changed, send the full 9 bytes.
- A full keyframe goes out every 2 s and on reconnect.

### 6.5 Budget

```
header + acks                      12 B
~15 visible dots × ~6 B (delta)    90 B
pellet events                      30 B
leaderboard (top 5, every 1 s)     ~4 B amortised
────────────────────────────────────────
≈ 140 B × 20 Hz ≈ 2.8 KB/s down    (+ WebSocket framing ≈ 3.5 KB/s)
up: 4 B × ≤20 Hz ≈ 0.1 KB/s
```

That is about 13 MB for an hour of play. It is fine on any mobile plan, and a single 1 Gbps server port can serve tens of thousands of players.

## 7. Protocol

The transport is WebSocket over TLS (`wss://`). React Native and Expo support it with no native module, and it gets through mobile carriers and corporate Wi-Fi. A UDP transport (WebTransport, or a native UDP module) is a later optimisation behind the same message format. We do not plan for it now.

| Dir | Type                | Payload                                                                     |
| --- | ------------------- | --------------------------------------------------------------------------- |
| C→S | `HELLO`             | join ticket, protocol version, client build                                 |
| S→C | `WELCOME`           | your entity id, room seed, world size, server tick, room settings, keyframe |
| C→S | `INPUT`             | seq `u16`, dx `i8`, dy `i8`, dash `bit`                                     |
| S→C | `SNAPSHOT`          | tick `u32`, last processed seq `u16`, entity deltas, pellet events          |
| S→C | `EVENT`             | ate / eaten / power-up / storm phase / round end (for sounds and toasts)    |
| S→C | `BOARD`             | top 5 names and masses, your rank (1 Hz)                                    |
| C→S | `PING` / S→C `PONG` | client time echo, used for the round-trip estimate and clock sync           |
| S→C | `ROUND_END`         | final ranks, rewards granted (coins and achievements are server-signed)     |

Names, skins and other text are sent **once** when a player appears, in an `INFO` message: id → name, skin id, color. They are never repeated per tick.

## 8. Server design

- **Runtime:** Node 22 or Bun with `uWebSockets.js`. One process uses one core and runs many rooms. Rooms are stored in a `Map` and stepped by a single 20 Hz timer with drift correction.
- **Cost of a tick:** `stepArena` for 20 dots plus about 260 pellets is O(dots × pellets) today. On the server we add the same 200 u grid used for area of interest, so pellet and eat checks only look at neighbouring cells. Measured target: **under 0.3 ms per room per tick**. That gives 100+ rooms per core while staying under 60% CPU.
- **Shared rules:** `packages/rules` is the current `src/game/motion` folder, moved without changes. The app and the server import it. CI runs the same unit tests against both.
- **Determinism guard:** every 5 s, a debug build sends a hash of its predicted own-dot state. A mismatch rate above 0.5% fails the build canary.
- **Graceful drain:** on deploy, a server stops accepting new rooms, finishes its running rounds (up to 3 min), then exits. Players are never cut off by a release.

## 9. Anti-cheat

The server is in charge, so most cheats are impossible by construction. On top of that:

| Threat                       | Defence                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Speed or teleport hacks      | Impossible: the server ignores client positions.                                                                          |
| Dash spam                    | Server-side cooldown. Extra dashes are dropped.                                                                           |
| Input flooding               | Over 60 inputs/s: drop the extras. Over 200/s: disconnect.                                                                |
| Fake coins or achievements   | Rewards are computed by the server at `ROUND_END` and written to Postgres. Online coin grants never come from the client. |
| Bot-farming in private rooms | Private rooms grant achievements but cap coin rewards at 50% of public rooms. Same-device multi-joins are blocked.        |
| Offensive names              | A word filter in Arabic and English when the name is set. Players can mute or report someone from the leaderboard.        |

## 10. Bots online

The bots are the `botCommand` AI that ships today.

- They run on the server as ordinary players, sending `ArenaCommand`s.
- They join at 40–70% of the median human mass, so newcomers always have something to eat and are never instantly flattened.
- One bot leaves for each human who joins. Below 4 humans, bots keep the room lively.
- Bot names come from the existing list and are marked with a small 🤖 on the leaderboard. Players should never feel tricked.

## 11. Rewards and progression online

- Coins: the offline `coinsFor` curve, plus a placement bonus. #1 earns +40, #2 +25 and #3 +15.
- Online-only achievements to add: _First Online Win_, _Top 3 ×10_, _Party Host_ (finish a private match you created), and _Squad Goals_ (finish 5 matches with the same friend).
- Players earn a **season badge** shown next to their name. It costs no server work beyond one integer per player.

## 12. Failure and edge cases

| Situation                                       | Behaviour                                                                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| App goes to the background (call, notification) | The dot coasts and then stops. The player gets 20 s to come back to the same dot before it leaves and becomes pellets.                        |
| Network drop                                    | Auto-reconnect with exponential backoff (0.5, 1, 2, 4 s) using a resume token. The server sends a keyframe and you continue.                  |
| Game server crash                               | Players are sent back to the menu with a "Match interrupted" card. Coins earned so far are granted, because they are checkpointed every 30 s. |
| High latency (over 250 ms)                      | A connection-quality indicator appears. Matchmaking prefers a closer region next time.                                                        |
| Old app version                                 | `HELLO` is rejected with an "Update Lumo to play online" message. Offline still works.                                                        |

## 13. Testing and observability

- **Headless soak:** a CLI that runs 1,000 bot-only rooms at 20× speed. It checks for no exceptions, mass conservation within tolerance, and no tick over budget.
- **Network chaos in CI:** a proxy adds 150 ms latency, ±40 ms jitter and 2% loss. Prediction error must stay under 10 u at p99.
- **Live metrics:** these feed a dashboard and alerts.
  - Per room: tick duration (p50/p99), players, bytes out per player.
  - Per client: round-trip p50/p95, reconnects per match, desync rate.
  - Funnel: time to match, rematch rate.
- **Load test before launch:** 5,000 simulated clients on staging, using one server per 2,000 players.

## 14. Client work in the Expo app

- `src/net/arenaClient.ts`: owns the WebSocket, binary encode/decode, the input ring buffer, the snapshot buffer, and clock sync.
- `src/app/motion.tsx`: gains an "online" source. The existing frame loop calls `client.predict(cmd)` and renders `client.view(now)` instead of `stepArena`. `MotionArt` stays as it is, because it already draws any `ArenaState`.
- Lobby screens: _Play online_ (quick match), _Create private room_, _Join with code_. These are covered in [Rooms and hosting](ROOMS_AND_HOSTING.md).
- **No new native modules:** WebSocket, `Share`, and Expo Router deep links already ship with the app. Check the Expo SDK 57 docs before adding any library.
