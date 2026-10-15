# Roguelike tactics: abandoned approaches

Every approach that was considered and dropped, with why. Read only when
revisiting a past choice; current decisions live in the topic files. Full
earlier texts are in git history (`docs/plans/roguelite-invasions.md`,
`docs/plans/roguelite/`, and this folder).

> Part of the roguelike tactics plan. Start at [README.md](README.md).

## Game shape

- **A dungeon crawl** (2026-10-13): one character exploring generated
  levels, finding an exit door, under fog of war. Replaced by the combat
  design (a party fighting battles on compact hex maps, complete
  information). Its open questions (run length, resting forever, map size,
  rooms and corridors, eight-direction movement, vision, the exit door,
  ghost spawn points, level contents, ghost strength) were answered or
  retired by the combat design.
- **Run structure as a pure sequence of fights** (as in Slice & Dice):
  rejected for a route map with route choices.

## Multiplayer

- **Live invasions with mutual opt-in at the door:** at the door after a
  level, a player chose to continue alone, open their level to an invader,
  or invade; the matchmaker paired them within about 45 seconds. Dropped:
  two players at the same door within seconds would rarely happen, and it
  needed a door UI, waiting window and cancel flow.
- **Always-on live invasions:** levels timed turn by turn, untimed breaks
  between levels as the invader's safe point, an invader joining the
  host's level with a single-use ticket. Dropped for ghost-only (D1):
  live play needs timers, safe points, hand-offs and live matchmaking, and
  two players at the same point at the same moment.
- **D5, signed character snapshots** (withdrawn): breaks ran in the
  browser, so the character crossed them as an HMAC-signed snapshot with
  break actions replayed on the server. Unneeded once the whole run lives
  in one room (D3).
- **D6, per-level rooms named by run and level** (withdrawn): their
  tombstones stopped a client replaying an old snapshot to undo a death.
  No snapshots, nothing to replay.
- **Ghosts as one character invading a level** from a fixed spawn point,
  appearing after some turns and hunting. Replaced by rival caravans:
  copies of whole parties met as a fight, deploying in a deployment zone.
- **Stage as fights won:** on a route map, players at the same point on
  the road can have won different numbers of fights. Stage is position
  along the road.
- **A nemesis rule** preferring the ghost that killed you, and **total
  kills** as the score: replaced by meeting each run's caravan at most
  once and scoring unique players killed, so runs don't go stale and a
  lucky build can't block a player.
- **A kill per hero killed:** a kill is a full party wipe.
- **Rival caravan fights on ordinary encounter maps:** they use PvP-style
  mirrored maps.
- **A beaten caravan's hero joining with its gear or upgrades:** it joins
  with nothing, like any recruit.
- **Unlocks only from caravan kills:** progression unlocks come from
  fights won; caravan kills give recognition unlocks, so power never
  depends on other players dying.

## Combat

- **A fine-grained tick scale** (typical action 100, quick 60, slow 150,
  movement 7 per hex): rejected because ticks could not be shown visually.
  Ticks are coarse whole numbers drawn one pip per tick.
- **Speed as a percentage reduction of action cost**, capped (10% to
  15%) and rounded down, with a starting offset derived from the same
  percentage: rejected because at the coarse scale it rounds to 0 on quick
  actions. **A flat per-tier cost reduction** was considered and not
  adopted, for simplicity. Speed sets starting order and breaks ties only.
- **Units sharing a tick and acting in tie order:** replaced by collisions
  resolving to separate ticks, so every unit has its own pip.
- **"Push" as the timeline effect:** the timeline effect is called Delay;
  Push means physically moving a unit.
- **The timeline as the next 16 turns shown as cards** (Mana Khemia
  style): replaced by pips, one per tick, so players count costs directly.
- **Stats hidden for every unit,** including your own: only enemies' stats
  are hidden (D11).
- **D11 alternatives:** every preview a server request (truly hidden, but
  a request per tap against the Free plan, with latency), and all stats
  sent to the browser and hidden only in the UI (anyone reading the
  network traffic sees them).
- **Health and damage in single digits:** percentage bonuses rounded away
  (for example Burn 2 with influence 15 stayed 2), so health and damage
  are on a ×10 scale.
- **Burn every 50 ticks for 200, guard for 200** (at the old 100-tick
  scale): too long; now burn every 3 ticks for 12 and guard for 10.

## Repository (D10)

A **standalone repository** with its own Worker, Durable Objects, page and
deploy was chosen and then dropped the same day (2026-10-15). Also weighed:
a game repository built into the arcade (needs a published engine and
`gen-game-registry.mjs` taking external packages, and most of the game's
code would still live in `canvas`, so most changes span two repos).
Learned:
- **A plain git dependency on the engine installs an empty package:** the
  engine ships only its built `dist/`, which isn't committed, and nothing
  builds it on install. What works (tested locally): a tag holding only
  the built package (`package.json` without workspace-only fields, plus
  `dist/`), consumed as `github:ersemella/canvas#engine-v<version>`. A
  script and a manual *Release engine* workflow that publish such tags
  were added in `782cd97` and reverted; restore them from there.
- The built engine uses extensionless relative imports, so it only loads
  through a bundler (Vite, esbuild, Wrangler), not plain Node.
- A Claude Code cloud session's GitHub integration can't create
  repositories (403); the owner creates them.
- A separate Cloudflare account would give the game its own Free-plan
  allowance; the same account shares it with poker.

## Names

- Package and folder names `roguelite` and `roguelike-tactics`: the game
  is **Silk Road Tactics** (`packages/games/silk-road-tactics`). Other
  titles considered: Silk Road Caravans, Caravans of the Silk Road, Silk
  Road: Rival Caravans, The Silk Road Charter, Silk Road: The Closing
  Road, Last Caravan on the Silk Road, Silk Road Gambit.
