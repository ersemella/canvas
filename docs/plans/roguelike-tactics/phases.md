# Roguelike tactics: build phases

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which has the status, the next step and an index of every decision.

## Workflow

Same as the other plans: one phase per merge to `main` (no PR unless
asked), each verified with `pnpm check:boundaries`, `pnpm games:check`,
`pnpm -r --if-present typecheck`, `pnpm test`, `pnpm e2e` (look at the
screenshots), then a green deploy including `smoke-prod`.

Rival caravans are the last phase: the solo game, its run structure and
hardening come first.

### Phase 1: One fight

Built from [phase-1-brief.md](phase-1-brief.md), which gives defaults for
every open rule Phase 1 touches, the prototype heroes, the AI, the map,
the API and the page.

New `packages/games/silk-road-tactics` (rules, server; client): a single
fight per the combat design: the track and action economy
([timeline.md](timeline.md)); a compact hex map with obstacles, hazards,
conceal, deployment, flanking and line of fire ([map.md](map.md));
complete information and previews (local, computed from the view, enemy
ability options included, D11) ([information.md](information.md));
stats, starter gear and the defence formula; every unit's stat sheet; four
prototype heroes; one enemy band built from the same heroes and gear, with
a simple AI. The track UI. Platform: the player key, the `RunSystem`
contract and registry support, `RunRoom`, its routes, and a minimal
`PlayerLedger` (active run). One request per player turn (move and action,
AI turns up to the player's next turn); hex rules and AI within the Free
plan's 10 ms ([architecture.md](architecture.md#long-lived-storage-and-cost)).
The PvP seams: units with controllers, a `mode` field on runs, versioned
full views in responses.

Acceptance: unit tests for the track (placement formula, collisions and
cascades, the push limit, charged abilities, effects over time), hex geometry and line of fire, the damage
formula, previews matching outcomes, determinism (same seed and actions,
same fight), and that the view never carries the run's seed; e2e deploys,
plays and wins or loses a fight; a reload resumes it exactly; another
player key can't act on the run.

### Phase 2: A run on the route map

The run as a **route map with route choices** (as in Slay the Spire or
Monster Train): stretches of road (15.3) whose nodes are fights,
caravanserais (rest and recovery, 10.11), bazaars (gear and consumables,
9), recruitment (10.6) and optional risk (11.4). Permanent hero death and
party wipes, partial recovery, gear rewards, seeded recruitment offers,
milestone upgrades, ultimates, run end. More heroes and enemy bands;
difficulty scaling (11.4). Leave room on the map for rival caravan nodes
(Phase 4).

Acceptance: e2e plays a route through several nodes, recruits a hero,
loses one permanently and continues; a party wipe ends the run; a reload
never rerolls the map, an offer or an encounter.

### Phase 3: Hardening

Rate limits on starting runs and on actions, abuse cases (run churn),
watching daily usage against the Free limits, and moving to Workers Paid
(with a budget alert) if usage or CPU errors call for it. Repeat the
farming checks after Phase 4.

### Phase 4: Rival caravans and rewards (last)

`GhostPool`, offering party copies as a run advances (one per lineage per
stage), rival caravan nodes on the route map with PvP-style maps (D2),
picking (never your own, never a lineage you've faced, weighted by unique
kills, pick cap, legends), recording "faced" in the ledger, the caravan
played by the enemy AI, at most one caravan per fight
([ghosts.md](ghosts.md), D8); a beaten caravan's gear drop and its hero in
the next recruitment offer (D2). Then rewards: crediting a **party wipe**
to the owner's ledger by victim (idempotent, D9), unique players slain per
run and per player, recognition unlocks, the tally, the caravan's story
and unlocks on screen, unlocks checked at run start, the legends lists,
owner names with a length limit and filter.

Acceptance: unit tests for the pool (cap, one per lineage, weighting,
own-caravan exclusion, legend retirement) and the ledger (a repeated
credit counts once; a victim wiped by two of A's runs counts once for A's
lifetime and once for each run); e2e with two player keys: B meets A's
caravan at the matching stage, and never again in a later fight or run; a
reload doesn't re-roll it; with every candidate faced, the node is an
ordinary fight; A's caravan wipes B's party, and A sees the kill and can
start a run with its unlock.
