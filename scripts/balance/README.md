# Silk Road Run balance simulation

The movement-rules runner (`run.mjs`, `simulate.ts`, `pnpm balance:tactics`)
was removed on 2026-10-23 with `FightState.experiment`, the overrides it
compared: walking is always blocked by units and always a turn of its own.
Its results are in `RESULTS.md`; to rerun it, use a revision before that.

Experiment files written before 2026-10-23 (`kit.mjs`, `hail-tuning.mjs`,
`modao*.mjs`) patch values the rules no longer have (action costs, ability
damage, the parked kits); they reproduce their measurements only at the
revision they were run at. So do the files for the new abilities of 2026-10-23
(`new-abilities*.mjs`, `ow-ai.mjs`, `fog*.mjs`, `volley-tuning.mjs`,
`outrider-no-adjacent.mjs`): Overwatch, Sunlight, Fog and the variant
switches they patch were removed once the kits were chosen; `volley.mjs`
still runs (Fog dropped from it). `pared.mjs`, `stats.mjs` and `caravans.mjs` run on
the current rules.

## Ability and stat ablation

`ablate.mjs` measures what each ability and stat is worth under the production
rules, with the production AI on both sides:

```sh
node scripts/balance/ablate.mjs scripts/balance/experiments/pared.mjs
node scripts/balance/ablate.mjs scripts/balance/experiments/stats.mjs --only storm-speed+1
```

An experiments file exports `experiments`, a map from a name to
`{patch?, mod?}`. `patch(config)` changes the config for both sides for that
experiment (`ABILITY`, `AI`, `HEROES`, `RULES` and the `ABILITIES`
definitions); it is undone afterwards. `mod` changes one side only: `ban`
removes abilities, `stats` adds to a hero's speed, defence (with the health
it gives), power or hp, `party` replaces its heroes. With `mod`,
each seed is played twice, once with each side modified, and `modWinPct` is
the modified side's share of finished fights: 50% means the change does
nothing, and a ban above 50% means the ability loses games when used.

Each fight uses `createFight(seed)`, so it has its own random ruins and
starting places. An experiment may also set `party` (the player's heroes;
the camel is added) and `enemies` (the enemy's units, wolves included), both
defaulting to the three heroes, the enemy to `party` when only that is set; `experiments/caravans.mjs` uses them to field
each stage's enemy caravans. Without `mod`, `playerWinPct` is the player
side's share of finished fights, with `outcomes` (enemies beaten, camel out,
camel killed, party killed), `heroesLeftPerWin` and `playerSurvivalPct`. Output per experiment: unfinished share, median actions
and slots, each hero's turns per unit and share of turns per ability, damage
and kills by source, and survival. Damage is attributed from the fight log.

Limits: a banned ability is removed from the hero's kit only while the
modified side chooses, so that side's search also assumes the other side
lacks it. 400 fights give about ±2.5 points of standard error on a win rate.
The findings and the principles built on them are in
`docs/plans/roguelike-tactics/balance.md`.

## Mirror matches

`mirror.mjs` checks the AI and rules for side bias: the same heroes on both
sides, no camel, the production AI on both.

```sh
node scripts/balance/mirror.mjs --pairs 1000 --party bokh,mangudai,storm
```

Each seed is played twice, as dealt and with the board mirrored left to right
and the sides swapped (cards keep their slots, so speed ties go to the same
team). Each pair is exactly fair, so `playerWinPct` should be 50%; anything
else is a bias towards a side. It doesn't measure how well the AI plays: two
copies of a weak AI are just as even. `sameTeamWonBothPct` is the share of
pairs one team won from both sides, i.e. decided by the setup.

First run (2026-10-22, seeds 1000–1999, 2,000 fights): player side 49.8%
(95% 47.5–52.2) of 1,730 finished; first mover 51.7%; same team won both
70%; 13.5% unfinished at 400 actions (without the camel nothing ends a
stall); median 45 actions.

### AI variants

`--ai A,B` gives each team its own AI (`production`, `greedy`: no lookahead,
the heuristic's best root action; `deep`: horizon 4 and four times the work
cap). Each AI keeps its team across a mirrored pair, so `aWinPct` is team a's
AI's share of wins on fair setups; a better AI should win more than 50%.

First runs (2026-10-22, seeds 1000–1499, 1,000 fights each, bokh, mangudai,
storm):

| Team a vs team b | Team a wins, finished fights (95%) | Unfinished |
| --- | ---: | ---: |
| production vs greedy | 60.1% (56.9–63.3) of 893 | 10.7% |
| production vs deep | 40.6% (37.3–43.9) of 863 | 13.7% |

Lookahead pays at both steps: production beats greedy and deep beats
production by about the same margin, so deeper search on this evaluation
keeps finding better moves rather than chasing its errors. The deep variant
costs about four times the CPU of production, past the Worker's budget
(ai-search.md).
