# Roguelite: build phases

> Part of the roguelite plan — start at [README.md](README.md), which has
> the status, the next step and an index of every decision.

## Phases

Same workflow as the other plans: one phase per merge to `main` (no PR
unless asked), each verified with `pnpm check:boundaries`,
`pnpm games:check`, `pnpm -r --if-present typecheck`, `pnpm test`,
`pnpm e2e` (look at the screenshots), then a green deploy including
`smoke-prod`.

### Phase 1 — Solo roguelite

New `packages/games/roguelite`: seeded level generation (placing ghost
spawn points from the start, unused until Phase 2), movement, combat,
enemy AI, doors, the between-levels screen, permadeath (server); the level
and between-levels screens (client). A multi-step "travel/explore" action,
one row per save, and AI within the Free plan's 10 ms (see [architecture.md](architecture.md#long-lived-storage-and-cost)). Turn order as actors with
controllers, a `mode` field on runs, and versioned full views in responses
(the PvP seams). Platform: the player key, the
`RunSystem` contract and registry support, `RunRoom`, its routes, and a
minimal `PlayerLedger` (active run, best depth).

Acceptance: unit tests for generation (seeded), combat and AI; e2e plays a
level, the between-levels screen and the next level; a reload resumes the
run and the same level; dying ends the run and a reload can't undo it;
another player key can't act on the run.

### Phase 2 — Ghosts

`GhostPool`, offering characters at each cleared level (one per lineage
per depth), the seeded ghost-per-level roll, picking (never your own,
never a lineage you've faced, weighted by unique kills, pick cap,
legends), recording "faced" in the ledger, the ghost AI, spawning at a
fixed point, and the one-ghost rule.

Acceptance: unit tests for the pool (cap, one per lineage, weighting,
own-ghost exclusion, legend retirement) and the ghost AI; e2e — two player
keys: A clears levels n and n+1; B gets A's ghost on level n+1 at a spawn
point, and never again on level n+2 or in a later run; never a second
ghost in a level; a reload doesn't re-roll the ghost; with every
candidate faced, the level has no ghost.

### Phase 3 — Rewards

Crediting kills to the owner's ledger by victim (idempotent), unique
players slain per run and per player, unlocks from the lifetime count,
the tally and unlocks on screen, unlocks checked at run start, the
legends lists, ghost names with a length limit and filter.

Acceptance: unit tests for the ledger (a repeated credit counts once; a
victim killed by two of A's runs counts once for A's lifetime and once for
each run); e2e — A's ghost kills B; A sees the kill and its unlock and can
start a run with it.

### Phase 4 — Hardening

Rate limits on starting runs and on actions, abuse cases (run churn to
seed the pool, farming with many keys), watching daily usage against the
Free limits, and moving to Workers Paid (with a budget alert) if usage or
CPU errors call for it.
