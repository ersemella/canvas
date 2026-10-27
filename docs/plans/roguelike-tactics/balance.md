# Roguelike tactics: balance review and principles

A measured review of the Phase 1 prototype's balance and feel (2026-10-20),
the tuning it suggests, and the principles for re-tuning as gear, heroes
and keywords arrive. Tunings 1 to 3 are **applied** (owner, 2026-10-20);
the rest is **Proposed**: the numbers are the owner's to set
([owner-decisions.md](owner-decisions.md), decision 2).

> Part of the roguelike tactics plan. Start at [README.md](README.md).
> Numbers are in `packages/games/silk-road-run/src/rules/config.ts`;
> the stat and keyword rules are in [heroes-and-gear.md](heroes-and-gear.md)
> and [keywords.md](keywords.md); the track is [timeline.md](timeline.md).
> The Grappler's Pin was renamed Grapple (owner, 2026-10-22); the
> measurements below keep the name they were taken under.
>
> **Everything before [the 2026-10-23 rework](#the-2026-10-23-rework) was
> measured on the old rules:** action costs and cost-based placement, the
> Low 10 / Medium 25 / High 40 stat scale, power-scaled base damage and
> percentage defence, and keywords since renamed or removed (track Push
> is now Delay; [keywords.md](keywords.md)). Its findings about those
> mechanics no longer apply; its method and principles still do.

## Summary

- **Most of the kit adds nothing, and two abilities cost games.** Three abilities do the work:
  the Bow, Hail and Throw. Removing one of them from a side drops
  its win rate to 8–35%. Removing anything else leaves it at 44–58%, so
  those abilities add little. Fog, Volley and Freeze score above 50%: the
  side that **loses** them wins more. Fights are mostly a race to deal
  damage plus lining up arrows. The control layer (Pin, Fog, Sunlight,
  Freeze) is close to zero in wins.
- **Fog is spammed because the AI overvalues it.** It is the Storm
  Caller's most-used action (39% of its turns), and the side without
  it wins 74%. The AI gives a flat bonus for fogging allies,
  whatever the threat. With that weight lowered to a third, Fog drops to
  7% of turns, the side without it wins 54%, unfinished fights fall from
  6.8% to 4.5%, and fights get shorter. Fog spam, not healing, was the
  main cause of stalls.
- **Sunlight is too weak to matter** at heal 35 (52 healed). At heal 50
  it is worth about 9 points of win rate, and with the other changes
  below, stalls stay at 2.5%.
- **The ultimates don't pay for themselves.** Volley and Freeze cost a
  charge and a full recovery (140), and their targets step out cheaply.
  Volley breaks even or better with charge 20 and recovery 60. Freeze
  costs games in every variant tried.
- **Speed is worth two to three times as much as power or defence**, point
  for point, and its value comes in steps set by the track's rounding.
  Changing `C` doesn't fix it (tested); pricing gear speed by the slots it
  saves does.
- **The Horse Archer takes 2–3 times as many turns as anyone else**,
  81% of them moves or Dashes to line up its six arrow lanes: a lot of
  clicks for one hero.
- **The track's own tools (Push, Pull) aren't in any Phase 1 kit**, so the
  game's centrepiece is used only through action costs.

## Method

Production rules and the production AI on both sides of the Salt Flats.
Each side has one of each prototype hero. Each fight has its own random
ruins, quicksand and starting places (seeds 1000 onward), and is cut off
at 400 chosen actions. The harness is `scripts/balance/ablate.mjs`; see
`scripts/balance/README.md`.

- **Usage:** each hero's turns split by what they did (an ability, a move,
  a Hold).
- **Ablation:** one side loses one ability. Every seed is played twice,
  once with each side handicapped. The handicapped side's win rate is
  what the ability is worth: 50% means nothing; below 50% means it helps;
  **above 50% means using it loses games**.
- **Stat sensitivity:** the same pairing, with one hero on one side given
  +10 of a stat.
- **Size:** 400 fights per row, about 380 finished. One standard error is
  about ±2.5 points, so differences under ~5 points are noise.
- **Limits:** this is a mirror match, played AI against AI. It measures
  how the AI uses each ability, which isn't how a person would. The
  handicapped side's AI also assumes the other side lacks the banned
  ability. Large effects are trustworthy. Small ones point at what to
  playtest.

## Findings

### Ability frequency (current rules, 400 fights)

| Hero | Turns per fight | Share of its turns |
|---|---:|---|
| Horse Archer | 25 | move 63%, Dash 18%, **Bow 13.5%**, Volley 3.8%, Hold 1.4% |
| Grappler | 7.7 | move 42%, **Throw 30%**, Pin 16%, Rampage 6.5%, Hold 5.4% |
| Storm Caller | 8.3 | **Fog 39%**, Hail 20.5%, move 18.6%, Sunlight 11.7%, Freeze 10.5% |

Median 53 chosen actions and 84 slots per fight; 6.8% unfinished.
Ultimates unlock around slot 32 to 39 and are used around 38 to 50. The
Grappler uses Rampage in only half of fights, because it often dies
first.

Damage and kills per fight (both sides together; Hail can also hit
allies, but the log doesn't say who cast it):

| Source | Damage to enemies | Damage to allies | Kills |
|---|---:|---:|---:|
| Bow | 744 | 0 | 0.98 |
| Hail | 453 | (unknown) | 1.00 |
| Throw | 325 | 1 | 0.42 |
| Volley | 301 | **64** | 0.61 |
| Rampage | 181 | 16 | 0.33 |
| Pin (Crushed) | 106 | 0 | 0.09 |
| Quicksand | 79 | | 0.16 |
| Freeze | 47 | 12 | 0.13 |
| Sunlight | 98 healed | | |

The Bow, Hail and Throw deal 68% of all damage. Freeze deals about 27 per
use, so it catches less than one enemy on average.

### What each ability is worth

Win rate of the side **without** the ability. "Fog fix" is the AI change
in tuning 1 below. "Package" is tunings 1 to 3.

| Ability | Current | Fog fix | Package | Reading |
|---|---:|---:|---:|---|
| Bow | 19.7% | 7.9% | | The core of the game |
| Hail | 28.1% | 25.8% | | Core; the Storm Caller's real job is damage |
| Throw | 30.6% | 35.1% | | Core; the Grappler's only real damage |
| Rampage | 45.2% | 44.1% | 45.4% | Pulls its weight |
| Dash | 49.9% | 44.6% | 48.2% | Mostly replaceable by walking |
| Pin | 52.0% | 47.9% | 50.6% | Adds nothing measurable |
| Sunlight | 50.7% | 51.1% | **41.0%** (heal 50) | Useless at heal 35; real at 50 |
| Fog | **74.0%** | 53.6% | 49.6% (cost 60, radius 2) | A trap at today's AI weights; still adds nothing after fixes |
| Volley | **56.4%** | **56.7%** | 47.9% (charge 20, recovery 60) | Costs games until it's cheaper |
| Freeze | **58.0%** | **56.4%** | **55.2%** | Costs games in every variant tried |
| All three ultimates | 59.2% | | | |

Freeze still costs games when made instant (54.1%), given radius 2
(54.8%), base damage 140 (53.2%), no friendly fire (54.4%) or no
Immobilize (56.0%), and when the AI's Vulnerable and Immobilized weights
are quartered (55.1%). The cause isn't isolated. The leading suspect is
when the AI chooses it: it scores the charge as if its targets won't
move, and does so at the moment Hail or Sunlight would do more. It needs
a look at individual fights, or a redesign.

### Tactical options and strategy

- **Decisions per turn are few and the same each fight.** The Horse Archer
  steps into a lane and shoots. The Storm Caller places hail on whoever
  is in reach. The Grappler walks in and throws. Fog and Pin are chosen
  often but change nothing. A "turtle" plan (fog, heal, pin) loses to a
  damage race.
- **The six-lane bow, with no range limit, sets the positioning game.**
  Lining up an arrow costs 2–3 cheap moves per shot. That makes the
  Horse Archer tedious to play: 25 turns a fight against the others' 8. A
  higher move cost doesn't help: at base 30 or 40 the Horse Archer switches
  to Dash (65–69% of its turns) and takes as many turns.
- **The tank doesn't tank.** The Grappler has the lowest survival (27% vs
  41–43%) and a third of the Horse Archer's damage per slot (raw 9.6 vs 30.9).
  Pin, its control tool, measures as worthless. What protection it gives
  comes from blocking arrow lanes with its body.
- **Track play is missing.** No Phase 1 ability Pushes or Pulls a card.
  Goal 4, time as a shared resource, shows up only as action costs and
  charges.
- **Variety between fights** comes from random terrain and starting
  places, not from composition, because both sides field the same three
  heroes.

### Costs, damage, stats and constants

Hits to kill with each hero's main attack (current numbers, no
Vulnerable; the Horse Archer and Storm Caller at 300 and 420 health since
2026-10-21, 360 before, when Throw took 5 and 6, Hail 6 and 8, and
Volley 2 on the Horse Archer):

| Attack (raw after power) | vs Grappler (540, def 25) | vs Horse Archer (300, def 10) | vs Storm Caller (420, def 25) |
|---|---:|---:|---:|
| Bow (216) | 4 (144 each) | 2 (180) | 3 (144) |
| Throw (96) | 9 (64) | 4 (80) | 7 (64) |
| Hail hit (75) | 11 (50) | 5 (62) | 9 (50) |
| Volley (360) | 3 (240) | **1 (300)** | 2 (240) |

Damage per slot of a typical action: Horse Archer 216 / 7 slots = 30.9;
Grappler 96 / 10 = 9.6; Storm Caller 75 / 10 = 7.5 plus the lingering
hex.

Stat exchange rates (win rate for +10 on one hero of one side; +60
health for reference):

| Hero | +10 speed | +10 power | +10 defence | +60 health |
|---|---:|---:|---:|---:|
| Grappler | 60.5% | 59.1% | 53.7% | 58.4% |
| Horse Archer | 64.6% | 54.7% | 57.9% | 58.2% |
| Storm Caller | 65.4% | 53.9% (61.3% with heal 50) | 55.6% | 55.7% |

- **Speed is the strongest stat for every hero.** Power's worth depends on
  the kit: +10 hardly moves the Horse Archer (no hits-to-kill threshold
  crossed), but matters for the Storm Caller once Sunlight's heal is
  worth having.
- **Speed's value comes in steps.** For a Medium (25) hero, +10 speed
  turns a typical action from 10 slots into 8 after rounding down.
  Rescaling the formula so the three stats share one constant (`C` 50,
  `speedScale` 7.5, giving typical turns of 8, 10 and 12 slots) measured
  the same: +10 speed on the Storm Caller and the Horse Archer gave 65.3% and
  63.4%, against 63.0% and 61.0% under the same tuning with today's `C`.
  The slot a turn lands on is what counts, not the formula, so `C` can
  stay.
- **Typical turns fall outside the 8 to 12 slot aim** at the ends (High
  7, Low 14; [timeline.md](timeline.md), 3.2). Harmless with three
  heroes; it starts to matter when Low heroes (Barbarian, Vanguard) and Very low heroes (Elephant Rider) arrive.
- **Movement:** a one-hex move costs 30, about 3 slots, so stepping is
  nearly free. That suits the separate-movement rule, but it's why the
  Horse Archer shuffles.

### Enemy caravans: solo strength and pair synergy (2026-10-22)

The player's full party (three heroes and the camel) against each stage-1
caravan (one hero, two wolves) and each stage-2 caravan (two heroes, a
wolf), production rules and AI on both sides, 400 fights each (seeds 1000
onward, each its own map). Same-hero pairs never happen in a run (the
stage picks distinct heroes); they are here as a reference, so a mixed pair
can be compared with its two doubles. "Heroes lost" is the player heroes
dead at the end, per finished fight. Experiments file:
`scripts/balance/experiments/caravans.mjs`.

| Enemy caravan | Player wins | Heroes lost | Player's losses: party / camel | Unfinished |
|---|---:|---:|---|---:|
| Grappler + 2 wolves | 99.7% | 0.28 | 0 / 1 | 0.8% |
| Horse Archer + 2 wolves | 99.7% | 0.34 | 1 / 0 | 0.3% |
| Storm Caller + 2 wolves | 98.3% | 0.47 | 7 / 0 | 0% |
| Grappler + Horse Archer + wolf | 93.8% | 0.78 | 17 / 7 | 2.8% |
| Grappler + Storm Caller + wolf | 84.5% | 1.02 | 60 / 2 | 0% |
| Horse Archer + Storm Caller + wolf | 82.8% | 1.11 | 63 / 4 | 2.8% |
| *Grappler ×2 + wolf* | 98.2% | 0.64 | 7 / 0 | 0.8% |
| *Horse Archer ×2 + wolf* | 96.1% | 0.68 | 12 / 3 | 2.8% |
| *Storm Caller ×2 + wolf* | 73.1% | 1.41 | 106 / 1 | 0.5% |
| All three, no wolves (stage 3) | 62.5% | 1.70 | 128 / 18 | 2.8% |

- **Stage 1 is nearly unlosable** whichever hero comes (98–100%), so win
  rate can't rank the heroes there; attrition can. The Storm Caller costs
  the player most (0.47 heroes, against 0.28 and 0.34), and it is the only
  stage-1 enemy that wins a few fights.
- **The Storm Caller is the strongest enemy hero by a wide margin.** Every
  caravan with it is 10–25 points harder than one without, and two of them
  beat any mixed pair. Hail looks like the cause: the player's Horse Archer
  (300 health) survives 54–58% of fights against a mixed pair with a Storm
  Caller and 35% against two, against 67–96% in caravans without one.
- **Synergy is small.** Against the average of its two doubles, the
  Grappler and Horse Archer together lose the player 3.4 points more fights
  (6.2% against 2.9%) and 0.12 more heroes: the one pair clearly worth more
  than its parts (perhaps the Grappler's body screening the Horse Archer; not
  checked).
  Pairs with the Storm Caller are about additive (losses +1.1 and +1.8
  points, heroes lost +0.0 and +0.07, inside noise).
- **Stage 2's difficulty depends on the draw**: 94% if the Storm Caller
  isn't picked, 83–85% if it is (two runs in three).
- **The camel favours the player in the mirror.** Three heroes each, the
  player wins 62.5%; 22 of 243 wins are the camel reaching the exit.
- One standard error is about ±1.2 points on win rates near 95% and ±2
  near 80%.

**Hail nerfed to 40 (2026-10-22; was 50, 60 at the Storm Caller's
power).** The same caravans, player win % and heroes lost per fight:

| Enemy caravan | Hail 50 | **Hail 40** | Hail 35 |
|---|---|---|---|
| Grappler + 2 wolves | 99.7%, 0.28 | 99.5%, 0.32 | 100%, 0.31 |
| Horse Archer + 2 wolves | 99.7%, 0.34 | 98.0%, 0.43 | 99.0%, 0.50 |
| Storm Caller + 2 wolves | 98.3%, 0.47 | 98.5%, 0.38 | 99.5%, 0.35 |
| Grappler + Horse Archer + wolf | 93.8%, 0.78 | 93.0%, 0.84 | 92.7%, 0.90 |
| Grappler + Storm Caller + wolf | 84.5%, 1.02 | 91.1%, 0.85 | 92.4%, 0.76 |
| Horse Archer + Storm Caller + wolf | 82.8%, 1.11 | 87.0%, 1.00 | 83.9%, 1.06 |
| *Grappler ×2 + wolf* | 98.2%, 0.64 | 97.5%, 0.68 | 97.0%, 0.72 |
| *Horse Archer ×2 + wolf* | 96.1%, 0.68 | 94.8%, 0.81 | 95.1%, 0.88 |
| *Storm Caller ×2 + wolf* | 73.1%, 1.41 | 83.0%, 1.10 | 91.2%, 0.84 |
| All three (unfinished) | 62.5%, 1.70 (2.8%) | 64.5%, 1.65 (4.3%) | 60.0%, 1.68 (10%) |

At 40 the stage-2 spread narrows from 83–94% to 87–93%, and the Storm
Caller stops being the hardest solo enemy (0.38 heroes lost, between the
Grappler's and the Horse Archer's). Two Storm Callers are still the hardest
double (83%), but no longer by 23 points. At 35 the Storm Caller is the
weakest enemy hero, and a tenth of mirror fights go unfinished: Hail is
also the side's damage, so cutting it lengthens fights. Unfinished fights
rise a little at 40 (0.5 to 2 points per caravan).

## Proposed tuning

**Applied 2026-10-20: tunings 1 to 3** (the package below without its Fog
change). Measured under the production rules afterwards, over 400 fights:
4.3% unfinished (6.8% before), median 48 actions and 72 slots; a side
without Sunlight wins 44.4%, without Volley 43.9%, without Fog 55.0%
(Fog still needs tuning 5). Storm Caller turns: Hail 31%, Sunlight 29%,
moves 25%, Freeze 9%, Fog 6%.

**Applied 2026-10-20: AI scoring in damage** (principle 4). The AI's flat
points for Vulnerable (2 per %, whatever its duration), Immobilized (2 a
slot) and fog (`fogShield`, `fogBlind`) are replaced by damage: each
side's pressure is its units' best basic hit over the slots a typical
turn takes. Vulnerable is worth its share of the other side's pressure
over the slots it lasts (capped at 20); Immobilized the share of the
unit's own pressure it loses (0.1 for a ranged or area attacker, 0.4 for
melee); standing Obscured the ranged hits it halves on the unit until it
can move. Two Freeze-related fixes: a charge is scored as missing the
units whose cards come before it lands (they step out), and the threat
model reads an enemy's charge with its own damage and area (every charge
was read as a Volley). Measured, same seeds:

| | Before | After |
|---|---:|---:|
| Unfinished (800 fights) | 3.4% | 4.9% |
| Side without Volley wins | 43.9% | **42.8%** |
| Side without Sunlight wins | 44.4% | 41.8% |
| Side without Fog wins | 55.0% | **50.1%** (no longer a trap; cast on 0.5% of turns) |
| Side without Freeze wins | 53.5% | 53.2% (unchanged) |
| Side without Pin / Dash wins | 48.7% / 50.6% | 50.3% / 48.4% |

Pricing the hits a ranged unit loses standing in fog was tried and
dropped: the Horse Archer shuffled out of every fog and sandstorm hex (20.5
turns a fight instead of 15) and 6.4% of fights went unfinished. Without
the charge-dodge assumption, unfinished fights fall to 2.8% but Volley is
worth nothing (50.3%); it is kept, since the stalls are the kind a
guaranteed end settles (tuning 8). A player request costs a mean 3.6 ms
locally (3.4 before).

Freeze is not an AI problem: honestly priced, it hits 0.8 enemies a cast
for 60 damage plus its statuses, and the AI now casts it less (0.57 times
a fight per Storm Caller, from 0.75) without changing its worth. Its
redesign (tuning 4) stands: the strongest candidate is a charge that
**follows a unit** (3.7 allows it), so it can't be stepped out of and is
answered by pushing or killing the caster instead.

Ordered by value. The **package** (tunings 1 to 3 together) measured:
2.5% unfinished (6.8% today); median 59 actions and 86 slots (53 and
84); no ability above 52% except Freeze; the Storm Caller's turns spread
across Sunlight 27%, Hail 27%, Fog 20% and moves 18%.

1. **AI fog weights: `AI.fogShield` 72,000 → 24,000, `AI.fogBlind` 300
   → 100.** An AI fix with no rule change, and the biggest single
   improvement: Fog stops being a trap, stalls drop, and fights shorten
   (53 → 44 actions). Better still, value Fog by the damage it actually
   prevents (see principle 4).
2. **Sunlight heal 35 → 50** (52 → 75 healed, quick). It becomes a real
   choice (41% without it) and stalls don't return. The heal nerf on
   2026-10-20 was made while Fog spam was inflating stalls.
3. **Volley and Freeze: charge 40 → 20, recovery 100 → 60.** Volley goes
   from costing games to slightly positive. Fog at cost 60 and radius 2
   stops costing games but still adds nothing.
4. **Freeze: redesign, or study individual fights.** No number tried made
   it pay (see above). Settled 2026-10-22 by damage 120 (instant, as below):
   a side without it wins 43%.
   **Charge time, measured 2026-10-20** (new AI, Pin as applied; 800
   fights for unfinished, 400 per ablation):

   | Volley / Freeze | Unfinished | Side without Volley wins | Side without Freeze wins |
   |---|---:|---:|---:|
   | Both charged (charge 20, recovery 60) | 5.4% | 42.4% | 52.0% |
   | **Freeze instant (cost 100), Volley charged** | 4.1% | 42.6% | **48.7%** |
   | Both instant, cost 100 | 3.0% | **23.7%** | 46.3% |
   | Both instant, cost 80 | 3.0% | 24.2% | 47.1% |
   | Both instant, Volley base damage 130 | | 34.6% | |

   Charging is what made Freeze miss. Instant, it pays. An instant Volley
   becomes nearly as decisive as the Bow, even at 130 damage. Proposed:
   **Freeze instant at cost 100, Volley stays charged** (Freeze applied
   2026-10-20). Both ultimates
   then sit in the 40–48% band, and Volley, an arcing rain of arrows,
   keeps the game's one charged, answerable threat (3.7).
   Volley's charge is 1 slot at the Horse Archer's speed, so little can answer
   it. A longer charge at the same total (charge 40, recovery 40) was
   tried: a side without Volley then wins 48.0% (42.6% at charge 20) and
   5.6% of fights go unfinished (4.1%). Volley stays at charge 20.
