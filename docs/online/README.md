# Lumo Online: Design Overview

This folder is the design for taking Lumo's Dot games online. Read it in this order:

1. **This overview**: which games go online, the core decisions, and the overall architecture.
2. [Dot Arena online](ARENA.md): the flagship. Netcode, tick rates, bandwidth, prediction, anti-cheat, and scaling.
3. [Rooms, hosting and private games](ROOMS_AND_HOSTING.md): room lifecycle, the room-owner ("host") role, private games with invite codes, and how Dot Paint and Dot Duel go online.

## Which games go online

| Game        | Online?     | Format                                                             | Why                                                                                            |
| ----------- | ----------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Dot Arena   | Yes, first  | 12–30 players, 3-min rounds, public + private                      | It is built around other players. Bots already prove the loop.                                 |
| Dot Paint   | Yes         | 4–8 players, 90 s rounds, public + private                         | The grid and fixed tick make it cheap to sync.                                                 |
| Dot Duel    | Yes         | 1 v 1, private first (couples and friends), then ranked            | Head-to-head is the most shareable mode we have.                                               |
| Async games | Ghosts only | Drift, Jump, Sort, Chain, Link, Maze, Stack, and the one-tap games | No live netcode. Players race a recorded "ghost" replay and weekly leaderboards (see Phase 4). |

## The decisions that shape everything

1. **The server decides.** A dedicated game server owns the truth for every match. Phones send _inputs_, never positions or scores. This one rule gives us fair play, simple anti-cheat, and the same experience on a cheap Android phone and a new iPhone.
2. **The "host" is a role, not a computer.** The player who creates a room becomes its **owner**. The owner can start the match, change settings and kick players. The match itself always runs on our server, so the owner leaving, locking their phone, or having bad Wi-Fi never ends the game for anyone else. Ownership moves to the next player automatically. Details are in [Rooms and hosting](ROOMS_AND_HOSTING.md#the-host-role).
3. **One rules engine for client and server.** The rules in `src/game/motion/*.ts` are already pure, seeded TypeScript functions. The server imports the same files. The phone uses them for prediction and offline play. We never maintain two copies of the game rules.
4. **Bots fill empty seats.** A public Arena room is never empty. Bots (the AI that already exists) hold seats and leave as real players join. A match starts in under 3 seconds even at 3 a.m.
5. **Offline stays first-class.** Every game keeps working with no network. Online is an extra mode, never a requirement to play.

## Architecture at a glance

```
 Phone (Expo app)                      Lumo backend
 ┌──────────────────────┐   HTTPS   ┌─────────────────────────┐
 │ UI + renderer (SVG)  │ ────────▶ │ Gateway / Matchmaker API │──┐
 │ Shared rules (TS)    │           │  auth · rooms · codes    │  │ Redis: room registry,
 │  ├ prediction        │           └─────────────────────────┘  │ codes, presence
 │  └ interpolation     │                        │ assigns room    │
 │ Net client (WS, bin) │   WebSocket (binary)   ▼                 │
 │                      │ ◀═══════════════▶ ┌──────────────────┐   │ Postgres: profiles,
 └──────────────────────┘    inputs ▲ ▼     │ Game server (N×)  │◀──┘ skins, bests,
                             snapshots      │ 1 process ≈ many  │     achievements
                                            │ rooms, 20 Hz tick │
                                            └──────────────────┘
```

- **Gateway / Matchmaker**: a stateless HTTP API. It handles anonymous sign-in, "find me an Arena match", "create a private room", and "join code K7Q2MX". It returns the address of a game server and a short-lived join ticket.
- **Game servers**: long-running Node or Bun processes. Each one runs many rooms on one event loop and speaks binary WebSocket. Rooms are cheap: an Arena room is about 1 ms of CPU per tick.
- **Redis** holds which rooms exist, where they run, their codes, and who is in them. **Postgres** holds the durable things: profile, name, owned skins, bests and achievements.

## Rollout phases

| Phase | Ships                                                                                                                      | Exit criteria                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 0     | Extract the shared rules into `packages/rules`. Add a headless simulation runner and a bot-vs-bot soak test on the server. | 10,000 simulated Arena matches with no desync between the client prediction and the server. |
| 1     | **Private Dot Arena rooms**: invite code or link, owner controls, bots fill seats. One region.                             | p95 round-trip under 120 ms inside the region. Under 1% disconnects per match.              |
| 2     | Public Arena matchmaking, regions (Middle East, Europe, US), reconnect, and the anti-cheat checks.                         | Day-1 retention for online players is at or above offline.                                  |
| 3     | Dot Paint online, and Dot Duel online for two phones (private first, ranked later).                                        | Duel rematch rate above 40%.                                                                |
| 4     | Async: weekly leaderboards and ghost replays for the deterministic games.                                                  | Seven-day retention up by at least 5 points.                                                |

## What already exists in the code

These pieces make the plan cheap:

- **Deterministic rules.** Every game takes a seed and a stream of inputs (`create`, `step`, `input`). The same seed and the same inputs always produce the same match.
- **One input shape for humans and bots.**
  - Arena: `ArenaCommand { dx, dy, dash }`.
  - Paint: a direction.
  - Duel: a paddle target.
- **Names and skins live on the player.** The player's name and skin are already fields of the player in each game (`Orb.name` and `Orb.emoji` in Arena, `Painter.name` and `Painter.emoji` in Paint). They travel to other players for free.
- **Dot Paint runs on a fixed tick.** It advances at exactly 8 Hz (`PAINT.tick`), the model a server needs.
