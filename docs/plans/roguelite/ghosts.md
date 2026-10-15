# Roguelite: ghosts and rewards

The game's multiplayer: what a ghost is, how one is picked and placed,
and what its kills earn. Decisions D1, D2, D8, D9.

> Part of the roguelite plan — start at [README.md](README.md), which has
> the status, the next step and an index of every decision.

### D1. Ghosts only; no live invasions; untimed turns

**Decision (owner, 2026-10-13):** other players appear only as ghosts. No
live player ever enters your level, so there are **no turn timers** and no
timeout actions; closing the tab mid-level is safe and the run waits.

**Why:** almost everything hard in the earlier designs existed only
because two humans could share a level (timers so one can't stall the
other, safe points, hand-offs, live matchmaking). Ghosts give the
multiplayer feel at any player count — live invasions needed two players
at the same depth at the same moment, which a small game rarely has — and
untimed turns make the game strategic and permadeath fair.

**Consequences:**
- The **ghost AI is the multiplayer experience.** A ghost has its owner's
  build but plays like our AI. It deserves real design effort; later,
  ghosts could copy simple habits from their owner (favourite abilities,
  aggression), as Forza's Drivatars and Killer Instinct's Shadows do.
- **Bad runs are inconsequential; good runs are memorable.** A run that
  dies early leaves ghosts only in shallow pools, where kill-weighted picks
  rarely choose them; a strong run leaves a ghost that keeps killing,
  becomes a legend, and earns its owner unlocks (D8, D9).
- **Live invasions only as a separate, opt-in mode** (see [pvp.md](pvp.md)). Adding them to the standard game would bring timers back and make
  a strategic game timed — a change to its identity. As a mode a player
  chooses per run, the standard game stays untimed.

**Revised 2026-10-13** (twice): replaces *mutual opt-in at the door*, then
*always-on live invasions with timed levels*. See [history.md](history.md).

### D2. What a ghost encounter means

Settled with D8 and D9:

- **Rewards for the player who beats a ghost** (confirmed): part of the
  ghost's gear drops, so fighting is worth more than avoiding — no more
  than an ordinary level's best loot. (NetHack's bones levels work this
  way: the dead character's gear is the reward for facing its ghost.)
- **Dying to a ghost** is an ordinary death: the run ends (permadeath), and
  the ghost's owner is credited (D9).

**Revised 2026-10-13:** the invader-death, disconnect and invasion-ending
questions belonged to live invasions and are gone.

### D8. Ghosts: one per level, from a pool per depth

**Decisions (owner, 2026-10-13):**
- **At most one ghost per level.** Never a second, even after the first is
  beaten.
- **A player faces a ghost from a given run at most once, ever.** A run
  leaves a ghost at every depth it clears; once a player has faced any of
  them, no ghost from that run is picked for that player again, at any
  depth, in any of their runs. This keeps runs from going stale (the same
  build, a bit stronger, level after level) and stops a player getting
  stuck behind one hard — possibly just lucky — build.
- **The measure of a ghost is unique players killed** (D9). With the rule
  above, every kill by a run's ghosts is a different player.

**How (confirmed proposals):**
- **Ghost identity is its source run.** Each ghost carries a **lineage
  ID**, an opaque hash of the source run's ID; the pool for a depth holds
  at most one ghost per lineage. "Faced" means the ghost was placed in your
  level, whether or not you fought it.
- **Where ghosts come from.** When a run clears level n and moves on, its
  room offers a copy of the character (stats and gear; the owner's
  player-key hash; the lineage ID) to the **ghost pool for depth n** — a DO,
  `idFromName('ghosts:' + n)`, holding a capped pool in SQLite (e.g. the
  latest few hundred, plus legends). Optionally also the character at the
  moment of death (closer to NetHack; a stronger pool where runs end).
- **Whether a level gets a ghost** is decided when the level is generated,
  with a tunable chance (perhaps rising with depth), and stored with the
  level, so a reload can't re-roll it. The ghost enters at one of the
  level's **fixed spawn points** (details with the level design), at the
  start or after some turns.
- **Which ghost.** A player who has cleared n, playing level n+1, gets a
  ghost from pool n:
  - **Never their own** (same player-key hash) — also removes the easiest
    way to farm kills.
  - **Never a lineage they've faced.** The player's ledger (D9) keeps the
    lineage IDs they've faced. The run's room asks the pool for a short
    list of candidates (say 20), asks the ledger which are new, takes the
    first, and records it as faced in the same step.
  - **Weighted by unique kills**, so a deadly run becomes a known threat
    ("Ghost of Mira — 7 players slain"), while each player meets it at
    most once; ghosts with no kills are picked at random from the large
    pool.
  - **A ceiling:** cap how often one lineage is picked, and retire it as a
    **legend** after N unique kills — it stays on the legends lists but
    stops invading — so one strong build can't own a depth.
  - **If every candidate is used up** (a veteran player at a quiet depth),
    the level simply has no ghost. Ghosts get rarer for players who've
    met everyone; a larger player base fixes that.
