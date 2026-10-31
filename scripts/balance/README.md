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
`china.mjs` (2026-10-25) measures the China line-up (fox, Vanguard,
Alchemist) against the Steppe party, on the Gobi (an experiment's
`map`) and the Steppe, and each Chinese hero in each Steppe hero's seat.
`elixir-cleave.mjs` (2026-10-25) measures Elixir's shapes and Cleave's
Delay by their switches (`ABILITY.elixir.shape`, `ABILITY.cleave.delay`).
`elixir-fixed.mjs` (2026-10-26) measures Elixir with a fixed Empower and
Weaken of 1 and a hit on an enemy (`ABILITY.elixir.fixed`), and with a
heal on allies (`ABILITY.elixir.heal`), and at power 0 with Haste and
Delay (`ABILITY.elixir.tempo`).
`china-steppe.mjs` (2026-10-26) measures the China party (Duelist, Vanguard,
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
`storm-power.mjs` (2026-10-27) measures the Storm Caller at power 2; its
`p*-bokh-for-storm` rows crash on two Grapplers on a side.
`elixir-tempo.mjs` (2026-10-26) measures the burst Elixir with Haste and
Delay in place of Empower and Weaken (`ABILITY.elixir.tempo`), counting
Delays on a unit already Delayed since its last turn (`delaysPerFight`)
and the Hastes the Alchemist gives itself (`hastesPerFight`).
`elixir-tempo-shapes.mjs` (2026-10-26) measures the same Elixir in other
shapes (bursts next to the Alchemist and within 2, one unit within 2 and
3), the Alchemist never taking its own (`ABILITY.elixir.self` off).
`elixir-haste-delay.mjs` (2026-10-26) measures more Haste than Delay
(`ABILITY.elixir.haste`, `.delay`, one `tempo` before), and the AI counting
Haste and Delay when it screens its options (`AI.trackWorth`).
Built since 2026-10-26: Haste 3 and Delay 3 (`haste: 3`, `delay: 3`,
`empower: 0`, `weaken: 0`, `self: false`), so the files touching the
Alchemist that don't set every one of these (`hail-elixir.mjs`,
`storm-speed.mjs`, `china-steppe.mjs` and earlier) reproduce only at their
revision; the three `elixir-tempo*.mjs` and `elixir-haste-delay.mjs` files
set them all (`elixir-tempo.mjs` with the Alchemist in its burst, as it
was measured).
`elixir-unstoppable.mjs` (2026-10-26) measures the Elixir on one ally
within 3, healing the Alchemist's power (1) and making it Unstoppable
until its next turn (`ABILITY.elixir.unstoppable`), against the heal alone
and the built burst, and the heal with Empower 1, Haste 3 or both. Built since then: the Alchemist's power 1, and an
Empower or Weaken of 0 no longer falling back to power (`elixirAmount`),
and `heal` no longer needing `fixed`; files that set the power and every
Elixir switch still reproduce.
Built since late 2026-10-26: one ally within 3, heal 1, Empower 1, Haste
3 (`shape: 'unit'`, `range: 3`, `heal: 'all'`, `empower: 1`, `haste: 3`,
`delay: 0`), so the files touching the Alchemist that don't set every
Elixir switch reproduce only at their revision; `elixir-unstoppable.mjs`
and `elixir-haste-delay.mjs` set them all.
Built since 2026-10-26: power 1, `fixed: 1`, `heal: 'all'`, so the earlier
files touching the Alchemist (`china.mjs`, `alchemist.mjs`,
`elixir-cleave.mjs`) reproduce only at their revision.
`china-mirror.mjs` (2026-10-26) measures the China party on both sides,
and each Chinese hero swapped for each Steppe hero on one side.
`china-steppe-retune.mjs` (2026-10-26) measures Cleave's Delay 6 and 5,
Swift Strike's Haste 2, the Elixir's Haste 2 and the Storm Caller at speed
3 (and with defence 1), and Hail's damage 2, 3 turns and 3 at once, each
on both sides, party for party and each
Chinese hero in its role's Steppe seat, and stage caravans with a Storm
Caller at each speed; it reproduces only at `a9f89d0`, before Hastes
collided by speed.
`tempo-collision.mjs` (2026-10-26) measures a Hastened or Delayed card
taking its slot against its colliding by speed (`RULES.delayWins`,
`.hasteWins`, at `a9f89d0`); built since: both by speed, the switches
removed, so its `built` and `by-speed` rows both measure that.

