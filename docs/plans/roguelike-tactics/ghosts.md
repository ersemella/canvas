# Roguelike tactics: ghosts (rival caravans) and rewards

The game's multiplayer: a **ghost** is a **rival caravan**, an
AI-controlled copy of another player's party met as a fight; how one is
picked, and what its kills earn. Decisions D1, D2, D8, D9.

**Build order (owner, 2026-10-15): rival caravans are the last step** —
built after the solo game, its run structure and hardening
([phases.md](phases.md)).

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which has the status, the next step and an index of every decision.

**Revised 2026-10-15 for the combat design.** This file was written when
the game was one character exploring dungeon levels, and a ghost was a
copy of one character invading your level at a fixed spawn point. The
combat design (owner, 2026-10-15) makes the game a party of up to four
heroes fighting a series of battles, and ghosts **rival caravans**: copies
of another player's party (combat design 11.2, 15.3). The rules carry over;
"level" becomes "fight", "depth" becomes **stage** (fights won so far — on
the route map this may change; see question 1 of the consistency review in
[README.md](README.md)), and
"character" becomes "party". The earlier version is in
[history.md](history.md) and in git history.

### D1. Ghosts only; no live opponents; no real-time turn timers

**Decision (owner, 2026-10-13):** other players appear only as ghosts —
rival caravans controlled by the AI. No live player ever joins your
fight, so there are **no real-time turn timers** and no timeout actions;
closing the tab mid-fight is safe and the run waits. (The combat
design's shared clock is game time, not real time: "chess with a clock"
means the tick timeline in [timeline.md](timeline.md).)

**Why:** almost everything hard in the earlier designs existed only
because two humans could share a fight (timers so one can't stall the
other, safe points, hand-offs, live matchmaking). Ghosts give the
multiplayer feel at any player count — live invasions needed two players
at the same point at the same moment, which a small game rarely has — and
untimed turns make the game strategic and permadeath fair.

**Consequences:**
- **A rival caravan is played by the enemy AI.** The combat design already
  builds regular enemies from the same heroes and gear as players (11.1),
  so the AI that plays a regular enemy band plays a rival caravan too. The
  AI is therefore the multiplayer experience and deserves real design
  effort; later it could copy simple habits from the owner (favourite
  abilities, aggression), as Forza's Drivatars and Killer Instinct's
  Shadows do.
- **Bad runs are inconsequential; good runs are memorable.** A run that
  dies early leaves rival caravans only in early-stage pools, where
  kill-weighted picks rarely choose them; a strong run leaves a caravan
  that keeps killing, becomes a legend, and earns its owner unlocks (D8,
  D9).
- **Live PvP only as a separate, opt-in mode** (see [pvp.md](pvp.md)). As
  a mode a player chooses, the standard game stays untimed.

**Revised 2026-10-13** (twice): replaces *mutual opt-in at the door*, then
*always-on live invasions with timed levels*. **Revised 2026-10-15:**
levels → fights, for the combat design. See [history.md](history.md).

### D2. What a rival caravan fight means

- **Rewards for beating a rival caravan** (confirmed 2026-10-13 for
  ghosts): part of its gear drops, so the fight is worth more than an
  ordinary one — but no more than an ordinary fight's best reward.
  (NetHack's bones levels and Nioh's revenants work this way.)
- **A beaten caravan's hero can join you** (decided, owner 2026-10-15):
  one of its heroes may appear in your next recruitment offer (combat
  design 10.6), as a defeated rival's hand joining you. Open details: which
  hero, whether it brings its gear or upgrades (recruits normally join
  without upgrades, 10.9), and duplicates (see [README.md](README.md)).
- **Losing heroes to a rival caravan** is ordinary permanent death (10.3);
  losing the whole party ends the run, and that **party wipe** is what
  credits the caravan's owner (D9).
- **Rival caravan fights get their own maps** (decided, owner 2026-10-15),
  distinct from ordinary encounter maps — for example built around a race
  to a point, fitting the setting's race along the road (15.2). Map and
  objective design open.

**Revised 2026-10-13:** the invader-death, disconnect and invasion-ending
questions belonged to live invasions and are gone. **Revised 2026-10-15:**
for the combat design (gear from a party; heroes die individually).