- **Who plays it.** The game's AI, driving a player-shaped character
  (gear, abilities), inside the run's room. Nothing happens to the player
  it was copied from, except credit for kills (D9).
- **A ghost is a player-shaped actor with an AI controller.** Model turn
  order as a list of actors, each with a controller (the player's actions,
  the enemy AI, the ghost AI), rather than hard-coding "player, then
  enemies, then ghost". It costs nothing now and is the main thing that
  makes opt-in PvP (future) possible: a live invader is the same actor
  with a human controller.

**Consequences:** the ghost AI is a significant piece of game work (D1).
Showing "Ghost of <name>" displays a player-chosen name to strangers:
needs a length limit and a basic filter.

**From prior art** (see [prior-art.md](prior-art.md)): Nioh's revenants are the closest
existing ghost mechanic — before fighting one, the player sees its owner's
level, name, cause of death and loot rarity. Show a ghost's name, depth
and unique kills when it appears; it makes the encounter personal. Nioh 2
also changed revenant drops from exact copies of the dead player's gear to
randomised stats, which supports D2's rule that a beaten ghost drops only
*part* of its gear, capped at an ordinary level's best loot.

**Revised 2026-10-13:** first a fallback when no live invader came, with
repeats treated as a problem; repeats then became a feature (killers stay
in the pool, a **nemesis** rule preferring the ghost that killed you,
legends); then ghosts became the only invaders. Finally the owner made
each run's ghost a once-per-player encounter: the nemesis rule is dropped
(it would make you face the same run again), and the goal is unique
players killed rather than total kills.

### D9. A ghost's kills reward its owner: recognition and unlocks

**Decision (owner, 2026-10-13):** when a ghost kills a player, its owner
earns **recognition** (unique players slain, "your ghost has slain N players",
legend status) and **permanent unlocks** carried across runs (e.g.
starting classes, items offered between levels, cosmetics). Not resources
in a current run: easy to farm, and they snowball.

**The score is unique players killed** (owner, 2026-10-13), per run and
per player:
- **Per run** — what a ghost lineage is known for and what makes it a
  legend. Automatically unique, since each player faces a run once (D8).
- **Per player, lifetime** — distinct victims across all of the owner's
  runs (a victim killed by two of your runs counts once here). Unlocks are
  earned from this number.

**How (confirmed proposals):**
- **A ledger per player:** a DO, `idFromName('player:' + keyHash)`,
  holding the active run (D3), best depth reached, the lineages this
  player has faced (D8), the set of victims' key hashes and the counts
  derived from it, legends, and unlocks. When a ghost kills a player, the
  run's room credits the owner's ledger with the victim's key hash, keyed
  by victim and lineage, so a retry can't count it twice.
- **Reading it.** The home and between-levels screens show the tally and
  new unlocks. Unlocks chosen for a new run are checked against the ledger
  by the run's room when it creates the run.
- **Legends list per depth** comes free from the ghost pool. A global
  leaderboard doesn't (it needs a query across all ledgers — a D1
  database); out of scope.
- **Notification** of a kill could reuse the async plan's Web Push work
  once it exists; until then the tally shows on the next visit.
- **A ghost's story** (idea, from Dragon's Dogma's pawns, see [prior-art.md](prior-art.md)): instead of only a number, show what the ghost did — "killed Ash
  at depth 5", "beaten by Rook at depth 7". The ledger already receives
  every credit; keeping the victim's display name and depth with it makes
  recognition far more vivid for little cost. Replays of a ghost's kills
  (as Clash of Clans and The Mighty Quest show raid replays) would need
  each encounter's actions stored — possible later, not planned.

**Consequences:**
- **Farming is much harder:** an alt key adds at most one kill per run,
  and one to the lifetime count ever. Farming means many keys (new browser
  profiles), each playing a run to the right depth to be killed — slow,
  and with no accounts not reliably detectable, so keep unlocks about
  options, not power. A daily cap on credited kills is likely unneeded;
  add one only if farming shows up.
- **Storage per ledger grows** with lineages faced and victims (one short
  hash each): a few kilobytes for a heavy player. Fine.
- **Lost key, lost rewards** (D4).

## Design: a ghost encounter

```
 Player (browser)        RunRoom run:R               Ghost pool (depth n)        Ledger (victim)   Ledger (ghost owner)
 clears level n ──────► offer character copy ─────► add to pool n
 next level ──────────► generate level n+1;
                        ghost this level? (seeded)
                        if yes: candidates ────────► weighted by unique kills,
                                                     never the player's own
                        ◄──────── candidates ───────┘
                        which are new? ────────────────────────────────► (victim ledger)
                        ◄──── first new: G; marked faced ───────────────┘
 moves ───────────────► player turn, enemies, G
   ... G kills the player ...
                        run over ─────────────────► G's lineage: unique kills += 1 ─► (legend after N)
                                        ─────────────────────────────────────────────► credit victim hash (idempotent)
```

- **Every step is safe to repeat:** offers are keyed by lineage and
  depth, "faced" by player and lineage, credits by victim and lineage.
- **Who to trust:** only rooms talk to pools and ledgers. The browser sends
  its player key and actions, never a depth, outcome or character.