`eye.mjs` (2026-10-27; reproduces only at `26ce722`, Eye's code removed since) measures Eye of the Storm as the Storm Caller's core
in place of Hail (`mod.kits`), with heal 2 (`ABILITY.eye.heal`) and Weaken
2 (`ABILITY.eye.weaken`), and the storm Immobilizing
(`ABILITY.eye.immobilize`), and on an empty space (`ABILITY.eye.anywhere`);
`eye-runs.mjs` the same in whole runs.
`eye-ai.mjs` (2026-10-27) whether the AI underplays Eye: a deeper search for
either core's side, and a Storm Caller that can't hurt keeping back
(`AI.supportKeepsBack`).

`wait.mjs` (2026-10-30) measures Wait (`RULES.waitShare`): one side with it, as Patient 3 or 4 (`RULES.patientSlots`) on its every unit, at production's search and a deep one against the same search without; and both sides with it at 2/3 against the built rule, the four regions' mirrors and parties. `wait-china.mjs` gives it to one Chinese hero at a time, with Patient saving 0 as the control.
`wait-leaf.mjs` (2026-10-30) measures the search's leaf counting the track (`AI.leafTrack`), one side's AI with it, and Wait for one side with both AIs using it.
`reach.mjs` (2026-10-31) measures the leaf counting each unit's best hit from where it stands (`AI.reachShare`): one side's AI with it, and Wait for one side with both AIs using it, with the track at 1 (`wait`) or at reach's weight (`waitm`).
`spearhead.mjs` (2026-10-30) measures Spearhead (`SPEARHEAD`), the Vanguard's allies next to it Hastened when it's hit: one side's Vanguard with it in China's mirror, and the Vanguard's six role-seat rows of `roles-twelve.mjs` with and without it (`patch` giving it to every Vanguard); suffixes `-h5`, `-h6` its Haste, `-a1`, `-a2` the AI's allies seeking it (`AI.spearheadShare`), `-r2` allies within 2 (`SPEARHEAD.range`); since the Vanguard starts with it at range 2 (2026-10-30), its other rows reproduce only at their revision.

`elixir-swap.mjs` (2026-10-27) measures the Elixir swapping an ally's
speed and health (`ABILITY.elixir.swap`, `.swapUntil`), the AI's first
guess at its risk at 0.5 and 0 (`AI.swapRisk`), against the built Elixir.

`boss-seal.mjs` (2026-10-29) plays whole runs for every party of three
with the road out sealed while a boss stands, as built (`sealed`), and
with the seal off (`open`, no hero a boss), on the same seeds.

`skill-fights.mjs` (2026-10-29) measures skill as `roster-check.mjs` did, for
all twelve heroes in their role's seat of a Steppe mirror and each region's
party (`mod.search`, `mod.searchHeroes`); `skill-runs.mjs` (`runs.mjs`)
plays each region's party through whole runs at a novice's, production's and
an expert's depth (`search`). See balance.md, "Skill on all twelve heroes
and whole runs".

`trample-stomp.mjs` (2026-10-28) measures Trample as a stomp, the
Juggernaut staying put and every unit next to it hit and Pushed 1 away
(`ABILITY.trample.mode: 'stomp'`, now `ABILITY.stomp`, the ability renamed
Stomp), and after a step of 1 (`.step`), against the charge as built.

`elixir-immortal.mjs` (2026-10-27) measures the Elixir granting Immortal
until the ally's next turn (`ABILITY.elixir.immortal`), on heroes and on
the camel too, against the built Elixir.

`elixir-range2.mjs` (2026-10-27) measures the Elixir on one unit within 2,
an ally healed and Empowered 2, an enemy hit and Weakened 2, at the
Alchemist's power 1 and 2, against the built Elixir.
`cleave-lines.mjs` (2026-10-27) measures Cleave as a line of 2 six ways
(`ABILITY.cleave.shape: 'lines'`) against the built shape, on today's rules;
adopted the same day, so `lines` is now `built`, and it and `cleave-shape.mjs`
reproduce only at their revision.
`roster-check.mjs` (2026-10-27) puts every hero in every seat of a Steppe
mirror and a China mirror, and plays one hero, or a whole side, by a
novice (`depth: 1`) or an expert (`deep`) search (`mod.searchHeroes`, the
heroes of the modified side that use `mod.search`). `roster-runs.mjs`
(2026-10-27) plays every party of three in whole runs, and the one-of-each
parties by a novice and an expert (`search`, the player's heroes' search).
`roster-nine.mjs` (2026-10-27) does the same for all nine heroes: each in
every seat of a Steppe, a China and a Persia mirror, the regions' parties
against each other, and the Persian heroes by a novice and an expert.
`roster-twelve.mjs` (2026-10-28) does the same for all twelve, Byzantium's
three too, without the skill rows.
`roles-twelve.mjs` (2026-10-29) runs only its role seats, each hero in its role's seat of the other three regions' mirrors, with no party against party.
`slam-delay.mjs` (2026-10-29) measures the Cataphract's slam as a Delay of 4 and 6 in those of its rows with the Cataphract in them.
`slam-armour.mjs` (2026-10-29) measures the slam Delaying 6 with the Cataphract Armoured again, in the same rows.
`track-time.mjs` (2026-10-29) measures the effects that last by turns lasting a window of slots (`RULES.trackTime`: `own`, 10, 12), and a one-turn Stun as a Delay of the unit's action cost (`RULES.stunAsDelay`); see balance.md, "Track time".
`track-time-ai.mjs` (2026-10-29) measures the same with the AI counting windows (`AI.windows`), that AI against the one that doesn't (`mod.ai`), and Rally on each region's tank (`mod.passives`).
`durations-elixir.mjs` (2026-10-29) measures the Elixir's Empower and Weaken lasting slots that the Alchemist's power lengthens and the target's defence shortens (`rules`, the fight's own, as the test stage's `"rules"`).
The switches these three files patch (`RULES.trackTime`, `RULES.stunAsDelay`, `AI.windows`, the fight's `ticks`) were removed for the fight's `slots` (durations in a fixed number of slots, the test stage's `"rules"`): `track-time.mjs` reproduces only at `80be4c2`, `track-time-ai.mjs` at `d36fdb6`, `durations-elixir.mjs` at `c524b53`. `durations-slots.mjs` (2026-10-29) measures `slots`. `grapple-off-track.mjs` (2026-10-29) measures the fight's `grapple: 'offTrack'`, alone and with `slots`. Both became the game's only rules later that day (`RULES.durations`, the grapple always off the track), the fight's `rules` removed: `durations-elixir.mjs`, `durations-slots.mjs` and `grapple-off-track.mjs` reproduce only at `0e39f6b`; to vary the durations now, patch `RULES.durations`. The Elixir's switches for an ally made Unstoppable, Immortal or swapping speed and health were removed on 2026-10-29: `elixir-unstoppable.mjs`, `elixir-immortal.mjs` and `elixir-swap.mjs` reproduce only at `5a758d5`.
`provision-vs-card.mjs` (2026-10-29) measures a provision (+1 speed, defence or power) against each passive and generic upgrade, on every hero in its region's mirror (`mod.stats`, `mod.passives`); see balance.md, "A provision against a passive or an upgrade".
`archer-magus.mjs` (2026-10-27) measures Ranger nerfs (`ABILITY.longshot.minRange`,
`.camel`, `.falloff`, power, defence) and Magus buffs (`ABILITY.conjunction.hit`,
`.delay`, range, speed, defence), each switch off as built.
`longshot-bracket.mjs` (2026-10-27) measures Longshot stopped by the first
unit and Piercing (`ABILITY.longshot.first`, `.pierce`) and Conjunction as a
bracket (`ABILITY.conjunction.mode`, `.once`), against `archer-magus.mjs`'s
`built` rows; then Longshot's Push (`ABILITY.longshot.push`) and the bracket
with its second unit before the Magus's next turn (`mode: 'before'`), and
Longshot with Delay, Weaken or a pin in place of Push (`.delay`, `.weaken`,
`.pin`). Conjunction is the bracket since 2026-10-27, so `roster-nine.mjs` and
`archer-magus.mjs` set `mode: 'swap'`, as they were measured. Conjunction was
renamed Omen on 2026-10-28 (`ABILITY.omen`; mode `omen` became `single`); the
experiment files use the new names, the notes above the old.
`omen.mjs` (2026-10-27) measures Omen, the Magus's ability on one unit
(`ABILITY.conjunction.mode: 'omen'`, `.rider`; since 2026-10-28 the ability is
Omen, `ABILITY.omen`, its mode `single`), in the support seats and its
skill span against the bracket.
`longshot-push.mjs` (2026-10-28) measures Longshot as built that day (flying
over the spaces next to the Ranger) with Push 0, 1 and 2
(`ABILITY.longshot.push`).
`priest.mjs` (2026-10-28) measures the Priest in the support seat of a
Steppe, a China and a Persia mirror, as built and at power 2, without the
overheal (`ABILITY.blessing.overheal`), with a Shield of 1 on top
(`.shield`) and without Humphrey as a target (`.camel`); `priest-buffs.mjs` buffs for
him (a smite on enemies, range, speed, defence, the AI's Shield worth);
`priest-shield.mjs` Blessing as a Shield in place of the heal
(`.heal` off), on one ally or every ally within a radius (`.shape: 'aura'`).
`priest-lasting.mjs` the same with a Shield lasting until spent
(`.lasts`, `.cap`).
`priest-heal-shield1.mjs` a heal with a lasting Shield of 1 on top, at
`cap` 1, 2 and 3; `cap` is an absolute amount since then (3 his power).
`priest-overheal-shield1.mjs` the heal with its excess and 1 more as a
lasting Shield, at `cap` 3 (built), 4 and 8. Blessing's built defaults
changed then (`overheal`, `shield` 1, `lasts`, `cap` 3), so `priest.mjs`,
`priest-buffs.mjs` and `priest-shield.mjs` reproduce only at their
revision.
`priest-track.mjs` (2026-10-30) Blessing by the track (`.mode: 'track'`,
`.scale` `bands` and `cap`, range 3, no Shield) against Blessing as built,
in the support seats, in his own and played by a novice and an expert.
`priest-track-shield.mjs` (2026-10-30) the same with the heal's excess as a
lasting Shield (`.trackShield`).
`priest-track-pure.mjs` (2026-10-30) the same without the smite (`.trackSmite`
off), a pure support, also with `.split` 7 and 9.
`priest-line.mjs` (2026-10-30) Blessing in a line (`.shape: 'line'`), with
Blessing's Shield, as a heal alone, and with the Priest himself too
(`.lineSelf`).
`priest-line-any.mjs` (2026-10-30) Blessing as built then: any line aimed,
the Priest always blessed.
`cleave-for-spearhead.mjs` (2026-10-31) the Vanguard without Spearhead
at Cleave's Delay 6–10 (`ABILITY.cleave.delay`), beside Spearhead as built.
`vanguard-skill.mjs` (2026-10-31) the tanks' skill, the Vanguard by those
options, as `skill-fights.mjs`.
`byzantium-swap.mjs` (2026-10-31) Byzantium's tank and damage hero swapped
as the test stage has them (a `patch`, both sides): every role-seat row of
`roles-twelve.mjs` as built and swapped, and the skill of the two heroes in
their new and old seats, the other damage heroes and Byzantium's party.
`priest-invocation.mjs` (2026-10-31) the Priest with Invocation as built
(speed 1, defence 2), as he was with Blessing (`blessing-`), and with Wait
at 2/3 on both sides (`wait-`): his support seats as `priest-line-any.mjs`,
and his and Byzantium's party's skill rows. `ablate.ts` counts
Invocation's hits as the `invocation` source and what it heals as
`invocationHealPerFight`.
`byzantium-hew.mjs` (2026-10-31) the swap with Hew in place of Leap
(`ABILITY.hew`), the Cataphract without and with Armoured; only the rows
with Byzantium in them, the rest from `byzantium-swap.mjs`.
`byzantium-brace.mjs` (2026-10-31) the swap as the test stage has it: the
Cataphract with Armour after a charge (`ABILITY.charge.armour`), Hew's
Shield (`ABILITY.hew.shieldPerHit`); every role-seat row and their skill.
`byzantium-fury.mjs` (2026-10-31) Hew as a line of 2, stepping in
(`ABILITY.hew.shape` `line`), with Fury (`FURY`) and without; on the
Priest's Invocation.
Since the Barbarian took it in runs (2026-10-31), Hew is Wade In
(`wadeIn`, `ABILITY.wadeIn`), and the Barbarian and the Cataphract are
built as the swap; the four `byzantium-*.mjs` files reproduce only at
their revision.

`alignment.mjs` (2026-10-31) the Magus's Alignment (the test stage's in place
of Omen, a `patch`, both sides) beside Omen as built: the Magus in the
support seat of the three other regions' mirrors, each other support in
his seat of Persia's, and his skill as `skill-fights.mjs`.
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

## Whole runs

`runs.mjs` plays whole runs: a party through `STAGES` as the page does
(`run.ts`), the fallen gone for the run and the survivors and the camel
going on at full health, until a stage is lost or the last is won. The
production AI plays both sides at its fixed work cap, so a seed always
plays the same run.

```sh
node scripts/balance/runs.mjs scripts/balance/experiments/roles.mjs --runs 200 --jobs 4
```

An experiments file exports `experiments`, a map from a name to
`{party, group?, patch?, provision?}`: `party` the player's heroes (the
camel is added), `patch` as in `ablate.mjs`, and `group` a label whose
parties' mean run win rate and spread are printed at the end. The
caravanserai's choices follow one fixed policy for every party: each
provision raises `provision` (`defence` by default) on the survivor with
the lowest stat total, and the first passive offered goes to the first
survivor without it. Output per experiment: `runWinPct`; by stage, the
share of runs reaching it, its win rate, its losses by how they ended
(camel killed, party killed, stalled at `--max-turns`), heroes going in and
heroes left per win; and of the runs won, the share each hero finished
standing in. 200 runs give about ±3.5 points of standard error on a run win
rate near 50%.

`experiments/roles.mjs` (2026-10-26) asks whether a party needs one hero of
each role (roster.md): every party of three from the roster, grouped as
one of each, no tank, no damage or no support. The one-of-each parties'
spread is how much the choice of heroes moves a run on its own; a missing
role matters only if its group falls clearly below it.

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
