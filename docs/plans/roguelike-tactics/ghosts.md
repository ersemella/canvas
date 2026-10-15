# Roguelike tactics: ghosts (rival caravans) and rewards

The game's multiplayer: a **ghost** is a **rival caravan**, an
AI-controlled copy of another player's party met as a fight; how one is
picked, and what its kills earn. Decisions D1, D2, D8, D9.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which has the status, the next step and an index of every decision.
> Abandoned approaches are in [history.md](history.md).

**Build order:** rival caravans are the last phase, after the solo game,
its run structure and hardening ([phases.md](phases.md)).

**Stage** means a run's position along the road on the route map, not the
number of fights won. Caravans are matched by stage, and difficulty scales
with it.

### D1. Ghosts only; no live opponents; no real-time turn timers

Other players appear only as rival caravans controlled by the AI. No live
player ever joins your fight, so there are **no real-time turn timers**
and no timeout actions; closing the tab mid-fight is safe and the run
waits. (The track is game time, not real time: "chess with a clock" means
the track in [timeline.md](timeline.md).)

**Why:** almost everything hard about live multiplayer exists only
because two humans share a fight: timers so one can't stall the other,
safe points, hand-offs, live matchmaking. Ghosts give the multiplayer feel
at any player count (live matches need two players at the same point at
the same moment, which a small game rarely has), and untimed turns make
the game strategic and permadeath fair.

**Consequences:**
- **A rival caravan is played by the enemy AI.** Regular enemies are
  built from the same heroes and gear as players (11.1), so the same AI
  plays a caravan. The AI is therefore the multiplayer experience and
  deserves real design effort; later it could copy simple habits from the
  owner (favourite abilities, aggression), as Forza's Drivatars and Killer
  Instinct's Shadows do.
- **Bad runs are inconsequential; good runs are memorable.** A run that
  dies early leaves caravans only in early-stage pools, where kill-weighted
  picks rarely choose them; a strong run leaves a caravan that keeps
  killing, becomes a legend, and earns its owner unlocks (D8, D9).
- **Live PvP only as a separate, opt-in mode** ([pvp.md](pvp.md)), so the
  standard game stays untimed.

### D2. What a rival caravan fight means

- **Its own maps:** PvP-style maps, symmetric or mirrored with opposite
  deployment zones (6.6, 12): a fair mirror match against another player's
  build, and the maps a future arena would need. Objectives open (for
  example a race to a point, fitting the setting's race along the road,
  15.2).
- **Rewards for beating it:** part of its gear drops, so the fight is
  worth more than an ordinary one, but no more than an ordinary fight's
  best reward (as NetHack's bones levels and Nioh's revenants do).
- **A beaten caravan's hero can join you:** one of its heroes may appear
  in your next recruitment offer (10.6). It joins **with nothing**, like
  any recruit, and is offered only if that hero isn't already in your
  party (no duplicates in one party, 10.4). Which hero is offered: open
  (suggested: the one that dealt the most damage).
- **Losing heroes to it** is ordinary permanent death (10.3). Losing the
  whole party ends the run, and that **party wipe** credits the caravan's
  owner (D9).

### D8. Rival caravans: at most one per fight, from a pool per stage

**Rules:**
- **At most one rival caravan per fight.** A fight never has two ghost
  parties.
- **A player faces a rival caravan from a given run at most once, ever.**
  A run leaves a copy of its party at every stage it passes; once a player
  has faced any of them, no caravan from that run is picked for that
  player again, at any stage, in any of their runs. This keeps runs from
  going stale (the same party, a bit stronger, fight after fight) and
  stops a player getting stuck behind one hard, possibly lucky, build.
- **The measure of a caravan is unique players killed** (D9). With the
  rule above, every kill by a run's caravans is a different player.

**How:**
- **Identity is its source run.** Each caravan carries a **lineage ID**,
  an opaque hash of the source run's ID; the pool for a stage holds at
  most one caravan per lineage. "Faced" means the caravan was placed in
  your fight, whether or not you won.
- **Where caravans come from.** When a run moves on from stage n, its room
  offers a copy of the party (heroes, gear, milestone upgrades, ultimate
  state as the combat design defines it; the owner's player-key hash; the
  lineage ID) to the **pool for stage n**, a Durable Object,
  `idFromName('ghosts:' + n)`, holding a capped pool in SQLite (for example
  the latest few hundred, plus legends). Whether active consumable buffs
  (9.6) are copied is open (below).
- **Whether a node is a rival caravan fight** is decided when the run's
  route map is generated, from the run's seed, so a reload can't re-roll
  it. The caravan deploys in its side's **deployment zone** (6.6), like
  any enemy band.
- **Which caravan.** A player reaching a rival caravan node at stage n+1
  gets a caravan from pool n, copies of parties that reached the same
  point on the road:
  - **Never their own** (same player-key hash), which also removes the
    easiest way to farm kills.
  - **Never a lineage they've faced.** The player's ledger (D9) keeps the
    lineage IDs they've faced. The run's room asks the pool for a short
    list of candidates (say 20), asks the ledger which are new, takes the
    first, and records it as faced in the same step.
  - **Weighted by unique kills**, so a deadly run becomes a known threat
    ("Mira's caravan: 7 players slain"), while each player meets it at
    most once; caravans with no kills are picked at random.
  - **A ceiling:** cap how often one lineage is picked, and retire it as a
    **legend** after N unique kills. It stays on the legends lists but
    stops appearing, so one strong build can't own a stage. Kills are rare
    (a kill is a party wipe), so N should be small; tune in play.
  - **If every candidate is used up** (a veteran player at a quiet stage),
    the node is an ordinary fight.
