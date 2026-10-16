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

- **Guard N%** (Phase 1 draft, until 2026-10-16): N% less damage for
  10 slots, Batyr's Hold the Line. Removed as outdated; Barrier covers
  damage protection ([keywords.md](keywords.md)).
- **A stronger status replacing a weaker one** (until 2026-10-16):
  replaced by each application running its own duration, with only the
  strongest applying at a time.
- **Narrow, capped damage variance from gear** (until 2026-10-16):
  damage ranges such as 5 to 6, previewed as a minimum and maximum.
  Replaced by set numbers so every preview is exact; critical hits, dodge
  chance, accuracy and evasion were considered and not included
  ([information.md](information.md), 8.1).
- **A shared clock of fine-grained ticks** (typical action 100, quick 60,
  slow 150, movement 7 per hex), with speed reducing action cost by a
  capped percentage. Replaced first by coarse ticks (ticks could not be
  shown visually), then by the track.
- **A shared clock of coarse whole-number ticks** (typical action 10,
  quick 6, slow 15, 1 tick per hex, minimum turn cost about 3), drawn one
  pip per tick, with speed affecting only starting order and tie-breaks:
  speed barely mattered (a percentage reduction rounds to 0 on quick
  actions, and a flat per-tier reduction was not adopted); collisions let
  the faster unit keep the tick and bump the incumbent, which needed bumps
  to count towards the delay limit; and a minimum turn cost below a short
  move made short moves free and allowed chained near-free turns. Replaced
  by the **track**: fine-grained costs divided by speed + C into coarse
  slots, so speed works in small steps while the track stays countable.
- **Starting order at tick 0 with tie rules spreading units out,** or a
  per-tier offset: replaced by the placement formula with a starting cost.
- **Units sharing a tick and acting in tie order:** replaced by one card
  per slot.
- **Move-only and wait turns** priced by a minimum turn cost: replaced by
  requiring an action on every turn.
- **Unlimited movement with an exponentially rising cost per hex:**
  considered and dropped for a movement cap, because costs are paid after
  the turn and a long dash could still strike first.
- **Delayed actions as separate timeline entries** (declared, then
  resolving at a scheduled point, cancelled if the caster died): replaced
  by charged abilities on the character's own card, plus track entities
  for effects that act independently (such as summons).
- **Ultimates charged by a meter** filled by keyword actions: replaced by
  once per combat.
- **Ultimates usable from the start of a fight:** replaced by an unlock
  after the hero completes a set number of turns, shown publicly, so
  fights build toward ultimates and the other side can see one coming.
- **An event order within a tick** (expiries, damage over time, delayed
  actions, then the unit): replaced by effects acting at the beginning of
  a slot, before that slot's card.
- **Enemy tie ranks in the derived numbers** (so the browser could preview
  who kept a contested tick): unneeded once the arriving card always
  yields.
- **Delay as the track effect and Push as board movement** (the Phase 1
  draft), then **Delay and Boost on the track with Push and Pull on the
  board** (2026-10-16): replaced by Push and Pull for the track and
  Displace for the board, so each pair of words means one thing
  ([keywords.md](keywords.md)).
- **Taunt dodged by Hold** (2026-10-16): a taunted unit could Hold
  instead of attacking the taunter. Replaced by a taunt that can't be
  dodged, because Hold made it the same as Dazed ([keywords.md](keywords.md)).
- **The timeline as the next 16 turns shown as cards,** then as one pip
  per tick: replaced by the track of slots.
- **Stats hidden for every unit,** including your own; then **enemy stats
  hidden** but discoverable through previews, with the browser sent only
  derived numbers (damage after defence, effect magnitudes). Replaced by
  complete information (D11): the first full-number preview revealed the
  stats anyway, so hiding them added a chore rather than uncertainty.
  Ways considered to keep them hidden: every preview a server request (a
  request per tap against the Free plan, with latency), and stats sent but
  hidden only in the UI (visible in network traffic).
- **Health mostly fixed per hero:** replaced by health modified by gear,
  because damage grows through the run and fixed health let it outgrow
  defence, collapsing late fights into whoever strikes first.
- **Recruits joining at the party's upgrade level** (with lower-level
  gear) to prevent a death spiral after a death: rejected, because a death
  is meant to start a death spiral with a low chance of recovery. Recruits
  join at base level with basic gear, and deaths don't change recruitment.
- **A movement cap based on speed** (for example
  `floor(M × speed / (speed + K))`): set aside, because speed already sets
  how often a unit acts, its cost per hex and its starting slot; adding
  reach would make it the default best stat and give the largest reach to
  units that already act first. A per-hero cap modified by boots was the
  suggested alternative; the cap stays a single global value for now.
- **Consumables usable in combat** as actions with their own cost:
  replaced by consumables used only between fights (stat buffs or statuses
  for the next combat, or health recovery), keeping combat about the
  heroes' abilities and the track.
- **Health and damage in single digits:** percentage bonuses rounded away
  (for example Burn 2 with influence 15 stayed 2), so health and damage
  are on a ×10 scale.

## Roster

- **Fox-Spirit Sorcerer as a trickster caster** (2026-10-16): illusions
  and decoys, using conceal tiles. Labelled damage but played as support:
  decoys and cover protect the party, and none of it kills. Replaced by
  an area-damage and Burn caster whose tricks protect only itself.

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
