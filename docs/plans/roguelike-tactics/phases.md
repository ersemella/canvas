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

- **Run structure** (open question 34): a pure sequence of fights, or a
  map with route choices — and where recruitment, caravanserais, bazaars
  and optional risk sit.
- **Previews and hidden stats** (D11, [architecture.md](architecture.md)).
- **Tuning starting points** for the combat design's TBDs Phase 1 needs:
  cost scale (open question 1), map size and shape (9), the knockback lock
  limit (5) can wait for PvP but is cheap to decide now.

### Phase 1 — One fight

New `packages/games/roguelike-tactics` (rules, server; client): a single
fight per the combat design — the shared clock, speed, action economy
([timeline.md](timeline.md)); a compact hex map with obstacles, hazards,
conceal, deployment, flanking and line of fire ([map.md](map.md));
complete information, previews and capped variance
([information.md](information.md)); stats, gear and the defence formula;
a few heroes from the prototype set (6–8 per 10.8, start smaller); one
enemy band built from the same heroes and gear, with a simple AI. The
timeline UI. Platform: the player key, the `RunSystem` contract and
registry support, `RunRoom`, its routes, and a minimal `PlayerLedger`
(active run). One request per player turn (move + action, AI turns up to
the player's next turn); hex rules and AI within the Free plan's 10 ms
([architecture.md](architecture.md#long-lived-storage-and-cost)). The PvP
seams: units with controllers, a `mode` field on runs, versioned full
views in responses.

Acceptance: unit tests for the clock (ordering, ties, pushes, minimum
cost), hex geometry and line of fire, the defence formula, previews
matching outcomes, and determinism (same seed and actions → same fight);
e2e deploys, plays and wins or loses a fight; a reload resumes it
exactly; another player key can't act on the run.

### Phase 2 — A run

The run structure (as decided before Phase 1): a sequence of fights,
permanent hero death, partial recovery between fights and rests, gear
rewards, recruitment offers (seeded), milestone upgrades, ultimates, run
end. More heroes and enemy bands; difficulty scaling (11.4).

Acceptance: e2e plays several fights in a run, recruits a hero, loses one
permanently and continues; a reload never rerolls an offer or encounter.

### Phase 3 — Rival caravans

`GhostPool`, offering party copies after each fight won (one per lineage
per stage), the seeded rival-caravan roll, picking (never your own,
never a lineage you've faced, weighted by unique kills, pick cap,
legends), recording "faced" in the ledger, the rival caravan played by the
enemy AI in its deployment zone, the one-caravan-per-fight rule
([ghosts.md](ghosts.md), D8).

Acceptance: unit tests for the pool (cap, one per lineage, weighting,
own-caravan exclusion, legend retirement); e2e — two player keys: A wins
fights n and n+1; B meets A's caravan as fight n+1, and never again in a
later fight or run; a reload doesn't re-roll it; with every candidate
faced, the fight is an ordinary one.

### Phase 4 — Rewards

Crediting kills to the owner's ledger by victim (idempotent; what counts
as a kill per D9), unique players slain per run and per player, unlocks
from the lifetime count, the tally and unlocks on screen, unlocks checked
at run start, the legends lists, owner names with a length limit and
filter.

Acceptance: unit tests for the ledger (a repeated credit counts once; a
victim killed by two of A's runs counts once for A's lifetime and once for
each run); e2e — A's caravan kills one of B's heroes; A sees the kill and
its unlock and can start a run with it.

### Phase 5 — Hardening

Rate limits on starting runs and on actions, abuse cases (run churn to
seed the pool, farming with many keys), watching daily usage against the
Free limits, and moving to Workers Paid (with a budget alert) if usage or
CPU errors call for it.
