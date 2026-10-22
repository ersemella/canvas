# Silk Road Run balance simulation

Run from the repository root, using the existing installed dependencies:

```sh
node scripts/balance/run.mjs --samples 500 --seed 20261020 --max-turns 400 --move-cost 60 --out work/balance-quick.json
node scripts/balance/run.mjs --samples 500 --seed 20261020 --max-turns 400 --move-cost 100 --out work/balance-typical.json
```

`pnpm balance:tactics --samples 500` is the package-script equivalent. No server,
browser, build, network connection, or new dependency is required. Vite loads the
TypeScript rules and engine source; its sockets and file watcher are disabled.
JSON output includes options, methodology, actual deployments, summaries, and
individual fight records, so the exact comparisons can be reproduced.

Each sample creates independent random legal deployments for both sides, with
one copy of each of the three prototype heroes. Each deployment runs twice,
swapping only which side gets priority on starting speed ties. The same placements
and priorities are used in all four variants:

- `baseline`: historical combined movement/ability rules with ally pass-through.
- `blocking`: historical combined actions, but walking cannot pass friendly units.
- `separate`: normal walking and an ability require separate turns.
- `both`: both changes.

The rules are stored on an optional `FightState.experiment`. Normal games have no
experiment and now use blocking and separate movement at base 20 plus 10 per hex,
with ordinary walking capped at 4 hexes; Leap (Dash until 2026-10-21) jumps 2.
The runner explicitly supplies overrides for each comparison variant’s blocking
and action economy. Map, stats, movement cap and ability ranges come from current
config. Historical results in RESULTS.md used walking cap 3 and Dash distance 2;
the stored results also predate the alpha-beta AI update. To reproduce those
measurements, use revision `094fe0c` and restore walking cap 3 and Dash distance 2.
Current runs use the current AI and record its search settings.
Experiments change submitted-path validation, reachable paths, AI options, taunt
reach, and AI threat estimates.

## Interpretation choices

Move-only turns use the existing `{move, action: {ability: 'hold'}}` representation.
They cost `--move-cost + movedHexes * RULES.moveCostPerHex`, divided by speed plus
C as usual. The adopted base cost is 20; pass `--move-cost 20` to measure it.
Other costs, such as 60 (quick) and 100 (typical), are experimental alternatives. Pure Hold keeps its existing cost. Moving still counts
toward ultimate unlock, as it does today. Dash (now Leap) and Rampage remain abilities and
retain their existing traversal rules, but cannot be combined with normal walking
under separate movement. The blocking variant concerns ordinary walking only.

Both teams use the current deterministic, capped production AI with the variant's
legal options and immediate threat model. The AI moves before acting in baseline;
it does not search act-then-move turns. It is not retrained or retuned for the new
rules. It searches actual future timeline decisions using budgeted alpha-beta. Both sides get the same search cap
per chosen turn; this is not the server's shared per-request budget.

A fight is marked stalled if still active after `--max-turns` chosen actions.
Automatic charged-ability trigger turns are resolved by the engine and do not
consume that cap. A stalled fight is a censored observation, not proof that the
fight can never finish. Completed-fight medians exclude those fights; compare
stall rates alongside medians. Timeline slots measure game time, not CPU time.
`moveOnly` also includes move + Hold in baseline. Idle holds exclude movement.
Hero survival is per starting unit at fight end or at the cap. Per-hero damage
and healing count immediate chosen-action effects only, excluding delayed status,
hazard, and charged-trigger damage; these are not total damage contribution.

The same-roster setup measures pacing, congestion, survival, and tie-priority
sensitivity. A roughly 50% side win rate does not establish hero balance. It
cannot establish balance for other maps, compositions, gear, or human play.
Use these results to select playtests, not to claim a rule is universally balanced.

## Ability and stat ablation

`ablate.mjs` measures what each ability and stat is worth under the production
rules (no `FightState.experiment`), with the production AI on both sides:

```sh
node scripts/balance/ablate.mjs scripts/balance/experiments/kit.mjs
node scripts/balance/ablate.mjs scripts/balance/experiments/stats.mjs --only storm-speed+10
```

An experiments file exports `experiments`, a map from a name to
`{patch?, mod?}`. `patch(config)` changes the config for both sides for that
experiment (`ABILITY`, `AI`, `HEROES`, `RULES` and the `ABILITIES` definitions,
whose `cost` and `recoveryCost` are copied from `ABILITY` at load time, so set
both; an ability's `charged` can be switched too); it is undone afterwards.
`party` sets both sides' heroes (default the three prototype heroes). `mod`
changes one side only: `ban` removes abilities, `stats` adds to a hero's
speed, defence, power or hp, `party` replaces its heroes. With `mod`,
each seed is played twice, once with each side modified, and `modWinPct` is
the modified side's share of finished fights: 50% means the change does
nothing, and a ban above 50% means the ability loses games when used.

Each fight uses `createFight(seed)`, so it has its own random ruins, quicksand
and starting places. Output per experiment: unfinished share, median actions
and slots, each hero's turns per unit and share of turns per ability, damage
and kills by source, healing, ultimate use and survival. Damage is attributed
from the fight log, so Hail, quicksand and Crushed are counted against the
enemy whoever they hit.

Limits: a banned ability is removed from the hero's kit only while the
modified side chooses, so that side's search also assumes the other side
lacks it. 400 fights give about ±2.5 points of standard error on a win rate.
The findings and the principles built on them are in
`docs/plans/roguelike-tactics/balance.md`.