- **What the player sees.** Everything shown for any enemy (complete
  information, section 7): heroes, positions, abilities through the design
  language; stats stay hidden (D11). At the start of the fight, also the
  owner's name and the caravan's unique kills (the Nioh lesson,
  [prior-art.md](prior-art.md)).
- **Units have controllers.** Each card on the track is driven by a
  controller (the player, the enemy AI). A rival caravan is AI-controlled
  units; a live PvP opponent (future) would be the same units with a human
  controller.

**Consequences:** the AI is a significant piece of game work (D1).
Showing an owner's name displays a player-chosen name to strangers: needs
a length limit and a basic filter. Hero duplicates across opposing sides
are allowed (10.4), so a caravan may field the same heroes as you.

### D9. A rival caravan's kills reward its owner

When a rival caravan kills a player, its owner earns **recognition**
(unique players slain, "your caravan has slain N players", legend status)
and **recognition unlocks** (cosmetics, titles). **Progression unlocks
come from fights won** (10.7), so power never depends on other players
dying. Not resources in a current run: easy to farm, and they snowball.

**A kill is a full party wipe:** a player counts as slain only when the
caravan kills their whole party, which ends the run. Heroes it kills along
the way are named in the caravan's story but don't count.

**The score is unique players killed**, per run and per player:
- **Per run:** what a caravan lineage is known for and what makes it a
  legend. Automatically unique, since each player faces a run once (D8).
- **Per player, lifetime:** distinct victims across all of the owner's
  runs (a victim wiped by two of your runs counts once here).
  Recognition unlocks are earned from this number.

**How:**
- **A ledger per player:** a Durable Object, `idFromName('player:' + keyHash)`,
  holding the active run (D3), best stage reached, the lineages this
  player has faced (D8), the set of victims' key hashes and the counts
  derived from it, legends, and unlocks. When a caravan wipes a party, the
  run's room credits the owner's ledger with the victim's key hash, keyed
  by victim and lineage, so a retry can't count it twice.
- **Reading it.** The home and between-fights screens show the tally and
  new unlocks. Unlocks chosen for a new run are checked against the ledger
  by the run's room when it creates the run.
- **Legends list per stage** comes free from the pool. A global
  leaderboard doesn't (it needs a query across all ledgers, a D1
  database); out of scope.
- **Notification** of a kill could reuse the async plan's Web Push work
  once it exists; until then the tally shows on the next visit.
- **A caravan's story** (from Dragon's Dogma's pawns, see
  [prior-art.md](prior-art.md)): show what it did ("killed Ash's Batyr at
  stage 5", "wiped Rook's party at stage 7", "beaten by Lin at stage 8").
  The ledger already receives every credit; keeping the victim's name,
  heroes and stage makes recognition vivid for little cost. Replays would
  need each fight's actions stored; possible later, not planned (combat is
  deterministic, so a replay is the actions plus the seed).

**Consequences:**
- **Farming is hard:** an alt key adds at most one kill per run, and one
  to the lifetime count ever. Farming means many keys (new browser
  profiles), each playing a run to the right stage to be wiped: slow, and
  with no accounts not reliably detectable, so recognition unlocks stay
  cosmetic. A daily cap on credited kills is likely unneeded; add one only
  if farming shows up.
- **Storage per ledger grows** with lineages faced and victims (one short
  hash each): a few kilobytes for a heavy player.
- **Lost key, lost rewards** (D4).

## Design: a rival caravan fight

```
 Player (browser)        RunRoom run:R               Pool (stage n)              Ledger (victim)   Ledger (owner)
 leaves stage n ──────► offer party copy ─────────► add to pool n
 reaches caravan node ► rival caravan (seeded)
                        candidates ────────────────► weighted by unique kills,
                                                     never the player's own
                        ◄──────── candidates ───────┘
                        which are new? ────────────────────────────────► (victim ledger)
                        ◄──── first new: G; marked faced ───────────────┘
 deploy, act ─────────► track: player units, G's units (AI)
   ... G wipes the player's party (run over) ...
                        ──────────────────────────► G's lineage: unique kills += 1 ─► (legend after N)
                                        ─────────────────────────────────────────────► credit victim hash (idempotent)
```

- **Every step is safe to repeat:** offers are keyed by lineage and
  stage, "faced" by player and lineage, credits by victim and lineage.
- **Who to trust:** only rooms talk to pools and ledgers. The browser sends
  its player key and actions, never a stage, outcome or party.

## Open questions (original numbers)

25. Whether a rival caravan copy carries the consumable buffs (9.6) active
    when it was copied. Consumables are used only between fights and last
    for the next combat, so a copy taken between fights may hold buffs
    meant for a fight it never plays.
