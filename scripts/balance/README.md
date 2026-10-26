# Caravan balance simulation

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
switches they patch were removed once the kits were chosen. So were
Volley and its files' subject (`volley.mjs`, `volley-charge.mjs`,
`volley-delayed.mjs`), replaced by Skirmish (2026-10-23); `skirmish.mjs`
measures Skirmish at charges 0, ½ and 1. `current.mjs` (each ability of
today's kits removed, and every stage caravan), `pared.mjs`, `stats.mjs`
and `caravans.mjs` run on the current rules. `sunlight.mjs` (2026-10-23) measures Sunlight's variants,
and the kit before it (Hail alone) as `today`; `sunlight-ai.mjs` the AI's
share of an Empower's worth, and `sunlight-full.mjs` the kit as it plays
against Hail alone.
`second-abilities.mjs` (2026-10-24) measures the upgrades of that day
(Shove, Haul, Feigned Retreat, Gale, Volley) beside Skirmish and Sunlight;
Hold Loose, Hip Toss, Squall Line, Tailwind and Overwatch, measured with
them, were removed with their code. A changed ability against its original
uses `mod.kits`, the modified side's kits by hero.
`outrider-straight.mjs` (2026-10-25) measures the Outrider's straight move
against the walk of 2 it replaced (it runs on the current rules);
`outrider-ai.mjs` and `outrider-ai-2.mjs` the AI's variants for it, whose
switches (`AI.standoff`, `AI.linesUp`, `AI.clearShot`) were removed once
the clear shot was adopted.
`hail-turns.mjs` (2026-10-25) reruns the whole game with Hail lasting 1
and 2 turns (`ABILITY.hail.turns`) on the current rules.
`china.mjs` (2026-10-25) measures the China line-up (fox, Modao Vanguard,
Waidan Alchemist) against the Steppe party, on the Gobi (an experiment's
`map`) and the Steppe, and each Chinese hero in each Steppe hero's seat.
`elixir-cleave.mjs` (2026-10-25) measures Elixir's shapes and Cleave's
Delay by their switches (`ABILITY.elixir.shape`, `ABILITY.cleave.delay`).
`elixir-fixed.mjs` (2026-10-26) measures Elixir with a fixed Empower and
Weaken of 1 and a hit on an enemy (`ABILITY.elixir.fixed`), and with a
heal on allies (`ABILITY.elixir.heal`), and at power 0 with Haste and
Delay (`ABILITY.elixir.tempo`).
`china-steppe.mjs` (2026-10-26) measures the China party (Youxia, Vanguard,
Alchemist) against the Steppe party, and each Chinese hero in each Steppe
hero's seat; `china-buffs.mjs` (2026-10-26) whether the AI is why China
loses (`mod.search`, the modified side's own horizon and work cap) and
buffs that even it; `vanguard-buffs.mjs` the Vanguard's buffs other
than speed, with Swift Strike Haste 3; `cleave-shape.mjs` Cleave's shape by its
switch (`ABILITY.cleave.shape`); `hail-elixir.mjs` two hails at once and
hail on entry (`ABILITY.hail.max`, `.entry`), and a power-0 Elixir of
radius 1 at melee range with Empower 2 and Weaken 1 (`ABILITY.elixir.empower`,
`.weaken`).
Built since 2026-10-26: the burst (`shape: 'burst'`, `range: 1`, `fixed: 0`,
`heal: false`, `empower: 2`, `weaken: 1`, the Alchemist's power 0), so the
files touching the Alchemist that don't set every one of these
(`china-steppe.mjs`, `china-buffs.mjs`, `vanguard-buffs.mjs`,
`cleave-shape.mjs`, `elixir-fixed.mjs`) reproduce only at their revision;
`hail-elixir.mjs` sets them all.
`storm-speed.mjs` (2026-10-26) measures the Storm Caller at speed 3.
Built since 2026-10-26: power 1, `fixed: 1`, `heal: 'all'`, so the earlier
files touching the Alchemist (`china.mjs`, `alchemist.mjs`,
`elixir-cleave.mjs`) reproduce only at their revision.

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

On the hexagon board, runs before 2026-10-24's fix of `mirrorHex` are
wrong: the mirrored fight stood units off the board and stalled.

First run (2026-10-22, seeds 1000–1999, 2,000 fights): player side 49.8%
(95% 47.5–52.2) of 1,730 finished; first mover 51.7%; same team won both
70%; 13.5% unfinished at 400 actions (without the camel nothing ends a
stall); median 45 actions.

### AI variants

Team a has the speed ties in both fights of a pair (cards keep their
slots), which is worth about 4 points: the production AI against itself
gives team a 54.4% (2026-10-24). Compare AIs with each as team a and take
the mean ([ai-search.md](../../docs/plans/roguelike-tactics/ai-search.md)).

`--ai A,B` gives each team its own AI (`production`, `greedy`: no lookahead,
the heuristic's best root action; `deep`: horizon 4 and four times the work
cap; `browser`: the page's AI, `AI.browser`, as deep as this machine gets in
its time, and `browser-slow`, a quarter of that time; both depend on the
machine and its load). Each AI keeps its team across a mirrored pair, so `aWinPct` is team a's
AI's share of wins on fair setups; a better AI should win more than 50%.

First runs (2026-10-22, seeds 1000–1499, 1,000 fights each, bokh, mangudai,
storm):

| Team a vs team b     | Team a wins, finished fights (95%) | Unfinished |
| -------------------- | ---------------------------------: | ---------: |
| production vs greedy |           60.1% (56.9–63.3) of 893 |      10.7% |
| production vs deep   |           40.6% (37.3–43.9) of 863 |      13.7% |

Lookahead pays at both steps: production beats greedy and deep beats
production by about the same margin, so deeper search on this evaluation
keeps finding better moves rather than chasing its errors. The deep variant
costs about four times the CPU of production, past the Worker's budget
(ai-search.md).
