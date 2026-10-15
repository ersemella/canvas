# Roguelike tactics: opt-in PvP (parked)

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which has the status, the next step and an index of every decision.
> Abandoned approaches are in [history.md](history.md).

**Parked: ignore PvP for now.** Recorded only so the standard game's
design leaves room for a future PvP mode that players opt into.

## Shape

- **Arena first.** Opted-in parties at the same stage meet in a separate
  duel room, between fights: a fight between two parties on a symmetric or
  mirrored map with opposite deployment zones (6.6, section 12 below). A
  rival caravan fight is the same fight with the AI in place of a human,
  and its maps are the arena's. No joining a running fight; a two-player
  timed turn-based room is close to what `GameRoom` and a `ServerSystem`
  already do; the parties are copied in from their `RunRoom`s server to
  server. Open: whether losing a duel ends the run or only costs
  something.
- **Live invasions, possibly later** (the more unique idea). A player
  chooses a PvP run when starting it (say, *Hunted*). Only PvP runs can
  invade or be invaded by live players, and only PvP runs are timed, so
  standard runs stay untimed and strategic. At most one invader per fight;
  with no live match, a rival caravan stands in, so PvP runs aren't empty
  at low player counts. Would add live matchmaking per stage, a turn timer
  and timeout action (the pure timer maths in
  `packages/server/src/roomPolicy.ts` is a model), a WebSocket on
  `RunRoom`, a ticket-gated join, and moving the invader's party between
  rooms with an idempotent outcome.
- PvP runs would likely keep their own caravan pools and rewards, so the
  standard game's balance doesn't depend on them.

**Seams to keep now** (cheap, in Phases 1 and 2):
- Units with controllers (D8).
- A `mode` field on every run (`'standard'` for now), stored with the run
  and with its caravan and ledger records.
- Responses carry the whole public view and a version number (D7), so a
  socket can push the same message later.
- No timer logic in the standard rules; timers, if they come, belong to
  the PvP mode's room settings.

**Main risk:** live matches need two opted-in players at the same stage at
the same time. When that doesn't happen, a rival caravan stands in.

## Lessons from games that shipped live invasions

See [prior-art.md](prior-art.md) for sources.
- **Everyone gives players control, with an AI fallback.** Deathloop
  offers single player (only an AI invader), friends only, and online, and
  the invader is AI whenever no human takes the slot; Dying Light and
  Sniper Elite 5 let players turn invasions off.
- **Don't punish the victim.** Watch Dogs first made the opt-out cost all
  progress, then changed so victims never lose notoriety. Reward the
  invader's risk; don't tax the invaded.
- **Supply and demand of targets.** When Elden Ring restricted who can be
  invaded, invaders were funnelled into fewer worlds. With opt-in, plan for
  the imbalance (caravans fill gaps on both sides).
- **Give an invasion an objective and an end.** Deathloop's invasion locks
  the exits until the hunted player hacks a jammer, which flips who is
  hunting whom; it also caps invasions per loop.
- **Limit frequency, and give the host an edge,** as Souls games and
  Deathloop do.
- **Disconnects need rules from day one.** Watch Dogs was patched after
  launch to deter quitting mid-invasion.
- **It's expensive.** Doom Eternal announced a Souls-style invasion mode
  and cancelled it in 2021. Turn-based play avoids real-time netcode, but
  matchmaking, hand-off and balancing are real work.
- **Turn-based is rare.** Athena Crisis lets a friend join a campaign,
  including by taking over the enemy AI. A variant worth remembering: the
  invader controls the enemies rather than a party (as in Crawl).

## 12. PvP Considerations

Not yet in scope, but the design must not block it:
- All information rules in section 7 apply equally to both sides.
- Deployment zones are on opposite ends of symmetric or mirrored maps (section 6.6).
- Speed concentrates first-mover advantage, strongly: it decides starting order and the frequent collisions of the coarse tick scale (3.3, 3.4, 4.1). If testing shows this matters, add a small starting offset in favour of the side that moves second.
- The delay limit (section 3.6) is required before PvP.
- A turn timer will likely be needed. TBD.
- The variance cap (section 8.1) applies.

Open question (original number):

17. PvP turn timer and second-mover offset.