**Applied 2026-10-21: Sunlight clears hail and fog from its target's
hex** (that hex only, so the effect reads as one space). Measured with the
camel in play, 400 fights each: a side without Sunlight wins 42.4%
(48.2% before), without Hail 43.9% (37.6%), without Fog 48.8% (51.5%);
fights unchanged in length (51 actions). Hail keeps its place but now
has an answer. A radius-1 clear around the target was stronger (41.3%)
but mixed effects across spaces; an area heal made fights 16–32% longer
and made Hail worthless (50.3% without it).

**Applied 2026-10-21: Leap replaces Dash** (owner): exactly 2 hexes in
a straight line, over whatever is in the hex between, cost 20. Dash went
up to 3 in a line, stopped by ruins and enemies, at 40, and read as a
cheaper walk. Measured with the camel in play, 400 fights each:

| Version | Side without it wins | Share of the Horse Archer's turns | Slots (Horse Archer) |
|---|---:|---:|---:|
| Dash (up to 3, cost 40) | 45.1% | 16.5% | 3 |
| **Leap, cost 20** | **40.3%** | 33% | 1 |
| Leap, cost 30 | 48.8% | 24% | 2 |
| Leap, cost 40 | 50.8% | 9% | 3 |
| Leap over up to 2 spaces, cost 40 | 46.3% | 18% | 3 |

A short hop only pays when it's cheap: at the Horse Archer's speed, 20 and
25 cost 1 slot, 30 costs 2. Its share of turns is above a situational
ability's band; it mostly replaces walking (9.6 turns a fight against
8.9), so watch it rather than tune it now.
As shipped, with Sunlight clearing hail and fog too, a side without Leap
wins 44.8%, and Leap is a third of the Horse Archer's turns.

**Measured 2026-10-21, not applied: a step before the Bow or Pin.** Each
was added as an extra option beside the ability (step one hex, then
fire, or step next to a unit, then pin it), so a side without the option
shows what the step is worth. 400 fights each:

| Option | Cost | Side without it wins | Note |
|---|---:|---:|---|
| Step, then fire | 100 | **29.0%** | 39% of the Horse Archer's turns; fights 54 → 44 actions |
| Step, then fire | 120 | 34.8% | |
| Step, then fire | **150 (slow)** | **43.0%** | 20% of its turns; 7.1 Horse Archer turns a fight (10.0 today) |
| Step, then fire | 180 | 50.0% | |
| Step, then pin | 100 | 47.0% | Grappler survival 34.5% → 29.1% |
| Step, then pin | 120 | 52.8% | |

Fog, three identities with the current AI (which prices fog only as
halving ranged hits, so it may undervalue the others): fog blocks arrows
51.0%, fog hides its units from shots beyond the next hex 51.3% (50.0%
at cost 60). Without Fog in the kit at all, fights are unchanged (53
actions; 54 with it) and the Storm Caller's turns go to Hail and
Sunlight.

**Measured 2026-10-21, not applied: Obscured that blocks sight.** A unit
on the hex can't be targeted by the Bow or Sunlight, and arrows can't fly
through it; the AI's scoring and threat model were changed to match.
400 fights each:

| Rule | Side without Fog wins | Fog's share of the Storm Caller's turns | Actions per fight |
|---|---:|---:|---:|
| Today (fog halves ranged hits) | 51.3% | 1.7% | 54 |
| Fog blocks sight | **55.5%** | 12.9% | 62 |
| Fog blocks sight, cost 60 | **57.3%** | 28.1% | 73 |
| Fog and sandstorm block sight | 48.6% | 11.8% | 61 |

Fog gets cast, but it loses its side games and makes fights 15–35%
longer: it blocks its own side's arrows and heals as well as the
enemy's, which the AI's fog value doesn't count. With sandstorm blocking
too it's about even, still with longer fights.

**Applied 2026-10-21 (owner): Fog removed; Pin may step first.** The
Storm Caller's kit is Sunlight, Hail and Freeze. Pin may step one hex,
to a free hex next to its target, at the same cost. Measured with both
in, 400 fights each: a side without Pin wins 50.0%, without Sunlight
40.8%, without the Bow 7.5%; 53 actions a fight.

**Applied 2026-10-22 (owner): Pin melee only, Crushed 10; Lunge replaces
Rampage.** The Grappler's ultimate is now Lunge: a unit within 3,
after a bound of up to 2 hexes to a free hex beside it, takes base 100
and is pinned as by Pin, with no Vulnerable. Measured first with a
prototype, 400 fights a row (win rate of the side without the ability):

| Variant | Without the ultimate | Without Pin |
|---|---:|---:|
| Rampage; Pin with its step (2026-10-21) | 44.8% | 50.0% |
| Rampage; Pin melee only | 47.3% | 50.4% |
| Lunge reach 2, no damage, Vulnerable 50% | 47.2% | 48.7% |
| Lunge reach 3, no damage, Vulnerable 50% | 46.4% | |
| Lunge reach 2, damage 100, Vulnerable 50% | 44.9% | |
| Lunge reach 2, damage 160, Vulnerable 50% | 42.6% | |
| Lunge reach 2, Vulnerable 50%; Pin at quick cost (60) | | 49.4% |
| Lunge reach 2, Vulnerable 50%; Pin Crushed 10 | | 46.7% |
| **As built:** Lunge reach 3, damage 100, no Vulnerable; Pin Crushed 10 | **46.3%** | **44.9%** |

Pin's step made no measurable difference, and a cheaper Pin was used more
without winning more; its crush damage is what moved it. As built, Pin
is worth about as much as Throw (a side without Throw wins 44.5%) and is
31% of the Grappler's turns (Throw 18%, Lunge 8.8%); Lunge is a little
under Rampage, within noise. 3.5% of fights unfinished, 54 actions a
fight; the Grappler survives 29% of fights.

**Applied 2026-10-22 (owner): Freeze base damage 60 → 120.** Measured
under the production rules first, 400 fights a row (win rate of the side
without Freeze; two seed ranges where shown):

| Variant | Without Freeze |
|---|---:|
| Damage 60 (as it was) | 48.4% / 47.7% |
| No friendly fire | 46.8% |
| No Immobilize | 51.3% |
| No friendly fire, no Immobilize | 49.2% |
| No friendly fire, radius 2 | 43.4% |
| No friendly fire, quick (60) | 43.2% |
| No friendly fire, damage 120 | 38.8% |
| Damage 100 | 46.2% / 46.0% |
| **Damage 120 (as built)** | **42.8% / 43.8%** |
| Push 10 instead of Immobilize and Vulnerable, damage 60 | 41.2% / 44.6% |
| The same, enemies only | 39.9% / 41.0% |
| The same, enemies only, no damage | 48.8% |

At 60 Freeze no longer cost games but added about 2 points; none of its
statuses was worth much on its own (the Bow and the area abilities don't
need to move, and Vulnerable covers about two enemy turns). At 120, with
friendly fire kept, it sits in the ultimate band; 3–4% of fights
unfinished, 58 actions. Pushing the targets' cards (principle 11) measured
as well but wasn't chosen. Freeze is still cast only about 0.4 times a
fight per Storm Caller (4% of its turns): under the ultimate's usage band.

**Measured, then applied 2026-10-21 (owner): sandstorm that blocks sight** (Fog gone): a unit
in it can't be targeted by the Bow or Sunlight, and arrows can't fly
through it. Fights the same length (54 actions, 53 without), the Bow a
little less dominant (a side without it wins 14.1%, 7.5% without the
rule; its damage −7%), Sunlight unchanged (40.3%).

5. **Fog needs a job.** With one ranged attacker, which can pick another
   lane, halving ranged damage rarely matters. Tried after tunings 1 to 3:
   an arrow can't target a unit in or behind fog, so fog blocks a lane
   outright. A side without Fog then wins 52.9% (55.0% without the
   change): better, but not yet worth having. The AI still values fog by
   its flat weights, not by the arrows it blocks, so value it by the bow
   damage it stops (principle 4) before judging the rule.
6. **Horse Archer click load.** Two candidates, both untested: the bow hits
   any unit in a range (5 or 6) with line of fire, not only six lanes; or
   a move-and-shoot ability (a "Parthian shot", 120 cost) replaces Dash.
   Either gives fewer, more meaningful turns.
7. **The Grappler as a tank.** It needs a reason to be hit or to hold
   ground. Tried after tunings 1 to 3: **Pin that doesn't Immobilize the
   Grappler itself** (the pin still breaks if the two are parted). A side
   without Pin then wins 44.8% (about 50% before): Pin becomes worth having,
   at no cost in stalls (3.5%). **Applied 2026-10-20:** the Grappler
   stays free, and moving away releases the target. A zone of control is
   untested.
8. **Stalls still need a guaranteed end.** Tuning brought them to 2.5%,
   not zero. Decided (owner, 2026-10-21): the caravan's camel, whose walk
   to the exit ends a fight ([camel.md](camel.md)); built 2026-10-21, and
   over 200 AI-vs-AI fights none went unfinished.

## The Vanguard (2026-10-22)

The fourth hero, measured before it joined the roster. Ablation as above
(`scripts/balance/ablate.mjs`), 400 fights an experiment, about ±2.5
points. "Vanguard team": the Vanguard, the Horse Archer and the Storm Caller,
against the prototype party (the Grappler in its place). Experiments:
`scripts/balance/experiments/modao.mjs`, `modao-tuning.mjs`,
`modao-tuning-2.mjs`; results in `work/modao-v*.json` (not committed).

| Round | Change | Vanguard team wins | Side without… wins | Mirror unfinished | Vanguard's turns |
|---|---|---|---|---|---|
| 1 | First kit: Challenge quick, Barrier 80 for 16 slots; Reap a 3-hex sweep, base 70, Push 2; Advance charged | 44.2% | Challenge 32.2%, Reap 44%, Advance 50.1% | 7% | Challenge 57%, move 38%, Reap 2% |
| 1 | High health (+120) | | 51.9% (no effect) | | |
| 2 | Challenge typical cost, Barrier 10 slots; Reap base 85, Push 3; Advance instant | 36.2% | Challenge 46.4%, Reap 21%, Advance 45.2% | 2.5% | move 78%, Reap 13%, Challenge 3% |
| 3 | Round 2 with Challenge quick, Barrier 6 slots | 40.8% | Challenge 38.9% | 2.5% | move 50%, Challenge 40%, Reap 6% |
| 3 | Challenge cost 80, Barrier 10 slots | 37.9% | Challenge 42.7% | 1.5% | move 68%, Challenge 19%, Reap 9% |
| 3 | Round 3's first, speed 15 | 46.2% | Challenge 40.9% | 3% | move 48%, Challenge 42%, Reap 6% |
| 4 | Reap base 100 (cancelled after two runs) | 45.1% | | 3.5% | |

- **A Barrier refreshed every turn stalls fights.** At 16 slots, longer
  than the Vanguard's turn, it absorbed about 600 damage per Vanguard per
  fight, more than its 420 health. At 6 slots it absorbs about 200.
- **Health doesn't matter while the Barrier does:** Medium health stays.
- **A charged ultimate needs a way to hold its targets:** Taunt didn't
  keep enemies in Advance's area. Instant, it pulls its weight.
- **A slow melee hero walks.** At speed 10 the Vanguard spent 40–78% of its
  turns moving; speed 15 lifted its team by 5 points. The owner keeps it
  slow (2026-10-22), so Reap became a 2-hex line (reach instead of width)
  to attack from further. **Built for playtesting, not measured:** speed
  10, Challenge quick with Barrier 80 for 6 slots, Reap a line of 2 at
  base 70 and Push 2, Advance instant.

**After the first playtest (owner, 2026-10-22).** Hold the Line (passive),
Reap a cone of 4 with Push 3, Advance a charge of up to 3 then strike,
Barrier 40. Same team and method, 400 fights an experiment, against the
kit built for playtesting above (a worktree of the commit before);
`scripts/balance/experiments/modao-playtest.mjs`, results in
`work/modao-playtest-*.json` (not committed). Hold the Line acts on the
other side's turns, so a one-sided ban can't ablate it.

| | Playtest kit | Revised kit |
|---|---|---|
| Vanguard team against the prototype party | 40.7% | 46.9% |
| Side without Reap / Challenge / Advance wins | 42% / 37.8% / 46.3% | 36% / 35.6% / 45.1% |
| Mirror unfinished | 5.5% | 3% |
| Mirror median actions | 87 | 62 |
| Vanguard's turns: move, Challenge, Reap, Advance | 58%, 34%, 4%, 4% | 56%, 31%, 8%, 5% |
| Damage a fight: Reap, Advance, Hold the Line | 104, 190, — | 184, 207, 33 |
| Barrier absorbed a fight | 455 | 333 |

- **Reap now pulls its weight:** used twice as often, nearly twice the
  damage, and a side without it falls from 42% to 36%.
- **Advance is still the weakest part** (a side without it wins 45%):
  the charge helps, but it is still used once in about two fights.
- **Hold the Line is small in the AI's hands** (33 damage a fight): the
  AI prices the blow, so it mostly stays put rather than walk away. Its
  worth is in that deterrence, which playtesting has to judge.
- **The Vanguard still walks on over half its turns** at speed 10.

## The pared-back rules (2026-10-23)

Measured on the rules pared back for balancing (README, owner
2026-10-22): kits Bow; Hail (base 40 and Push 5 landing, 20 slots, base
20 to a unit starting its turn in it); Grapple (reach 2 with a step in,
base 60, pinned while adjacent) and Throw (beside the Grappler), with
Inevitable; moves of at most 3; six ruins, no quicksand or sandstorm;
Temee walking itself to the one exit. Production AI on both sides,
`scripts/balance/ablate.mjs` and `mirror.mjs`, seeds from 1000; results in
`work/pared-*.json` (not committed). No fight went unfinished at 400
actions where a camel was present.

**What each ability is worth** (`experiments/pared.mjs`, 800 fights each,
the three heroes and a camel on each side; the share of finished fights
the side without it wins):

| Removed | Side without it wins | Note |
|---|---:|---|
| (nothing) | 50% | median 55 actions |
| Bow | 3.4% | |
| Hail | 1.9% | the most damage and kills of any ability |
| Grapple | 22.6% | |
| Throw | 36.6% | |

