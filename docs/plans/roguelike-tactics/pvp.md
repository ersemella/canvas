# Roguelike tactics: opt-in PvP (parked)

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which has the status, the next step and an index of every decision.

## Future: opt-in PvP

*Written for the dungeon-crawl version (levels, depth, characters); read
"level" as fight, "depth" as stage and "character" as party. Only the
arena and section 12 were revised for the combat design (2026-10-15).*

**Parked (owner, 2026-10-13): ignore PvP for now.** Recorded only so the
standard game's design leaves room for it. Owner's direction (2026-10-13): a future PvP version
that players opt into.

**Owner's preference (2026-10-13): an arena first.** Live invasions
remain the more unique idea and stay recorded as a possible later mode.

**Shape:**
- **Arena (first).** Opted-in parties at the same stage meet in a
  separate duel room, between fights. **Revised 2026-10-15:** the combat
  design fits this directly — a fight between two parties on a symmetric
  or mirrored map with opposite deployment zones (6.6, section 12 below),
  where a rival caravan is the same fight with the AI in place of a
  human.
  Smaller: no joining a running level, and a two-player timed turn-based
  room is close to what `GameRoom` and a `ServerSystem` already do; the
  characters are copied in from their `RunRoom`s server to server, so no
  signed snapshots are needed. Open: whether losing a duel ends the run
  (permadeath) or only costs something.
- **Live invasions (possibly later).** A player chooses a PvP run when starting it (say,
  *Hunted*). Only PvP runs can invade or be invaded by live players, and
  only PvP runs are timed, so standard runs stay untimed and strategic.
  Live invaders still come at most one per level (D8's rule); with no live
  match, a ghost invades as in the standard game, so PvP runs aren't
  empty at low player counts.
- PvP runs would likely keep their own ghost pools and rewards, so the
  standard game's balance doesn't depend on them.

**What live invasions would add** (most was designed in revision 2 — see [history.md](history.md) and its commits): live matchmaking per depth, a turn
timer and timeout action for PvP runs (the pure timer maths in
`packages/server/src/roomPolicy.ts` is reusable), a WebSocket on
`RunRoom`, a ticket-gated join for the invader, and moving the invader's
character between rooms with an idempotent outcome. Because runs live
entirely on the server (D3), the hand-off is between two rooms only — no
client-held snapshot, so D5 and D6 stay withdrawn.

**Seams to keep now** (cheap, in Phases 1–2):
- Turn order as actors with controllers (D8).
- A `mode` field on every run (`'standard'` for now), stored with the run
  and with its ghost and ledger records.
- Responses carry the whole public view and a version number (D7), so a
  socket can push the same message later.
- No timer logic in the standard rules; timers, if they come, belong to
  the PvP mode's room settings.

**Main risk, for both shapes:** live matches need two opted-in
players at the same depth at the same time. When that doesn't happen, a
ghost stands in — an arena duel against a ghost, or a ghost invasion in a
PvP run — so the mode stays playable at low player counts.

**Lessons from games that shipped live invasions** (see [prior-art.md](prior-art.md)), for
when PvP is picked up again:
- **Everyone gives players control, with an AI fallback.** Deathloop
  offers three settings — single player (only an AI invader), friends
  only, online — and the invader is AI whenever no human takes the slot;
  Dying Light and Sniper Elite 5 let players turn invasions off. Opt-in
  plus a ghost fallback matches this.
- **Don't punish the victim.** Watch Dogs first made the opt-out cost all
  progress (notoriety reset to zero), then changed so victims never lose
  notoriety. Reward the invader's risk; don't tax the invaded.
- **Supply and demand of targets.** When Elden Ring restricted who can be
  invaded (only players in co-op or using an item), invaders were funnelled
  into fewer worlds. With opt-in, invaders may far outnumber targets, or
  the reverse — plan for the imbalance (ghosts fill gaps on both sides).
- **Give an invasion an objective and an end.** Deathloop's invasion locks
  the exits until the hunted player hacks a jammer, which flips who is
  hunting whom; it also caps invasions per loop. Pure "kill the host"
  stalls. (Same questions as the old D2: how an invasion ends.)
- **Limit frequency, and give the host an edge.** Souls games and
  Deathloop both cap how often a host is invaded; Souls games added host
  advantages over time to keep invasions fair.
- **Disconnects need rules from day one.** Watch Dogs was patched after
  launch to deter quitting mid-invasion.
- **It's expensive.** Doom Eternal announced a Souls-style invasion mode
  and cancelled it in 2021, citing development problems. Turn-based helps
  (no netcode for real-time action), but the matchmaking, hand-off and
  balancing work is real — another reason it's parked.
- **Turn-based is rare.** The one turn-based example found is Athena
  Crisis, where a friend can join a campaign — including by taking over
  the enemy AI — triggered by items found in the campaign. A variant worth
  remembering: the invader controls the level's monsters rather than a
  character (as in Crawl).

## 12. PvP Considerations (from the combat design)

Not yet in scope, but the design must not block it:
- All information rules in section 7 apply equally to both sides.
- Deployment zones are on opposite ends of symmetric or mirrored maps (section 6.6).
- Speed concentrates first-mover advantage. If testing shows this matters, add a small starting offset in favor of the side that moves second.
- The knockback lock limit (section 3.6) is required before PvP.
- A turn timer will likely be needed. TBD.
- The variance cap (section 8.1) applies.

Open question (from section 14):

17. PvP turn timer and second-mover offset.