### D8. Rival caravans: at most one per fight, from a pool per stage

**Decisions (owner, 2026-10-13, carried to the combat design 2026-10-15):**
- **At most one rival caravan per fight.** A fight never has two ghost
  parties. (Was: at most one ghost per level.)
- **A player faces a rival caravan from a given run at most once, ever.**
  A run leaves a copy of its party at every stage it clears; once a player
  has faced any of them, no caravan from that run is picked for that
  player again, at any stage, in any of their runs. This keeps runs from
  going stale (the same party, a bit stronger, fight after fight) and
  stops a player getting stuck behind one hard — possibly just lucky —
  build.
- **The measure of a rival caravan is unique players killed** (D9). With
  the rule above, every kill by a run's caravans is a different player.

**How (confirmed proposals, adapted 2026-10-15):**
- **Identity is its source run.** Each caravan carries a **lineage ID**,
  an opaque hash of the source run's ID; the pool for a stage holds at
  most one caravan per lineage. "Faced" means the caravan was placed in
  your fight, whether or not you won.
- **Where caravans come from.** When a run wins its n-th fight and moves
  on, its room offers a copy of the party — heroes, gear, milestone
  upgrades, ultimate state as the combat design defines it; the owner's
  player-key hash; the lineage ID — to the **pool for stage n**, a DO,
  `idFromName('ghosts:' + n)`, holding a capped pool in SQLite (e.g. the
  latest few hundred, plus legends). Whether consumables are copied is the
  combat design's open question 25.
- **Whether a fight is a rival caravan fight** is decided when the
  encounter is generated, with a tunable chance (perhaps rising with
  stage), and stored with the run, so a reload can't re-roll it. Where
  these fights sit in a run depends on the run structure (open question
  34, see [README.md](README.md)). The caravan deploys in its side's
  **deployment zone** (combat design 6.6), like any enemy band.
- **Which caravan.** A player who has won n fights, about to fight their
  (n+1)-th, gets a caravan from pool n:
  - **Never their own** (same player-key hash) — also removes the easiest
    way to farm kills.
  - **Never a lineage they've faced.** The player's ledger (D9) keeps the
    lineage IDs they've faced. The run's room asks the pool for a short
    list of candidates (say 20), asks the ledger which are new, takes the
    first, and records it as faced in the same step.
  - **Weighted by unique kills**, so a deadly run becomes a known threat
    ("Mira's caravan — 7 players slain"), while each player meets it at
    most once; caravans with no kills are picked at random from the large
    pool.
  - **A ceiling:** cap how often one lineage is picked, and retire it as a
    **legend** after N unique kills — it stays on the legends lists but
    stops appearing — so one strong build can't own a stage.
  - **If every candidate is used up** (a veteran player at a quiet stage),
    the fight is an ordinary one. Rival caravans get rarer for players
    who've met everyone; a larger player base fixes that.
- **What the player sees.** Everything the combat design shows for any
  enemy (complete information, section 7): heroes, positions, abilities
  through the design language; stats stay hidden. Also, at the start of
  the fight, the owner's name and the caravan's unique kills (the Nioh
  lesson, [prior-art.md](prior-art.md)).
- **Units have controllers.** Each unit on the timeline is driven by a
  controller (the player, the enemy AI). A rival caravan is AI-controlled
  units; a live PvP opponent (future) would be the same units with a human
  controller. Costs nothing now.

**Consequences:** the AI is a significant piece of game work (D1).
Showing an owner's name displays a player-chosen name to strangers: needs
a length limit and a basic filter. Hero duplicates across opposing sides
are allowed (combat design 10.4), so a rival caravan may field the same
heroes as you.

**Revised 2026-10-13:** first a fallback when no live invader came, with
repeats treated as a problem; repeats then became a feature (killers stay
in the pool, a **nemesis** rule preferring the ghost that killed you,
legends); then ghosts became the only invaders. Finally the owner made
each run's ghost a once-per-player encounter: the nemesis rule is dropped
(it would make you face the same run again), and the goal is unique
players killed rather than total kills. **Revised 2026-10-15:** ghosts
become rival caravans (party copies met as a fight); spawn points become
deployment zones; depth becomes stage.

