# Hybrid Hosting: Keeping Server Costs Low

This plan answers the question "what if our own server is small?". The short answer: run the matches that need a referee on a small VPS that we control, and let players' phones host the matches between friends.

## 1. Who hosts what

| Match type                        | Runs on                     | Our server does                                             | Why                                                                                       |
| --------------------------------- | --------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Public Dot Arena / Dot Paint      | **Our VPS** (authoritative) | Full simulation                                             | Strangers need a fair referee. This is the flagship experience. See [ARENA.md](ARENA.md). |
| Private rooms (friends), Dot Duel | **The host player's phone** | Lobby, room codes, and a message relay or connection broker | Friends rarely cheat each other, and the CPU cost moves off our server.                   |
| Async (ghosts, leaderboards)      | Phones                      | Store and validate replays                                  | No live traffic                                                                           |

The game rules are the same pure TypeScript in every case (`src/game/motion`). A room just picks _where_ `step()` runs. The room-owner role from [ROOMS_AND_HOSTING.md](ROOMS_AND_HOSTING.md#the-host-role) is unchanged. In phone-hosted rooms, the owner's phone is also the simulation host.

## 2. Phone-hosted private rooms

### 2.1 Connection

1. The host creates a room through our API and receives a code. Guests join with the code, exactly as in [§3 of ROOMS_AND_HOSTING](ROOMS_AND_HOSTING.md#3-private-games).
2. Phones first try a **direct WebRTC data channel**. Our server only exchanges the connection details (signalling), and a free public STUN server handles NAT discovery.
3. If a direct connection fails (strict NAT, some carrier networks), traffic goes through **our relay** instead. The relay only forwards bytes and never runs the game, so a small VPS can relay thousands of rooms.
4. The phone has no WebRTC in the build yet. Adding it means adding a library with native code and making a development build. Check the Expo SDK 57 docs before choosing one. Until then, **relay-only over the existing WebSocket** works with no native changes, so Phase 1 starts with it.

### 2.2 The host phone's job

- It runs the authoritative `step()` for the room at the same rates as the server version: Arena at 20 Hz, Duel at 30 Hz, Paint at 8 Hz.
- It sends snapshots to guests using the same binary protocol as [ARENA §7](ARENA.md#7-protocol), so the guest code is identical whether the host is a phone or our server.
- Room size is capped for phone hosts:
  - Arena: 8 players.
  - Paint: 6.
  - Duel: 2.
  - Bots off by default, so the host phone's battery and upload stay comfortable.

### 2.3 Host migration (the match survives the host leaving)

- Every **2 s**, the host sends guests a compact **checkpoint**: the full game state, seed, tick and owner list. That is about 1–3 KB.
- If the host disconnects, backgrounds the app, or stops sending for **3 s**:
  1. the next host is chosen deterministically: the guest who has been in the room longest, so every phone agrees without a vote
  2. that phone loads the last checkpoint and announces "👑 Sara is now hosting"
  3. the other guests reconnect to the new host, or through the relay
- At most 2 s of play rolls back. That is acceptable for friendly matches.
- If no guest can take over, the room ends with a "Host left" result card and keeps the rewards earned so far.

### 2.4 Trust and rewards

A phone host could be modified, so phone-hosted rooms carry less weight:

- They grant achievements and **at most 50% of public-room coins**. This is the same cap already set for private rooms in [ARENA §9](ARENA.md#9-anti-cheat).
- The host's phone submits the result. The server checks it is plausible: score within the game's limits, match length, and no impossible masses. If it fails the check, no reward is given.
- No ranked play and no global leaderboard entries from phone-hosted rooms.

## 3. Our VPS

### 3.1 Starting setup

| Item      | Recommendation                                                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Machine   | 2 vCPU, 2–4 GB RAM, Ubuntu LTS, Docker                                                                                                                                                    |
| Location  | As close to Gulf players as possible: a Jeddah, Bahrain or UAE region from a cloud or VPS provider. Oracle Cloud has a Jeddah region with an always-free tier, which is good for staging. |
| Processes | One game-server process per vCPU (Node or Bun + `uWebSockets.js`), plus one API/matchmaker process, plus Redis                                                                            |
| Database  | Managed Postgres on a free or small tier, kept off the game box                                                                                                                           |
| TLS       | Caddy or Nginx in front for `wss://` and automatic certificates                                                                                                                           |

**Estimated capacity for one such VPS.** These figures are estimates from the design and must be confirmed with the load test in [ARENA §13](ARENA.md#13-testing-and-observability):

- CPU: about 1,000–2,000 concurrent players in public Arena rooms.
- Bandwidth: about 3.5 KB/s per player, so 1,000 players is about 3.5 MB/s. Choose a plan with generous monthly traffic.
- Relayed private rooms cost almost no CPU, so the limit there is bandwidth only.

### 3.2 Load levers before buying more hardware

Use these in order, from cheapest to strongest:

1. **Cap rooms per process** so one hot server never degrades everyone. Extra players go to another server or wait a few seconds.
2. **Lower the public tick rate** from 20 Hz to 15 Hz. Arena steering still feels smooth with prediction and interpolation.
3. **Cap bots** to 8 bodies per room on a busy server.
4. **Push more friends' games to phone hosting.** For example, "Play with friends" defaults to a phone host when server load is above 70%.
5. **Add a second VPS.** Rooms are independent, so a second machine doubles capacity, and the matchmaker spreads new rooms across both.

### 3.3 Overflow and growth

- **Burst capacity:** pay-per-use game hosting such as Edgegap or Hathora can run the _same_ Docker image on demand when a spike arrives, for example after a viral share. The matchmaker sends overflow rooms there. We pay only for those minutes.
- **Fully managed alternative:** a relay service such as Photon removes server management entirely. It is not the main plan, because the game would no longer have a referee, and public matches need one.

## 4. Cost outline

| Stage                           | Setup                                                              | Approx. monthly cost |
| ------------------------------- | ------------------------------------------------------------------ | -------------------- |
| Development / beta              | Free-tier VPS (for example Oracle in Jeddah) + free Postgres/Redis | $0                   |
| Launch (up to ~1–2k concurrent) | 1 paid VPS + 1 standby, small managed DB                           | ~$20–60              |
| Growth (~10k concurrent)        | 4–6 VPS across 2–3 regions + burst capacity on demand              | ~$100–250            |

These are planning ranges, not quotes. Check current provider prices before choosing.

## 5. What changes in the rollout

The phases in [README](README.md#rollout-phases) change in two places:

- **Phase 1 (private Arena)** now ships phone-hosted rooms through the WebSocket relay first. The cost is almost nothing, and it tests the protocol with real friends.
- **Phase 2 (public matchmaking)** adds the authoritative VPS game servers. The client code is shared, because only the snapshot source changes.