Per fight (control): Hail 1,094 damage and 2.1 kills, Bow 930 and 1.0,
Grapple 306 and 0.5, Throw 269 and 0.5. Hail's damage is counted against
the enemy whoever it hits, so its friendly fire is hidden. (The first
run showed 184 of the Bow's damage as friendly fire: enemy arrows hitting
Temee, whose log name has no "Your", were miscounted. Fixed in
`ablate.ts` 2026-10-23; over 60 fights the AI shot 401 arrows, none at
its own side, 92 of the enemy's at Temee.) Each hero spends 52–58% of its turns moving; the Storm
Caller casts Hail on 48% of its turns, the Grappler grapples on 28% and
throws on 13%. Survival: Storm Caller 47%, Grappler 29%, Horse Archer 20%.

**Stage enemies against the full party** (`experiments/caravans.mjs`, 400
fights each; lower is a stronger enemy):

| Enemy | Player wins | Median actions |
|---|---:|---:|
| Grappler and two wolves | 100% | 40 |
| Horse Archer and two wolves | 99.8% | 40 |
| Storm Caller and two wolves | 98.3% | 44 |
| Grappler, Horse Archer, wolf | 97.3% | 44 |
| Horse Archer, Storm Caller, wolf | 87.3% | 47 |
| Grappler, Storm Caller, wolf | 86.5% | 54 |
| Two Storm Callers, wolf | 71.3% | 59 |
| All three heroes | 63.8% | 55 |

Fights end almost always by combat: in the all-three stage the player won
231 by beating the enemy and 24 by Temee reaching the exit, lost 140 by
the party falling and only 5 by Temee dying (98.8% of camels survive).
Fights last a median of 102 slots, short of the ~180 Temee needs.

**Stats** (`experiments/stats.mjs`, 400 fights each; the side with the
extra wins):

| +10 / +60 health | Speed | Defence | Power | Health |
|---|---:|---:|---:|---:|
| Grappler | 60.8% | 58.0% | 56.8% | 56.0% |
| Horse Archer | 49.3% | 61.5% | 58.3% | 61.0% |
| Storm Caller | 66.3% | 65.5% | 60.0% | 57.0% |

**Mirror matches** (no camel, 500 pairs): player side 50.7% (47.3–54.0),
first mover 51.4%: no side bias. 16.5% unfinished at 400 actions, with
nothing to end a stall.

**Reading.** Hail carries the game: with no damage of their own outside
it, the side losing it almost never wins, and two Storm Callers are the
strongest pair. Throw adds least. The Horse Archer gains nothing from +10
speed (its track steps don't change at that step) but dies first. Temee
is rarely attacked and rarely decides a fight, so the race to the exit
does little at these lengths.

### Scaling Hail down (2026-10-23)

`experiments/hail-tuning.mjs`, 400 fights each, the full party against
two Storm Callers and a wolf (Hail's best enemy) and against all three
heroes (stage 3). The player's win rate rises as Hail weakens; for
reference, two Horse Archers and a wolf lose 95.8% of the time, two
Grapplers and a wolf 100%.

| Hail (base values) | vs two Storm Callers | vs all three | Temee out, of 400 (all three) | Unfinished (all three) |
|---|---:|---:|---:|---:|
| Current: land 40, linger 20, 20 slots, Push 5, range 3 | 71.3% | 63.8% | 24 | 0% |
| Linger 10 | 88.0% | 62.8% | 44 | 0% |
| Linger 0 | 82.8% | 66.3% | 41 | 0% |
| 10 slots | 75.8% | 63.5% | 20 | 0% |
| Push 3 | 72.5% | 66.3% | 30 | 0% |
| Range 2 | 78.3% | 63.7% | 40 | 0.3% |
| **Land 20** | **98.8%** | **76.4%** | **112** | 2.5% |
| Land 20, 10 slots | 99.5% | 77.1% | 102 | 3.0% |
| Land 20, linger 10 | 99.8% | 81.4% | 118 | 3.3% |
| Land 0 | 100% | 85.3% | 159 | 1.3% |

The damage on landing is what makes Hail strong: halving it does more
than removing everything else that was tried. Lingering, duration,
Push and range each move the two-Storm-Caller enemy by under 17 points
and stage 3 by under 3. With landing damage 20, two Storm Callers are
about as strong as two of either other hero, stage 3 gets easier, and
Temee reaching the exit wins over a quarter of stage-3 fights instead of
6%, at the cost of a few fights going unfinished. Landing damage 30 is
untried.

### How much Push decides (2026-10-23)

Hail is the only source of Push in the pared-back kits. With Hail's
landing damage at 20, the full party played each stage's enemy
(`stageEnemies`) on 150 seeds a stage, 450 fights per variant, production
AI on both sides: as built, with Push off for both sides, and with it off
for one side only (that side's Hail still lands and lingers, but its
cards don't move; each side's search plays by its own rule). A one-off
script, not committed.

| Player wins | Stage 1 | Stage 2 | Stage 3 | All |
|---|---:|---:|---:|---:|
| As built | 100% | 96.7% | 77.0% | 91.3% |
| No Push for anyone | 95.3% | 90.7% | 74.7% | 86.9% |
| Player without Push | 94.7% | 82.0% | 43.0% | 73.3% |
| Enemy without Push | 100% | 98.7% | 95.3% | 98.0% |

- Push happens in every fight: 9.4 cards pushed a fight, 49 slots in
  all (about 5 each), more as stages grow (6.6, 9.6, 12.0 cards).
- Turning it off for everyone changes the result of 16% of fights (73 of
  450; 7, 17 and 49 by stage). That counts fights that only diverge by
  chance, so it is an upper bound on Push deciding them.
- Its value is clearest one-sided: in stage 3, a party without Push
  against an enemy with it wins 43% instead of 77% (34 points), and an
  enemy without it loses 95% instead of 77% (18 points). In stages 1 and
  2 it is worth 5–15 points to the player.

## The 2026-10-23 rework

The owner's rework ([keywords.md](keywords.md), [timeline.md](timeline.md),
[roster.md](roster.md)): small whole-number stats, health (1 + defence) × 2,
damage exactly the user's power, Temee pacing the track (one turn a round
for everyone), Hail Immobilizing one space, Grapple Stunning, Throw
Moving. Measured with `scripts/balance/ablate.mjs`, the production AI on
both sides (its weights rescaled to the new health), 200 fights each,
seeds from 1000.

**Each ability removed from one side** (`experiments/pared.mjs`; 50% means
it adds nothing):

| Experiment | Modified side wins | Unfinished | Median actions |
|---|---:|---:|---:|
| control | 50% | 4% | 52 |
| no Bow | 22.3% | 1.5% | 49 |
| no Hail | 34% | 0% | 53 |
| no Grapple | 6.2% | 2.5% | 50 |
| no Throw | 50% | 4% | 52 |

In the control fights (the player's side also played by the AI): the
player's side won 66.7% of finished fights (enemies beaten 58, Temee out
70, Temee killed 32, party killed 32 of 192 finished); a median 254 slots,
about 12 of Temee's rounds. Share of each hero's turns: the Grappler
Grapples on 69%, walks on 27% and Throws on 3%; the Horse Archer shoots on 41%,
walks on 36% and Holds on 23% (nothing in its lanes); the Storm Caller
hails on 81%. Per fight, the Bow dealt 15.6 damage and Grapple 10.9;
kills were Grapple 1.44, Bow 1.35, Throw 0.01.

- **Grapple is the strongest ability in the game.** Its Stun takes away
  every turn of the grappled unit until the Grappler is damaged, Stunned
  or moved apart, and the AI rarely breaks it: a side without it wins 6%.
- **Throw is a trap:** it gives up a held Stun (when it lands away) for 1
  damage. The AI almost never takes it, and removing it changes nothing.
- **Hail matters without damage**: Immobilizing a melee unit, or the
  camel, for a round is worth 16 points of win rate.

**Stage caravans** (`experiments/caravans.mjs`: the full party and Temee
against each stage's enemy):

| Enemy | Player wins |
|---|---:|
| Grappler + 2 wolves | 87% |
| Horse Archer + 2 wolves | 95.5% |
| Storm Caller + 2 wolves | 98.5% |
| Grappler + Grappler + wolf | 39% |
| Grappler + Horse Archer + wolf | 80% |
| Grappler + Storm + wolf | 84.3% |
| Horse Archer + Horse Archer + wolf | 93.5% |
| Horse Archer + Storm + wolf | 97% |
| Storm + Storm + wolf | 99.5% |
| all three | 72.5% |

Every enemy with a Grappler is the hard one; the wolves (placeholders) are
weak.

### Hail deals 1 (2026-10-23)

Rerun on the rules as of the same day's last track change (action cost
12 − 2 × speed, Temee starting last, collisions to the faster card), 200
fights each, seeds from 1000. At power 0 Hail dealt nothing, so the
Storm Caller couldn't break a grapple or finish a kill. **Owner,
2026-10-23: the Storm Caller's power is 1.**

Each variant patched both sides; the columns are the win rate of a side
without the ability. "Immobilize" makes Grapple's hold Immobilize its
target instead of Stunning it. The squeeze-free runs without Hail and
without Throw crashed in the harness (a fight with no acting unit).

| Variant | No Bow | No Hail | No Grapple | No Throw | Unfinished | Median actions |
|---|---:|---:|---:|---:|---:|---:|
| Power 0 (before) | 15.9% | 42.2% | 5.5% | 48% | 3% | 52 |
| No squeeze | 12.8% | | 6.5% | | 2% | 56 |
| Immobilize | 0.5% | 28.4% | 43.9% | 50.5% | 3% | 64 |
| **Power 1 (adopted)** | 15.5% | 13.7% | 9.5% | 50% | 0% | 41 |
| Immobilize and power 1 | 8% | 10% | 27.5% | 50.5% | 0% | 45 |

- **The Stun, not the squeeze, makes Grapple decide fights**: without
  the squeeze it is worth the same. Taking the Stun away alone hands the
  game to the Bow and gets Temee killed in half the fights.
- **Power 1 evens the three heroes**: a side without any one hero's
  ability wins 9.5–15.5%, where without Hail it won 42.2% and without
  Grapple 5.5%.
  Hail takes the most kills (1.8 a fight, the Bow 1.47, Grapple 0.35).
  Grapple stays the most valuable; limiting the Stun (to the target's
  next turn, then Immobilized) is the next step if play bears that out.
- **Throw still adds nothing** in every variant.
- In the power-1 control fights the player's side (also the AI) won 58%
  of finished fights; Temee survived 92% and was killed in 16 of 200.
  Survival: the Grappler 30.5%, the Horse Archer 37.5%, the Storm Caller
  42.5%.

**Stage caravans** (`experiments/caravans.mjs`), player wins:

| Enemy | Power 0 | Power 1 |
|---|---:|---:|
| Grappler + 2 wolves | 84.5% | 97.5% |
| Horse Archer + 2 wolves | 92.5% | 96.5% |
| Storm Caller + 2 wolves | 100% | 100% |
| Grappler + Grappler + wolf | 38.5% | 79% |
| Grappler + Horse Archer + wolf | 38.5% | 64% |
| Grappler + Storm + wolf | 78.5% | 92% |
| Horse Archer + Horse Archer + wolf | 39.5% | 60.5% |
| Horse Archer + Storm + wolf | 88.3% | 87.5% |
| Storm + Storm + wolf | 100% | 99% |
| all three | 39.8% | 54.5% |

The stages now climb: one hero and two wolves 96–100%, two heroes and a
wolf 60–99%, all three 54.5%. Under power 0, three stage-2 caravans
were as hard as stage 3.

**Stats at power 0** (`experiments/stats.mjs`, +1 to one hero of one
side): the Storm Caller's power +1 won 79% (the change adopted), the
Grappler's speed +1 71.7%; the rest 49.5–61.5%.

### New abilities (2026-10-23)

The owner's proposals, built on a branch (not merged): **Overwatch** for
the Horse Archer, **Sunlight** for the Storm Caller (heal 1, cleanse, melts
hail), and a **swap** as one of Throw's landings ([roster.md](roster.md)).
`experiments/new-abilities.mjs` and `new-abilities-tuning.mjs`, 400 fights
each, seeds from 1000, the production AI on both sides. The AI was changed
with them in one way: healing an ally is worth what the same damage to an
enemy is (it had counted at the friendly-fire penalty, 1.5, and Sunlight
took 47% of the Storm Caller's turns in a first run).

**Each ability removed from one side** (50% means it adds nothing):

| Side without | Before (today's kits) | With the new abilities |
|---|---:|---:|
| Bow | 13% | 13.1% |
| Overwatch | | **50.3%** |
| Hail | 16.3% | 35.6% |
| Sunlight | | **50.3%** |
| Grapple | 10.3% | 8.3% |
| Throw (with the swap) | 47.5% | 45.6% |
| Overwatch and Sunlight | | 49.2% |

Unfinished 0–0.8%. Control fights: median 49 actions (42 before), 91
slots (78); the player's side (the AI, with Temee) won 43.2% of finished
fights (59% before), Temee killed in 84 of 400 (48).

Share of turns: the Horse Archer shoots 46%, walks 30%, Overwatches 24% (it
no longer Holds: 15.5% before); the Storm Caller Hails 51%, Sunlights 33%,
walks 17%; the Grappler swaps on 2.6% and Throws on 8.3%. Per fight:
Overwatch fires 0.2 shots (0.3 damage, 0.1 of it on allies); Sunlight
heals 6.6.

- **Overwatch adds nothing** with this AI. It takes it on turns it would
  otherwise Hold, and with no valuation of which lane matters its lane is
  as good as arbitrary; walks route around it, and it fires 0.2 times a
  fight. Variants, each worth nothing: shooting every unit that enters
  (side without it 50.5%), the shot stopping a walk (50.5%), both (50.8%).
  Its worth needs the AI to value a lane by the walks it cuts (Temee's
  road, the enemy's way in) before tuning means anything (principle 4).
- **Sunlight at heal 1 adds nothing**, and it makes Hail matter less
  (35.6% without Hail, 16.3% before): the Storm Caller now Hails less.
  Longer fights give the enemy time to reach Temee.
- **Sunlight at heal 2** (`sun-heal2`): a side without it wins **41.7%**,
  in the 40–48% band for a non-core ability. But it takes 47% of the
  Storm Caller's turns (over the 35% that makes a non-core ability
  suspect), 1.5–1.8% of fights go unfinished, the median fight is 55
  actions, and 19.4 health is healed a fight.
- **The swap is dead** (2.6% of the Grappler's turns, under 5%), as
  expected: a second adjacent unit to grapple, or Throw's 1 damage
  somewhere else, is nearly always better. It costs no button.

**Stage caravans** (`experiments/caravans.mjs`), player wins:

| Enemy | Before | With the new abilities |
|---|---:|---:|
| Grappler + 2 wolves | 98% | 98.5% |
| Horse Archer + 2 wolves | 96.8% | 96.3% |
| Storm Caller + 2 wolves | 99.8% | 100% |
| Grappler + Grappler + wolf | 78.3% | 75.9% |
| Grappler + Horse Archer + wolf | 66.5% | 68.4% |
| Grappler + Storm + wolf | 94% | 94.7% |
| Horse Archer + Horse Archer + wolf | 64.8% | 59.5% |
| Horse Archer + Storm + wolf | 90.8% | 89.4% |
| Storm + Storm + wolf | 99% | 97.2% |
| all three | 58.3% | **42.8%** |

The last stage is harder (42.8% from 58.3%): an enemy Storm Caller's
Sunlight keeps its side standing longer. The first two stages barely
move.

#### The AI valuing Overwatch's lanes, and Fog in place of Sunlight

**The AI now values an overwatched lane** (`overwatchThreat` in
`ai.ts`) by its one shot, at the most it is worth on a hostile unit acting
before the Horse Archer's next turn that must cross it: Temee's next step into
it is a sure hit (its health weight, 2 a point); a melee unit whose every
way to a hex beside its quarry goes through the lane takes the shot or
forgoes its hit, so the lesser of the two; ranged units lose nothing.
Overwatch is still worth nothing (`experiments/ow-ai.mjs`): a side without
it wins 49% (shooting every unit that enters: 49%; the shot stopping a
walk: 50%). A sample of 30 fights shows why: of 552 Horse Archer decisions,
the lanes were worth different amounts on 27 (5%), and the bow had a
target on 435 (79%). On an 8 × 8 board with 3-space walks, one lane is
almost never the only way to a target or the exit.

**Fog** (owner, 2026-10-23), in place of Sunlight: one space within 3,
until the Storm Caller's next turn; a unit standing in it is
**Weakened** 1 (its abilities, the grapple's squeeze and an overwatch shot
included, deal 1 less, at least 0). The AI values a unit in fog at the
damage it Weakens from its next hit, if that comes before the fog lifts,
and its threat map Weakens a fogged enemy's hit. `experiments/fog.mjs`
and `fog-tuning.mjs`, 400 fights each:

| Side without | Fog, 1 space, Weaken 1 | Fog, radius 1 (owner's first proposal) | Fog, 1 space, Weaken 2 |
|---|---:|---:|---:|
| Bow | 14.5% | | |
| Overwatch | 48.1% | | |
| Hail | 29.1% | 35.4% | 40.6% |
| **Fog** | **49.9%** | **46.3%** | **55.5%** |
| Grapple | 10.6% | | |
| Throw | 44.4% | | |

| | Fog, 1 space | Radius 1 | Weaken 2 |
|---|---:|---:|---:|
| Fog's share of the Storm Caller's turns | 28% | 35% | 35% |
| Damage fog took off hits, per fight | 2.8 | 8.9 | 2.9 |
| Unfinished | 1.5% | 0.5% | 0% |
| Median slots | 78 | 86 | 91 |

- **One space at Weaken 1 adds nothing**: most hits come from units that
  can step out or shoot from elsewhere, and it takes Hail's turns.
- **Radius 1 is worth a little** (46.3%, just inside the 40–48% band):
  it takes three times the damage off, but it slows fights.
- **Weaken 2 is a trap** (55.5%): the AI casts it on a third of the Storm
  Caller's turns and loses more for it.
- With Fog in place of Sunlight, the stages are back where they were
  (`caravans.mjs`): all three heroes 56.7% (58.3% before any new ability,
  42.8% with Sunlight); the rest within 3–7 points.

#### Volley in place of Overwatch

**Volley** (owner, 2026-10-23): the Horse Archer's arrows loosed high onto one
space within 3, falling as hail does, so no line of fire is needed; the
unit there takes the Horse Archer's power (2), as the Bow's arrow does. Fog
stays in the Storm Caller's kit; the swap stays (owner). The threat map
counts every space within its reach. `experiments/volley.mjs` and
`volley-tuning.mjs`, 400 fights each.

| | As proposed (range 3) | Range 2 | 1 less damage | Range 2–3 (not adjacent) |
|---|---:|---:|---:|---:|
| Side without Volley wins | **14.5%** | 24.4% | 28% | 15% |
| Side without the Bow wins | 42.5% | 36.6% | 33% | 22.8% |
| Volley's share of the Horse Archer's turns | 29% | 17% | 47% | 29% |
| Temee killed (of 400 control fights) | **168** | 48 | 24 | 170 |
| Player wins vs Horse Archer + 2 wolves | 77.5% | 93.5% | 100% | 78.3% |
| vs Grappler + Horse Archer + wolf | 52.5% | 73.7% | 89% | 52.3% |
| vs Horse Archer + Horse Archer + wolf | **13%** | 43% | 84.8% | 13.3% |
| vs all three | 42.5% | 62.6% | 69.9% | 42% |

Before any new ability: Temee killed in 48 of 400; the stage caravans
96.8%, 66.5%, 64.8% and 58.3%. As proposed, the rest of the kit (side
without): Hail 39.1%, Fog 51.4%, Grapple 29.3% (10.3% before), Throw
48.6%; the Bow and Volley both gone, 6.3%.

- **As proposed, Volley is the strongest ability in the game**: the Bow's
  damage with none of its limits (line of fire, the first unit in the
  lane). It makes the Bow the lesser attack, takes Grapple's place as what
  decides fights, and hunts Temee over anything in the way: Temee dies in
  42% of fights. An enemy with two Horse Archers wins 87% of stage 2.
- **Range 2 fits**: Volley a strong second attack (24.4%), the Bow still
  worth having (36.6%), Volley on 17% of turns, Temee killed as often as
  before; stage 2 with two Horse Archers is the hard one (43%), the last
  stage a little easier (62.6%).
- **1 less damage** is a weak attack the AI uses on nearly half of the
  Horse Archer's turns (over the 35% that makes a non-core ability suspect),
  and every stage gets easier.
- **Not on adjacent units** changes nothing: the Horse Archer stands off
  anyway.

**Neither the Bow nor Volley on an adjacent unit** (owner's question,
2026-10-23; `experiments/outrider-no-adjacent.mjs`): `ABILITY.bow.minRange`
and `volley.minRange` 2; an adjacent unit still stops the Bow's arrow.

| | Volley range 3 | Volley range 2 | Range 2, adjacent allowed (above) |
|---|---:|---:|---:|
| Side without Volley wins | **13.4%** | 20.2% | 24.4% |
| Side without the Bow wins | 41.3% | 43.4% | 36.6% |
| Side without Grapple wins | 23.7% | 17.4% | |
| The Horse Archer's turns: Hold | **37.9%** | **42.4%** | 10.7% |
| Volley / Bow / walking | 34% / 9% / 19% | 22% / 11% / 25% | 17% / 39% / 33% |
| Temee killed (of 400) | 130 | 44 | 48 |
| Player wins vs Horse Archer + 2 wolves | 88.5% | 99% | 93.5% |
| vs Grappler + Horse Archer + wolf | 73.7% | 84.5% | 73.7% |
| vs Horse Archer + Horse Archer + wolf | 30.1% | 81% | 43% |
| vs all three | 54.4% | 62% | 62.6% |
| Unfinished | 0% | 2.5% | 0% |

- **At range 3 it is still too strong**: Volley still decides fights
  (13.4%), Temee still dies far more often (130 of 400), and two enemy
  Horse Archers still win 70% of stage 2.
- **At range 2 the numbers balance, the Horse Archer doesn't**: Volley only
  reaches the ring two spaces out, so with an enemy beside it or none at
  two the Horse Archer Holds on 42% of its turns, and the Bow, hardly used
  (11%), is worth little (43.4%). Stage 2 gets easier than before any new
  ability. Range 2 with adjacent targets allowed keeps the Horse Archer busy
  (Holds 10.7%) at similar worth.

#### The kits adopted (owner, 2026-10-23)

Volley at range 2 (adjacent included), the swap kept, the Storm Caller with
Hail alone; Overwatch, Sunlight and Fog removed with their code
([history.md](history.md)). `experiments/volley.mjs` and `caravans.mjs`,
400 fights each:

| Side without | Wins |
|---|---:|
| Bow | 38.3% |
| Volley | 23.5% |
| Hail | 18.8% |
| Grapple | 16.8% |
| Throw (with the swap) | 49.5% |
| Bow and Volley | 7.5% |

No fight unfinished; median 40 actions, 74 slots. Share of turns: the
Horse Archer shoots 38%, volleys 17%, walks 33%, Holds 13%; the Storm Caller
Hails 72%; the Grappler Grapples 36%, Throws 10%, swaps 2%. Control
fights: the player's side won 65%, Temee killed in 54 of 400. Stage
caravans, player wins: one hero and two wolves 92.8–99.5%; two heroes and
a wolf 72.7–99% but 42.5% against two Horse Archers; all three 61.3%.

#### Volley delayed, at range 3 (2026-10-23)

Owner's question: a wider Volley, range 3, whose arrows land on the marked
space at the start of the Horse Archer's next turn, on whoever stands there
then; nothing else changed (still aimed at a space with a unit on it).
Built as an experiment switch, off in play: `ABILITY.volley.delayed`. The
AI values a volley in the air at its hit, `AI.volleyDodgeShare` (0.25, a
PLACEHOLDER) of it if the unit there can walk before it lands, and its
threat map counts a delayed Volley's reach at that share.
`experiments/volley-delayed.mjs`, 400 fights each, seeds from 1000, against
the adopted kits on the same seeds:

| | Adopted (range 2, instant) | Range 3, delayed |
|---|---:|---:|
| Side without Volley wins | 23.5% | 26.2% |
| Side without the Bow wins | 38.3% | 34.8% |
| Side without Hail / Grapple / Throw wins | 18.8% / 16.8% / 49.5% | 17.8% / 20.8% / 49.5% |
| The Horse Archer's turns: Volley / Bow / walking / Hold | 17 / 38 / 33 / 13% | **44** / 25 / 30 / 1% |
| Volley damage per fight (both sides) | 5.3 | 10.5 |
| Volley kills per fight | 0.56 | 1.74 |
| Volleys that hit a unit | 100% | about 60% |
| Temee killed (of 400 control fights) | 54 | 34 |
| Player wins vs Horse Archer + 2 wolves | 92.8% | 99.5% |
| vs Grappler + Horse Archer + wolf | 72.7% | 84.7% |
| vs Horse Archer + Storm + wolf | 87.8% | 97.5% |
| vs Horse Archer + Horse Archer + wolf | **42.5%** | **81.5%** |
| vs all three | 61.3% | 67.8% |

Unfinished 0–1%.

- **The stage spike goes**: two enemy Horse Archers become an ordinary stage-2
  enemy, and Temee dies less often. A volley on a unit that can still walk
  mostly makes it step aside.
- **Volley's worth doesn't fall**: a side without it still wins only
  26.2%, a core ability's worth for a second attack, and the AI takes it
  on 44% of the Horse Archer's turns (over the 35% that makes a non-core
  ability suspect), with twice the damage and three times the kills. At
  range 3 it nearly always has a target, so it becomes the Horse Archer's main
  attack and the Bow its fallback.
- The result leans on how well the AI dodges (about 40% of volleys miss);
  a player who reliably steps out would weaken it further. Delayed at
  range 2 is the next to try.

#### Volley charged, at range 3 (2026-10-23)

Owner's follow-up: the delay above costs the Horse Archer nothing, its arrows
landing at the start of a turn it takes anyway. Made a charge: after a
delayed volley the Horse Archer's card goes `ABILITY.volley.charge` more slots
on than its action cost (6), and the arrows land at the start of that later
turn, so the target has 6 + charge slots to step out. The AI prices a
charge at its share of a turn (charge ÷ action cost × the Horse Archer's hit).
`experiments/volley-charge.mjs`, 400 fights each, seeds from 1000:

| | Adopted | Delayed, no charge | Charge 1 | Charge 2 | Charge 4 | Charge 6 |
|---|---:|---:|---:|---:|---:|---:|
| Side without Volley wins | 23.5% | 26.2% | 29.6% | 49.5% | 50.5% | 51% |
| Side without the Bow wins | 38.3% | 34.8% | 25.5% | 21.5% | 18.5% | 15.5% |
| Side without Hail / Grapple wins | 18.8 / 16.8% | 17.8 / 20.8% | 17 / 17.5% | 13.5 / 10.8% | 16 / 11% | 19 / 8.8% |
| The Horse Archer's turns on Volley | 17% | 44% | 35% | 17% | 12% | 6% |
| Volleys cast / hitting a unit, per fight | 2.7 / 2.7 | 8.6 / 5.3 | 5.7 / 4.1 | 2.5 / 1.9 | 1.7 / 1.4 | 0.9 / 0.6 |
| Temee killed (of 400) | 54 | 34 | 14 | 36 | 46 | 46 |
| Player wins vs Horse Archer + 2 wolves | 92.8% | 99.5% | 100% | 98.3% | 97.3% | 94.8% |
| vs Grappler + Horse Archer + wolf | 72.7% | 84.7% | 89% | 81.8% | 81.8% | 73.5% |
| vs Horse Archer + Storm + wolf | 87.8% | 97.5% | 95.7% | 95% | 92.3% | 87.3% |
| vs Horse Archer + Horse Archer + wolf | 42.5% | 81.5% | 85.3% | 79% | 74% | 64.8% |
| vs all three | 61.3% | 67.8% | 77.8% | 60.8% | 61% | 57.8% |

No fight unfinished (0–0.3%).

- **Any charge makes Volley worth nothing** (49.5–51%). It is a
  breakpoint (principle 7): from charge 2 the window is 8 slots, the action
  cost of every speed-2 unit, so every hero and wolf gets a turn to step
  out before the arrows land. What Volley still hits is a unit that can't
  walk (Immobilized, Stunned) or that stays; it lands about 75% of the
  time but is cast rarely.
- The Bow becomes the Horse Archer's attack again (side without it 15.5–21.5%,
  core worth), and Grapple and Hail matter more.
- The stages: two enemy Horse Archers stay easier than with the adopted
  Volley (65–79% against 42.5%), the hardest stage-2 enemy at charge 6;
  the last stage is as before.
- **Charge 1 is no middle ground**: a window of 7 still gives a speed-2
  unit a turn first on most volleys, yet Volley is worth what it was
  with no charge (29.6% against 26.2%, within the noise) and takes 35% of
  the Horse Archer's turns. The step from worth everything to worth nothing
  is between charges 1 and 2. The stages get easier at charge 1 (all
  three 77.8%, Temee killed in 14 of 400); why is not yet looked at.
- No charge tuning gives Volley a second ability's worth (40–48%): with a
  charge it needs a bigger payoff for a unit that is caught.

**Adopted (owner, 2026-10-23): charge 2 at range 3.** The switch went with
it: Volley is always charged (`ABILITY.volley` `{range: 3, charge: 2}`).
The AI search now counts a fight that ends while the track runs on to the
next decision (a volley landing, a squeeze) as a turn later than one its
option ends, so a Bow shot that kills now wins over a sure volley that
kills at the next turn. Measured as shipped (`volley.mjs`-style ablation
and the Horse Archer caravans, 400 fights each), the same as charge 2 above:
side without Volley 49.5%, without the Bow 21.5%, Hail 13.5%, Grapple
10.8%, Throw 49.3%; player wins 98.3%, 81.8%, 95%, 79% and 60.8%.

**Remeasured on the new track** (action cost 60 ÷ (speed + 5), rounded,
merged the same day: the Horse Archer's is 8, a speed-2 unit's 9, so a volley
lands 10 slots after it is cast and every unit that walks still gets a
turn first). 400 fights each, seeds from 1000:

| Side without | Wins |
|---|---:|
| Bow | 28.5% |
| **Volley** | **44%** |
| Hail | 15.8% |
| Grapple | 13.8% |
| Throw | 47.3% |
| Bow and Volley | 19.3% |

The Horse Archer's turns: walking 37%, Bow 34%, Volley 26%, Hold 3%; 3.8
volleys cast a fight, 2.5 hitting, 1 kill. Temee killed in 30 of 400.
Stage caravans, player wins: Horse Archer + 2 wolves 100%, Grappler + Horse Archer +
wolf 89.8%, Horse Archer + Storm + wolf 99%, two Horse Archers + wolf 97%, all
three 73.8%. On this track Volley is in the 40–48% band for a second
ability, on the edge of its usage band (8–25%). The stages are easier
across the board; how much of that is the track and how much is Volley
wasn't separated.

**With Sunlight in the Storm Caller's kit** (Empower 2, merged the same
day), same runs: side without Volley 47.8%, the Bow 25.8%, Hail 33.1%,
Sunlight **55.3%**, Grapple 11%, Throw 45%, the Bow and Volley 14.3%.
Volley stays (just) in its band, on 21% of the Horse Archer's turns (3.5
casts a fight, 2.5 hitting). Sunlight costs games, as measured before
it was merged. Temee killed in 56 of 400. Player wins: Horse Archer + 2
wolves 99.3%, Grappler + Horse Archer + wolf 86.3%, Horse Archer + Storm + wolf
91.8%, two Horse Archers + wolf 88.5%, all three 69.3%.

### Skirmish in place of Volley (2026-10-23)

Owner's question: replace Volley with a step of one space, then the Bow's
shot from there; the step optional, so the Horse Archer can still shoot as
he does now. A second form: the step, then a charged shot, so its target
can dodge. Built as an experiment switch, in no kit: `ABILITY.skirmish`
(`charge` a share of the action cost, as Volley's; 0 shoots at once). The
Bow stays in the kit beside it, so a side without Skirmish shows what the
step is worth and a side without both what the one merged ability would
be. Charged, the arrow flies when the charging card comes back, down the
lane it was aimed along, hitting the first unit in it then: the target
can step out, and another unit can step in. The AI values a charged shot
in the air by the first unit in its lane, at `AI.volleyDodgeShare` if that
unit can walk first, and its threat map counts the Bow's lanes from each
free space next to an Horse Archer (at the dodge share once charged).
`experiments/skirmish.mjs`, 400 fights each, seeds from 1000:

| | Today (Bow, Volley) | Step, shot at once | Step, charge ½ (4 slots) | Step, charge 1 (8 slots) |
|---|---:|---:|---:|---:|
| Side without the Bow wins | 29% | 45.3% | 33.5% | 26% |
| Side without the second ability wins | 39.5% (Volley) | **31.5%** | **42.5%** | 49.8% |
| Side without both | 18.3% | 14.8% | 14.3% | 19.3% |
| Side without Hail / Grapple / Throw / Sunlight | 26.3 / 18.5 / 47.8 / 48% | 26 / 17 / 50.3 / 49.3% | 23 / 18 / 47.5 / 49.8% | 27.8 / 13.8 / 48.8 / 53.3% |
| The Horse Archer's turns: walk / Bow / second / Hold | 35 / 29 / 30 / 6% | 33 / 22 / 31 / **14%** | 38 / 34 / 18 / 10% | 44 / 39 / 5 / 12% |
| Second ability's damage / kills a fight | 8.8 / 1.1 | 9 / 0.8 | 4.8 / 0.55 | 1.5 / 0.23 |
| Median actions / slots | 37 / 77 | 36 / 71 | 37 / 80 | 40 / 81 |
| Temee killed (of 400) | 30 | 26 | 30 | 30 |
| Player wins vs Horse Archer + 2 wolves | 99.8% | 99.3% | 100% | 98.5% |
| vs Grappler + Horse Archer + wolf | 90.3% | 82.5% | 84.5% | 79.3% |
| vs Horse Archer + Storm + wolf | 94% | 89.5% | 93.5% | 92.3% |
| vs Horse Archer + Horse Archer + wolf | 88.3% | 83.5% | 92% | 88.8% |
| vs all three | 74.8% | 69% | 69.5% | 68.5% |

No fight unfinished. Today's Volley measured stronger here (39.5%) than
when it was adopted (44%; Sunlight's merge since).

- **The step with the shot at once is a better Bow, not a second
  ability.** A side without it wins 31.5%, a core action's worth, and with
  it the plain Bow is worth almost nothing (45.3%): it is the one merged
  ability the owner described, "the Bow, with an optional step". As that,
  the Horse Archer's attack is worth a little more than the Bow and Volley
  together today (14.8% against 18.3% without), and every stage with an
  enemy Horse Archer gets 3–8 points harder. It also costs the Horse Archer a
  decision: two of his three choices are the same shot. The AI Holds more
  (14% of his turns), which isn't looked into yet (the threat map's wider
  reach may make it wary of walking).
- **The step with a charge of half a turn fits every band** (principles
  2, 3): Skirmish 42.5% and 18% of turns (a second ability's 40–48% and
  8–25%), the Bow back as the core (33.5%, 34% of turns), nothing over
  50%. It is a little weaker than today's Volley (42.5% against 39.5%),
  hits less (4.8 damage a fight against 8.8), and two enemy Horse Archers are
  no longer a hard stage 2 (92%); the last stage is a little harder.
- **A full turn's charge is dead** (49.8%, 5% of turns): a step and a shot
  12 slots later, against walking and then shooting, is no saving.
- The charged result leans on how well the AI dodges, as Volley's did; a
  player who steps out of the lane reliably would weaken it further, but
  unlike Volley, the lane also catches a unit that walks into it.

**Adopted (owner, 2026-10-23): the step with a charge of half a turn**, in
place of Volley, which was removed with its code ([history.md](history.md)).
`ABILITY.skirmish` `{charge: 0.5}`; the Horse Archer's kit is the Bow,
Skirmish and Hold. A drawn arrow in the air is `FightState.shots`, its
lane drawn on the board up to the first unit in it (`shotLane`); the AI's
threat map leaves out a Skirmish step for an Immobilized Horse Archer. The
page aims it in two taps, the space to step to and then a unit in line
from there (owner, 2026-10-23; the unit first until then). Measured as shipped, 400 fights each: side without
Skirmish 43%, the Bow 33.5%, both 14.3%, Hail 22.8%, Sunlight 49.8%,
Grapple 18%, Throw 47.5%; the Horse Archer walks 38%, Bows 34%, Skirmishes
18%, Holds 10%; Temee killed in 30 of 400. Player wins: Horse Archer + 2
wolves 100%, Grappler + Horse Archer + wolf 84.5%, Horse Archer + Storm + wolf 93.5%,
two Horse Archers + wolf 91.8%, all three 69.5%.

### Sunlight as Empower (2026-10-23)

A proposal for the Storm Caller's second ability (open question in
[roster.md](roster.md)): **Sunlight**, Empower 1 on a unit within 3 that
hits (not Temee, not a unit already Empowered) until the end of that unit's
next turn. The owner asked for three variants: the Storm Caller may target
itself (**self**: its next Hail deals 2), a Grappler's Empower adds to its
squeeze (**squeeze**), and Sunlight melts hail on its space, freeing whoever
it held, with a space of hail alone a target too (**melts**). Built for
measuring first, in no kit: the Empower rule in the rules (`empower` in
resolve.ts, ending at its unit's turn end in fight.ts), Sunlight in the
balance scripts. `experiments/sunlight.mjs`, 400 fights
each, seeds from 1000, measured with the action cost at 12 − 2 × speed
(before 60 ÷ (speed + 5), the same day).

**The AI's valuation** (`empowerGain` in ai.ts): an Empower is worth one
hit's extra damage while its unit has an enemy within reach, and stops
counting once its unit's turn begins (it is being spent). Two first tries
made it a trap, which says more about the scoring than the ability
(principle 4):
- Counted whenever the unit had it, spending it on a hit scored as losing
  it, so the bonus cancelled out: the side without Sunlight won 57%, and
  70% with self, the Storm Caller recasting on itself (972 casts in 400
  fights) for 0.9 extra damage a fight. Recasting on a unit already
  Empowered is now refused.
- Counted with no enemy in reach, it Empowered Grapplers about to walk.

**Each ability removed from one side** (modified side's wins; "today" is
the adopted kit, Hail alone):

| Side without | Today | Sunlight | + self | + squeeze | + melts | All three | Empower 2 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sunlight | | 50.3% | 49.5% | 50% | 49.8% | 50% | **57%** |
| Hail | 18.8% | 22.5% | 24% | 24.3% | 23% | 24.5% | 31.3% |
| Grapple | 16.8% | 20.3% | 20% | 19.8% | 18.5% | 19% | 20% |
| Bow | 38.3% | 41.8% | 39.8% | 42% | 41.8% | 40.8% | 42% |
| Volley | 23.5% | 23.8% | 23.8% | 23.8% | 24.8% | 24.3% | 20% |

| Control fights | Today | Sunlight | + self | + squeeze | + melts | All three | Empower 2 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Storm Caller: Hail / Sunlight | 72% / | 67% / 7% | 67% / 8% | 66% / 8% | 65% / 10% | 64% / 11% | 45% / 26% |
| Empower's damage a fight | | 0.8 | 0.8 | 0.8 | 0.9 | 0.9 | 4.1 |
| Temee killed (of 400) | 54 | 64 | 62 | 64 | 56 | 54 | **104** |

Targets, base Sunlight: the Horse Archer 66%, the Grappler 34%. Self was taken
on 8% of casts; squeeze raised the Grappler's share to 40%; melts melted
0.5 hails a fight. No fight went unfinished; medians 39–43 actions.

**Stage caravans**, player wins:

| Enemy | Today | Sunlight | + self | + squeeze | + melts | All three | Empower 2 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Horse Archer + 2 wolves | 92.8% | 93.5% | 93% | 93.5% | 93.5% | 93% | 88.5% |
| Horse Archer + Horse Archer + wolf | 42.5% | 43% | 44.5% | 43% | 43% | 44.5% | 37.8% |
| Grappler + Horse Archer + wolf | 72.7% | 73.9% | 73.4% | 74.2% | 73.9% | 73.7% | 66.2% |
| Horse Archer + Storm + wolf | 87.8% | 87.3% | 87.3% | 87.3% | 87.5% | 87.5% | 78% |
| All three | 61.3% | 62% | 61% | 62.3% | 60.3% | 60% | 56% |

- **Empower 1 for one turn is worth nothing in every variant** (49.5–50.3%,
  within the ±2.5 points of noise), on 7–11% of the Storm Caller's turns.
  A Hail (1 damage and a hold) almost always beats +1 on an ally's next
  hit; it pays only when the +1 makes a kill.
- **It still takes a little from Hail** (the side without Hail wins
  22.5–24.5%, 18.8% today): the turns it takes are Hail's.
- **None of the three variants changes that.** Self is rarely worth a
  turn (a turn now for +1 next turn); the squeeze adds a point at most to
  a grapple already deciding fights; melting is rare (0.5 a fight) and
  only keeps Temee alive a little more (56 killed of 400, 64 without it).
- **It doesn't counter the Horse Archer**: stages with enemy Horse Archers move
  within noise (two Horse Archers 43–44.5%, 42.5% today).
- **Empower 2 is a trap** (57%): it takes a quarter of the Storm Caller's
  turns (3.75 casts a fight) and Hail's from it (Hail on 45% of turns, its
  damage 6.5 a fight from 10.1), yet adds only 4.1 damage a fight, about
  1.1 of each cast's 2: the Empowered ally often has no hit on its next
  turn. Without Hail holding them, enemies reach Temee: it dies in 104 of
  400 control fights (54 today), and in 46 of 400 against the Horse Archer and
  two wolves (29 today), a caravan with no Storm Caller, so it is the
  player's own Sunlight that costs it. The AI counts the full +2 whenever
  an enemy is in reach, about twice what it delivers (principle 4).

**Adopted at Empower 2** (owner, 2026-10-23), as measured: Sunlight is in
the Storm Caller's kit (`ABILITY.sunlight` in config.ts), then with self,
melts and squeeze on (owner, the same day). That combination, at Empower 2,
wasn't measured; the AI's valuation is unchanged, so it still
misuses it.

### Sunlight as it plays, and the AI's valuation (2026-10-23)

Sunlight as adopted (owner): Empower 2, the Storm Caller may target
itself, hail melts, and an Empowered Grappler's squeeze deals its Empower
more; on the day's later rules (action cost 60 ÷ (speed + 5), Volley
charged at range 3).

**The valuation** (`empowerGain` in ai.ts), rebuilt: an Empower is worth
its extra damage on the unit's next hit if an enemy is in reach, twice
that for a Grappler that grapples (its squeeze), plus a kill's worth if
that hit kills only with it, all times `AI.empoweredShare`.
`experiments/sunlight-ai.mjs`, 400 fights each:

| Share counted | 1 | ¾ | ½ | ¼ |
|---|---:|---:|---:|---:|
| Side without Sunlight wins | 53% | 49.8% | **49.3%** | 50.3% |
| Storm Caller: Hail / Sunlight | 25% / 47% | 29% / 42% | 40% / 33% | 46% / 25% |
| Self-casts, of all casts | 37% | 37% | 27% | 22% |
| Temee killed (of 400) | 48 | 46 | **40** | 52 |

**Adopted: ½** (`AI.empoweredShare`). At 1 Sunlight is still a slight trap
and crowds Hail out; at ½ it is no longer one, the Storm Caller Hails
most, and Temee dies least. No share makes Sunlight worth anything.

**The full measurement** (`experiments/sunlight-full.mjs`, 400 fights
each): the kit as it plays against the Storm Caller with Hail alone, on the
same rules.

| Side without | Sunlight kit | Hail alone |
|---|---:|---:|
| Sunlight | 49.3% | |
| Hail | 22.5% | 15.8% |
| Grapple | 14.3% | 13.8% |
| Throw | 48.3% | 47.3% |
| Bow | 24.8% | 28.5% |
| Volley | **51.8%** | 44% |

| Control fights | Sunlight kit | Hail alone |
|---|---:|---:|
| Storm Caller: Hail / Sunlight / walk | 40% / 33% / 27% | 72% / / 27% |
| Sunlight's targets: self / Grappler / Horse Archer | 27% / 35% / 38% | |
| Empower's damage a fight; hails melted | 4.8; 0.84 | |
| Temee killed (of 400) | 40 | 30 |

**Stage caravans**, player wins:

| Enemy | Sunlight kit | Hail alone |
|---|---:|---:|
| Grappler + 2 wolves | 94% | 96.8% |
| Horse Archer + 2 wolves | 99.8% | 100% |
| Storm Caller + 2 wolves | 99.8% | 100% |
| Grappler + Grappler + wolf | 70.8% | 72.3% |
| Grappler + Horse Archer + wolf | 87% | 89.8% |
| Grappler + Storm + wolf | 89.8% | 91.8% |
| Horse Archer + Horse Archer + wolf | 92.3% | 97% |
| Horse Archer + Storm + wolf | 93.3% | 99% |
| Storm + Storm + wolf | **84.8%** | 97.8% |
| All three | 67.5% | 73.8% |

No fight unfinished; medians 31–46 actions.

- **Sunlight still adds nothing** (49.3%) and takes Hail's turns: the side
  without Hail wins 22.5% (15.8% with Hail alone).
- **It makes Volley worth nothing** (51.8%, 44% with Hail alone): an
  Empowered Horse Archer's Bow (4 damage, a kill on any 4-health unit) is
  worth more than a charged Volley. The Bow is worth more (24.8%).
- **The enemy gains more from it than the player**: every stage with an
  enemy Storm Caller is harder, most with two (84.8% from 97.8%; they
  Empower each other, a Hail then dealing 3), and the last stage falls to
  67.5% from 73.8%. With no enemy Storm Caller the stages move 1–5 points.
- **It doesn't counter the Horse Archer**: two enemy Horse Archers win more often
  (92.3% player wins, 97% with Hail alone).

### The game as it plays (2026-10-23, evening)

The whole game rechecked after Skirmish was adopted and aimed at its space
first: kits Bow, Skirmish; Hail, Sunlight (as adopted); Grapple, Throw.
`experiments/current.mjs` and `experiments/stats.mjs`, 400 fights each,
seeds from 1000; `mirror.mjs`, 500 pairs. No fight unfinished with a camel;
median 38 actions, 79 slots.

| Side without | Now | As Skirmish shipped |
|---|---:|---:|
| Bow | 35.5% | 33.5% |
| Skirmish | 44% | 43% |
| Bow and Skirmish | 15.5% | 14.3% |
| Hail | 22.8% | 22.8% |
| Sunlight | 48.8% | 49.8% |
| Grapple | 18.3% | 18% |
| Throw | 48.3% | 47.5% |

| Control fights | |
|---|---|
| Horse Archer: walk / Bow / Skirmish / Hold | 38 / 34 / 17 / 10% |
| Grappler: walk / Grapple / Throw / Hold / swap | 50 / 35 / 9 / 4 / 3% |
| Storm Caller: Hail / Sunlight / walk | 43 / 33 / 24% |
| Turns a fight: Horse Archer / Grappler / Storm Caller | 6.8 / 5.6 / 7.3 |
| Damage (kills) a fight: Bow / Hail / Skirmish / Grapple / Throw | 10.9 (1.0) / 8 (1.3) / 5.2 (0.6) / 4.9 (0.55) / 1.8 (0.4) |
| Sunlight's targets: self / Horse Archer / Grappler / Temee (melting) | 31 / 38 / 30 / 1%; Empower 5.4 damage a fight, 0.7 hails melted |
| Survival: Storm Caller / Grappler / Horse Archer; Temee killed | 44.5 / 34 / 32%; 34 of 400 |

**Stage caravans**, player wins (a stronger enemy is lower):

| Enemy | Player wins |
|---|---:|
| Horse Archer + 2 wolves | 100% |
| Storm Caller + 2 wolves | 99.5% |
| Grappler + 2 wolves | 96.8% |
| Horse Archer + Horse Archer + wolf | 95.3% |
| Horse Archer + Storm + wolf | 94.5% |
| Grappler + Storm + wolf | 87.8% |
| Storm + Storm + wolf | 86.5% |
| Grappler + Horse Archer + wolf | 83.8% |
| Grappler + Grappler + wolf | 75% |
| All three | 68.3% |

**Stats**, +1 (+2 health) on one hero of one side, the side with it wins:

| | Speed | Defence | Power | Health |
|---|---:|---:|---:|---:|
| Grappler | 61.3% | 54.5% | 51.3% | 54.5% |
| Horse Archer | 57.5% | 60% | 61.8% | 60% |
| Storm Caller | 67% | 52% | 66.5% | 52% |

**Mirror** (no camel): player side 49.6% (46.5–52.8), first mover 48.9%,
3.3% unfinished: no side bias.

- **Nothing moved since Skirmish shipped**: every ablation is within a
  point or two of its measurement then (one standard error is ±2.5).
  Against principle 12 it passes: nothing unfinished, nothing above 50%,
  every second ability at 44–49%.
- **Sunlight and Throw are worth almost nothing** (48.8%, 48.3%), at the
  top of a second ability's band. Throw is used on 9% of the Grappler's
  turns, so it costs little. Sunlight takes a third of the Storm Caller's
  (33%, near principle 3's 35% line) for a share of 1.2 points; those
  turns are Hail's.
- **Grapple is worth more than a core action** (18.3%, below the core's
  20–35%): the Grappler's kit is Grapple and little else.
- **Stage 2 is uneven.** Two Grapplers and a wolf (75%) are nearly stage
  3 (68.3%); any pair with an Horse Archer but no Grappler is a stage-1 fight
  (94–95%).
- **The Storm Caller gains most from stats**: +1 speed or power is worth
  about 17 points, its defence and health 2. The Grappler's power is worth
  nothing (51.3%; Grapple's squeeze and Throw don't scale with it much),
  its speed 11 points.

### Second abilities measured (2026-10-24)

Owner's list: candidate second abilities and changes to existing ones, each
held to principle 2 (a side without a second ability wins 40–50%) and the
owner's rule that a second ability is for variety, not a straight buff.
Built as experiments in no kit (`abilities.ts`, "Experiments"), on today's
starting kits (Grapple, Throw; Bow; Hail; no upgrades).
`experiments/second-abilities.mjs`, 1,000 fights each (one standard error
about ±1.6), seeds from 1000. A **new** ability joins its hero's kit on
both sides and one side goes without it. A **changed** ability replaces the
original on one side only (`mod.kits`): head to head, above 50% is a buff.

| New ability | Rule as built | Side without it wins | Hero's turns on it | Damage (kills) a fight |
|---|---|---:|---:|---:|
| Shove (Grappler) | Melee, Push 2, no damage | 49.6% | 1.1% | — |
| Haul (Grappler) | Pull 2 the first unit in a lane 2–3 away, no damage | 47.8% | 7.6% | — |
| Feigned Retreat (Horse Archer) | The Bow's shot at full damage, then a walk of 1–2 | **42.5%** | 12.8% | 4.7 (0.55) |
| Volley (Horse Archer) | Any space within 3, no line of fire, charged ½ (4 slots) | **41.1%** | 19.9% | 5.6 (0.78) |
| Overwatch (Horse Archer) | A lane until its next turn, the first unit entering shot | **57.9%** | 26% | 0.3 (0.02) |
| Gale (Storm Caller) | Each unit next to a space within 3 takes 1 and is Pushed 1 | **40.6%** | 21.8% | 5 (0.53), 0.3 to allies |
| Tailwind (Storm Caller) | Haste 3 on a unit within 3, once between its turns | **57.2%** | 4.9% | — |
| *Skirmish (reference)* | *Today's upgrade* | *42.8%* | *14.3%* | *4 (0.48)* |
| *Sunlight (reference)* | *Today's upgrade* | *46.7%* | *18.4%* | — |

| Changed ability | Rule as built | Head to head, side with it wins | Side without it wins (original's) | Hero's turns on it |
|---|---|---:|---:|---:|
| Hold Loose (Grapple) | Immobilized, not Stunned; holds through damage and Stuns | **39.4%** | 19% (Grapple 10.3%) | 17.8% |
| Hip Toss (Throw) | Lands within 2 of the Grappler; the grapple ends | 47.5% | 53.1% (Throw 48.7%) | 5.1% |
| Squall Line (Hail) | Hail on 3 spaces in a line, no damage | **29.4%** | 36.2% (Hail 20.1%) | 37.7% |

No fight unfinished except with Squall Line (0.4% head to head, 1.4% with
both sides on it; median 113 slots against 87). Overwatch with the AI's
lane value (`AI.watchShare`, 0.25) at 0.1 and 0.5: 56.4% and 60.6%.

- **In the band (40–50%): Feigned Retreat, Volley and Gale**, each a
  second ability's worth, used in principle 3's band (13–22% of turns),
  none above 50%. Feigned Retreat is worth about Skirmish (42.5% against
  42.8%) though as built it is the Bow plus a free walk; at full damage
  it is the Bow's best form whenever a step is wanted. Volley charged
  measures as it did at its adoption (44% then). Gale is the Storm
  Caller's strongest second ability so far, stronger than Sunlight
  (40.6% against 46.7%), and costs Hail half its turns (47.6% from 66%).
- **Shove, Haul: near nothing.** The AI seldom finds a use (Shove 1.1% of
  turns): with no collision damage and hail the only thing to push
  into, a displacement is worth only what the next turns make of it,
  past the search's horizon. A player might do more with them.
- **Overwatch and Tailwind lose games** (57.9%, 57.2%). Overwatch fires
  almost never (0.3 damage a fight): the enemy AI walks round a lane it
  sees, so the turn is lost, whatever value the AI gives a lane (56–61%);
  as in 2026-10-23's measurement, a lane on an 8 × 8 board with
  three-space walks is seldom in the way. Tailwind is a trap: used on 5%
  of turns, each a turn of Hail given up for 3 slots of an ally's.
- **Hold Loose is a nerf, not a sidegrade** (39.4% head to head): the
  held unit still acts, and Stunned's lost turn is Grapple's worth. It is
  still the Grappler's core (19% without it).
- **Hip Toss changes nothing** (47.5% head to head, 53.1% without it):
  like Throw, it is seldom worth a turn.
- **Squall Line is a big nerf** (29.4% head to head) and slows fights:
  Hail's damage, which kills (1.0 a fight) and breaks grapples, is worth
  more than two more spaces of Immobilize.

**Adopted (owner, 2026-10-24): Gale, Volley, Feigned Retreat, Haul and
Shove as upgrades** (`upgrades` in config.ts; [roster.md](roster.md)), as
measured. Hold Loose, Hip Toss, Squall Line, Tailwind and Overwatch were
removed with their code (owner, 2026-10-24; [history.md](history.md)).

### Walk 2 and the ring of hail (2026-10-24)

Asked for: less first-mover advantage and a Hail that reads at a glance.
`scripts/balance/mirror.mjs`, 300 pairs (600 fights, no camel; ±4 points
at 95%), and `ablate.mjs` for Hail's worth, 400 fights with the camel;
starting kits, seeds from 1000. The mirror runs follow the fix of that
day: until then `mirror.ts` flipped the old 8-column board, so on the
hexagon every mirrored fight stood units off the board and stalled.

Movement, Hail as it was (any space within 3):

| Variant | First mover wins | Mirror unfinished | Median actions |
|---|---:|---:|---:|
| Walk 3, Hold (as it was) | 64.4% | 10% | 40 |
| Walk 2 | 45.7% | 9.8% | 45 |
| No idle Hold (AI only) | 57.5% | 12.5% | 39 |
| Walk 2, no Hold | 43.9% | 10% | 43 |
| Walks by hero (Horse Archer straight lines up to 3, others 2) | 43.3% | 7.7% | 45 |

Hail's shape, at walk 2:

| Hail lands on | Spaces | First mover wins | Mirror unfinished | Side without Hail wins | Storm Caller's turns on Hail |
|---|---:|---:|---:|---:|---:|
| Within 3 | up to 37 | 45.7% | 9.8% | 22.3% | 65.5% |
| Within 2 | 19 | 48.8% | 21.5% | 26.5% | 56.4% |
| Straight lines up to 3 | 18 | 44.7% | 28.8% | 30.3% | 53.4% |
| **Exactly 2 away** | 12 | **48.6%** | 22.2% | **28.8%** | **46%** |

- **Walk 3 handed the fight to the first mover** (64.4%): one walk and a
  hit reached almost anything. Walk 2 leaves a middle distance and
  slightly favours the second mover (about 55%).
- **Removing Hold doesn't end stalls**: the units shuffle instead.
- **The ring reads best and measures well**: a shape round the Storm
  Caller, safe next to it and 3 or more away (the Grappler's way in);
  first mover near even; Hail still the core (28.8%, in principle 2's
  20–35%) and in principle 3's usage band (46% from 65.5%).
- **Its cost: more stalls without the camel** (22.2%) and longer fights
  (median 53 actions, from 46, with the camel). With the camel nothing
  went unfinished; a mirror or PvP mode needs an objective of its own.

**Adopted (owner, 2026-10-24): walks of at most 2, and Hail on a space
exactly 2 away** (`RULES.movementCap`, `ABILITY.hail` in config.ts).

### Hail for two turns (2026-10-25)

Asked for: whether the ring left Hail too weak, and a Hail lasting 2 of
its caster's turns to make up for it. `ablate.mjs`, 400 fights each,
starting kits, seeds from 1000, with a `turns` setting patched in:

| Hail lasts | Side without Hail wins | Without Grapple | Without the Bow | Storm Caller's turns on Hail (vs all three) | Player wins vs all three | Median actions |
|---|---:|---:|---:|---:|---:|---:|
| 1 turn (as it was) | 27.8% | 10.5% | 13.3% | 46.6% | 75.5% | 53 |
| 2 turns, a new hail replacing the last | 25.5% | 10.8% | 14.3% | 47.4% | 72% | 54 |
| 2 turns, two hails at once | 25.3% | 10.8% | 12.8% | 49.4% | 72% | 52 |

- **The ring hadn't left Hail weak**: 27.8% without it, within the core's
  20–35% (principle 2), and Hail on 46.6% of turns, at the top of the
  core's usage band.
- **Two turns changes little**, all within the ±2.5 points of 400 fights:
  the Storm Caller mostly hails again on its next turn, replacing the
  last. Doubling the hold's worth in the AI's first guess gave the same
  fights exactly: that guess only orders its search.

**Adopted (owner, 2026-10-25): Hail lasts until its caster's turn after
next, and hailing again replaces it** (`ABILITY.hail.turns`).

### The Horse Archer's straight move (2026-10-25)

Asked for: the balance after the Horse Archer's move became Longshot's shape
(any number of spaces straight along one of the six lanes, up to the first
unit, yurts or the map's edge). `ablate.mjs` with
`experiments/outrider-straight.mjs`, 400 fights each, starting kits, seeds
from 1000, the walk of 2 patched back in for comparison; `mirror.mjs`, 300
pairs (600 fights, no camel), the walk of 2 at the commit before.

| Horse Archer moves | Side without the Bow wins | Without Hail | Without Grapple | Player wins vs all three | Horse Archer survives (control) | Horse Archer's turns per fight | Longshot damage / kills per fight | First mover wins (mirror) | Mirror unfinished |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Walk 2 (as it was) | 10.5% | 27.8% | 8.3% | 70.3% | 47.8% | 10.1 | 16.6 / 1.61 | 42.4% | 22.5% |
| Straight, no cap | 21.3% | 27.8% | 10.5% | 65.8% | 36.8% | 8.0 | 13.4 / 1.14 | 41.3% | 32.2% |

- **The straight move makes the Horse Archer weaker, not stronger.** He dies
  more (survives 36.8% of fights, from 47.8%), so he gets fewer turns and
  shoots less: Longshot deals about a fifth less and kills about 30% less.
  The likely cause is lost footwork: a walk of 2 reaches the six spaces
  between the lanes, and the straight move can't, so he can't step out of
  a lane or round a unit in front of him.
- **The Bow comes into principle 2's core band**: the side without it
  wins 21.3%, inside 20–35%, from 10.5%, when the Bow was worth more than
  a core action should be. Its use is unchanged (42% of his turns, inside
  principle 3's band).
- **The fight as a whole barely moves**: the party wins 65.8% against all
  three, from 70.3% (inside the noise of 400 fights at 95%); Hail and
  Grapple are worth the same; first mover unchanged.
- **More stalls without the camel** (32.2%, from 22.5%): with the camel
  nothing went unfinished.

### The Horse Archer's AI (2026-10-25)

Asked for: an AI heuristic that plays the straight move well. The cause of
the Horse Archer's deaths: the AI's closing-in reward (`AI.perHexFromEnemy`,
0.2 a space nearer the nearest enemy) grows with the move's length. A walk
of 2 earned at most 0.4 a turn; a dash of 5 earns 1.0, more than the
threat of ending next to the Grappler costs the Horse Archer (about 0.25), so
he dashed into melee. `ablate.mjs` with `experiments/outrider-ai.mjs` and
`outrider-ai-2.mjs` (they patch switches removed once the variant was
chosen), 400 fights each, starting kits, seeds from 1000. Player-side
figures are against all three heroes.

| AI variant | Side without the Bow wins | Player wins | Temee killed | Party killed | Player's Horse Archer survives | Longshot damage / kills | Horse Archer's turns: Longshot / move / Hold |
|---|---:|---:|---:|---:|---:|---:|---|
| Walk 2, closing by spaces (before the straight move) | 10.5% | 70.3% | 76 | 43 | 63.8% | 17.2 / 1.57 | 42% / 42% / 15% |
| Closing by spaces (as it was) | 21.3% | 65.8% | 93 | 44 | 49.3% | 13.7 / 1.09 | 43% / 41% / 16% |
| Standoff 3: no reward for closing within 3 | 17.3% | 55.5% | 151 | 27 | 74.3% | 13.7 / 1.1 | 26% / 21% / 54% |
| Caution 2 (from 1) | 22.3% | 68.5% | 86 | 40 | 56.8% | 14.4 / 1.16 | 42% / 41% / 18% |
| Closing by lining up: steps onto a target's line | 17.3% | 69.8% | 109 | 12 | 91.3% | 16 / 1.33 | 32% / 31% / 38% |
| **Lining up a clear shot** | **17%** | **78%** | **68** | 20 | 76.5% | **18 / 1.51** | 45% / 40% / 15% |

Standoffs of 2 and 4 and the standoff with caution 2 measured like
standoff 3: he survives but holds, and Temee dies.

- **A standoff saves him and loses the fight**: with no reward inside 3
  spaces he holds over half his turns and Temee dies twice as often.
- **Lining up is the right measure for an archer**: Longshot has no range,
  so the distance to an enemy says nothing about a shot. On a line he
  stops dashing in, but a line with a unit in the way counted as a shot,
  so he held 38% of his turns.
- **A clear shot fixes that**: 0 with a clear lane to the target, 1 on its
  line with a unit in the way, otherwise the steps onto its nearest line.
  The best of every variant: the party wins 78% against all three, Temee
  is killed least, Longshot does the most damage, and his turns split as
  they did before.

With it (the production AI since), the starting kits: side without the Bow
wins 17%, without Hail 28.8%, without Grapple 12%. Mirror matches, 300
pairs: **first mover wins 53.5%** (41.3% before: nearer even),
33.7% unfinished without the camel (32.2%). Fights take about 30%
more CPU in the simulation; the AI-against-AI fight stays within the CPU
budget per turn (rules.test.ts).

**Adopted (2026-10-25): an archer closes in by lining up a clear shot**
(`shotGap` in ai.ts).

### Hail for two turns, rechecked (2026-10-25)

Asked for: the whole game again, in case Hail lasting 2 turns is too
strong, now that the Horse Archer moves straight and lines up a clear shot.
`ablate.mjs` with `experiments/hail-turns.mjs`, **800 fights each** (about
±1.8 points of standard error), seeds from 1000; the upgrade rows give the
Storm Caller Hail and that upgrade on both sides. `heldTurnsPerFight`
(new in `ablate.ts`) counts the turns units begin Immobilized by hail.

| | Hail 1 turn | Hail 2 turns (as built) |
|---|---:|---:|
| Side without Hail wins | 31.1% | 30.1% |
| Side without the Bow | 17.4% | 15.6% |
| Side without Grapple | 12.5% | 13.1% |
| With Sunlight: side without Sunlight / without Hail | 46.8% / 31.9% | 44.6% / 30.6% |
| With Gale: side without Gale / without Hail | 31.1% / 49% | 31.6% / 48.5% |
| Storm Caller +1 speed / +1 power | 57% / 65% | 58% / 64.5% |
| Storm Caller's turns: Hail / move / Hold | 44 / 44 / 12% | 43 / 45 / 12% |
| Hail damage (kills) a fight | 8.2 (1.19) | 8.2 (1.17) |
| Turns begun held by hail a fight: enemy / own side | 3.30 / 0 | 3.42 / 0.02 |
| Median actions; unfinished | 50; 0% | 52; 0% |

Stage caravans, player wins (the full party; lower is a stronger enemy):

| Enemy | Hail 1 turn | Hail 2 turns |
|---|---:|---:|
| Horse Archer + 2 wolves | 98.9% | 98.9% |
| Grappler + 2 wolves | 99.4% | 99.4% |
| Storm Caller + 2 wolves | 99.8% | 99.8% |
| Grappler + Grappler + wolf | 79.6% | 81.4% |
| Horse Archer + Horse Archer + wolf | 84.9% | 85.3% |
| Grappler + Horse Archer + wolf | 90.9% | 91.6% |
| Horse Archer + Storm + wolf | 96.3% | 95.6% |
| Grappler + Storm + wolf | 96.6% | 97.5% |
| Storm + Storm + wolf | 96.8% | 96.4% |
| All three | 75.9% | 76.3% |

Mirror (Hail 2 turns, 500 pairs, no camel): first mover 53.2%.

- **Hail lasting 2 turns is not too strong**: every row is within one
  standard error of 1 turn. Hail's worth (30.1%) sits in the core's
  20–35% band (principle 2), its use (43%) in principle 3's 25–45%.
- **Why it changes so little**: the Storm Caller hails again on most of its
  turns, which replaces the last hail, so the second turn rarely stands.
  Units begin only 0.12 more turns a fight held (3.42 from 3.30), and the
  Storm Caller's own side is almost never caught (0.02).
- **The second turn would matter if the Storm Caller could hail and still
  act**: with Sunlight it hails on 30% of turns, not 43%, and the hail's
  damage rises a little at 2 turns (6.3 from 5.8 a fight), still within
  noise (Sunlight 44.6% from 46.8%). Re-check Hail's duration when a kit
  gives the Storm Caller more to do between hails.
- **Not Hail's problem, but out of band**: **Gale** is far stronger than
  when it was made an upgrade (side without it 31.6%, from 40.6% on
  2026-10-24; principle 2 wants 40–50% for a second ability), and with
  Gale, Hail is worth nothing (48.5%): Gale replaces it. The Bow (15.6%)
  and Grapple (13.1%) remain worth more than a core action should
  (20–35%), as before.
- **Stage 2 is still uneven**: two Grapplers and a wolf (81.4%) are near
  stage 3 (76.3%); pairs with a Storm Caller are stage-1 fights (95–97%).
  The Storm Caller is the weakest enemy hero in every caravan, 1 or 2
  turns of Hail alike.

### The China line-up against the Steppe party (2026-10-25)

Asked for: the Chinese units (the test stage's line-up: a fox spirit, the
Vanguard and the Alchemist, starting kits and the builder's
untested numbers) against the Steppe party. `ablate.mjs` with
`experiments/china.mjs`, **400 fights each** (about ±2.5 points), seeds
from 1000. `ablate.ts` now takes an experiment's `map` (the Gobi: four or
five ruins, no mountains) and attributes Cleave's damage.

The full party (three heroes and the camel) against each enemy, player
wins (lower is a stronger enemy):

| Enemy | Map | Player wins | Heroes lost a win |
|---|---|---:|---:|
| Fox + Vanguard + Alchemist | Gobi | 100% | 0.09 |
| Fox + Vanguard + Alchemist | Steppe | 100% | 0.09 |
| Fox + Fox + Alchemist (no Vanguard) | Gobi | 100% | 0.01 |
| Fox + Vanguard + Fox (no Alchemist) | Gobi | 100% | 0.06 |
| Three foxes | Gobi | 100% | 0 |
| Horse Archer + 2 wolves (stage 1) | Steppe | 99% | 0.08 |
| All three Steppe heroes (stage 3) | Gobi | 73% | 0.57 |

Hero for hero (`mod.party`): one side has a Chinese hero in a Steppe
hero's seat, the other the three Steppe heroes, every seed from both
sides; the camel with the player. The Chinese side's share of wins:

| Swapped in | for the Grappler | for the Horse Archer | for the Storm Caller |
|---|---:|---:|---:|
| Vanguard | 38.5% | 40.5% | 52.5% |
| Alchemist | 32% | 35.3% | 40.6% |
| Vanguard and Alchemist (for the Grappler and the Storm Caller) | 27.3% | | |

- **The China line-up is a stage-1 fight**: the party wins every one and
  loses a hero in under one fight in ten, as against the Horse Archer and two
  wolves. The Gobi changes nothing (100% on both maps); the Steppe's stage
  3 played on the Gobi (73%) is as hard as on the Steppe (76%).
- **The Vanguard is the stronger of the two**, about the Storm Caller's
  equal (52.5% in its seat) and weaker than the Grappler (38.5%) and the
  Horse Archer (40.5%). It deals 5–6 damage a fight with Cleave, used on 35–40%
  of its turns, almost never on its own side (0.1–0.2 a fight). At speed 1
  it takes half the Horse Archer's turns.
- **The Alchemist is the weakest hero measured**, below every Steppe hero
  in every seat (32–41%), and the pair together loses 3 fights in 4. Elixir
  is 60–70% of its turns but adds only 2–4 Empowered damage a fight; it
  deals none itself, and at health 4 it is the first to die. Taking it
  out of the China line-up (a second fox) costs the enemy nothing.
- **To bring them to the Steppe's level** (about 50% in a
  seat): the Vanguard about one stat point (speed 2 would give it the
  Grappler's turns), the Alchemist more than that; Elixir at range 2 and
  power 2 is too little for a whole turn. Not changed: the numbers are
  the owner's to set.

### Elixir's shape and Cleave's Delay (2026-10-25)

Asked for: a different shape for Elixir, and Delay on the Vanguard's
Cleave. Both are switches, the built kits unchanged: `ABILITY.elixir.shape`
(`unit` as built; `burst`, a space within `range` and every unit within
`radius` of it; `aura`, every unit within `radius` of the Alchemist, aimed
at its own space; the Alchemist never itself) and `ABILITY.cleave.delay`
(each unit Cleave leaves standing Delayed that many slots, keywords.md
17.3; 0 as built). Delay is new in `resolve.ts`, without the delay limit
(3.6). The AI values a shape's Empowers and Weakens unit by unit, and a
Delay as the share of a turn the card loses (Delay ÷ the unit's action
cost). `ablate.mjs` with `experiments/elixir-cleave.mjs`, **400 fights
each** (about ±2.5 points), seeds from 1000. *Seat*: the hero in the
Storm Caller's seat against the three Steppe heroes, its side's share of
wins (50% the Storm Caller's equal). *China*: the fox, Vanguard and
Alchemist against the Steppe party on the Gobi, player wins.

| Elixir | Seat | China | Elixir's share of turns (seat) | Empowered damage a fight (seat) |
|---|---:|---:|---:|---:|
| A unit within 2 (as built) | 40.6% | 100% | 63% | 2.6 |
| A unit within 3 | 43.4% | 100% | 69% | 3.0 |
| Burst: a space within 2 and its neighbours | **46.4%** | 99.3% | 74% | 3.9 |
| Aura: the Alchemist's neighbours | 41.8% | 100% | 41% | 2.1 |
| Aura: within 2 of the Alchemist | **46.2%** | 98.5% | 65% | 3.8 |

| Cleave's Delay | Seat | China |
|---|---:|---:|
| 0 (as built) | 52.5% | 100% |
| 2 | 54.5% | 99.5% |
| 3 | 55.8% | 100% |
| 5 | 61.8% | 99.8% |

The aura within 2 and Delay 3 together: China 97.5%.

- **An area Elixir is worth about 6 points in the seat**: the burst
  (46.4%) and the aura within 2 (46.2%) Empower and Weaken more than one
  unit a turn (3.8–3.9 Empowered damage a fight, from 2.6). Range 3 alone
  is worth 3 points, within noise. The aura of 1 does nothing (41.8%): the
  Alchemist must stand in the fight to use it, and it is used on only 41%
  of turns. None of them lifts the Alchemist to the Storm Caller's level;
  the area shapes come within 1.5 standard errors of it.
- **Delay helps the Vanguard in steps**: 2 and 3 slots are worth 2–3
  points each (within noise), 5 slots (half a turn of a speed-2 hero)
  about 9 (61.8%, above the Storm Caller and the measure's 50%). Delay 3
  is about a third of a Steppe hero's turn.
  In the Grappler's seat (the same measure, `mod.party` with the Vanguard
  for the Grappler) Delay 5 lifts it from 38.5% to 46.8%: still below the
  Grappler, within about 1.3 standard errors of its equal.
- **The China line-up stays a stage-1 fight** with every variant
  (97.5–100%): the fox and the Alchemist's 4 health are the weak part,
  not the kits. Its difficulty is a matter of numbers (or of the line-up),
  not of Elixir's shape or Cleave's Delay alone.
- **Adopted (owner, 2026-10-25): Cleave's Delay 5.** Elixir's shape stays
  a switch, `unit` as built; an area shape needs its area drawn on the page
  (`radius`, or an `area` for the aura). The delay limit (3.6) is not built.
- **The Alchemist with a stat point more** (`experiments/alchemist.mjs`,
  the same seat measure, 400 fights each):

  | Elixir | as built | +1 defence | +1 speed | +1 power |
  |---|---:|---:|---:|---:|
  | A unit within 2 | 40.6% | 44% | **49.2%** | 41% |
  | Burst of 1 within 2 | 46.4% | **51.4%** | 64.1% | 52.6% |
  | Aura of 2 | 46.2% | 48.2% | 60.2% | 48% |

  Speed is worth the most, as for every hero (principle 6): speed 3 brings
  the built Elixir to the Storm Caller's level; with an area shape it
  overshoots by 10–14 points. With the burst, defence 2 (health 6) does
  it instead. Power adds little to the single Elixir: more Empower on one
  ally seldom changes a kill.
  **Recommended:** speed 3 with Elixir as built (no page work), or the
  burst with defence 2 if an area Elixir is wanted. **Adopted (owner,
  2026-10-25): speed 3, Elixir as built.**
- **Found while building it**: the page never offers Elixir on an enemy.
  `offeredTargets` (choices.ts) shows a support ability's targets on its
  own side only, so a player's Alchemist can't Weaken; the AI's can.
  Fixed 2026-10-25: Elixir is offered on either side (`bothSides`).

### Elixir fixed at 1, with a hit (2026-10-26)

Asked for: Elixir's Empower and Weaken fixed at 1, not the Alchemist's
power, and an enemy also taking a hit of its power, so power is damage
again (9.2) and the exception to 17.2 goes. A switch,
`ABILITY.elixir.fixed` (0 as built; above 0 that Empower and Weaken, a
hit on an enemy first, and any enemy a target); the AI values the hit as
any attack's, and the lookahead marks every space within Elixir's range.
`ablate.mjs` with `experiments/elixir-fixed.mjs`, **400 fights each**
(about ±2.5 points), seeds from 1000. *Seat* and *China* as in the section
above.

| Elixir | Seat | China | Empowered damage a fight (seat) |
|---|---:|---:|---:|
| By power, no damage (as built) | 49.4% | 98.8% | 4.0 |
| Fixed 1, a hit of power 2 | **71.5%** | 88.3% | 0.9 |
| Fixed 1, a hit of power 1 | 53% | | 1.0 |

- **At power 2 it is too strong**, about 20 points over the Storm
  Caller: the hit is the Bow's damage at the Horse Archer's speed, on any unit
  within 2 with no line of fire, and a Weaken besides.
- **At power 1 it is the Storm Caller's equal** (within noise), with no
  unfinished fights (0.8% as built); the China line-up, at power 2, is
  harder (88.3% from 98.8%).
- **The Alchemist stops being a support**: the AI spends Elixir on
  enemies, the hit worth more than an Empower of 1, and the damage it adds
  through allies falls from 4 a fight to 1. A larger Empower on allies
  than the Weaken on enemies would pull it back; not measured. The
  harness doesn't attribute Elixir's own damage or kills.
- Not adopted on its own; adopted with a heal at power 1 (below).

**With a heal** (asked for the same day): an ally also heals the
Alchemist's power, up to its health, so a hurt ally can be aimed at
(`ABILITY.elixir.heal`: `all`, the camel too; `heroes`, not the camel); the
Empower and Weaken stay fixed at 1, an enemy still takes a hit. The AI
values a heal point as a point of damage. Healing is new in `resolve.ts`
(`heal`) and records no event, so the page's playback wouldn't show it.

| Elixir | Seat | China | Elixir's share of turns (seat) |
|---|---:|---:|---:|
| Fixed 1, a hit, no heal, power 2 | 71.5% | 88.3% | 55.6% |
| Fixed 1, a hit, heal any ally, power 2 | 69.3% | 87.3% | 68.5% |
| Fixed 1, a hit, heal heroes only, power 2 | 69% | 87.3% | 61.7% |
| Fixed 1, a hit, no heal, power 1 | 53% | | 59.2% |
| Fixed 1, a hit, heal any ally, power 1 | 55.8% | | 69.8% |
| Fixed 1, a hit, heal heroes only, power 1 | 57.5% | | 65.1% |

- **The heal adds little**: within noise at power 2, 3–4 points at power 1
  (about 1.5 standard errors). Elixir is used more (the heal is taken),
  but a heal of 1 or 2 mostly trades for a hit that would have taken as
  much off an enemy and could kill.
- **Healing the camel changes nothing measurable** (55.8% against 57.5%).
  China's two rows are the same fights: the enemy has no camel.
- **No stalls from healing**: 0–0.8% unfinished, as without it.
- At power 1 every variant is about the Storm Caller's equal; power 2 is
  too strong with or without the heal.
- **Everything by power** (the Empower and Weaken too) is the same as
  these at power 1, but a power point then raises four effects: at power
  2 (one provision) it wins 74–75% in the seat (heal any ally 75.3%,
  heroes only 74%), against 69% with the Empower and Weaken fixed.
- **Adopted (owner, 2026-10-26): power 1, the Empower and Weaken fixed at
  1, a heal and a hit of the Alchemist's power, the camel healed too**
  (`fixed: 1`, `heal: 'all'`; 55.8% in the seat). A heal is recorded as
  an event and shown in the playback (+N in jade). The China line-up with
  it: 98.5% player wins, still a stage-1 fight. `elixir-fixed.mjs` now sets
  every amount and the power in each variant, reproducing these tables on
  the new defaults.

**No damage, power 0, with Haste and Delay** (asked for the same day): the
Alchemist's power 0; an ally Empowered and **Hastened**, an enemy Weakened
and **Delayed**, by fixed amounts (`fixed`; `tempo`, Haste and Delay
slots), any unit a target (the camel too, so it can be Hastened). The AI
values Haste and Delay as Cleave's Delay, the share of a turn the card
gains or loses.

| Empower/Weaken | Haste/Delay | Seat | China |
|---:|---:|---:|---:|
| 1 | 0 | 37.3% | 99.7% |
| 1 | 3 | 55.3% | 98.7% |
| 1 | 5 | 62.3% | 92% |
| 2 | 0 | 46.3% | 98.5% |
| 2 | 3 | 62.1% | 95.7% |
| 2 | 5 | **74%** | 84.8% |

- **The tempo carries it**: each step of Haste and Delay is worth more
  than a point of Empower and Weaken. 1 and 3 is the Storm Caller's equal
  (within noise of 50%); 2 and 0 (the built Elixir at power 0, fixed) is
  just under; 2 and 5 is as strong as the Alchemist hitting for 2.
- **Delay 3 is about a third of a Steppe hero's turn**; at speed 3 the
  Alchemist hands it out on most of its turns (64–70% Elixir).
- Unfinished fights stay at 0–0.8%. The camel walking out still wins a
  fight, so a lone Alchemist at power 0 can win by Hastening it.

### China against the Steppe, with the Swordsman (2026-10-26)

Asked for: the China party (Swordsman, Vanguard, Alchemist, as built) against the Steppe party, and the Swordsman in the
Horse Archer's seat in a Steppe mirror. `ablate.mjs` with
`experiments/china-steppe.mjs`, **400 fights each** (about ±2.5 points),
seeds from 1000; the two headline rows also 2,000 more from seed 5000.
`ablate.ts` now attributes Swift Strike's damage (`swiftStrike`).

Party for party (`mod.party`), the camel with the player, every seed from
both sides; the China side's share of wins:

| China party against the Steppe party | China wins |
|---|---:|
| Steppe map, 2,400 fights | **36.8%** (36.5% of 2,000, 38.3% of 400) |
| Gobi | 37% |

As a stage on the Gobi (the player's party and camel against three
heroes): the Steppe party beats the China heroes 82.3%; the China party
beats the Steppe heroes 53.3%.

Hero for hero in a Steppe mirror (one side a Chinese hero in a Steppe
hero's seat); the Chinese side's share of wins:

| Swapped in | for the Grappler | for the Horse Archer | for the Storm Caller |
|---|---:|---:|---:|
| Swordsman | 41% | **46.9%** (2,400 fights; 45% of 400, 47.3% of 2,000) | 57% |
| Vanguard | 40% | 44.5% | 58.8% |
| Alchemist | 44.1% | 50.8% | 55% |

- **China is the weaker region**: about 37 to 63 party for party, on
  either map, and as an enemy it is easier than the Steppe's heroes
  (82% player wins against 53%). Unfinished fights 0–0.3%.
- **Each Chinese hero is near the Steppe's level alone** (41–59% in a
  seat): every one beats the Storm Caller in its seat and loses to the
  Grappler in its. So the gap is the line-up, not one hero: China has no
  ranged damage or area, and in the party match the Horse Archer deals 12.3
  damage a fight with Longshot against the Swordsman's 6.8 and the
  Vanguard's 5.6, and survives 79% against their 36%.
- **The Swordsman for the Horse Archer: 46.9% (95% about 45–49)**, a little
  under the hero it replaces. Same turns a fight (4.7 against 4.8),
  Swift Strike on 34% of them and moving on 57%; it deals 6.1 damage a
  fight against the Horse Archer's 8.7 and survives 36% against 49%: health
  4 in melee is the cost.
- Not changed: the numbers are the owner's to set.

### Why China loses, and buffs that even it (2026-10-26)

Asked for: whether the AI is why China loses (36.8% party for party,
above), and the obvious buffs. `experiments/china-buffs.mjs`, 400 fights
unless marked; China's side only for the stats (`mod.stats`), the patches
touch only China's abilities. `ablate.ts`'s `mod.search` gives the
modified side its own horizon and work cap (`deep`: 4 and 4 × 220).

**The AI** (China's share of wins):

| Search | China wins |
|---|---:|
| Both production | 36.8% (2,400) |
| China deep, the Steppe production | 50% |
| The Steppe deep, China production | 29% |
| Both deep | **41.2%** (800) |
| The Swordsman with no caution (0, from 1) | 30.8% |
| The Vanguard with caution 1 (from 0) | 33.8% |

- **Mostly not the AI.** A deeper search is worth about 10 points to
  either side (+11.7 for China, +9.2 for the Steppe); with both deep
  China gains about 4 points (41.2%), so the production AI underplays
  China a little, and most of the 13-point gap is the kits. The caution
  settings as built are the better ones for both heroes.

**Buffs**, China against the Steppe, and the hero in a Steppe seat:

| Buff | China wins | In a seat |
|---|---:|---:|
| none | 36.8% | Swordsman for Horse Archer 46.9%; Vanguard for Grappler 40%; Alchemist for Storm Caller 55% |
| Alchemist power +1 (2) | 60% (1,200) | 67.7% for the Storm Caller |
| Swordsman speed +1 (4) | 58.2% (1,200) | 60% for the Horse Archer |
| Elixir range 3 | 50% (1,200) | 65.3% for the Storm Caller |
| Swift Strike Haste 4 | 47.8% | 55.1% for the Horse Archer (800) |
| Vanguard speed +1 (2) | 47.8% | 45.9% for the Grappler (800) |
| Swordsman power +1 (3) | 47.5% | |
| Every Chinese hero defence +1 | 47.8% | |
| Swordsman defence +1 (health 6) | 43.1% | |
| Vanguard power +1 (3) | 43.3% | |
| Alchemist defence +1 (health 6) | 40.8% | |
| **Vanguard speed 2 and Haste 3** | **51.7%** (800) | Haste 3: 47.6% for the Horse Archer (800); speed 2: 45.9% for the Grappler |
| Vanguard speed 2 and Haste 4 | 57.9% (800) | |

- **A buff to the Alchemist overshoots**: power 2 or range 3 even
  China but make it the best hero in a Steppe party (65–68% in a seat);
  it is already above 50% there. So does the Swordsman at speed 4.
- **Health doesn't fix it**: defence +1 on every Chinese hero is worth
  11 points, on the Swordsman or Alchemist alone 3–6.
- **The Vanguard at speed 2 and Swift Strike Haste 3** even the parties
  (51.7%) and bring the two heroes under 50% in their seats up to
  46–48%, none past 50%. Not changed: the numbers are the owner's.

### The Vanguard's buffs other than speed (2026-10-26)

Asked for: with Swift Strike Haste 3 (owner: seems good), a buff for the
Vanguard that isn't speed, keeping its kit a slow tank's.
`experiments/vanguard-buffs.mjs`: China against the Steppe with Haste 3
and the buff, and the Vanguard alone in the Grappler's seat (no Haste).

| Vanguard buff, with Haste 3 | China wins | Vanguard for the Grappler |
|---|---:|---:|
| none (Haste 3 alone) | 43.4% (1,600) | 40% |
| speed 2 (above) | 51.7% (800) | 45.9% (800) |
| **Cleave Delay 8** (from 5) | **52.5%** (1,600) | 46.9% (800) |
| Cleave Delay 7 | 49% (800) | 47.5% |
| power +1 (3) | 50.2% (800) | 42.8% |
| defence +2 (health 12) | 49% (800) | 46.5% |
| a walk of 3 (from 2) | 48.6% (800) | 43% |
| defence +1 (health 10) | 45.5% (800) | 43.8% |
| Cleave reach 3 | 43.6% (800) | 41.3% |

- **Cleave's Delay does what speed did**: Delay 8 is speed 2's equal
  for China and in the seat; 7 is a step under (49%). With Delay 8 the
  Vanguard Cleaves on 38% of its turns (33% at 5), deals 7.1 damage a
  fight (5.9) and survives 50% (44%), and the Horse Archer facing it 66%
  (81%): its target loses most of a turn.
- Power +1 and a walk of 3 even China too but do less for the Vanguard in
  a Steppe party; defence +2 does both, slower; reach 3 adds nothing.
- **Adopted (owner, 2026-10-26): Cleave Delay 8 and Swift Strike
  Haste 3.** The earlier files that set neither (`china-steppe.mjs`,
  `china-buffs.mjs`) reproduce their tables only at their revision.

### Cleave's shape (2026-10-26)

Asked for: whether Cleave's shape (a line of 2 up or down, or a cone of
3 to either side) holds the Vanguard back. A switch for measuring,
`ABILITY.cleave.shape` (board.ts, `cleaveAreas`; the AI's `strikable`
reads the areas for the switch's shapes): `lines`, a line of 2 six ways
(the shape before 2026-10-26); `arcs`, three neighbours side by side, six
ways; `cones`, the built cone six ways. `experiments/cleave-shape.mjs`,
**800 fights each**, Delay 8 and Haste 3 as built. `ablate.ts` now counts
the units each source hits (`hitsPerFight`).

| Shape | China wins | Vanguard for the Grappler | Cleaves a fight (China) |
|---|---:|---:|---:|
| built | 52.6% | 47.4% | 1.46 |
| lines six ways | **60%** | 51.9% | 1.61 |
| cones six ways | 57.3% | 50% | 1.51 |
| arcs six ways | 48.1% | 44.6% | 1.28 |

- **The shape costs the Vanguard about 4–7 points** against a line six
  ways; arcs (every swing next to it) cost more. A swing catches about as
  many enemies in every shape: what the better shapes add is a swing on
  more turns, since more of the spaces around the Vanguard are in one.
- The built shape misses four of the six spaces 2 away straight out
  (the diagonals' lines) and reaches the space between two diagonals
  instead: a unit 2 away on a diagonal can't be hit, though it reads as
  in reach.
- With lines six ways, Delay 8 would overshoot (60%); a lower Delay with
  lines would be the measured equivalent (not run).
- Not changed: the shape is the owner's.

### Two hails, hail on entry, and a melee Elixir (2026-10-26)

Asked for: Hail with two hails standing at once and damage on entering
it, and the Alchemist at power 0 with an Elixir of radius 1 at melee
range, an ally Empowered 2 and an enemy Weakened 1 (no hit, no heal).
Switches for measuring, all off as built: `ABILITY.hail.max` (a caster's
hails standing at once, a new one past it replacing the oldest; each
lifts on its own and frees only whoever it held), `ABILITY.hail.entry` (a
unit entering hail, walking or Moved, takes the caster's power), and
`ABILITY.elixir.empower` and `.weaken` (each side's amount apart).
`experiments/hail-elixir.mjs`, **800 fights each** (about ±1.8 points),
seeds from 1000, Delay 8 and Haste 3 as built. *Seat*: a hero in a Steppe
hero's seat against the three Steppe heroes, its side's share of wins.

| Hail | Side without Hail | Swordsman / Vanguard / Alchemist for the Storm Caller | Party vs all three (player wins) | Storm + Storm + wolf | China vs Steppe | Hail's hits a fight |
|---|---:|---:|---:|---:|---:|---:|
| built | 30.1% | 64.4 / 62.4 / 54.6% | 76.3% | 96.4% | 52.6% | 4.86 |
| two at once | 28% | 63.1 / 61.8 / 54.5% | 74.4% | 95.6% | 51.7% | 5.06 |
| entry | 30% | 64.3 / 62.9 / 55.1% | 75.9% | 96.4% | 53.1% | 4.94 |
| two and entry | 28.6% | 63.3 / 63 / 54.5% | 74.4% | 95.6% | 51.8% | 5.14 |

- **Neither changes Hail measurably**: every row within about one
  standard error of the built one. Entry damage almost never fires (0.05
  more hits a fight): the AI walks round hail, since being held already
  costs it more than the damage. Two hails add little because the Storm
  Caller hails again on most turns, as with Hail lasting 2 (above): units
  begin 2.3 turns a fight held, from 2.2.
- **The Storm Caller is now the weakest Steppe hero by more**: with Haste
  3 and Delay 8 the Swordsman and the Vanguard in its seat win 62–64% (57–59%
  before), the Alchemist 55%.

| Elixir | Alchemist for the Grappler / Horse Archer / Storm Caller | China vs Steppe | Elixir's share of turns (China) | Empowered damage a fight (China) |
|---|---:|---:|---:|---:|
| built (a unit within 2, power 1, a hit and a heal) | 47.6 / 49 / 54.6% | 52.6% | 71% | 1.3 |
| power 0, aura of 1 (every unit next to it), Empower 2, Weaken 1 | 29.1 / 35 / 42.6% | **29.9%** | 43% | 2.5 |
| power 0, burst of 1 on a space next to it, Empower 2, Weaken 1 | 43.7 / 44.1 / 52% | 41.4% | 65% | 4.3 |

- **The aura is far too weak** (China 29.9%, 23 points under the built):
  it needs the Alchemist in the melee, at health 4, and catches a unit
  only on 43% of turns (it moves on half of them).
- **The burst plays as a support** (Empowered damage 4.3–5.5 a fight,
  three times the built Elixir's) but costs about 4–11 points: China
  41.4%, 44–52% in a seat. Unfinished fights rise a little (0.3–1.6%).
- **Adopted (owner, 2026-10-26): two hails at once and hail on entry**
  (`max: 2`, `entry: true`), then the same day **the burst Elixir** as
  measured (`shape: 'burst'`, `range: 1`, `radius: 1`, `empower: 2`,
  `weaken: 1`, no hit or heal, the Alchemist's power 0). `hail-elixir.mjs` sets
  every switch in each variant, reproducing these tables on the new
  defaults.

### The Storm Caller at speed 3 (2026-10-26)

Asked for: the Storm Caller at speed 3 (from 2), Hail untouched, on the
current rules (two hails, hail on entry, the burst Elixir).
`experiments/storm-speed.mjs`, **800 fights each** (about ±1.8 points),
seeds from 1000. *Seat*: a Chinese hero in the Storm Caller's seat
against the three Steppe heroes (50% its equal; lower, a stronger Storm
Caller).

| | Speed 2 (built) | Speed 3 |
|---|---:|---:|
| Swordsman for the Storm Caller | 63.3% | **50.4%** |
| Vanguard for the Storm Caller | 63% | 60.8% |
| Alchemist for the Storm Caller | 49.8% | 39.5% |
| China vs Steppe | 40.1% | **25%** |
| Side without Hail | 28.6% | 20.3% |
| Party vs all three (player wins) | 74.4% | 73.6% |
| vs Grappler + Storm + wolf | 96.1% | 93.2% |
| vs Storm + Storm + wolf | 95.6% | 89.3% |
| Storm Caller's turns a fight (China vs Steppe) | 5.3 | 7 |
| Its survival (China vs Steppe) | 76% | 93% |

Head to head, a Steppe mirror with one side's Storm Caller at speed 3:
57%.

- **Speed 3 brings it level with the Swordsman** (50.4%) but not the Vanguard
  (60.8%), and puts it 10 points over the burst Alchemist.
- **It widens the gap between the regions**: China falls from 40.1% to
  25% party for party, as the Storm Caller takes a third more turns and
  almost never falls.
- **As an enemy it changes little**: stage caravans with a Storm Caller
  stay stage-1 fights (89–93%), and stage 3 is unchanged.
- Hail's worth (20.3%) stays in the core's band, at its bottom edge.
- Not changed: the numbers are the owner's.

### China against the Steppe, role for role (2026-10-26)

Asked for: each Chinese hero against the Steppe hero of its role (owner:
compare heroes only within a role), and the parties together, on the
current rules (two hails, hail on entry, the burst Elixir, the Storm
Caller at speed 2). `experiments/china-steppe.mjs`, **1,600 fights each**
(about ±1.25 points), seeds from 1000.

| Role | Chinese hero in the Steppe hero's seat | Its side wins |
|---|---|---:|
| Tank | Modao Vanguard for the Bökh Champion | 47% |
| Damage | Youxia Swordsman for the Mangudai Outrider | 47.3% |
| Support | Waidan Alchemist for the Storm Caller | 49.3% |
| Party | China for the Steppe | **40.4%** |

| China vs Steppe | Youxia | Vanguard | Alchemist | Outrider | Champion | Storm Caller |
|---|---:|---:|---:|---:|---:|---:|
| Survives | 33% | 48% | 59% | 77% | 66% | 76% |
| Damage a fight | 7.9 | 6.8 | (4.2 through Empower) | 9.9 | 2.5 | 3.5 |

- **Each Chinese hero is within 3 points of its counterpart**, all a
  little under; the support pair is even.
- **Together they lose 60 to 40**: a 9.6-point gap, half again the
  seats' gaps added up (6.4). China is all melee (the burst reaches only next to the
  Alchemist), so its three heroes walk in through the Outrider's arrows
  and two hails that now hit on entry; the Youxia, first in, survives a
  third of fights. In a Steppe party each Chinese hero has the Outrider
  and Hail on its side, which is why it measures near even alone.

### Elixir as Haste and Delay (2026-10-26)

Asked for: the burst Elixir as built (a space next to the Alchemist,
radius 1) with Haste and Delay in place of Empower and Weaken, an ally
Hastened and an enemy Delayed `tempo` slots (`ABILITY.elixir.tempo`,
`empower` and `weaken` 0), to support the Vanguard. Fixed first: an
amount of 0 gave Empower 0, replacing an Empower the unit had.
`experiments/elixir-tempo.mjs`, **800 fights each** (about ±1.8 points),
seeds from 1000. `ablate.ts` now counts Delays and Hastes by source
(`delaysPerFight`, `hastesPerFight`): *again* is a Delay on a unit already
Delayed since its last turn, *self* a Haste the Alchemist gave itself.
The Alchemist's and Vanguard's turns are China's, a fight.

| Elixir | China vs Steppe | Alchemist for the Storm Caller | Unfinished (China) | Elixir's Delays a fight (again) | Its Hastes (on itself) | Alchemist's turns | Vanguard's turns |
|---|---:|---:|---:|---:|---:|---:|---:|
| built (Empower 2, Weaken 1) | 40.1% | 49.8% | 0.8% | — | — | 12 | 7.8 |
| Haste and Delay 2 | 39.4% | 50.4% | 0.1% | 12.2 (5.7) | 17.9 (9.3) | 14.6 | 7.3 |
| Haste and Delay 3 | **58%** | 67% | 0.6% | 20.1 (14.6) | 28.7 (14) | 18.5 | 8.2 |
| Haste and Delay 4 | 83.8% | 89.8% | 12.6% | 123 (119.7) | 83.5 (52.9) | 56 | 10.9 |

- **At 2 it is the built Elixir's equal** (39.4% and 50.4%, within
  noise): a Haste and Delay Elixir is a workable support at that size.
- **3 and 4 are a lockout, not a Vanguard buff.** The Vanguard gains
  under half a turn a fight at 3; the gain is the Alchemist Hastening
  itself (about half its Hastes) and Delaying the same enemy again
  before it acts (73% of its Delays at 3, 97% at 4). At 4 a speed-3
  Alchemist (action cost 8) Hastened 4 acts every 4 slots and pushes
  the enemy next to it 4 each time, so that enemy never acts: 56
  Alchemist turns a fight and one in eight fights unfinished.
- **What it needs before a higher amount**: the Alchemist kept out of its
  own Haste, and the delay limit (3.6), which this is the first ability
  to need. Neither built; not changed, the Elixir stays Empower and
  Weaken (the owner's call).

### Elixir as Haste and Delay, other shapes (2026-10-26)

Asked for: Haste and Delay kept, the shape changed. A switch for
measuring, `ABILITY.elixir.self` (on as built): off, the Alchemist never
takes its own Elixir, so it can't Hasten itself, the loop above. Every
row here has it off. `experiments/elixir-tempo-shapes.mjs`, **800 fights
each** (about ±1.8 points), seeds from 1000; the built Elixir (Empower 2,
Weaken 1) is China 40.1%, the seat 49.8% (above). Delays, *again* and the
turns as above.

| Shape | Haste and Delay | China vs Steppe | Alchemist for the Storm Caller | Elixir's Delays a fight (again) | Its Hastes | Vanguard's turns |
|---|---:|---:|---:|---:|---:|---:|
| Burst next to it (as built) | 2 | 35.5% | 43.5% | 8.5 (2.7) | 6 | 6.9 |
| | 3 | 43.4% | **49.8%** | 8.7 (3.4) | 6.5 | 7.6 |
| | 4 | 53.9% | 58.1% | 9.5 (4.4) | 7.2 | 8 |
| Burst within 2 | 2 | 40.4% | 47.8% | 9.7 (3) | 7.2 | 7.1 |
| | 3 | **50.5%** | 56.4% | 10.8 (4.1) | 8 | 7.7 |
| | 4 | 59% | 61.8% | 10.5 (4.7) | 8 | 8.1 |
| One unit within 2 | 2 | 29.4% | 33.9% | 3.6 (0.6) | 2.6 | 6.7 |
| | 3 | 30.4% | 44.4% | 4 (0.8) | 2.7 | 6.8 |
| | 4 | 38% | 47.9% | 4.1 (1) | 2.9 | 7.3 |
| One unit within 3 | 2 | 29% | 36.1% | 3.7 (0.5) | 2.7 | 6.8 |
| | 3 | 32.7% | 44.1% | 4.2 (0.7) | 3 | 7.1 |
| | 4 | 40% | 47.4% | 4.3 (0.8) | 3.1 | 7.4 |

- **Without itself in it, there is no lockout**: no unfinished fights at
  any amount, the Alchemist's turns stay at about 12 (56 at 4 with
  itself), and about 40% of its Delays find a unit already Delayed, from
  73–97%. The delay limit (3.6) would still cut that 40%.
- **A burst is needed**: one unit loses at every amount (China 29–40%),
  as the single Empower did; a burst catches about two units a use.
- **The burst next to it at 3 is the Storm Caller's equal** (49.8%) and
  China gains 3 points on the built Elixir (43.4%). **Thrown within 2 at
  3 evens China** (50.5%) but is 6 points over the Storm Caller in its
  seat.
- **The Vanguard gains little**: under a turn a fight at 3 or 4 (7.6–8.1,
  7.8 with the built Elixir). The Haste reaches whichever ally stands
  near the target; `hastesPerFight` doesn't count it by ally.
- **Adopted (owner, 2026-10-26): the burst next to the Alchemist, Haste
  3 and Delay 3, the Alchemist kept out of it** (`haste: 3`, `delay: 3`,
  `empower: 0`, `weaken: 0`, `self: false`).

### Elixir with more Haste than Delay, and the AI counting them (2026-10-26)

Asked for: whether the AI values Haste and Delay, and the Elixir's Haste
and Delay apart. **The AI counted them only in part**: `guessValue`
orders options by the share of a turn a card moves (Cleave's Delay too),
but `scoreOutcome`, which screens the options the search plays on,
counted Haste and Delay as nothing while it counts Empower and Weaken as
statuses, and the leaf evaluation has no track term; the search saw a
moved card only where the turn it moved fell within its horizon.
Switches for measuring: `ABILITY.elixir.haste` and `.delay` (the one
`tempo` until now) and `AI.trackWorth` (0 as built: above 0,
`scoreOutcome` counts each other card a turn moves, the share of a turn ×
its turn's worth × this, as `guessValue` does). `ablate.ts` counts Hastes
by ally (`hastesPerFight.*.to`).
`experiments/elixir-haste-delay.mjs`, **800 fights each** (about ±1.8
points), seeds from 1000: the burst next to the Alchemist, the Alchemist
never in it (`self` off), no Empower or Weaken; the built Elixir is China
40.1%, the seat 49.8%. Vanguard Hastes and turns are China's, a fight.

| Haste / Delay | China vs Steppe | Alchemist for the Storm Caller | Vanguard Hastened | Vanguard's turns | Cleaves |
|---|---:|---:|---:|---:|---:|
| 3 / 3 | 43.4% | 49.8% | 3.3 | 7.6 | 3 |
| 3 / 0 | 29.8% | 36.4% | 2.7 | 7 | 2.7 |
| 4 / 0 | 33% | 37.9% | 2.8 | 7.2 | 2.7 |
| 3 / 1 | 36.5% | 44.1% | 3.2 | 7.2 | 2.7 |
| 4 / 1 | 35.5% | 44.1% | 3 | 7.1 | 2.8 |
| 5 / 1 | 40.1% | 44.1% | 3 | 7.3 | 2.9 |
| 4 / 2 | 39.6% | 47.3% | 3.2 | 7.5 | 2.9 |
| **`trackWorth` 1:** built Elixir | 40.7% | 49.9% | — | 7.8 | 1.8 |
| 3 / 3 | 47.6% | 54.6% | 4 | 7.8 | 3.2 |
| 4 / 1 | 42% | 46.9% | 4 | 7.6 | 3.1 |

- **Delay carries the Elixir, not Haste.** With the same Delay, more
  Haste adds little (3/1 to 5/1: 36.5–40.1%, the seat 44.1% throughout);
  with no Delay it loses badly (30–33%). Every pair with more Haste than
  Delay is under 3 / 3.
- **The Vanguard is Hastened about three times a fight** (the most of any
  ally; the Swordsman about 2, the camel 1.3), yet takes no more turns
  (7–7.8, 7.8 with the built Elixir): about a turn's worth of slots a
  fight, spread over the fight.
- **Counting Haste and Delay in the screen is worth 4–6 points to the
  Haste Elixir** (3/3: 47.6% from 43.4%, the seat 54.6%; 4/1: 42% from
  35.5%) and nothing to the built one (40.7%). With it, 3 / 3 is still
  ahead of 4 / 1.
- `trackWorth` stays 0. The Elixir was then built as 3 / 3 (above). Before `trackWorth` is adopted it needs the whole game
  measured with it on, since it changes how Cleave's Delay and Swift
  Strike's Haste are weighed too.

### The China mirror (2026-10-26)

Asked for: whether a Chinese hero is weak in a China mirror (the China
party on both sides), on the current rules (the Elixir as Haste 3 and
Delay 3, Cleave Delay 8, Swift Strike Haste 3).
`experiments/china-mirror.mjs`, seeds from 1000: the mirror, 400 fights,
the camel with the player (the player wins 55.6%); each Chinese hero
swapped for each Steppe hero on one side, **800 fights each** (about ±1.8
points), every seed from both sides.

| In the mirror | Youxia | Vanguard | Alchemist |
|---|---:|---:|---:|
| Survives | **44.9%** | 51.8% | 54.6% |
| Turns a fight | 10.3 | 7.3 | 10.4 |

The swapped side's share of wins (above 50%: the hero taken out was the
weaker):

| Taken out | Bökh Champion in | Mangudai Outrider in | Storm Caller in | Mean |
|---|---:|---:|---:|---:|
| **Youxia Swordsman** | **71%** | 54.1% | 43.1% | **56.1%** |
| Modao Vanguard | 64.3% | 58.4% | 36% | 52.9% |
| Waidan Alchemist | 58.8% | 57.5% | 38.9% | 51.7% |

- **The Swordsman is the weakest in the mirror**: it survives least,
  taking as many turns as the Alchemist, and taking it out gains the most
  (the Champion in its seat 71%, the largest swing; the highest mean).
- **Not by much outside melee**: for the Outrider, taking out the
  Swordsman gains the least (54% against 57–58%); only the Champion's
  column separates the three clearly, so health 4 in melee against the
  Vanguard's Cleave (14.2 damage and 3 kills a fight, the mirror's only
  attributed damage) is the cost.
- **The Storm Caller is weak in any Chinese seat** (36–43%), as it is
  the Steppe's weakest.
- Not changed: the numbers are the owner's.

### Elixir on one ally within 3: a heal and Unstoppable (2026-10-26)

Asked for: the Elixir as one unit within 3, healing the Alchemist's power
and making it Unstoppable until the next turn, with the Alchemist's power
1 (built the same day; the built burst doesn't use it). Unstoppable
(keywords.md 17.4) is built as a switch for measuring,
`ABILITY.elixir.unstoppable` (off as built): the ally can't be Pushed,
Pulled or Immobilized until the start of its own next turn, and hail
holding it lets go; a Move (Throw, the grapple's swap) still moves it
(open question 54). The heal no longer needs `fixed` (`ABILITY.elixir.heal`
alone), and an Empower or Weaken of 0 no longer falls back to power, so the
built burst gives none at power 1. The AI's guess counts the hail it frees
an ally from; the rest is the search's.
`experiments/elixir-unstoppable.mjs`, **800 fights each** (about ±1.8
points), seeds from 1000: only allies, never the Alchemist, no Haste,
Delay, Empower, Weaken or hit; `heal-only` is the same without
Unstoppable. The built burst (Haste 3, Delay 3) was China 43.4%, the seat
49.8%, at power 0 (above).

| Elixir | China vs Steppe | Alchemist for the Storm Caller | Elixir's share of the Alchemist's turns (China) | Hold |
|---|---:|---:|---:|---:|
| Built burst, power 1 | 40% | 49.4% | 57.6% | 0.5% |
| One ally within 3: heal 1, Unstoppable | 30.7% | 43.1% | 59% | 3.4% |
| One ally within 3: heal 1 | 25.8% | 39% | 53.1% | 10.7% |

- **The single-target Elixir loses**: China 30.7% (9 points under the
  burst), the seat 43.1% (6 under), as every one-unit Elixir has (above:
  29–40%).
- **Unstoppable is worth about 4–5 points over the heal alone** (30.7%
  from 25.8%, the seat 43.1% from 39%): against the Steppe it answers the
  Storm Caller's hail and nothing else (Gale and Shove are upgrades). With
  the heal alone the Alchemist Holds a tenth of its turns, no ally hurt.
- **Power 1 changes the built burst little**: China 40% from 43.4% at
  power 0 (under 2 standard errors), the seat 49.4% from 49.8%.
- Not changed: the built Elixir stays the burst (the owner's call);
  `unstoppable` stays off.

**With Empower and Haste** (asked the same day): the same one-ally heal,
no Unstoppable, the ally also Empowered 1 (one that hits, until the end
of its next turn), Hastened 3, or both; the same file, fights and seeds.
Hastes are China's, a fight, the camel's in brackets.

| Elixir | China vs Steppe | Alchemist for the Storm Caller | Elixir's share of the Alchemist's turns (China) | Hastes (camel) | Empower damage |
|---|---:|---:|---:|---:|---:|
| Heal 1, Empower 1 | 29.7% | 45.5% | 65.1% | — | 1.9 |
| Heal 1, Haste 3 | 39.9% | 46.1% | 61.1% | 6.9 (2.6) | — |
| Heal 1, Empower 1, Haste 3 | **47.2%** | **54.3%** | 63.7% | 7.1 (2.3) | 2.9 |

- **Both together are the strongest Elixir measured for China**: 47.2%,
  7 points over the built burst (40%) and 17 over the heal alone; in the
  seat 54.3%, 5 over the Storm Caller's equal (49.4%).
- **Haste carries it, Empower adds to it**: Haste alone is the burst's
  equal for China (39.9%), Empower alone adds nothing for China (29.7%
  from 25.8% with Unstoppable's 30.7%) but 6 points in the seat. Together
  they add more than apart (Empower's damage 2.9 a fight from 1.9: a
  Hastened ally strikes sooner, while Empowered).
- **A third of the Hastes go to the camel** (2.3–2.6 a fight), the AI
  speeding it to the exit.
- Not changed: the built Elixir stays the burst (the owner's call).

**A higher Empower** (asked the same day: should it be higher?): the
same, `heal-empower-N-haste-M`.

| Empower / Haste | China vs Steppe | Alchemist for the Storm Caller | Empower damage |
|---|---:|---:|---:|
| 1 / 3 (above) | 47.2% | 54.3% | 2.9 |
| 2 / 2 | 55.3% | 63.1% | 4.8 |
| 2 / 3 | 59.8% | 67.4% | 5.2 |
| 3 / 3 | 62.2% | 73.5% | 7.7 |

- **Empower 2 is too strong at either Haste**: China 55–60%, the seat
  63–67%, 14–18 points over the Storm Caller's equal. Each point of
  Empower adds about 2.5 damage a fight. Empower 1 is the right size; if
  anything, 1 / 3 is a little over in the seat.
- **Adopted (owner, 2026-10-26): heal 1, Empower 1, Haste 3 on one ally
  within 3** (`shape: 'unit'`, `range: 3`, `heal: 'all'`, `empower: 1`,
  `haste: 3`, `delay: 0`, `self: false`), the Alchemist's power 1.

### China against the Steppe after the collision rule (2026-10-26)

Asked for: a balance check of China against the Steppe on the current
rules, then whether to nerf Cleave or Swift Strike or buff the Storm
Caller. `experiments/china-steppe.mjs` and
`experiments/china-steppe-retune.mjs`, **800 fights each** (about ±1.8
points), seeds from 1000.

Two rule changes since the Elixir was adopted, rerun at the revision
before each:

| Revision | China vs Steppe | Alchemist for the Storm Caller |
|---|---:|---:|
| Elixir adopted (`50e7963`) | 47.2% | 54.3% |
| Grapple's throw deals no damage (`b0e5d7c`) | 50.4% | 54.8% |
| A Hastened or Delayed card wins the collision (`64bb617`, built) | **62%** | 60.3% |

On the built rules: China vs Steppe 60% on the Gobi; as a stage on the
Gobi, the China party and camel beat the three Steppe heroes 74.1%, the
Steppe party China's 53.9%. Each Chinese hero in each Steppe seat:

| | Grappler | Horse Archer | Storm Caller |
|---|---:|---:|---:|
| Swordsman | 49.3% | 49.3% | 64.5% |
| Vanguard | 49% | 48.5% | 62% |
| Alchemist | 46.1% | 56.1% | 60.3% |

- **The collision rule is worth 12 points to China**: Cleave's Delay and
  the Hastes now always land, and the Steppe's turns fall (the Horse
  Archer's 5.1 a fight to 4.26, the Grappler's 4.12 to 3.79, the Storm
  Caller's 4.56 to 4.22) while China's hold. Cleave's Delays rose from
  2.57 a fight to 2.88.
- **Role for role, only support is off**: tank 49%, damage 49.3%,
  support 60.3%.

Each change on both sides, the party and each Chinese hero in its role's
seat:

| Change | Party | Tank | Damage | Support |
|---|---:|---:|---:|---:|
| built | 62% | 49% | 49.3% | 60.3% |
| Cleave Delay 6 | 55.1% | 44.3% | 49.3% | 60.3% |
| Cleave Delay 5 | 49.4% | **40.8%** | 49.3% | 60.3% |
| Swift Strike Haste 2 | 55.3% | 49% | 47.4% | 60.3% |
| Elixir Haste 2 | 55.1% | 49% | 49.3% | 58.9% |
| Storm Caller speed 3 | **52.1%** | 46.4% | 49.9% | 55.3% |
| Storm Caller speed 3, defence 1 (health 4) | 55% | 47.5% | 49.9% | 55.4% |

- **Nerfing Cleave evens the parties by breaking the tank pair**: at
  Delay 5 the Vanguard is 9 points under the Grappler, and the support gap
  is untouched. Swift Strike's Haste 2 leaves China at 55% and the
  Swordsman a little under the Horse Archer.
- **The Elixir's Haste 2 barely moves the support pair** (58.9%).
- **The Storm Caller at speed 3 comes closest everywhere**: the parties
  52.1%, every role within about 5 points, unfinished fights at most
  1.4%. Speed 3 was declined earlier the same day, when China lost 40 to
  60.
- **Defence 1 with speed 3 gives back about 3 points**: the parties 55%,
  the roles unchanged within noise.

Stage caravans with a Storm Caller against the Steppe party and camel
(player wins; lower, a stronger enemy):

| Caravan | Built | Speed 3 | Speed 3, defence 1 |
|---|---:|---:|---:|
| Storm Caller + 2 wolves | 99.6% | 99% | 99.1% |
| Grappler + Storm Caller + wolf | 96.4% | 93% | 94.6% |
| Horse Archer + Storm Caller + wolf | 95.5% | 92.1% | 93.5% |
| Storm Caller + Storm Caller + wolf | 95.3% | 89.2% | 89% |
| All three | 76.3% | 74% | 76.5% |

- **As an enemy either variant changes little**: stage 1 and 2 caravans
  stay at 89% or more, stage 3 within 2 points.

Hail in place of speed (asked the same day): damage 2 (the Storm
Caller's power 2, Hail its only hit, on landing and on entry), lasting 3
of its caster's turns (`ABILITY.hail.turns`), or 3 at once
(`ABILITY.hail.max`).

| Change | Party | Tank | Damage | Support | vs Grappler + Storm + wolf | vs Storm + Storm + wolf | vs all three |
|---|---:|---:|---:|---:|---:|---:|---:|
| built | 62% | 49% | 49.3% | 60.3% | 96.4% | 95.3% | 76.3% |
| Storm Caller speed 3 | 52.1% | 46.4% | 49.9% | 55.3% | 93% | 89.2% | 74% |
| Hail damage 2 | **51.1%** | 48.6% | 52.8% | **50.6%** | 91.6% | 84% | **68.3%** |
| Hail lasting 3 turns | 62.1% | 48% | 50.1% | 59.5% | 96.4% | 94.8% | 72.8% |
| 3 hails at once | 62% | 49% | 49.3% | 60.3% | 96.4% | 95.3% | 76.3% |

- **Hail damage 2 evens every pairing**: the parties 51.1%, each role
  within 3 points, the support pair even (50.6%) where speed 3 left it
  5 over. Fights run shorter (median 46 actions from 49).
- **It makes enemy Storm Callers harder**: stage 3's three heroes fall
  to the player 68.3% from 76.3%, two Storm Callers and a wolf 84% from
  95.3%.
- **Lasting longer does nothing for the matchup**, and **3 at once never
  comes into play**: a hail lasting 2 turns lifts before a third can be
  cast, so the results match the built game's exactly.
- Not changed: the numbers are the owner's.

### Does a party need one of each role? Whole runs (2026-10-26)

Asked for: whether a party needs a tank, a damage hero and a support to
get through a run, the owner wanting to encourage one of each without
requiring it. `scripts/balance/runs.mjs` plays whole runs (all six
stages, the fallen gone, survivors at full health, the production AI on
both sides; each provision +1 defence to the weakest survivor, the first
passive offered to the first survivor without it);
`experiments/roles.mjs` plays every party of three from the six built
heroes, 200 runs each (seeds 1000–1199, about ±2.5 points on rates near
15%).

| Shape | Parties | Runs won, mean | Range |
|---|---:|---:|---:|
| One of each | 8 | 17.3% | 5.5–36.5% |
| No damage | 4 | 21.9% | 12–35% |
| No support | 4 | 14.8% | 4.5–24% |
| No tank | 4 | 8.8% | 3–15.5% |

- **Roles don't decide a run yet; heroes do.** One of each is no better
  than average, and no damage beats it. The one-of-each parties alone
  span 5.5–36.5%, wider than the gap between any two shapes.
- **Two heroes carry runs:** parties with the Grappler win 22.1% (9.9%
  without), with the Alchemist 21.1% (10.9% without). Every other hero's
  parties win less than those without it: the Storm Caller 11.5% (20.5%),
  the Swordsman 12.1% (19.9%), the Horse Archer 14.2% (17.8%), the
  Vanguard 15.2% (16.9%). The Grappler and Alchemist together win 35–36.5%
  with any third but the Storm Caller (24.5%).
- **No tank is the one shape that hurts** (8.8%), mostly because it
  can't have the Grappler.
- **Losses are the camel's whatever the shape:** 79–86% of lost stages
  end with the camel killed, 13–20% with the party, stalls about 1%. A
  missing role doesn't change how a run is lost, so no role is doing a
  job the others can't (camel.md's tank job isn't built).
- **Stage 3 and stage 6 decide runs:** the regions' last fights, against
  three heroes, are won 22–81% of the time; stage 1 93–100%.

Next: the role jobs (the tank protecting the camel first), then this
experiment again; a one-of-each edge needs the heroes' spread within a
role narrowed too, or hero strength will keep hiding it.

### Haste and Delay in collisions (2026-10-26)

Asked for: the balance if a Hastened or Delayed card takes the slot it
lands on only when faster, then with a Delayed card always yielding.
`experiments/tempo-collision.mjs`, **800 fights each** (about ±1.8
points), seeds from 1000; the variants' switches (`RULES.delayWins`,
`.hasteWins`) were removed once the rule was built, so `by-speed` and
`haste-by-speed` reproduce only at `a9f89d0`.

| Rule | China vs Steppe | Vanguard for Grappler | Swordsman for Horse Archer | Alchemist for Storm Caller | vs China party | vs Swordsman + Vanguard + wolf | vs all three |
|---|---:|---:|---:|---:|---:|---:|---:|
| Hastened or Delayed card takes its slot (was built) | 62% | 49% | 49.3% | 60.3% | 45.1% | 87.6% | 76.3% |
| **Both by speed, as any placement (built)** | 50.4% | 49% | 50% | 54.8% | 59.3% | 89.9% | 76.3% |
| Haste by speed, Delay takes its slot | 50.4% | 49% | 50% | (stopped) | | | |
| Haste by speed, Delay always yields (built for a day) | **50.8%** | 49.3% | 50% | **54.8%** | 58.1% | 89.6% | 76.3% |

The "vs" columns are stage caravans against the Steppe party and camel
(player wins; lower, a stronger enemy).

- **Haste is the whole effect**: Hastes colliding by speed take China
  from 62% to about 50%. How a Delay collides changes nothing measurable:
  Cleave's targets (speed 2 and 3) rarely land on a taken slot they
  wouldn't win anyway.
- **Adopted (owner, 2026-10-26): Hastened and Delayed cards collide by
  speed**, as any placement, one rule for every card. A Delayed card
  always yielding was built first and measured the same.
- **Support is still the pairing that's off**: the Alchemist 54.8% in the
  Storm Caller's seat under either rule, about 5 over; tank and damage within a point of
  even.
- **China as an enemy is about 14 points easier** (the Steppe party
  59.3% from 45.1%); the other caravans move 2 points or less.

### Eye of the Storm in place of Hail (2026-10-27)

The owner's proposal: Eye of the Storm as the Storm Caller's core in place
of Hail, Hail an upgrade beside Sunlight and Gale. An ally exactly 2 away,
or the Storm Caller itself, heals the Storm Caller's power (1), with its
Empower and Weaken (heals take them since this proposal, the Elixir's
too); then every unit next to it that hits, of either side, is Weakened 1.
Then, asked for, heal 2 (`ABILITY.eye.heal` 1) and Weaken 2.
`experiments/eye.mjs` and `eye-runs.mjs`, **400 fights each** (about
±2.5 points) from seed 1000, 200 whole runs (about ±3.5). *Head to head*:
one side's Storm Caller with Hail as its core against Eye (above 50%, Hail
the stronger). *Seat*: a Chinese hero in the Storm Caller's seat against
the three Steppe heroes (50% its equal; lower, a stronger Storm Caller).

| | Hail (built) | Eye 1/1 | Heal 2 | Weaken 2 | Both |
|---|---:|---:|---:|---:|---:|
| Hail against Eye, head to head | | 66.2% | 62% | 63.3% | 61.6% |
| Side without the core ability | 28.6%¹ | 38.3% | 37.7% | 40.6% | 38.5% |
| Swordsman for the Storm Caller | 62.3% | 74.5% | 70.5% | 69.8% | 64.2% |
| Vanguard for the Storm Caller | 61.5% | 71.7% | 65.9% | 71.2% | 64.9% |
| Alchemist for the Storm Caller | 55% | 66.4% | 61.1% | 66.2% | 61.7% |
| Whole runs won (both sides' Storm Callers) | 11.5% | 17% | | | 29.5% |

¹ From "The Storm Caller at speed 3", not rerun.

With an upgrade, Hail + Sunlight beats Eye + Sunlight 60.4%, Hail + Gale
Eye + Gale 56%. Stage caravans with an enemy Storm Caller, player wins
with Hail and Eye 1/1: Storm + 2 wolves 99.5% and 100%, Grappler + Storm +
wolf 96% and 98.7%, Horse Archer + Storm + wolf 95% and 98.8%, all three
78.3% and 81.5%. Whole runs by stage (Steppe 1–3, China 1–3): Hail 98,
88.3, 56.6, 95.9, 71.3, 34.3; Eye 1/1 98.5, 87.3, 58.7, 90.1, 69.2, 54;
both 98.5, 91.9, 69.6, 94.4, 79.8, 62.1.

- **Eye is weaker than Hail at every number tried**: Hail wins 62–66%
  head to head, and every Chinese hero beats an Eye Storm Caller by more
  than it beats a Hail one (5–12 points at 1/1, 3–9 with both raised).
- **Eye is still worth having** (a side without it wins 38–41%), but less
  than Hail (28.6%), at the bottom of the core's band or below it.
- **Heal 2 and Weaken 2 each close the gap a little; both together close
  it most**, the seat rows 2–10 points nearer Hail's, still 2–3 short.
- **Runs get easier, not harder**: an enemy Storm Caller with Eye is a
  weaker one, so runs won rise from 11.5% to 17%, and to 29.5% with both
  raised, mostly in China's last stage (34% to 54% and 62%), where the
  enemy fields all three heroes; the player's Storm Caller loses some of
  its strength, the enemy's more.
- Not changed: built on the branch `eye-of-the-storm`, Hail still the
  core on `main`; the numbers are the owner's.

#### Eye of the Storm Immobilizing its storm (2026-10-27)

Asked for next: the storm round Eye's target Immobilizing every unit in
it, either side and the camel too, until the end of its next turn
(`ABILITY.eye.immobilize`), in place of the Weaken (*Imm*), beside Weaken
1 (*Imm + Weaken 1*), and with heal 2 in place of the Weaken (*Imm + heal
2*). The same experiments, files and seeds as above.

| | Hail (built) | Eye 1/1 | Imm | Imm + Weaken 1 | Imm + heal 2 |
|---|---:|---:|---:|---:|---:|
| Hail against Eye, head to head | | 66.2% | 64.7% | 58.8% | 57.3% |
| Side without the core ability | 28.6% | 38.3% | 42.1% | 36% | 37% |
| Swordsman for the Storm Caller | 62.3% | 74.5% | 74.4% | 70.1% | 74.8% |
| Vanguard for the Storm Caller | 61.5% | 71.7% | 71.9% | 67.5% | 67.7% |
| Alchemist for the Storm Caller | 55% | 66.4% | 69.8% | 63.7% | 64.4% |
| Whole runs won (both sides' Storm Callers) | 11.5% | 17% | 9% | 15.5% | |

Whole runs by stage: Imm 97.5, 81, 46.2, 84.9, 69.4, 41.9; Imm + Weaken 1
97, 83, 52.8, 85.9, 79.5, 53.4.

- **Immobilizing in place of the Weaken is no stronger** in the seat rows
  and worth less to a side (42.1% without it): a melee unit held next to
  an ally still hits it, and the storm holds the healed ally's own
  neighbours, allies included, as often as its enemies.
- **Immobilize with Weaken 1 is the strongest Eye measured head to head**
  (Hail 58.8%) and as a side's worth (36%), but the seat rows stay 6–9
  points behind Hail's.
- **An enemy Storm Caller holding the party's walkers makes runs harder**:
  Imm alone 9% of runs, under Hail's 11.5%; with Weaken 1 15.5%.
- Not changed: `immobilize` off as built.

#### Eye of the Storm on an empty space (2026-10-27)

Asked for next: heal and Weaken again, the Storm Caller able to open the
eye on a free space exactly 2 away with no unit on it too, the storm round
it Weakening with no heal (`ABILITY.eye.anywhere`); at heal 1 and Weaken
1, and at heal 2 and Weaken 2. The same experiments, files and seeds.

| | Hail (built) | Eye 1/1 | Anywhere 1/1 | Eye 2/2 | Anywhere 2/2 |
|---|---:|---:|---:|---:|---:|
| Hail against Eye, head to head | | 66.2% | 63.4% | 61.6% | **55.4%** |
| Side without the core ability | 28.6% | 38.3% | 37.7% | 38.5% | **32.7%** |
| Swordsman for the Storm Caller | 62.3% | 74.5% | 70.6% | 64.2% | **59%** |
| Vanguard for the Storm Caller | 61.5% | 71.7% | 65.3% | 64.9% | **61.2%** |
| Alchemist for the Storm Caller | 55% | 66.4% | 67.3% | 61.7% | 60.2% |
| Whole runs won (both sides' Storm Callers) | 11.5% | 17% | 24% | 29.5% | 33.5% |

Whole runs by stage: anywhere 1/1 98.5, 92.4, 62.1, 92, 74, 62.3;
anywhere 2/2 99.5, 95, 72.5, 94.2, 84.5, 61.5.

- **Placing it on an empty space helps most at 2/2**: the first Eye level
  with Hail in the seat rows (the Swordsman 59% to Hail's 62.3%, the
  Vanguard 61.2% to 61.5%, the Alchemist 60.2% to 55%), and near it as a
  side's worth (32.7% to 28.6%). Head to head Hail still wins 55.4%.
- At 1/1 it helps a little (3–6 points in two seat rows, none in the
  third).
- **Runs get easier still** (24% and 33.5% from Hail's 11.5%): the
  player's Storm Caller gains more from it than the enemy's, whose AI
  Weakens the party's melee heroes but seldom shields its own.
- Not changed: `anywhere` off, heal 1 and Weaken 1 as built.

## Principles for re-tuning

How to keep the game balanced as gear, new heroes, new abilities and new
keywords arrive.

1. **One currency: action cost.** Price every effect in action cost,
   which speed turns into slots (3.2). Reference: a typical (100)
   single-target attack does base 80 to 120, depending on how much else
   the ability does. A quick (60) action does about 60% of that. Area,
   charged and conditional effects are priced by the targets they
   **expect** to hit (about 0.6 for a radius-1 charge today), not the
   most they could.
2. **Measure worth, not just use.** Usage share says how often an ability
   is chosen; ablation says what it is worth. Targets per kit, with the
   side lacking the ability at:
   - the **core** action: 20–35%;
   - each **other** ability: 40–50% (owner, 2026-10-24; was 40–48%):
     it pulls its weight, and none is mandatory;
   - the **ultimate**: 40–47%;
   - **never above 50%**: an ability that loses games when used is a trap
     for players and the AI alike.
3. **Usage bands.** Core 25–45% of a hero's action turns; situational
   abilities 8–25% each; the ultimate used in at least 80% of fights where
   the hero lives to unlock it. An ability used on over 35% of turns that
   isn't the core is suspect: check its ablation. One under 5% is dead.
4. **The AI's scoring is part of the balance.** A flat valuation (Fog's
   shield bonus, points per status) can make an ability a trap or a
   must-pick. Before tuning an ability's numbers, check by ablation that
   the AI uses it well. Value effects by what they enable or prevent:
   Vulnerable v% for d slots is worth v% of the damage the other side can
   reach the target with in d slots; fog is worth the ranged damage it
   would actually stop.
5. **Charged effects pay after the dodge.** A charged ability's realized
   value must beat the alternatives over its total cost (charge plus
   recovery). The answer is cheap: one hex costs 30, 2–3 slots. So keep
   charges short, make the area wide enough that escaping takes two hexes
   or a full turn, or make the dodge itself the payoff (area denial,
   forcing a move).
6. **Speed is universal, power depends on the kit, defence on the
   target.** Measured with the original AI: +10 speed was worth 10–15
   points of win rate, +10 power 4–11, +10 defence 4–8. With the AI
   scoring statuses and fog in damage (2026-10-20), much of speed's
   premium went: +10 speed gives the Storm Caller 55.3% and +10 power
   61.8%; the Grappler 57.4% for speed; the Horse Archer 62% for speed and
   57.1% for power. Part of speed's value was the old AI turning cheap
   actions into many low-value turns. Speed still matters most for the
   hero whose damage is its job (the Horse Archer). Price gear speed by the
   slots it saves for that hero's main action, in steps that cross a slot
   breakpoint, and publish slot tables (cost × speed → slots). Neither
   `C` 50 nor carrying the fraction rounding discards to the next turn
   changed speed's measured worth (both tested).
7. **Breakpoints are what matter.** Hits to kill and slots per action are
   the only numbers that change outcomes. Size a gear stat line to move
   one of them (Bow vs Grappler from 4 hits to 3 needs 180 a hit), and let
   previews show it ([heroes-and-gear.md](heroes-and-gear.md), 9.7).
8. **End stalls by rule, not by weak healing.** With a guaranteed end (the
   camel's walk to the exit, [camel.md](camel.md)), heals can be priced
   for value. Reference: healing per cost at 0.6–0.9 of a
   damage hero's after-defence damage per cost (Sunlight at 75 per 60
   against the Bow's 144–180 per 100 measured healthy).
9. **Keywords don't scale with power, so re-check them at late-run stats.**
   As gear raises power, damage grows and keyword values don't, so
   control and support kits weaken relative to damage. Re-run the
   ablations at early and late gear levels (for example +20 power all
   round) and adjust keyword values, or cap power from gear first (9.1,
   "Watch").
10. **Even the decisions per hero.** Keep each unit's turns per fight
    within about 1.5× of the others. Prefer abilities that combine a
    reposition with an effect over near-free steps whose only purpose is
    to set up the next turn.
11. **Put the track in the kits.** Push, Pull and track entities are what
    make time a shared resource (goal 4). Price Push N as the output it
    denies (the target's damage per slot × N, capped by the push limit,
    3.6), and measure it like any ability. New heroes (the Jinn Binder
    first) should bring them.
12. **A change ships when** the kit ablation against the current roster
    shows: unfinished fights ≤ 3%, no ability above 50%, no non-core
    ability below 35%, and usage in its band. Then playtest it with people.
    The AI mirror match is a measuring tool, not the verdict on feel.

## Open questions

1. Freeze is used in fewer than half of fights (0.4 casts a fight per
   Storm Caller, 2026-10-22): its worth is fixed (damage 120), its use isn't.
2. Whether the bow's six lanes should stay (tuning 6): the lanes give it
   a clear identity, at the cost of many fiddly turns.
3. Whether mixed compositions break these readings. Every measurement
   here is a mirror match; Phase 2's recruitment needs composition
   ablations.