### D9. A rival caravan's kills reward its owner: recognition and unlocks

**Decision (owner, 2026-10-13):** when a ghost kills a player, its owner
earns **recognition** (unique players slain, "your caravan has slain N
players", legend status) and **permanent unlocks** carried across runs
(e.g. starting heroes, items offered between fights, cosmetics). Not
resources in a current run: easy to farm, and they snowball.

**The score is unique players killed** (owner, 2026-10-13), per run and
per player:
- **Per run** — what a caravan lineage is known for and what makes it a
  legend. Automatically unique, since each player faces a run once (D8).
- **Per player, lifetime** — distinct victims across all of the owner's
  runs (a victim killed by two of your runs counts once here). Unlocks are
  earned from this number. (Whether unlocks also come from fights won,
  as the combat design suggests in 10.7: consistency review question 3 in
  [README.md](README.md).)

**A kill is a full party wipe** (decided, owner 2026-10-15): a player
counts as slain only when the rival caravan kills their whole party, which
ends the run. Heroes it kills along the way are named in the caravan's
story but don't count. Kills are rarer than they would be per hero, so the
legend threshold N (D8) should be small; tune it in play.

**How (confirmed proposals):**
- **A ledger per player:** a DO, `idFromName('player:' + keyHash)`,
  holding the active run (D3), best stage reached, the lineages this
  player has faced (D8), the set of victims' key hashes and the counts
  derived from it, legends, and unlocks. When a caravan kills, the run's
  room credits the owner's ledger with the victim's key hash, keyed by
  victim and lineage, so a retry can't count it twice.
- **Reading it.** The home and between-fights screens show the tally and
  new unlocks. Unlocks chosen for a new run are checked against the ledger
  by the run's room when it creates the run. Unlocks must respect the
  combat design's restart concerns (10.7): earned from fights won, not
  runs started.
- **Legends list per stage** comes free from the pool. A global
  leaderboard doesn't (it needs a query across all ledgers — a D1
  database); out of scope.
- **Notification** of a kill could reuse the async plan's Web Push work
  once it exists; until then the tally shows on the next visit.
- **A caravan's story** (idea, from Dragon's Dogma's pawns, see
  [prior-art.md](prior-art.md)): show what it did — "killed Ash's Batyr at
  stage 5", "beaten by Rook at stage 7". The ledger already receives every
  credit; keeping the victim's display name, heroes and stage with it makes
  recognition far more vivid for little cost ("killed Ash's Batyr" is a
  story line; only a party wipe counts as a kill). Replays would need each
  fight's actions stored — possible later, not planned (combat is
  deterministic, so a replay is the actions plus the seed).

**Consequences:**
- **Farming is much harder:** an alt key adds at most one kill per run,
  and one to the lifetime count ever. Farming means many keys (new browser
  profiles), each playing a run to the right stage to be killed — slow,
  and with no accounts not reliably detectable, so keep unlocks about
  options, not power. A daily cap on credited kills is likely unneeded;
  add one only if farming shows up.
- **Storage per ledger grows** with lineages faced and victims (one short
  hash each): a few kilobytes for a heavy player. Fine.
- **Lost key, lost rewards** (D4).

## Design: a rival caravan fight

```
 Player (browser)        RunRoom run:R               Pool (stage n)              Ledger (victim)   Ledger (owner)
 wins fight n ────────► offer party copy ─────────► add to pool n
 next fight ──────────► generate encounter n+1;
                        rival caravan? (seeded)
                        if yes: candidates ────────► weighted by unique kills,
                                                     never the player's own
                        ◄──────── candidates ───────┘
                        which are new? ────────────────────────────────► (victim ledger)
                        ◄──── first new: G; marked faced ───────────────┘
 deploy, act ─────────► timeline: player units, G's units (AI)
   ... G wipes the player's party (run over) ...
                        ──────────────────────────► G's lineage: unique kills += 1 ─► (legend after N)
                                        ─────────────────────────────────────────────► credit victim hash (idempotent)
```

- **Every step is safe to repeat:** offers are keyed by lineage and
  stage, "faced" by player and lineage, credits by victim and lineage.
- **Who to trust:** only rooms talk to pools and ledgers. The browser sends
  its player key and actions, never a stage, outcome or party.
