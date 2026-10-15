# Roguelike tactics: build phases

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which has the status, the next step and an index of every decision.

**Revised 2026-10-15 for the combat design.** The phases were written for
one character exploring dungeon levels; they now follow the combat
design's party-based fights. The earlier Phase 1–2 text is in git
history.

## Phases

Same workflow as the other plans: one phase per merge to `main` (no PR
unless asked), each verified with `pnpm check:boundaries`,
`pnpm games:check`, `pnpm -r --if-present typecheck`, `pnpm test`,
`pnpm e2e` (look at the screenshots), then a green deploy including
`smoke-prod`.

### Before Phase 1

Decided 2026-10-15: the run structure (a route map, open question 34)
and previews versus hidden stats (D11). Still needed — **starting values**
for the combat design's TBDs that Phase 1 uses: the cost scale (open
question 1), map size and shape (9), the minimum turn cost; the knockback
lock limit (5) can wait for PvP but is cheap to decide now.

### Phase 1 — One fight

New `packages/games/roguelike-tactics` (rules, server; client): a single
fight per the combat design — the shared clock, speed, action economy
([timeline.md](timeline.md)); a compact hex map with obstacles, hazards,
conceal, deployment, flanking and line of fire ([map.md](map.md));
complete information, previews (local: own units from their stats,
enemies from derived numbers, D11) and capped variance
([information.md](information.md)); stats, gear and the defence formula;
your heroes' stat sheet; a few heroes from the prototype set (6–8 per
10.8, start smaller); one enemy band built from the same heroes and gear,
with a simple AI. The timeline UI. Platform: the player key, the
`RunSystem` contract and registry support, `RunRoom`, its routes, and a
minimal `PlayerLedger` (active run). One request per player turn (move +
action, AI turns up to the player's next turn); hex rules and AI within
the Free plan's 10 ms
([architecture.md](architecture.md#long-lived-storage-and-cost)). The PvP
seams: units with controllers, a `mode` field on runs, versioned full
views in responses.

Acceptance: unit tests for the clock (ordering, ties, pushes, minimum
cost), hex geometry and line of fire, the defence formula, previews
matching outcomes, determinism (same seed and actions → same fight), and
that no enemy raw stat reaches the browser; e2e deploys, plays and wins or
loses a fight; a reload resumes it exactly; another player key can't act
on the run.

### Phase 2 — A run on the route map

The run as a **route map with route choices** (open question 34, decided
2026-10-15; as in Slay the Spire or Monster Train): stretches of road
(15.3) whose nodes are fights, caravanserais (rest and recovery, 10.11),
bazaars (gear and consumables, 9), recruitment (10.6) and optional risk
(11.4). Permanent hero death and party wipes, partial recovery, gear
rewards, seeded recruitment offers, milestone upgrades, ultimates, run
end. More heroes and enemy bands; difficulty scaling (11.4). Leave room
on the map for rival caravan nodes (Phase 4).

Acceptance: e2e plays a route through several nodes, recruits a hero,
loses one permanently and continues; a party wipe ends the run; a reload
never rerolls the map, an offer or an encounter.

### Phase 3 — Hardening

Rate limits on starting runs and on actions, abuse cases (run churn),
watching daily usage against the Free limits, and moving to Workers Paid
(with a budget alert) if usage or CPU errors call for it. Repeat the
farming checks after Phase 4.

### Phase 4 — Rival caravans and rewards (last)

**Last by the owner's decision (2026-10-15).** `GhostPool`, offering
party copies as a run advances (one per lineage per stage), rival caravan
nodes on the route map with their own maps (D2), picking (never your own,
never a lineage you've faced, weighted by unique kills, pick cap,
legends), recording "faced" in the ledger, the caravan played by the enemy
AI, at most one caravan per fight ([ghosts.md](ghosts.md), D8); a beaten
caravan's gear drop and its hero in the next recruitment offer (D2).
Then rewards: crediting a **party wipe** to the owner's ledger by victim
(idempotent, D9), unique players slain per run and per player, unlocks,
the tally, the caravan's story and unlocks on screen, unlocks checked at
run start, the legends lists, owner names with a length limit and filter.

Acceptance: unit tests for the pool (cap, one per lineage, weighting,
own-caravan exclusion, legend retirement) and the ledger (a repeated
credit counts once; a victim wiped by two of A's runs counts once for A's
lifetime and once for each run); e2e — two player keys: B meets A's
caravan at the matching stage, and never again in a later fight or run; a
reload doesn't re-roll it; with every candidate faced, the node is an
ordinary fight; A's caravan wipes B's party, and A sees the kill and its
unlock and can start a run with it.
