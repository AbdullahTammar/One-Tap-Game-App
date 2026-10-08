# Rooms, Hosting and Private Games

This document covers how players meet: public matchmaking, the room-owner ("host") role, private games with friends, and how Dot Paint and Dot Duel go online. The netcode itself is in [ARENA.md](ARENA.md).

## 1. Rooms

A **room** is one live match on a game server. It has an id, a game type (`arena`, `paint` or `duel`), a privacy setting, an owner, settings, and a list of players and bots.

```
          create / match             start (owner, or auto)
 (none) ───────────────▶ LOBBY ─────────────────────────────▶ PLAYING
                           ▲  ▲                                  │
                  rematch  │  └───── round over, 20 s results ◀──┘
                           │
                  everyone leaves, or 15 min idle ──▶ CLOSED (code released)
```

| State     | What happens                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOBBY`   | Players see each other's dots and skins and can chat with emoji reactions. Bots are shown as empty seats that will fill. The owner can change settings. |
| `PLAYING` | The simulation runs (see ARENA.md). Arena lets people join until the storm starts; Paint and Duel lock at start.                                        |
| Results   | 20 s of ranks, rewards and a big **Rematch** button. Rematch takes everyone straight back to `LOBBY` with the same code.                                |
| `CLOSED`  | The room is released. A private code can be reused 24 h later.                                                                                          |

Public rooms skip the lobby. Quick match drops you into a room that is already playing, or starts one, in under 3 s.

## 2. The host role

The design goal: a player can _own_ a game without the game _depending_ on that player's phone.

### 2.1 What the owner is

The **owner** (shown as "Host 👑" in the UI) is the player who created a private room. The owner can:

- start the match, or let it auto-start when everyone taps Ready
- change room settings in the lobby (§4)
- kick a player. That player cannot rejoin that room for 10 minutes.
- lock the room, so nobody new can join with the code
- start a rematch, or close the room

### 2.2 What the owner is not

The owner's phone is **not** the game server. The match always runs on Lumo's dedicated server, and the owner is just another client with extra permissions. We made this choice deliberately:

| Phone-hosted (rejected as the main design)                        | Dedicated server with an owner role (chosen)          |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| Host leaves, sleeps or loses signal → the match dies for everyone | Owner leaves → ownership moves. The match carries on. |
| The host has zero lag, so the host has an advantage               | Everyone is equal                                     |
| The host can modify the game and cheat                            | The server is the authority                           |
| One phone uploads to N players: battery drain, mobile NAT issues  | Each phone keeps one small connection to the server   |
| Strict NAT and carrier networks often block players               | Works on any network that can open `wss://`           |

### 2.3 Ownership transfer

If the owner disconnects for more than 20 s, quits, or taps _Give host_, ownership passes automatically:

1. to the player the owner chose, if any
2. otherwise to the human who has been in the room longest
3. if no humans are left, the room closes after the round ends

Everyone sees a toast: "👑 Sara is now the host". No match is ever interrupted by an ownership change.

### 2.4 Optional fallback: local host for Dot Duel

As a _secondary_ feature only, Dot Duel can work with no internet when two phones are next to each other. One phone runs the simulation and the other connects over the local network. Same-phone Duel already covers most cases, so this is Phase 5+ and nothing in the online stack depends on it.

## 3. Private games

### 3.1 Creating and inviting

1. The player taps **Play with friends → Create room** and picks a game (Arena, Paint or Duel). They then pick the settings, or use the defaults.
2. The server returns a **room code**: 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, which leaves out the confusing characters 0, O, 1, I and L. For example `K7Q2MX`. That is about 887 million possible codes, so they cannot be guessed.
3. The lobby shows three ways to invite:
   - **Share link**: the system share sheet with `https://lumo.app/j/K7Q2MX`. That link opens the app straight into the lobby if it is installed (universal / app link), or the store page if not. In-app the route is `lumo://join/K7Q2MX`, using the existing `scheme: 'lumo'` and an Expo Router route `src/app/join/[code].tsx`.
   - **QR code**, for friends in the same room.
   - **Code**, to read out loud.
4. Friends tap the link or type the code under **Join with code**. They land in the lobby with their own name and skin.

### 3.2 Privacy rules

- Private rooms never appear in matchmaking and cannot be searched or listed. The code is the only way in.
- The owner can **lock** the room once everyone is in. A locked room rejects even a valid code.
- Optional **4-digit PIN** for streamers: the code alone is not enough to join.
- The server allows 10 join attempts per minute per device and per IP, so codes cannot be brute-forced.
- A kick lasts 10 minutes for that room. Repeated reports feed the global moderation queue.

### 3.3 Room settings

The owner sets these in the lobby:

| Setting         | Arena                            | Paint                  | Duel                  |
| --------------- | -------------------------------- | ---------------------- | --------------------- |
| Max players     | 2–30 (default 12)                | 2–8 (default 6)        | 2                     |
| Bots fill seats | on / off                         | on / off               | — (vs bot is offline) |
| Round length    | 2 / 3 / 5 min                    | 60 / 90 / 120 s        | first to 3 / 5 / 7    |
| Storm speed     | slow / normal / fast             | —                      | —                     |
| Power-ups       | on / off                         | —                      | —                     |
| Respawn         | on / off                         | on / off               | —                     |
| Teams           | free-for-all / 2 teams (Phase 3) | free-for-all / 2 teams | —                     |

### 3.4 Social features that bring players back

- **Rematch** keeps the group together: one tap, same room, same code.
- **Recent players**: after a private match you can save someone as a friend. Next time, _Invite friends_ sends them a push notification.
- **Group streak**: playing with the same friends on consecutive days unlocks the _Squad Goals_ achievement and a shared lobby flag.
- **Result card**: a shareable image of the final leaderboard with everyone's dots, skins and names. Every share is free marketing.

## 4. Matchmaking (public)

- **Regions**: Middle East (Bahrain or UAE), Europe (Frankfurt), US-East. The client pings all three at startup and picks the lowest round-trip. Players can override this in Settings.
- **Quick match** puts you in the fullest room for your region and game that still has space and has not reached the storm. Otherwise it creates a new room filled with bots.
- **Skill buckets**: Arena keeps public matches casual and only uses a soft MMR, to keep brand-new players away from veterans. Duel ranked (Phase 3) uses Glicko-2.
- **Party queue**: up to 4 friends from a private lobby can queue together into a public Arena room.

## 5. Dot Paint online

- The rules are already tick-based (`PAINT.tick = 1/8 s`). The server runs the official 8 Hz tick.
- Clients send **turn intents** (`dir`, plus the tick they were pressed on). The server applies a turn on the next tick that starts after it arrives.
- **Each tick's broadcast** contains:
  - each painter's head cell and direction (3 bytes each)
  - every cell whose owner changed, as run-length encoded rows (captures repaint large areas cheaply)
  - trail cells added or removed
- **The client draws its own head 1 tick ahead** (prediction) and corrects if a turn was rejected, for example a reverse.
- **Bandwidth** is about 1–2 KB/s, with bursts to about 6 KB on a big capture.

## 6. Dot Duel online (two phones)

- 1 v 1 rooms. Private by default: **"Duel a friend"** sends a link. Ranked Duel comes later.
- The server runs the puck at **30 Hz**, because the puck is fast. Each phone sends its paddle _target_, the same `targets` input the game uses today.
- **Each phone shows its own paddle as the bottom one**: the server sends player 2 a vertically flipped view. Both players see their own goal at the bottom, exactly like same-phone Duel.
- **Paddles are predicted locally.** The puck is interpolated 50 ms behind, with puck collisions extrapolated locally for responsiveness. If the server's puck differs, it blends toward the server's position within 80 ms.
- **Couples mode**: Duel rooms remember the pair and show a running head-to-head record ("Sara 12 – 9 Abdullah").

## 7. Hosting infrastructure

| Piece                 | Choice for launch                                                           | Why                                                                   |
| --------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Game servers          | Docker containers on Fly.io Machines, or Hetzner with Nomad                 | Regional, cheap, fast to scale. Fly can place Machines near the Gulf. |
| Gateway / matchmaker  | The same container image in "api" mode, behind a load balancer              | One codebase, stateless                                               |
| Room registry         | Redis (Upstash or managed)                                                  | Fast code lookup and presence. Codes expire with a TTL.               |
| Accounts and progress | Postgres (Supabase or Neon)                                                 | Profiles, skins, bests, achievements, friends                         |
| Auth                  | An anonymous device account first. Link Sign in with Apple or Google later. | No sign-up friction on day one                                        |
| Edge                  | TLS at the load balancer. WebSocket upgrade passed through to game servers  | `wss://` works everywhere                                             |

**Capacity and cost estimate:**

- One 2 vCPU / 2 GB machine handles about 200 Arena rooms × 12 players, roughly 2,400 concurrent players, at under 60% CPU. Bandwidth is about 8 MB/s.
- At launch, 2 machines per region (for redundancy) plus Redis and Postgres free or low tiers come to **about $60–120 per month for up to ~10k concurrent players**.
- Fleet autoscaling: when average room slots used across the region exceed 70%, a new machine is added. When a machine has been idle for 10 minutes, it is drained and stopped.

**Deploys** are rolling and drain-first: running matches always finish on the old version (see ARENA §8). The client and server protocol is versioned, and the server accepts the current version and the previous one.

## 8. Privacy and safety

- Player names are filtered when set and can be reported. Chat is **emoji reactions only** in Phase 1–2, so there is no free-text moderation burden.
- Players under 13 or under the local age threshold get private rooms only, with friends they have added through a code.
- No location is shared. Region is chosen by ping, never by GPS.
- The data kept is the minimum: a device account id, name, skin, progress and match results. These need adding to `docs/PRIVACY_POLICY.md` before the online launch.
