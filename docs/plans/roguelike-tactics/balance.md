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

**Reverted (owner, 2026-10-27)**: Hail is the Storm Caller's core again
and Eye's code is removed; `experiments/eye*.mjs` reproduce these tables
only at `26ce722`, where its switches (`ABILITY.eye`, `AI.supportKeepsBack`)
exist.

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
- Not adopted in this shape: Eye healing and hitting was (below).

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
  player's Storm Caller gains more from it than the enemy's (why is not
  measured).
- Not changed: `anywhere` off, heal 1 and Weaken 1 as built.

Then, asked for, on an empty space too and Immobilizing in place of the
Weaken (`anywhere`, `immobilize`, `weaken: 0`), head to head only: Hail
wins 61.1% at heal 1 and 54.6% at heal 2 (Anywhere 2/2, Weakening, 55.4%).

#### Is the AI underplaying Eye? (2026-10-27)

Asked for: whether Hail wins because the AI plays Eye badly.
`experiments/eye-ai.mjs`, 400 fights each, the best Eye (on an empty
space too, heal 2, Weaken 2) unless it says otherwise.

| | Production AI | Changed |
|---|---:|---:|
| Eye's side, its AI deeper (depth 4, 4 × the work), against Hail | 44.6% | 50.6% (+6) |
| Hail's side, its AI deeper, against Eye | 55.4% | 60.7% (+5.3) |
| Hail against Eye 2/2, a Storm Caller that can't hurt keeping 2 from an ally (`AI.supportKeepsBack`) | 55.4% | 56.6% |
| Hail against Eye 1/1 on an empty space, the same | 63.4% | 62.3% |

- **A deeper search helps both cores alike** (6 and 5.3 points), so the
  production AI doesn't underplay Eye more than Hail; with Eye's side
  deeper, the two are even (50.6%).
- **Keeping an Eye Storm Caller back changes nothing** (both within a
  point and a half, inside the noise).
- So Hail's lead is the ability's, as far as these check: not the AI's
  horizon or where it stands the Storm Caller. Not checked: how much the
  AI counts a Weaken (`AI.empoweredShare`, ½, tuned for Empower), or how a
  person plays it.
- Not changed: `supportKeepsBack` off as built.

#### Eye of the Storm healing and hitting (2026-10-27)

Asked for: Eye healing its target the Storm Caller's power and hitting
every unit in the storm round it, either side and the camel too, for the
same (`ABILITY.eye.damage`), no Weaken. Head to head only, 400 fights:
Hail wins **50%** against it on an ally or itself, and **42.3%** with an
empty space a target too (`anywhere`): the first Eye stronger than Hail.
The seat rows and whole runs are not measured.

Then, asked for: how it scales with power, as provisions raise it. Both
sides' Storm Callers at power 2 and 3, Hail against Eye head to head (Hail
wins):

| Power | Eye hitting, on an empty space too | Eye hitting, on an ally or itself |
|---:|---:|---:|
| 1 (built) | 42.3% | 50% |
| 2 | 29.6% | 37.7% |
| 3 | 23.7% | 40.6% |

- **On an empty space too, it outgrows Hail with every point of power**:
  Hail's share falls from 42.3% to 23.7%. A power provision adds 1 to
  every unit in the storm, up to six, where Hail's adds 1 to one.
- **On an ally or itself only, it grows once and then holds** (37.7%,
  40.6%): the storm must sit round one of its own side's units, so the
  more it hits the more of its own side it hurts.

Then, asked for: both hitting Eyes against the game's balance at power
1, the same experiments as for the first Eye (`eye.mjs`, `eye-runs.mjs`).

| | Hail (built) | Eye hitting, ally or itself | Eye hitting, empty space too |
|---|---:|---:|---:|
| Side without the core ability | 28.6%¹ | 24.3% | 20.8% |
| Swordsman for the Storm Caller | 62.3% | 61.5% | 52.3% |
| Vanguard for the Storm Caller | 61.5% | 59.3% | 52% |
| Alchemist for the Storm Caller | 55% | 57.8% | 54.1% |
| vs Storm + 2 wolves (player wins) | 99.5% | 100% | 100% |
| vs Grappler + Storm + wolf | 96% | 97.3% | 96% |
| vs Horse Archer + Storm + wolf | 95% | 98% | 98% |
| vs all three | 78.3% | 70.8% | 78.3% |
| Whole runs won | 11.5% | 14% | 19% |

¹ From "The Storm Caller at speed 3", not rerun.

Whole runs by stage: on an ally 98, 90.3, 58.2, 85.4, 64.8, 49.1; on an
empty space too 99.5, 94, 59.9, 93.8, 68.6, 52.8.

- **On an ally or itself it sits where Hail does**: every seat row within
  3 points of Hail's, the caravans within 3 but the full Steppe caravan
  (70.8%, 7.5 harder), runs 14% to 11.5%; worth a little more (24.3%).
- **On an empty space too it is the strongest Storm Caller measured**:
  the Swordsman and the Vanguard only even with it (52%), worth 20.8%, at
  the core's band's bottom edge; with the power scaling above, it would
  pull further from the other heroes as a run raises its power.
- A stronger Storm Caller widens the Steppe's lead over China (balance.md,
  "China against the Steppe").
- **Adopted (owner, 2026-10-27): Eye hitting, on an ally or itself**, as
  the Storm Caller's core, Hail an upgrade; **reverted to Hail the same
  day** (owner), Eye's code removed (at `26ce722` before that).

#### Eye of the Storm's storm following its target (2026-10-27)

Asked for: the storm going with the unit healed until the Storm Caller's
next turn (`ABILITY.eye.follows`), catching each unit that comes next to
it once, a walk it Immobilizes stopping there; Weakening 1, Immobilizing,
and both, no hit, on an ally or itself. Head to head only, 400 fights,
Hail wins:

| | Storm where cast | Storm following |
|---|---:|---:|
| Weaken 1 | 66.2% | 66.2% |
| Immobilize | 64.7% | 66.4% |
| Immobilize and Weaken 1 | 58.8% | 60.8% |

- **Following changes nothing** (all within 2 points, inside the noise):
  the AI's guess at Eye counts only the units next to the target as it is
  cast, and its short search seldom walks the healed ally into enemies to
  use the storm; a person might.
- With both, more fights go unfinished (5.5%, from 3.5%).
- Not changed: `follows` off as built.

#### Is breaking grapples why the hitting cores win? (2026-10-27)

Asked for: whether Hail and the hitting Eye beat the Weakening Eye because
a hit frees a grappled unit. Hail against Eye head to head, 400 fights,
with no Grappler on either side (the Vanguard, Horse Archer and Storm
Caller), Hail wins:

| | With the Grappler | Without |
|---|---:|---:|
| Eye Weakening 1 | 66.2% | 60.7% |
| Eye hitting | 50% | 49.5% |

- **Breaking grapples is part of it, not most**: without Grapplers Hail's
  lead over the Weakening Eye shrinks by 5.5 points (about two standard
  errors), but Hail still wins 60.7%. The hit itself is worth more.
- The hitting Eye stays level with Hail either way, so hitting alone,
  not freeing allies, is what brings it there.

#### Eye of the Storm following, Weakening and Immobilizing, within 3 (2026-10-27)

Asked for: the storm following the unit healed (`follows`), heal by
power, Weaken 1 and Immobilize, no hit, an ally anywhere within 3 or the
Storm Caller itself (`ring` off, `range` 3), against the game's balance.
`eye.mjs`, `eye-runs.mjs`, 400 fights and 200 runs each.

| | Hail (built) | Eye hitting, ally exactly 2 away | This Eye |
|---|---:|---:|---:|
| Hail against it, head to head | | 50% | 56.6% |
| Side without the core ability | 28.6%¹ | 24.3% | 30.3% |
| Swordsman for the Storm Caller | 62.3% | 61.5% | 54.7% |
| Vanguard for the Storm Caller | 61.5% | 59.3% | 58.2% |
| Alchemist for the Storm Caller | 55% | 57.8% | 55.7% |
| vs Storm + 2 wolves (player wins) | 99.5% | 100% | 100% |
| vs Grappler + Storm + wolf | 96% | 97.3% | 99.7% |
| vs Horse Archer + Storm + wolf | 95% | 98% | 96.9% |
| vs all three | 78.3% | 70.8% | 72.8% |
| Whole runs won | 11.5% | 14% | 13.5% |

¹ From "The Storm Caller at speed 3", not rerun.

Whole runs by stage: 96.5, 90.2, 55.7, 89.7, 69, 45.

- **Level with Hail against the other heroes, behind it head to head**:
  the seat rows match Hail's or beat them (the Swordsman 54.7% to 62.3%),
  but Hail beats it 56.6% when the two meet.
- **Fights stall more**: 8% unfinished against the Grappler, Storm and
  wolf, 5.3% against all three, 3.8% head to head (0–2% for Hail). The
  storm holds the camel and both sides' melee units in place.
- Not changed: `follows`, `immobilize`, `ring` and `range` as built.

### The Storm Caller at power 2 (2026-10-27)

Asked for: whether the Storm Caller at power 2 (from 1), so Hail hits for
2 on landing and on entry, is too strong, on the current rules (Hail the
core again, the Elixir on one ally within 3). `experiments/storm-power.mjs`,
**1,600 fights each** (about ±1.25 points), seeds from 1000. *Seat*: another
hero in the Storm Caller's seat against the three Steppe heroes (50% its
equal; lower, a stronger Storm Caller). The power applies to every Storm
Caller on both sides.

| | Power 1 (built) | Power 2 |
|---|---:|---:|
| Swordsman for the Storm Caller | 62.9% | **48.9%** |
| Vanguard for the Storm Caller | 62.9% | **46.8%** |
| Horse Archer for the Storm Caller¹ | 54.1% | 40% |
| Vanguard for the Grappler (tank) | 49.1% | 47.1% |
| Swordsman for the Horse Archer (damage) | 48.1% | 53.4% |
| Side without Hail | 26.7% | **15.4%** |
| vs Storm + 2 wolves (player wins) | 99.5% | 98.5% |
| vs Grappler + Storm + wolf | 96.9% | 91.8% |
| vs Horse Archer + Storm + wolf | 94.7% | 91.6% |
| vs Storm + Storm + wolf | 95.4% | **84.1%** |
| vs all three | 75.3% | **69.1%** |

¹ 43.9% of these fights unfinished at both powers: two Horse Archers on a
side stall, so the row is less sure than the others.

Head to head, a Steppe mirror with one side's Storm Caller at power 2:
66.1% (speed 3, the same way: 57%).

- **Power 2 moves it from last of the seats to just ahead**: the
  Swordsman and Vanguard fall from 63% to 47–49%, 1 to 3 points under even,
  where speed 3 left the Vanguard at 60.8%.
- **Hail becomes as much of the game as the Bow or Grapple**: a side
  without it wins 15.4% (from 26.7%), where the Bow's and Grapple's sides
  without them won 15.6% and 13.1% when last measured ("Hail for two
  turns, rechecked").
- **As an enemy it is harder**: stage 3 falls 6 points to 69.1%, two Storm
  Callers and a wolf 11 points to 84.1%; stage 1 is unchanged.
- **Two Grapplers on a side crash the rules**, so the Grappler wasn't
  measured in the Storm Caller's seat: a Grappler's throw finds no held
  unit next to it (`grapple.resolve` in abilities.ts, `heldNextTo`
  undefined). Two Grapplers never meet on one side in a run.
- **Adopted (owner, 2026-10-27)**: the Storm Caller's power is 2.

### The Elixir swapping speed and health (2026-10-27)

Asked for: the Elixir swapping an ally's stats until its next turn, its
speed for its health, the Alchemist's power 0. A switch for measuring,
`ABILITY.elixir.swap` (off as built): one ally within 3, never the
Alchemist or the camel (its speed 0 would be its health), swaps its speed
and its current health; no heal, Empower or Haste. The builder's choices,
each measured both ways: how long (`swapUntil`: `end`, through the ally's
next turn, its card placed after it at the swapped speed; `start`, until
that turn starts, so the speed counts only in collisions), and what the
health does (`pool`, the swapped health a pool of its own, the unit's own
health back untouched unless it fell; `carry`, what it gained or lost
meanwhile carried back, falling if none is left). The AI reads a swapped
unit by the health it will have back (`healthAfterSwap`), and its first
guess counts each point of health lost for now at `AI.swapRisk` (0.5);
at 0.5 it almost never swaps, so every variant is also run at 0.
`experiments/elixir-swap.mjs`, **800 fights each** (about ±1.8 points),
seeds from 1000; `ablate.ts` counts swaps by ally (`swapsPerFight`).

| Elixir | `swapRisk` | China vs Steppe | Alchemist for the Storm Caller | Elixir's share of its turns (China) | Swaps a fight (Vanguard / Swordsman) |
|---|---:|---:|---:|---:|---:|
| built (heal 1, Empower 1, Haste 3, power 1) | | **42.8%** | **44.2%** | 61% | |
| swap, pool, through its turn | 0 | 23% | 22.5% | 28% | 1.5 / 1.3 |
| swap, carry, through its turn | 0 | 21.9% | 21.8% | 21% | 1.6 / 0.5 |
| swap, pool, until its turn | 0 | 17.9% | 17.8% | 28% | 1.2 / 1.7 |
| swap, carry, until its turn | 0 | 15.6% | 17.4% | 26% | 1.3 / 1.3 |
| swap, pool, through its turn | 0.5 | 16.9% | 18.9% | 8% | 0 / 0.8 |
| swap, carry, through its turn | 0.5 | 15.6% | 17.8% | 1% | 0 / 0.1 |

- **The swap is close to no Elixir at all**: the carry row at 0.5, where
  the AI swaps under once a fight, is in effect an Alchemist with nothing
  to do (15.6%, holding 40% of its turns); the best swap adds 7 points to
  that, the built Elixir 27. In the seat every variant wins 17–23%, about
  half the built Elixir's 44%.
- **What it is used for is the Vanguard's speed**: health 8 for speed 8
  takes its next card 5 slots on instead of 10, half a turn, but leaves
  it at health 1 meanwhile; its survival falls from 45% to 26–28%. The
  Swordsman and the Horse Archer (health 4, speed 3) trade a slot of speed
  for 1 health, or, hurt, a little health for a slower card.
- **Lasting through the ally's turn is worth about 5 points** over ending
  as it starts (the speed then counts only in collisions); `pool` and
  `carry` differ by 1–2 points, within noise. Carry's falls as a swap ends
  are rare (0–0.1 a fight).
- **The Alchemist at power 0 has nothing else**: with the swap seldom
  worth a turn it moves or Holds on 70–80% of its turns.
- Not changed: `swap` stays off. To be worth a turn it would need to come
  on top of the built Elixir, or the speed half alone (an ally's speed set
  to its health through its next turn, health untouched) is the part that
  pays; neither measured.

### The Elixir granting Immortal (2026-10-27)

Asked for: the Elixir granting only Immortal until the ally's next turn.
A switch for measuring, `ABILITY.elixir.immortal` (off as built): one ally
within 3, never the Alchemist, is Immortal (keywords.md 17.6: its health
can't be reduced, its Shield still takes damage) until the start of its
next turn; `heroes`, not the camel, `all`, the camel too. The Alchemist's
power 0; no heal, Empower or Haste. The AI's first guess values it as
the damage the ally would take before its next turn, and its fall
(`threatDamage`); the search sees the hits turned to nothing.
`experiments/elixir-immortal.mjs`, **1,600 fights each** (about ±1.25
points), seeds from 1000; `ablate.ts` counts Immortals given and the hits
that took no health (`immortalsPerFight`).

| Elixir | China vs Steppe | Alchemist for the Storm Caller | Elixir's share of its turns (China) | Immortals a fight (hits turned to nothing) |
|---|---:|---:|---:|---:|
| built (heal 1, Empower 1, Haste 3, power 1) | **44.8%** | **46.1%** | 61% | |
| Immortal, heroes | 20.9% | 26.2% | 39% | 4 (1.7) |
| Immortal, the camel too | 24.6% | 31.4% | 43% | 4.9 (3.2) |

- **Immortal is about the swap's worth, 20–25 points under the built
  Elixir**: China 20.9–24.6% (the swap 15.6–23%, above), the seat
  26–31%.
- **The enemy hits someone else**: of about 4 Immortals a fight, under
  half turn a hit to nothing (1.7 a fight on heroes, about 3 damage). An
  Immortal unit is one the other side's search simply doesn't strike; with
  power 0 the Alchemist adds no damage of its own, and its Elixir no
  tempo, which is what carries the built one (Haste 3).
- **The camel is the best target**: with it allowed the side gains 4–5
  points, the camel blocking about 1.5 hits a fight and surviving 77% in
  China's fights (69.5% built); it is a lone target the enemy must hit to
  win that way.
- **Who it keeps standing**: the Vanguard survives 42% with Immortal
  (heroes) against 47.6% built, the Swordsman 31.6% against 34.3%: the
  built Elixir keeps them standing better, though it blocks nothing.
- Not changed: `immortal` stays off. Immortal alone doesn't pay for a
  whole turn; on top of the built Elixir, or with the Alchemist's power
  back for a heal, it might; not measured.

**Delayed, so the ally acts Immortal** (asked the same day: the AI
doesn't press in with an Immortal ally, since Immortal ends as its turn
starts): `ABILITY.elixir.immortalWhen` `delayed`, Immortal from the start
of the ally's next turn until the start of the turn after; while Immortal
the ally fears no enemy (`scoreOutcome`'s caution skipped), and the AI's
first guess values it as a turn of the ally's (`AI.immortalWorth`, 1). The
same file, fights and seeds.

| Immortal | China vs Steppe | Alchemist for the Storm Caller | Elixir's share of its turns (China) | Immortals a fight (hits turned to nothing) | Cleave's damage a fight |
|---|---:|---:|---:|---:|---:|
| now, heroes (above) | 20.9% | 26.2% | 39% | 4 (1.7) | 5.7 |
| delayed, heroes | 18.9% | 24% | 28% | 2.5 (1.4) | 5.6 |
| now, the camel too (above) | 24.6% | 31.4% | 43% | 4.9 (3.2) | 5.9 |
| delayed, the camel too | 20.3% | 26.5% | 32% | 3.2 (2.1) | |

- **Delaying it costs 2–5 points**: the ally's own Immortal turn adds no
  damage (the Vanguard's Cleave 5.6 a fight, 5.7 Immortal now, 7.7 with
  the built Elixir), and fewer Elixirs come to anything (2.5 Immortals a
  fight from 4: the ally can fall first, and the AI gives it less).
- **Fearless spacing isn't worth much here**: the China heroes are melee
  and already walk in (the caution weighs only the hits before its next
  turn); most likely what holds them back is the Outrider’s arrows and the hail on the
  way (not measured), which an Immortal walk-in shrugs off for one turn only. The enemy’s
  search still strikes whoever isn't Immortal.
- Not changed: `immortalWhen` stays `now`, `immortal` off.

### The Elixir on one unit within 2, Empower 2 and Weaken 2 (2026-10-27)

Asked for: the Elixir on one space within 2, an ally healed the
Alchemist's power and Empowered 2, an enemy hit for its power and
Weakened 2; no Haste. Already switches, no rules change: `shape: 'unit'`,
`range: 2`, `fixed: 1` (the hit), `heal: 'all'`, `empower: 2`, `weaken: 2`,
`haste: 0`. At the Alchemist's power 1 (as built) and 2 (one provision).
`experiments/elixir-range2.mjs`, **1,600 fights each** (about ±1.25
points), seeds from 1000. *China* and *Seat* as in "The Elixir granting
Immortal".

| Elixir | China vs Steppe | Alchemist for the Storm Caller | Elixir's share of its turns (China) | Empowered damage a fight (China) | Alchemist survives (China) |
|---|---:|---:|---:|---:|---:|
| built (one ally within 3, heal 1, Empower 1, Haste 3, power 1) | 44.8% | 46.1% | 61% | 2.7 | 55.4% |
| within 2, Empower 2, Weaken 2, power 1 | **49.3%** | **50.6%** | 66% | 3.1 | 59.1% |
| within 2, Empower 2, Weaken 2, power 2 | 68.5% | 64.9% | 65% | 2.2 | 68.5% |
| within 2, Empower 2, Weaken 2, power 1, itself too | 55.6% | 49.6% | 69% | 3.4 | 66.3% |

- **At power 1 it is the Storm Caller's equal and China's best Elixir
  yet**: 4–5 points over the built one (about 2.5–3 standard errors),
  50.6% in the seat, China within a point of even. No unfinished fights.
- **Most likely the Weaken 2 does the work Haste 3 did** (not isolated):
  a hit of 2 Weakened 2
  deals nothing (a Horse Archer's Bow, a Storm Caller's Hail), so the
  enemy's next hit is gone, besides the 1 damage. The Vanguard and the
  Swordsman survive 2–5 points more (50.1% and 39.6%, from 47.6% and
  34.3%); the Empower 2 adds a little damage through allies (3.1 a fight,
  from 2.7). The harness doesn't attribute Elixir's own hits or the hits
  Weaken took off.
- **At power 2 it is too strong**, 15–20 points over the Storm Caller, as
  the fixed-1 Elixir with a hit was at power 2 (71.5%): the hit, the heal
  and the Weaken add up. A provision of power on the Alchemist would be
  worth far more than one on any other hero.
- **Adopted (owner, 2026-10-27): at power 1** (`range: 2`, `fixed: 1`,
  `heal: 'all'`, `empower: 2`, `weaken: 2`, `haste: 0`).
- **Itself too** (asked for and adopted the same day, owner: `self: true`,
  its own Empower given on its turn lasting through the end of its next
  one, as any Empower given on a unit's own turn does): China gains 6
  points (55.6%, from 49.3%), the seat is unchanged (49.6%, within noise).
  The Alchemist Empowers itself to hit for 3 and heals itself (it
  survives 66.3% in China's fights, from 59.1%); no unfinished fights.

### Cleave as a line of 2 six ways, on today's rules (2026-10-27)

Asked for: Cleave as simply a line of 2 spaces straight out, in place of
the built shape (a line of 2 up or down, or a cone of 3 to either side).
The measuring switch already has it, `ABILITY.cleave.shape: 'lines'` (a
line of `reach` 2 in each of the six directions, stopped by yurts, not by
units; the shape before 2026-10-26): no rules change. Rerun from "Cleave's
shape" on the rules since (the collision rule, the Elixir as built).
`experiments/cleave-lines.mjs`, **1,600 fights each** (about ±1.25
points), seeds from 1000, Delay 8 and Haste 3 as built. *China*: the China
party against the Steppe party. *Seat*: the Vanguard in the Grappler's
seat against the three Steppe heroes.

| Cleave | China vs Steppe | Vanguard for the Grappler | Cleave's share of the Vanguard's turns (China) | Units hit a fight, enemy / ally (China) | Cleave's damage a fight (China) | Vanguard survives (China) |
|---|---:|---:|---:|---:|---:|---:|
| built (line up or down, cone to the sides) | 44.8% | 47.1% | 40.3% | 3.17 / 0.15 | 7.7 | 47.6% |
| line of 2 six ways | **48.4%** | **52.5%** | 43.6% | 3.32 / 0.10 | 8.1 | 53.1% |

- **The line six ways is worth 3.5–5.5 points to the Vanguard** (about
  2–3 standard errors of the difference): China within 2 points of even,
  the Vanguard a little above the Grappler in its seat. Less than on
  2026-10-26 for China (7.4 then, 52.6% to 60%), about the same in the
  seat (4.5 then). No unfinished fights.
- **It swings more often and hits allies less**: Cleave on 43.6% of the
  Vanguard's turns (40.3%), a few more enemies a fight, a third fewer
  allies (0.10 from 0.15) since no cone reaches round beside it. Damage
  barely moves (8.1 from 7.7); the Vanguard survives 5 points more (53.1%
  from 47.6%), not attributed.
- At 52.5% in the seat it sits just over the 50% line; Delay 7 with the
  line would likely bring it back (not run; Delay 7 cost China about 3.5 points
  in "The Vanguard's buffs other than speed").
- **Adopted (owner, 2026-10-27): Cleave as a line of 2 six ways**, Delay
  8 kept. The switch's `lines` is now `built`; `cleave-shape.mjs` and
  `cleave-lines.mjs` reproduce only at their revision.

### The roster checked again: seats, whole runs and skill (2026-10-27)

Asked for: the balance again on today's rules (Cleave a line of 2 six
ways, the Elixir on one unit within 2, the Storm Caller at power 2, the
Steppe's mountains in every fight, Humphrey's health carried from stage to
stage); whether any hero is strictly better to have than another,
especially within a role; and how much the game rewards playing well.
`experiments/roster-check.mjs` (fights, **1,600 each**, about ±1.25
points) and `experiments/roster-runs.mjs` (whole runs, **400 each**, about
±1 point on rates near 5%, ±1.7 near 12%), seeds from 1000. *Skill* is the
AI's search standing in for a player: a **novice** looks one decision
ahead (`depth: 1`), production three, an **expert** four with four times
the work (mirror.ts's `deep`); `mod.searchHeroes` (ablate.ts) gives it to
one hero only, `search` (runs.ts) to the player's heroes in a run.

**One fight, each hero in another's seat** (the side with the swap wins;
50% is the hero's equal there):

| In the seat of | Steppe mirror | | | China mirror | | |
|---|---:|---:|---:|---:|---:|---:|
| | Grappler | Horse Archer | Storm Caller | Swordsman | Vanguard | Alchemist |
| Grappler | | | | 54.4% | 49.6% | 52.3% |
| Vanguard | 52.1% | 53.2% | 50.2% | | | |
| Horse Archer | | | | 51.9% | 56% | 49.3% |
| Swordsman | 53.4% | 52.2% | 47.8% | | | |
| Storm Caller | | | | 56.8% | 52.9% | 46.2% |
| Alchemist | 54.1% | 52.8% | 46.6% | | | |

China against the Steppe party for party: **53.9%**, no unfinished fights.

- **No hero is strictly better than its role's other**, each pair measured
  both ways: the Vanguard in the Grappler's seat 52.1%, the Grappler in the
  Vanguard's 49.6% (the Vanguard 1–2 points ahead, about noise); the
  Swordsman for the Horse Archer 52.2%, the Horse Archer for the Swordsman
  51.9% (each a little better in the other's party); the Alchemist for the
  Storm Caller 46.6%, the Storm Caller for the Alchemist 46.2% (each better
  in its own party). Every role is within about 2 points.
- **Across roles, only the Storm Caller over the Swordsman holds both
  ways**: in the Swordsman's seat 56.8%, the Swordsman in its seat 47.8%.
  Every other cross-role pair flips with the party. A hero from the other
  region tends to help a little (most swaps 50–54%): mixing kits pays.
- Left out: a hero in a party already holding one. Two Horse Archers or
  two Storm Callers stall (36–50% unfinished), and a second Vanguard or
  Alchemist in a China party wins 75–79% (two Cleaves' Delay 8, two
  Weaken 2s stacking). A run's party never holds two of a hero, nor does
  a stage caravan, so this matters only if one ever does.

**Whole runs, every party of three** (the production AI on both sides):

| | Runs won, mean (range) | Steppe stage 3 won | Reach China | Stage 6 won |
|---|---:|---:|---:|---:|
| Every party (20) | 1.8% (0–7%) | 17–49% | 8–43% | 0–45% |
| One of each (8), Humphrey's health carried (built) | 1.3% (0–6.5%) | 34% | 27% | 20% |
| The same, Humphrey at full health each stage | **12.5%** (7.8–16.5%) | 53% | 46% | 43% |

Of every stage lost, 92% end with Humphrey killed.

- **Humphrey's carried health is now the balance**: it takes runs from
  12.5% to 1.3% (as built since earlier today; 17.3% on 2026-10-26, before
  power 2 and the mountains). Stage 3, the Steppe's three heroes, is won a
  third of the time, and China's stages against a camel still hurt from
  the Steppe less still.
- **It makes the Alchemist the hero to have**, the only thing that heals
  Humphrey: parties with it win 3.1% of runs, without it 0.5%; the
  Storm Caller in its place costs 2–6 points of runs in four of six
  parties. With Humphrey at full health the order flips (the Alchemist's
  parties 11.3%, the Storm Caller's 13.8%): it is the carry-over, not the
  Elixir, that makes it a must-pick. The Horse Archer's parties win least
  either way (0.8% carried, 11.9% full), the Swordsman's reaching China
  1–7 points more than the Horse Archer's in the same party.
- **At full health every role is within about 3 points** (the Grappler
  14.1%, the Vanguard 10.9%; the Swordsman 13.2%, the Horse Archer 11.9%;
  the Storm Caller 13.8%, the Alchemist 11.3%), each about 2 standard
  errors: no strictly better hero.

**Skill expression.** One hero played by a novice or an expert, the rest
of both sides by production, in a Steppe mirror with that hero in its
role's seat on both sides (its side's wins):

| Played by | Grappler | Vanguard | Horse Archer | Swordsman | Storm Caller | Alchemist | Steppe party | China party |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Novice | 46.2% | 46.1% | 44.6% | 44.5% | 43.7% | 45.8% | 33.4% | 28.8% |
| Expert | 52.6% | 53.7% | 53.3% | 51.4% | 54.2% | 55.3% | 60.3% | 55.6% |
| Span | 6.4 | 7.6 | 8.7 | 6.9 | 10.5 | 9.5 | 26.9 | 26.8 |

In whole runs (the one-of-each parties, Humphrey's health carried): a
novice wins 0.6% of runs and reaches China in 20.7%, production 1.3% and
27.2%, an expert 2.3% and 37.8% (Steppe stage 3: 28%, 34%, 44%).

- **Play is worth about 27 points in a fight**, the same for either
  region: a whole party played a decision deep loses two in three to
  production, one played four deep wins three in five. The heroes' spans
  add up to about the party's, so no hero's worth hides in another's.
- **Supports reward play most, tanks least** (Storm Caller 10.5, Alchemist
  9.5; Grappler 6.4, Vanguard 7.6), as the roles suggest: a tank's job is
  to stand in front, a support's to pick its moment. The Swordsman (6.9)
  is the damage hero that rewards play less, its one hit and Haste leaving
  fewer choices than the Horse Archer's lanes.
- **In a run, play shows in how far it gets, not in runs won**: an expert
  reaches China nearly twice as often as a novice, but both rarely finish
  while Humphrey's health carries over. With runs near 1%, skill can't
  show at the end of a run.
- Limits: a deeper search is a stand-in for a player, who reads and plans
  differently; and the expert is only one decision deeper than the enemy.

Not changed: the numbers are the owner's. What would most help, measured
above: something that restores Humphrey between stages (or the carry-over
softened), after which every role is even within about 3 points.

### The Archer and Longshot (2026-10-27)

Asked for: whether the Archer as built (speed 2, defence 1, power 3,
Longshot: any unit on its six lines, at any range, never blocked) is in
line with the roster, whose seats measured within about 3 points of 50%
("The roster checked again"). `modWinPct`, 200 fights each (about ±3.5
points), production AI on both sides.

**In every seat** (`experiments/archer.mjs`), the Archer in place of:

| Seat | Steppe mirror | China mirror |
|---|---|---|
| Tank (Grappler, Vanguard) | 60% | 56.5% |
| Damage (Horse Archer, Swordsman) | 65% | 58.5% |
| Support (Storm Caller, Alchemist) | 66.8% | 60% |

**Too strong everywhere**, by 7 to 17 points: a shot of 3 that no front
line stops kills the 4-health heroes in two turns from anywhere on a line.

**Tuning** (`experiments/archer-tuning.mjs`), in the damage seat:

| Variant | Steppe | China |
|---|---|---|
| As built | 65% | 58.5% |
| Power 2 | 54% | 48.2% |
| Longshot's range 4 | 48.5% | 52% |
| Speed 1 | 59.5% | 51% |
| Defence 0 (health 2) | 53% | 53.3% |

- **Range 4 brings it in line** (48.5% and 52%) and keeps power 3, its
  identity: still the hardest hit on the roster, from up to 4 spaces over
  anything in between, where Snap Shot has no range but stops at the first
  unit.
- Power 2 also does (54%, 48.2%), but leaves it a Horse Archer that
  ignores blockers. Defence 0 is close (53%) but dies to any one hit of 2.
  Speed 1 isn't enough on the Steppe.
- Not changed: the owner's call. As built, `ABILITY.longshot.range` is
  `Infinity`; 4 is one line in config.ts.

### All nine heroes (2026-10-27)

Asked for: a balance check of all nine heroes, the Steppe's (Grappler,
Horse Archer, Storm Caller), China's (Vanguard, Swordsman, Alchemist) and
Persia's (Elephant Rider, Archer, Magus), each as built today (Longshot at
any range). `experiments/roster-nine.mjs`, `modWinPct`, **800 fights
each** (about ±1.8 points), seeds from 1000, production AI on both sides;
Persia's party is the Elephant Rider, the Archer and the Magus, one per
role. No whole runs: Persia isn't in a run yet.

**Each hero in every seat of the two other regions' mirrors** (the side
with the swap wins; 50% is the hero's equal there):

| In the seat of | Steppe | | | China | | | Persia | | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| | Grappler | Horse Archer | Storm Caller | Vanguard | Swordsman | Alchemist | Elephant | Archer | Magus |
| Grappler | | | | 48.8% | 58.3% | 52% | 42.8% | 25.9% | 63.1% |
| Vanguard | 52.7% | 52.9% | 50.5% | | | | 59.9% | 36.6% | 72.9% |
| Elephant Rider | 52.3% | 56.3% | 48.5% | 34% | 33.3% | 25.8% | | | |
| Horse Archer | | | | 49.1% | 50.1% | 48.3% | 54.6% | 34.1% | 64.8% |
| Swordsman | 50.1% | 52.8% | 47.5% | | | | 46.9% | 35.9% | 70.8% |
| Archer | 62.2% | 67.1% | 64.2% | 58% | 64.5% | 61.9% | | | |
| Storm Caller | | | | 55.6% | 56.2% | 48.9% | 54.9% | 36% | 68.6% |
| Alchemist | 53.9% | 52.5% | 46.4% | | | | 57.5% | 37.4% | 72.6% |
| Magus | 24.8% | 32.5% | 28.9% | 22.1% | 35.8% | 31.5% | | | |

Each hero's mean: in the six seats of the other regions, and its side's
wins when each of the six others takes its seat (its worth where it is):

| | Grappler | Vanguard | Elephant | Horse Archer | Swordsman | Archer | Storm Caller | Alchemist | Magus |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| In others' seats | 48.5% | 54.3% | 41.7% | 50.2% | 50.7% | **63%** | 53.4% | 53.4% | **29.3%** |
| Kept in its own | 50.7% | 55.4% | 47.2% | 47.6% | 50.3% | **65.7%** | 52.3% | 55.3% | **31.2%** |

Party against party: China beats the Steppe **56.1%**, Persia beats the
Steppe **56%**, Persia loses to China **29.6%**. Unfinished fights 0–0.6%
everywhere.

- **The six of the Steppe and China are still within about 3 points
  of each other in a role** (as "The roster checked again"): the
  Vanguard 52.7% for the Grappler, the Grappler 48.8% for it; the
  Swordsman and the Horse Archer 52.8% and 50.1%; the Alchemist and the
  Storm Caller 46.4% and 48.9%, each better in its own party.
- **The Archer is too strong, everywhere**: 58–67% in every seat, any
  other hero in its seat 26–37%. Within its role, 15 points or more over
  the Horse Archer and the Swordsman both ways. The 200-fight check above
  ("The Archer and Longshot") holds at 800; Longshot's range 4 measured in
  line there.
- **The Magus is too weak, everywhere**: 22–36% in every seat, any other
  hero in its seat 63–73%, about 20 points under the Storm Caller and the
  Alchemist both ways. Power 0 and a swap on the track don't make up for a
  hero that never hits, heals or Empowers: Conjunction is a whole turn
  spent moving two cards.
- **The Elephant Rider is weak, and depends on its party**: in the
  Steppe's seats about even (48.5–56.3%), in China's 25.8–34%, and the
  Vanguard in its seat 59.9%. Against the Grappler it holds both ways
  (52.3%, and 42.8% for the Grappler in its seat), against the Vanguard
  it loses both ways (34%, 59.9%). The tanks don't order cleanly; China's
  mirror, with Cleave's Delay 8 on a speed-1 hero and Swift Strike's
  Haste, is where it suffers, not yet traced.
- **Persia's party is even with the Steppe only because its extremes
  cancel**: the Archer's surplus and the Magus's deficit, each about 15–20
  points. Against China, whose Vanguard and Alchemist are the strongest of
  the first six, it loses 70–30.

**Skill**, the Persian heroes, as "The roster checked again" measured
the others (one hero played a decision deep or four deep, in its role's
seat of a Steppe mirror on both sides; its side's wins):

| Played by | Elephant Rider | Archer | Magus |
|---|---:|---:|---:|
| Novice | 45.4% | 48.5% | 44.3% |
| Expert | 52.6% | 52.6% | 53% |
| Span | 7.2 | **4.1** | 8.7 |

- The Elephant Rider (7.2) and the Magus (8.7) sit with their roles
  (tanks 6.4–7.6, supports 9.5–10.5, a little under). **The Archer
  rewards play least of all nine** (4.1, the damage heroes 6.9–8.7): a shot
  at any range on any line, never blocked, leaves little to choose.
  Longshot's range 4 should add choices back (where to stand).

Not changed: the numbers are the owner's. What would most help, in order:
the Archer's Longshot to range 4 (measured above); the Magus given
something that pays when Conjunction doesn't (a power above 0, or a hit
or Delay riding on the swap), then measured again; and the Elephant
Rider's loss in China's mirror traced before its numbers change.

### Archer nerfs and Magus buffs (2026-10-27)

Asked for: nerfs for the Archer other than Longshot's range, and buffs
for the Magus (the owner: the Elephant Rider is fine for now).
`experiments/archer-magus.mjs`, `modWinPct`, **800 fights each** (about
±1.8 points), the Archer in the damage seat and the Magus in the support
seat of a Steppe and a China mirror. The new switches, off as built:
`ABILITY.longshot.minRange`, `.camel`, `.falloff`, and
`ABILITY.conjunction.hit`, `.delay`.

**The Archer** (built 67.1% and 61.7%; 50% its equal):

| Variant | Steppe | China |
|---|---:|---:|
| As built | 67.1% | 61.7% |
| No shot at the spaces next to it (`minRange` 2) | 64.8% | 59.1% |
| A hit 1 less beyond 3 spaces (`falloff` 3) | 62.6% | 56.1% |
| A hit 1 less beyond 2 (`falloff` 2) | 58.9% | 53.1% |
| Can't shoot Humphrey (`camel` off) | 56.6% | 50% |
| Defence 0 (health 2) | 54.1% | 57.7% |
| Power 2 | 54.8% | 48.8% |
| *Range 4 ("The Archer and Longshot", 200 fights)* | *48.5%* | *52%* |

- **Humphrey is a third of the Archer's edge**: leaving the camel out
  takes 10 points off on the Steppe and 12 in China, keeping power 3 and
  any range. A shot over the guards at the caravan is what no one else
  has, and the camel's health is the run's ([camel.md](camel.md)).
- **Power 2 is the nearest alone** (54.8%, 48.8%), at the cost of its
  identity; falloff 2 does half as much; `minRange` 2 almost nothing (it
  seldom has an enemy next to it); defence 0 only on the Steppe.
- No single nerf but range 4 and power 2 brings it within 3 points on
  both maps. **The pair to try**: no camel with falloff 2 or defence 0
  (not measured together).

**The Magus** (built 28.9% and 31.4%):

| Variant | Steppe | China |
|---|---:|---:|
| As built | 28.9% | 31.4% |
| Speed 3 | 27.9% | 30.8% |
| Defence 2 (health 6) | 30.1% | 31.7% |
| Range 3 | 33.2% | 40.9% |
| Each enemy swapped Delayed 2 more | 32.5% | 38.4% |
| Each enemy swapped Delayed 3 more | 35.2% | 46.4% |
| Each enemy swapped hit, power 1 | 42.4% | 41.8% |
| Each enemy swapped hit, power 2 | 55.1% | 60.6% |
| **Hit at power 1 and range 3** | **52.3%** | **56.3%** |

- **Stats don't help**: more turns or more health for a hero whose turns
  do too little change nothing (speed 3 and defence 2 within noise).
  The kit is the problem.
- **More track control helps in China only** (Delay 3: 46.4% there, 35.2%
  on the Steppe): China's Vanguard and Swordsman lean on their own
  tempo, the Steppe's heroes less.
- **A hit on the enemies it swaps is what works**: power 1 lifts it 13
  points, power 2 overshoots (55–61%). **Power 1 with range 3 lands it
  even** (52.3%, 56.3%), more than either alone: range gives the hit more
  pairs to choose from. Within 3 points on the Steppe, about 6 over in
  China.
- The hit makes it a star-reader that also harms, against the pure
  track controller of its design (roster.md); a Delay rider keeps that
  identity but measured short.

Not changed: the owner's call.

### Longshot stopped by the first unit, and Conjunction as a bracket (2026-10-27)

Asked for (the owner): Longshot hitting the first thing in its path and
Piercing, its damage untouched; and Conjunction putting its first unit
just after the Magus's current turn and its second just after his next,
in place of a swap. `experiments/longshot-bracket.mjs`, the same seats,
seeds and 800 fights as "Archer nerfs and Magus buffs", whose *as built*
rows are the baseline. Switches, off as built: `ABILITY.longshot.first`,
`.pierce`; `ABILITY.conjunction.mode: 'bracket'`, `.once`.

| Variant | Steppe | China |
|---|---:|---:|
| Archer as built | 67.1% | 61.7% |
| **Archer, first unit or yurt in line, Piercing** | **47.6%** | **42.1%** |
| The same, and no shot at Humphrey | 42.8% | 34.3% |
| Magus as built | 28.9% | 31.4% |
| Magus, bracket | 47.9% | 60.1% |
| Magus, bracket, range 3 | 54.8% | 72.4% |
| **Magus, bracket, a unit not put back twice before it acts (`once`)** | **41.4%** | **46.6%** |
| The same, range 3 | 47.3% | 59.6% |

- **The Archer stopped by the first unit swings past even**: 20 points
  off on both maps, even on the Steppe, about 8 under in China. It is now
  a slower Snap Shot that hits for 3: the front line protects again, and
  Humphrey with it (leaving the camel out as well takes 5–8 points more,
  so not needed). Pierce changes nothing yet: Armour comes only from
  Hardened, which no hero has.
- **The bracket lifts the Magus 19–29 points, but it can lock a unit
  out**: the unit put after his next turn is again before his next turn
  when it comes, so he can put it back every turn, and it never acts
  while he lives and it stays within 2 (unfinished fights to 0.8–1.9%).
  The fixed-star limit (roster.md) assumed every card he moves still
  acts before he does again; the bracket breaks it.
- **With `once`** (a unit put back can't be put back again until it has
  acted) **the lock is gone and the Magus lands 41–47%**: 12–15 points up
  from the swap, without dealing damage, still 3–9 short. Range 3
  overshoots in China (59.6%). China's mirror again rewards track control
  more than the Steppe's.

Not changed: the owner's call. Built as switches only.

**Then** (the owner): Push on the first-unit Longshot, and the bracket's
second unit put just *before* the Magus's next turn (`mode: 'before'`), so
every unit he moves still acts before he does again and no lock is
possible (`once` not needed). `ABILITY.longshot.push`, same seats, seeds
and fights.

| Variant | Steppe | China |
|---|---:|---:|
| Archer, first in line, Piercing (above) | 47.6% | 42.1% |
| **The same, Push 1** | **50.3%** | **45.6%** |
| The same, Push 2 | 48.6% | 47.2% |
| Magus, bracket with `once` (above) | 41.4% | 46.6% |
| Magus, second just before his next turn | 32.4% | 41.3% |
| The same, range 3 | 37.5% | 51.6% |

- **Push brings the Archer in line**: Push 1 even on the Steppe and 4
  under in China, Push 2 within 3 points on both. Pushing the front line
  back gives the next shot a lane and keeps a melee hero off it.
- **Before his next turn is the weakest bracket**: 32–41%, only a few
  points over the swap. The second unit's Delay is what paid: put
  before his next turn, an enemy acting late anyway barely moves, and
  one already early is Delayed less than after it. Range 3 helps in
  China only (51.6%, 37.5% on the Steppe).

**Built since** (the owner, 2026-10-27): Conjunction as the bracket,
without `once` (`mode: 'bracket'` by default). The files measuring the
Magus before it (`roster-nine.mjs`, `archer-magus.mjs`) set `mode: 'swap'`.

### Longshot's effect (2026-10-27)

Asked for: an effect for the first-unit, Piercing Longshot other than
Push. Same seats, seeds and 800 fights (`longshot-bracket.mjs`);
`ABILITY.longshot.delay`, `.weaken`, `.pin` (Immobilized through the unit's
next turn, not an Unstoppable one), off as built.

| Effect | Steppe | China |
|---|---:|---:|
| None (above) | 47.6% | 42.1% |
| Push 1 (above) | 50.3% | 45.6% |
| Push 2 (above) | 48.6% | 47.2% |
| **Delay 2** | **49.3%** | **48.2%** |
| **Delay 3** | **49.4%** | **50.9%** |
| Weaken 1 | 50.8% | 43.2% |
| Weaken 2 | 50.9% | 45.5% |
| Pinned (Immobilized through its next turn) | 55.4% | 55% |

- **Delay is the most even of every Archer variant**: Delay 2 within 2
  points on both maps, Delay 3 within 1. An arrow that staggers its
  target sets the Archer on the track, as Cleave's Delay does the
  Vanguard, and it reads well from range.
- Pinning overshoots by 5 points on both: a unit that can't walk can't
  close on the Archer or leave its line, so the next arrow comes too.
- Weaken is even on the Steppe but short in China (43–46%): it blunts
  damage, and China's Alchemist heals and Empowers it back.

**Built since** (the owner, 2026-10-27): Delay 3, with the first unit and
Pierce (`first`, `pierce`, `delay: 3` by default). The files measuring the
Archer before it (`archer.mjs`, `archer-tuning.mjs`, `archer-magus.mjs`,
`roster-nine.mjs`, `longshot-bracket.mjs`) set the switches they were
measured with.

### Omen (2026-10-27)

Asked for: the Magus's ability on **one** unit, its side choosing the
effect as the Elixir's does (an ally acts next, an enemy just after the
Magus's next turn), with no guard; and whether it rewards play.
`experiments/omen.mjs`, 800 fights each, `ABILITY.conjunction.mode:
'omen'` (off as built) and `.rider` (the ally Empowered, the enemy
Weakened). In the support seat of a Steppe and a China mirror:

| Variant | Steppe | China |
|---|---:|---:|
| Conjunction as built (the bracket; above) | 47.9% | 60.1% |
| Omen, range 2 | 45.8% | 46.8% |
| **Omen, range 3** | **48.8%** | **51.7%** |
| Omen, range 2, rider 1 | 53.1% | 57.9% |
| Omen, range 3, rider 1 | 59.2% | 66.2% |

**Skill**, as "The roster checked again" measured it: the Magus played a
decision deep (novice) or four deep (expert), the rest of both sides by
production, in a Steppe mirror with a Magus on each side (its side's wins):

| Played by | Conjunction (bracket) | Omen, range 2 | Omen, range 3 |
|---|---:|---:|---:|
| Novice | 45.6% | 41.5% | 38.6% |
| Expert | 52.2% | 53.3% | 53.8% |
| Span | 6.6 | 11.8 | **15.2** |

- **Omen at range 3 is even on both maps** (48.8%, 51.7%), the first of the
  Magus's variants within 2 points on both, where the bracket is 12
  points over in China.
- **It rewards play more than any hero measured**: a span of 15.2, against
  the Alchemist's 9.5 and the Storm Caller's 10.5, the highest before. One
  unit and the side deciding the effect is the Elixir's choice; the
  bracket's pair, with more to pick from, rewards play least of the
  supports (6.6): with two units moved, a careless pick still lands one.
  A novice's Omen loses more than a production one (38.6%), so a bad
  read costs.
- The rider overshoots (53–66%): Empower and Weaken on top of the track
  move are too much.
- **Unfinished fights**: 0.4–1.4% in the seats, but 1.9–3.9% with a Magus
  on each side (the skill rows), at or over principle 12's 3%. Two Magi
  putting each other's side back stall; with no guard an Omen can still
  hold one enemy back each turn, and two Magi can each hold one.

**Built since** (the owner, 2026-10-28): Omen at range 3, no rider
(`mode: 'omen'`, `range: 3` by default), and the ability renamed Omen:
`ABILITY.omen`, id `omen`, the mode `single`. The notes above keep the
names of the day they were written. The files measuring the Magus
before it set the mode and range they were measured with.

### Trample as a stomp (2026-10-28)

Asked for: Trample with the Juggernaut staying where it is, every unit
next to it, ally or enemy, hit for its power and Pushed 1 away
(`ABILITY.trample.mode: 'stomp'`, off as built), against the charge as
built (a walk of up to 2 in a line, the row in its way hit and Pushed
back). `experiments/trample-stomp.mjs`, **1,600 fights each** (about
±1.25 points), seeds from 1000, `modWinPct` throughout. The stomp is
resolved as Rebound's push: the hits first, then each unit still standing
next to it Pushed 1 straight away, one at a time in the order for cards
placed at the same moment; one with a unit or yurts behind it stays, hit.

| | Charge (built) | Stomp |
|---|---:|---:|
| Juggernaut in the Grappler's seat, Steppe mirror | 53.8% | **39%** |
| Juggernaut in the Vanguard's seat, China mirror | 33.9% | **26.3%** |
| Grappler in its seat, Persia mirror (lower is better for it) | 47.3% | **60.3%** |
| Vanguard in its seat, Persia mirror | 56.1% | 61% |
| Persia against the Steppe | 60.4% | **44.8%** |
| Persia against China | 45.9% | **37.3%** |
| Played by a novice, Steppe seat on both sides | 46% | 44.3% |
| Played by an expert | 52% | 53.9% |
| Span | 6 | 9.6 |

Its turns (the Juggernaut's share, in its Steppe seat): the charge 37%
Trample, 55% walks, 9% Hold; the stomp 21% Trample, 63% walks, 17% Hold.

- **The stomp is 8–15 points weaker than the charge in every seat**, and
  turns Persia from even-to-ahead into behind both other regions. The
  Grappler and the Vanguard now beat it in its own seat (60–61%).
- **It's a speed-1 melee hit that throws its targets out of reach.** The
  charge closes up to 2 spaces and hits in the same turn; the stomp needs
  units already next to it, so the Juggernaut walks more and Holds about
  twice as often (nothing next to it, or only allies). And each enemy it
  Pushes 1 away must be walked back to before the next stomp, while the
  charge ends next to the row it drove.
- **It rewards play a little more** (span 9.6 against 6): when to wait for
  enemies to close, and keeping allies off its sides, matter more than
  lining up a charge.
- Unfinished fights 0.1–2.8%, as the charge's.
- Not measured: a stomp without the Push (a plain hit all round), or with
  power 3; either would close part of the gap, as the Push is what
  costs it its next turn's targets.

Not built: the charge stays (`mode: 'charge'` by default).

**A step first** (later that day): the stomp after a step of 1, as
Skirmish's, or none (`step: 1`): the Juggernaut steps onto any free space
next to it, or stays, and stomps where it ends. Same seats, seeds and
1,600 fights:

| | Charge (built) | Stomp | **Step, then stomp** |
|---|---:|---:|---:|
| Juggernaut in the Grappler's seat, Steppe mirror | 53.8% | 39% | **56.5%** |
| Juggernaut in the Vanguard's seat, China mirror | 33.9% | 26.3% | **41.2%** |
| Grappler in its seat, Persia mirror (lower is better for it) | 47.3% | 60.3% | 48.2% |
| Vanguard in its seat, Persia mirror | 56.1% | 61% | **52.5%** |
| Persia against the Steppe | 60.4% | 44.8% | **66.6%** |
| Persia against China | 45.9% | 37.3% | **49.7%** |
| Played by a novice | 46% | 44.3% | 44.8% |
| Played by an expert | 52% | 53.9% | 54% |
| Span | 6 | 9.6 | 9.2 |

Its turns in its Steppe seat: 42.5% Trample, 46.7% walks, 10.8% Hold.

- **The step makes the stomp the stronger Trample**: 1–7 points over the
  charge in every seat but the Grappler's swap (even, 48.2% to 47.3%), and
  15–17 points over the stomp in place. It now reaches as far as the
  charge (a unit 2 away), and an enemy it Pushes is a step away for the
  next one, so it walks less and Tramples more than either.
- **China is still its weak mirror**, 41.2%, but 7 points closer than the
  charge's 33.9%; the Vanguard no longer beats it clearly in its own seat
  (52.5%).
- **Persia against the Steppe goes to 66.6%**, 6 over the charge; the
  Archer's surplus (above) is most of Persia's lead there already.
- It keeps the stomp's reward for play (span 9.2, the charge's 6).
- Unfinished fights 0.1–2.6%, as the others'. A Juggernaut felled by hail
  on its step doesn't stomp.

**Built since** (the owner, 2026-10-28): the step, then the stomp
(`mode: 'stomp'`, `step: 1` by default). `trample-stomp.mjs` sets the mode
and step of each row, so it still reproduces. Since then a step may
also go onto an enemy next to it, shoving it 1 on first (roster.md),
which these rows didn't measure. The ability was then renamed Stomp
(`ABILITY.stomp`, id `stomp`); the notes above keep the name of the day
they were written.

### Longshot's Push, flying over the spaces next to the Ranger (2026-10-28)

Asked for (the owner): is Longshot weak without its Push, now that it
flies over the spaces next to the Ranger (`minRange` 2, a unit or yurt
there passed over) and hits the first unit beyond? `experiments/longshot-push.mjs`,
the seats, seeds and 800 fights of "Longshot's effect" (about ±1.8
points); `ABILITY.longshot.push` 0, 1 (as built) and 2, no Delay.

| Push | Steppe | China |
|---|---:|---:|
| *Stopped by the next space, no effect ("Longshot's effect")* | *47.6%* | *42.1%* |
| *Stopped by the next space, Push 1 (the same)* | *50.3%* | *45.6%* |
| None | 49.6% | 46.6% |
| **1 (as built)** | **55.2%** | **48.9%** |
| 2 | 54.5% | 47.9% |

- **Not weak without the Push**: no Push is even on the Steppe and 3
  under in China, both inside the target band. Flying over the next
  space is worth 2–4 points on its own (the front line no longer
  shields the enemy behind it), about what the Push was worth before.
- **With the Push it now overshoots on the Steppe** (55.2%, 5 over) and
  is about even in China; Push 2 changes nothing over Push 1.

**Built since** (the owner, 2026-10-28): no Push (`push: 0` by default).
`longshot-push.mjs` sets the Push of each row, so it still reproduces.

### The Priest (2026-10-28)

Asked for (the owner): the Priest, Byzantium's support, speed 2, defence
1, power 3, with Blessing (an ally within 2, himself and Humphrey too,
healed his power, the rest of the heal Shield until the ally's next
turn). `experiments/priest.mjs` and `priest-buffs.mjs`: the Priest in
the support seat of a Steppe, a China and a Persia mirror (in place of
the Storm Caller, the Alchemist and the Magus), 400 fights each (about
±2.5 points), `modWinPct`, Humphrey on the field. The target band is
45–55%.

| Priest | Steppe | China | Persia |
|---|---:|---:|---:|
| **As built** | **42.7%** | **22.8%** | **41.6%** |
| Power 2 | 32.6% | 19.8% | 30.3% |
| No overheal (heal only) | 29.7% | 27.5% | 34.3% |
| Shield 1 on top of the heal (`shield: 1`) | 47.7% | 23.3% | 46.1% |
| Humphrey not a target (`camel: false`) | 37.8% | 21.5% | 39.2% |
| Range 3 | 46.4% | 25.0% | |
| Speed 3 | 43.1% | 32.0% | |
| Defence 2 | 44.8% | 25.3% | |
| The AI valuing a Shield in full (`AI.shieldShare` 1) | 41.3% | 20.5% | |
| An enemy within 2 hit for his power (`smite`) | 60.4% | 47.5% | |
| Smite and speed 3 | 70.8% | 69.8% | |

- **Weak as built**, most in China's seat, where he replaces the
  Alchemist (22.8%): a side with a Priest has one hero fewer that hits,
  and the 4-health heroes of these fights die to two or three hits,
  faster than a heal of 3 every 9 slots mends them.
- **The overheal is most of his worth**: without it he loses 7–13
  points on the Steppe and in Persia. Power is worth about 10 points a
  point. The camel's heals are worth 2–5 points.
- **No defensive buff closes the gap in China**: a Shield of 1 on top,
  range 3, speed 3 or defence 2 each add 1–9 points; the AI's
  valuation of a Shield isn't the cause (shieldShare 1 changes nothing).
- **A smite does**: Blessing hitting an enemy for his power, as the
  Elixir does, brings him to 60.4% and 47.5%, the Alchemist's shape.
  With speed 3 too it's far too strong (70%).

**Built as measured** (the owner to decide): no smite. The likeliest
tunings are the smite at power 2 (power 3 already overshoots the
Steppe), or a Shield of 1 on top with a second, damaging ability as an
upgrade; neither is measured yet.

### Blessing as a Shield, on one ally or every ally near (2026-10-28)

Asked for (the owner): Blessing giving Shield equal to the Priest's power
in place of the heal, and whether on every nearby ally it's too strong.
`experiments/priest-shield.mjs`, the seats and 400 fights of "The Priest"
(about ±2.5 points); `ABILITY.blessing.heal` off, `shape` `unit` (one
ally within 2) or `aura` (every ally within `radius` of him, himself
too).

| Blessing | Steppe | China | Persia |
|---|---:|---:|---:|
| *Heal 3, the rest Shield (as built, "The Priest")* | *42.7%* | *22.8%* | *41.6%* |
| Shield 3, one ally within 2 | 36.3% | 20.8% | 30.1% |
| Shield 3, every ally within 1 | 27.4% | 16.8% | 23.6% |
| Shield 2, every ally within 1 | 25.6% | 15.0% | 18.8% |
| Shield 2, every ally within 2 | 37.1% | 18.0% | 35.4% |
| Shield 1, every ally within 2 | 21.8% | 13.5% | 21.9% |

- **A Shield alone is worth less than the heal** by 2–12 points: it goes
  at the ally's next turn, so a Shield on an ally who acts before the
  enemy reaches it is wasted, where a heal keeps.
- **Not too strong on every ally: weaker.** Within 1 he must stand in
  the front line to reach two allies, and as a 4-health hero dies there;
  within 2 (Shield 2) it is about the single Shield's worth, not more.
- Part of the gap may be the AI's (it values a Shield by the hits that
  could reach the ally now); not measured.

**Built as measured**: the heal and overheal stay; `heal` and `shape`
are switches, off. Untried: a Shield lasting until the Priest's next
turn, so each covers a full round whoever acts first.

### A lasting Shield (2026-10-28)

Asked for (the owner): can the Shield be permanent? `ABILITY.blessing.lasts`:
a Blessing's Shield stays until damage spends it, not until the ally's
next turn, a unit holding at most `cap` of it (3, his power; so
he can't stack it without end). `experiments/priest-lasting.mjs`, the
seats and 400 fights of "The Priest" (about ±2.5 points).

| Blessing | Steppe | China | Persia |
|---|---:|---:|---:|
| *Heal 3, the rest Shield until the ally's turn (as built)* | *42.7%* | *22.8%* | *41.6%* |
| Heal 3, the rest a lasting Shield | 41.9% | 47.0% | 47.4% |
| **A lasting Shield of 3, one ally within 2** | **44.6%** | **44.5%** | **45.9%** |
| The same, up to 6 on a unit (`cap` 2) | 40.4% | 39.5% | 45.9% |
| A lasting Shield of 3, every ally within 1 | 40.3% | 39.0% | 37.7% |
| A lasting Shield of 2, every ally within 2 | 44.2% | 39.5% | 36.5% |

- **Lasting fixes China**: 22.8% to 44.5–47%, the first version of the
  Priest even in all three seats without a smite. A Shield that waits for
  the hit is never wasted on an ally the enemy doesn't reach first.
- **A lasting Shield of 3 on one ally** is the most even (44.5–45.9%),
  a little under the band; the heal with a lasting overheal is as good
  in China and Persia, 42% on the Steppe.
- **Stacking to 6 is worse**, not better: the AI piles it on one unit.
- **Every ally is still not too strong**: 37–44%, under the single
  ally, for the front-line reason in "Blessing as a Shield".

**Built as measured**: `lasts` off, the owner to choose.

### A heal and a lasting Shield of 1 (2026-10-28)

Asked for (the owner): Blessing healing the Priest's power, and on top a
Shield of 1 that stays until damage breaks it. `experiments/priest-heal-shield1.mjs`:
`overheal` off, `shield` 1, `lasts`, a unit holding at most `cap` (1, no
stacking; 2; 3), the seats and 400 fights of "The Priest".

| Blessing | Steppe | China | Persia |
|---|---:|---:|---:|
| *Heal 3, the rest Shield until the ally's turn (as built)* | *42.7%* | *22.8%* | *41.6%* |
| *A lasting Shield of 3, one ally ("A lasting Shield")* | *44.6%* | *44.5%* | *45.9%* |
| Heal 3 and a lasting Shield of 1, at most 1 on a unit | 35.8% | 39.0% | 40.7% |
| The same, at most 2 | 34.1% | 35.0% | 39.5% |
| The same, at most 3 | 34.5% | 34.3% | 37.6% |

- **Better than built in China** (39% from 22.8%), the lasting Shield's
  doing, but **6–9 points under a lasting Shield of 3** in every seat,
  and under the built overheal on the Steppe: the heal is worth less
  than the Shield when most hits fall on allies at full health, and 1
  is little against hits of 2 or 3.
- Stacking makes it worse again (the AI piles it on one ally).

**Built as measured**: off, the owner to choose.

### A heal, its excess and 1 more as a lasting Shield (2026-10-28)

Asked for (the owner): heal the Priest's power, the heal beyond the
ally's missing health becoming Shield, and 1 more on top, all of it
lasting until damage spends it. `experiments/priest-overheal-shield1.mjs`:
`overheal`, `shield` 1, `lasts`, a unit holding at most `cap` (3, his
power; 4, one Blessing on an unhurt ally; 8), the seats and 400 fights
of "The Priest" (about ±2.5 points).

| Blessing | Steppe | China | Persia |
|---|---:|---:|---:|
| *As first built: the excess Shield until the ally's turn* | *42.7%* | *22.8%* | *41.6%* |
| *A lasting Shield of 3, no heal ("A lasting Shield")* | *44.6%* | *44.5%* | *45.9%* |
| *Heal and a lasting Shield of 1 ("A heal and a lasting Shield of 1")* | *35.8%* | *39.0%* | *40.7%* |
| **Heal, the excess and 1 more lasting, at most 3** | **50.3%** | **50.3%** | **52.0%** |
| The same, at most 4 | 54.5% | 50.9% | 53.0% |
| The same, at most 8 | 43.2% | 50.5% | 52.8% |

- **Even in every seat at cap 3**, the first version of the Priest inside
  the band everywhere: the heal mends the hurt, the overheal shields the
  unhurt, and the 1 on top gives a badly hurt ally a Shield too.
- Cap 4 is 1–4 points stronger, still in the band but at its top on the
  Steppe; cap 8 lets the AI pile Shield on one unit, worse on the Steppe.

**Built** (the owner, later 2026-10-28): `overheal`, `shield` 1, `lasts`,
`cap` 3.

### All twelve heroes (2026-10-28)

Asked for: a balance check of all twelve heroes, the nine of "All nine
heroes" as built today (Omen, Longshot first-in-line with Pierce and
Delay 3, Stomp) and Byzantium's three (Cataphract, Barbarian, Priest).
`experiments/roster-twelve.mjs`, `modWinPct`, **400 fights each** (about
±2.5 points), seeds from 1000, production AI on both sides; each region's
party one per role, tank, damage, support. Unfinished fights 0–1.3%, up
to 7.8% with the Priest or the Storm Caller in Byzantium's party.

Party against party (the second side's wins):

| | Steppe | China | Persia |
|---|---:|---:|---:|
| China | 57.5% | | |
| Persia | 66.9% | 49.8% | |
| **Byzantium** | **8.6%** | **9.8%** | **24.8%** |

Each hero in its role's seat of the other regions' mirrors (the side with
the swap wins; 50% is the hero's equal there):

| Tank seat of | Steppe | China | Persia | Byzantium |
|---|---:|---:|---:|---:|
| Grappler | | 47.5% | 42.9% | 73.2% |
| Vanguard | 54.3% | | 57.2% | 79.3% |
| Juggernaut | 62.8% | 39.6% | | 68.6% |
| Cataphract | 36.5% | 20.3% | 46.5% | |

| Damage seat of | Steppe | China | Persia | Byzantium |
|---|---:|---:|---:|---:|
| Outrider | | 54.8% | 45.2% | 52.2% |
| Duelist | 53% | | 41.6% | 52.5% |
| Ranger | 50.5% | 45.3% | | 51.1% |
| Barbarian | 39% | 38.8% | 25.6% | |

| Support seat of | Steppe | China | Persia | Byzantium |
|---|---:|---:|---:|---:|
| Storm Caller | | 44.5% | 43.2% | 70% |
| Alchemist | 60% | | 52.4% | 54.5% |
| Magus | 50.8% | 46% | | 48.9% |
| Priest | 50.3% | 44.5% | 50.9% | |

Each hero's mean: in the nine seats of the other regions (any role), and
its side's wins when each of the nine others takes its seat:

| | In others' seats | Kept in its own |
|---|---:|---:|
| Grappler | 54.7% | 50.5% |
| Outrider | 49.8% | 49.1% |
| Storm Caller | 55% | 49.8% |
| Vanguard | **60.3%** | **61.5%** |
| Duelist | 50.1% | 51.5% |
| Alchemist | 53.1% | 62.4% |
| Juggernaut | 54.1% | 52.8% |
| Ranger | 48.7% | 59.2% |
| Magus | 48.9% | 56.4% |
| Cataphract | **32.4%** | **36.9%** |
| Barbarian | **34%** | 42.4% |
| Priest | 47.4% | 39.1% |

- **The first nine are now within the band** but for the Vanguard: the
  Ranger (45–51% in the damage seats) and the Magus (46–51% in the
  support seats) are no longer the outliers of "All nine heroes", their
  reworks (Longshot first-in-line, Omen) closing 15–20 points each.
  Persia beats the Steppe 66.9% and holds China even.
- **The Vanguard is the strongest hero**: 54–79% in the tank seats, 60%
  over all seats, and China's seat holds against every other tank
  (the Grappler 47.5%, the Juggernaut 39.6%, the Cataphract 20.3%).
- **Byzantium is far too weak, the Cataphract and the Barbarian both**:
  its party wins 9–25%; the Cataphract 20–47% in the tank seats, any other
  tank in its seat 69–79%; the Barbarian 26–39% in the damage seats,
  any other in its seat about even (51–52%), so his loss is his own.
  Speed 1 and Reave, and Charge with no walk of its own, cost each about
  15 points.
- **The Priest is about even** (44.5–50.9%), as measured when Blessing
  was built; his party's 39% when others take his seat is the weak tank
  and damage hero around him, not his.

Not changed: the numbers are the owner's. What would most help, in order:
the Cataphract and the Barbarian measured with buffs (a walk for the
Cataphract, or Charge hitting harder; speed 2 for the Barbarian); then
the Vanguard looked at, the one hero over the band.

**Changed** (the owner, later 2026-10-28), not yet measured: Charge
carries every unit in its way as a row while there is room (the first
only before); the Barbarian's Reave replaced by Axe Throw (any unit
within 3 in line, over everything, hit and Pushed 1, no pickup); Cleave's
Delay 6 (8 before).

### All twelve heroes, after the owner's changes (2026-10-28)

Asked for: "All twelve heroes" again, on the owner's changes of later
2026-10-28 (Charge carrying a row, Axe Throw in place of Reave, Cleave's
Delay 6). `experiments/roster-twelve.mjs` unchanged, 400 fights each
(about ±2.5 points), the same seeds; rows with none of the three changed
heroes repeat the first run exactly.

Party against party (the second side's wins; before in brackets):

| | Steppe | China | Persia |
|---|---:|---:|---:|
| China | 49.8% (57.5%) | | |
| Persia | 66.9% (66.9%) | 52.5% (49.8%) | |
| **Byzantium** | **31.3%** (8.6%) | **26.8%** (9.8%) | **37.5%** (24.8%) |

| Tank seat of | Steppe | China | Persia | Byzantium |
|---|---:|---:|---:|---:|
| Grappler | | 57.4% | 42.9% | 80.5% |
| Vanguard | 49% | | 53% | 78.3% |
| Juggernaut | 62.8% | 51.8% | | 77.9% |
| Cataphract | 36.8% | 35.6% | 47% | |

| Damage seat of | Steppe | China | Persia | Byzantium |
|---|---:|---:|---:|---:|
| Outrider | | 49.8% | 45.2% | 41.8% |
| Duelist | 53% | | 41.6% | 40.8% |
| Ranger | 50.5% | 44.3% | | 36.3% |
| Barbarian | 50% | 49.1% | 35.9% | |

| Support seat of | Steppe | China | Persia | Byzantium |
|---|---:|---:|---:|---:|
| Storm Caller | | 42.5% | 43.2% | 46.3% |
| Alchemist | 60% | | 52.4% | 46.6% |
| Magus | 50.8% | 40.5% | | 49.5% |
| Priest | 50.3% | 42.3% | 50.9% | |

Means (in the nine seats of the other regions; its side's wins with each
of the nine others in its seat): the Vanguard 51.5% and 49.9% (60.3%,
61.5%), the Barbarian 44.9% and 55.9% (34%, 42.4%), the Cataphract 33.3%
and 28.8% (32.4%, 36.9%); the other nine within 2 points of before.

- **The Vanguard is even**: 49–53% in the Steppe's and Persia's tank
  seats, any other tank in China's 52–57%; China against the Steppe
  49.8%. Its 78% in Byzantium's seat is the Cataphract's weakness.
- **The Barbarian is fixed**: 36–50% in the damage seats (26–39%), and
  the other damage heroes in his seat 36–42%, so Axe Throw is now the
  better hero in Byzantium's party. Weak only in Persia's seat (35.9%),
  where the Ranger outranges him.
- **The Cataphract is still far too weak**: 36–47% in the tank seats
  (20–47%), any other tank in its seat **78–81%**. Carrying a row helped
  most in China (20.3% to 35.6%), little elsewhere. Byzantium's party is
  27–38% because of it alone.
- Unfinished fights up to 10% with the Storm Caller or the Magus in
  Byzantium's party (two heroes that never hit beside the Priest).

Not changed. Next, the Cataphract's buffs measured: Charge Delaying what
it hits (the Vanguard's kind of control, which tanks win by), a walk of
1, power 2.

**Changed** (the owner, 2026-10-29): the Cataphract Armoured, Armour 1
against every hit unless it Pierces.

### The Cataphract Armoured (2026-10-29)

`experiments/roster-twelve.mjs`, only its 39 rows the Cataphract is in
(the rest unchanged from the run above), 400 fights each, the same seeds.
Before (from the run above) in brackets.

| | Steppe | China | Persia |
|---|---:|---:|---:|
| Byzantium against | **45.8%** (31.3%) | **40.8%** (26.8%) | **50.3%** (37.5%) |

| | In Steppe's tank seat | China's | Persia's |
|---|---:|---:|---:|
| The Cataphract | 46.8% (36.8%) | 58% (35.6%) | 53.2% (47%) |

| In Byzantium's tank seat | Grappler | Vanguard | Juggernaut |
|---|---:|---:|---:|
| Its side wins | 65% (80.5%) | 61.8% (78.3%) | 62.3% (77.9%) |

- **In the band away from home**: 47–58% in the other regions' tank
  seats, the top of the band in China's; 44.9% over all nine seats
  (33.3%).
- **Byzantium's party 41–50%** (27–38%), the first time inside or near
  the band, lowest against China.
- **Still the weakest tank in its own party**: any other tank there wins
  62–65%. Untraced; a guess is that its Charge carries and hits its own
  allies (the Barbarian and the Priest stand near it), and its lack of a
  walk leaves it out of place after a charge.

**Changed** (the owner, 2026-10-29): Charge's slam, a unit it hits left
against ruins or the map's edge Stunned for its next turn.

### Charge's slam (2026-10-29)

`experiments/roster-twelve.mjs`, the Cataphract's 39 rows again, Armoured
and with the slam (`ABILITY.charge.stun`), 400 fights each, the same
seeds. Armoured alone ("The Cataphract Armoured") in brackets.

| | Steppe | China | Persia |
|---|---:|---:|---:|
| Byzantium against | **56.1%** (45.8%) | **80.6%** (40.8%) | **63.4%** (50.3%) |

| | Steppe's tank seat | China's | Persia's |
|---|---:|---:|---:|
| The Cataphract | 63.4% (46.8%) | **85.6%** (58%) | 70.7% (53.2%) |

| In Byzantium's tank seat | Grappler | Vanguard | Juggernaut |
|---|---:|---:|---:|
| Its side wins | 34.3% (65%) | 33.6% (61.8%) | 27.1% (62.3%) |

- **Far too strong now**: 63–86% in the other tank seats, the strongest
  hero on the roster (69.7% over all nine seats; the Vanguard at 8 was
  60.3%). Byzantium beats China 80.6%. Each slam costs the enemy a whole
  turn, the most a single ability takes; Stunning only the front of a row
  doesn't hold it back, since most charges carry one unit.
- **Stalls in the Byzantine mirror**: with a Cataphract on each side (a
  hero in the Barbarian's seat), 24–50% of fights reach the 400-action
  cutoff unfinished (0.5–7% elsewhere); the two Stun each other against
  the edge. Those rows' win rates mean little.

Untried, likeliest to land in the band: the slam without Armour (Armour
alone gave 47–58%, the slam on top 15–28 points more); or the slam kept
with Armour but a Delay (say 4) in place of the Stun, or only against
ruins, not the map's edge.

**Changed** (the owner, 2026-10-29): the slam kept, Armoured taken off
the Cataphract.

### The slam without Armour (2026-10-29)

The Cataphract's 39 rows again, the slam and no Armour, 400 fights each,
the same seeds. Armoured alone, then Armoured with the slam, in brackets.

| | Steppe | China | Persia |
|---|---:|---:|---:|
| Byzantium against | **41.5%** (45.8%, 56.1%) | **69.1%** (40.8%, 80.6%) | **53.8%** (50.3%, 63.4%) |

| | Steppe's tank seat | China's | Persia's |
|---|---:|---:|---:|
| The Cataphract | 50.1% (46.8%, 63.4%) | **74.7%** (58%, 85.6%) | 60.6% (53.2%, 70.7%) |

| In Byzantium's tank seat | Grappler | Vanguard | Juggernaut |
|---|---:|---:|---:|
| Its side wins | 48.9% (65%, 34.3%) | 47.4% (61.8%, 33.6%) | 51.4% (62.3%, 27.1%) |

- **The gap in its own party is closed**: any other tank in Byzantium's
  seat 47–51%, even with it, the first time.
- **Even in the Steppe's party (50.1%), a little strong in Persia's
  (60.6%), far too strong in China's (74.7%)**, and Byzantium beats China
  69.1%. Not traced; China's Duelist and Alchemist have 4 health and the
  Vanguard acts every 10 slots, so a lost turn may cost it most.
- Stalls in the Byzantine mirror lower but still 15–26% of fights with
  the Storm Caller or the Magus in Byzantium's party (24–50% with
  Armour).

Untried: the slam Delaying (say 4–6) in place of the Stun, or Stunning
only against ruins, not the map's edge, to bring China's seat down and
end the stalls.

**Changed** (the owner, later 2026-10-29): the slam Delays in place of
the Stun, Delay 4 the builder's first number (`ABILITY.charge.delay`).

### The slam as a Delay (2026-10-29)

`experiments/slam-delay.mjs`: the Cataphract's 39 rows with the slam
Delaying 4 and 6, no Armour, 400 fights each, the same seeds. The Stun
("The slam without Armour") in brackets.

| | Delay 4 | **Delay 6** | (Stun) |
|---|---:|---:|---:|
| Byzantium against the Steppe | 29.6% | **34.8%** | (41.5%) |
| against China | 35% | **46.5%** | (69.1%) |
| against Persia | 44.4% | **45.2%** | (53.8%) |
| The Cataphract in the Steppe's tank seat | 40.3% | **42%** | (50.1%) |
| in China's | 53% | **53.5%** | (74.7%) |
| in Persia's | 51.1% | **53.6%** | (60.6%) |
| Another tank in Byzantium's seat | 67–74% | **59–69%** | (47–51%) |

- **Delay 6 is better than 4 everywhere**, and built.
- **In the band in China's and Persia's seats** (53.5%, 53.6%), a little
  under in the Steppe's (42%); China's surplus with the Stun gone.
- **Byzantium's party 35–47%**, weakest against the Steppe, and another
  tank in its own seat still wins 59–69%: the gap the Stun closed is back,
  smaller than Armoured alone left it (62–65%).
- Stalls back to normal (at most 11% of fights, from 15–26%).

Between the Delay and the Stun lies what the Cataphract wants: Delay 8
(the Vanguard's first Cleave), or Delay 6 with Armoured back, are the
next to try.

### The slam's Delay 6 with Armoured back (2026-10-29)

`experiments/slam-armour.mjs`: the Cataphract's 39 rows, the slam Delaying
6 and the Cataphract Armoured, 400 fights each, the same seeds. Not built.

| | Delay 6 | **Delay 6, Armoured** | Stun, no Armour | Armoured alone |
|---|---:|---:|---:|---:|
| Byzantium against the Steppe | 34.8% | **51.4%** | 41.5% | 45.8% |
| against China | 46.5% | **63.8%** | 69.1% | 40.8% |
| against Persia | 45.2% | **54.8%** | 53.8% | 50.3% |
| The Cataphract in the Steppe's tank seat | 42% | **57%** | 50.1% | 46.8% |
| in China's | 53.5% | **71.8%** | 74.7% | 58% |
| in Persia's | 53.6% | **60%** | 60.6% | 53.2% |
| Another tank in Byzantium's seat | 59–69% | **43–52%** | 47–51% | 62–65% |

- **The gap in its own party is closed** (another tank 43–52%), as with
  the Stun, and Byzantium even with the Steppe and Persia (51.4%, 54.8%).
- **Strong again against China**: 71.8% in China's seat, Byzantium 63.8%;
  a little strong in the Steppe's and Persia's (57%, 60%). China is the
  outlier in every version with the slam or Armour; not traced.
- Stalls normal (at most 11%).

Between Delay 6 alone and this: Delay 4 with Armoured (Delay 4 measured
2–12 points under 6 without it), or Delay 6 Armoured only against hits
from in front.

**Built** (the owner, 2026-10-29, "for now"): Delay 6 with Armoured.

### Track time (2026-10-29)

`experiments/track-time.mjs`: the effects that last by turns lasting a
window of slots instead (`RULES.trackTime`): `own`, a turn of slots the
unit's action cost when given; 10 and 12 slots a turn for every unit. The
regions' parties against each other, the abilities with those effects
(one side without), a point of speed on each hero in its region's mirror,
and the China boss stage; 400 fights each, the same seeds. Run on the
rules of `31f251f` (the slam a Stun, no Armour) with the switches of
`80be4c2`; on later rules the `own-stun` rows need `ABILITY.charge.slam`
at `stun`. Not built.

In the kits as built only the Elixir's Empower and Weaken and the Storm
Caller's hail change: the Priest's Blessing Shield is lasting, Rally is
not drafted, and Princess Iron Fan's stage is won 98–100% either way.
Persia's and Byzantium's own rows came out exactly the same in every mode.

| | By turns | own | 10 | 12 |
|---|---:|---:|---:|---:|
| A side without the Elixir (China) | 9.5% | 8.5% | 6.5% | **4%** |
| without hail (Steppe) | 15.5% | 15.5% | 14.8% | 14.3% |
| Speed +1, mean of the six Steppe and China heroes | 60.7% | 62% | 61.9% | 62.5% |
| the Duelist | 76% | 78% | 77.3% | **81.2%** |
| the Alchemist | 57.3% | 61.3% | 61.8% | 61% |
| the Storm Caller | 60.3% | 60.5% | 61.5% | 62.5% |
| China against the Steppe | 49.8% | 52% | 53% | 49.8% |
| Persia against China | 52.5% | 54.5% | 54.8% | 53.5% |
| Byzantium against China | 69.1% | 68% | 67.2% | 65.3% |

- **Balance barely moves**: party against party within 3 points of by
  turns in every mode, inside the noise (about ±5 points at 400 fights),
  and fights as long.
- **Speed is worth a little more, as feared, but only 1–2 points**, most
  with a fixed 12 (the Duelist, already the strongest speed point, 81%).
- **The Elixir is worth more the longer the window** (its side without
  it 9.5% to 4%): a fast unit gets more than one Empowered action from it.
- The AI doesn't plan for windows (a Haste into one, a Delay out of one),
  so the timing choices track time adds aren't played here.

The slam as a Delay of the unit's action cost (`RULES.stunAsDelay`, with
`own`), the Stun in brackets: Byzantium against China 57.5% (69.1%),
Persia 47% (53.8%), the Steppe 45.6% (41.5%); a side without Charge
18.1% (7.7%); stalls 0–2% (5–11%). Between Delay 6 ("The slam as a
Delay") and the Stun, as Delay 8 would be.

### Track time with an AI that counts windows (2026-10-29)

`experiments/track-time-ai.mjs`, on the rules of `d36fdb6` (the slam
Delaying 6, the Cataphract Armoured): "Track time" again with the AI
counting windows (`AI.windows`): an Empower or Weaken once for each of the
unit's turns within it (so a Delay out of one, or a Haste into one,
counts), a Shield only against the enemies acting while it lasts, and hail
lifting before the unit it holds acts as holding nothing. Also Rally (19.8)
on each region's tank, the only Shield the window changes (the Blessing's
is lasting). 400 fights each, the same seeds. Not built.

The AI counting windows against the one that doesn't (its side's wins):

| | own | 10 | 12 |
|---|---:|---:|---:|
| Steppe mirror | 49.5% | 49.8% | 50% |
| China mirror | 50% | 50.8% | 51.4% |
| With Rally on every tank: Steppe | 52.5% | 53.3% | 51% |
| China | 50.8% | 51.5% | 53.1% |
| Persia | 53.6% | 54.2% | 52.6% |
| Byzantium | 49.2% | 49.2% | 51.1% |

| | By turns | own | 10 | 12 |
|---|---:|---:|---:|---:|
| A side with Rally on its tank: Steppe | 51% | 55.5% | 55.8% | 54.8% |
| China, Persia, Byzantium | 47.6–51.8% | 48.5–51.5% | 50–51.5% | 48.5–52.3% |
| A side without the Elixir (China) | 9.5% | 8.8% | 5% | 4% |
| Speed +1, mean of the six Steppe and China heroes | 60.7% | 62.1% | 62.2% | 62.3% |
| the Duelist | 76% | 78.3% | 78.3% | **83.3%** |
| Party against party | 49.8–66.9% | within 2 points | within 3 | within 4 |

- **Counting windows is worth little**: nothing with the Elixir and hail
  alone (49.5–51.4%), 1–2 points with Rally's Shield (52% over its
  rows). The timing choices track time adds are there, but small in
  these kits: few effects last long enough, or are Delayed or Hastened
  often enough, for a window to matter.
- **The rest as with the first AI**: speed 1.5 points more, the Elixir
  worth more the longer the window, a fixed 12 the most (the Duelist's
  speed point 83%), party against party within the noise.
- Rally is worth 4–5 points more in the Steppe's party with a window (55%
  against 51%), and the same elsewhere.

A first run of this file let a hero's `passives` set by one experiment
leak into the next (the config's restore kept a key a patch added); fixed
in `d36fdb6` and rerun. Earlier files set every key they add
(`slam-armour.mjs`), so none was affected.

### Skill on all twelve heroes and whole runs (2026-10-29)

Asked for: whether the game still rewards play, on the latest rules, as
"The roster checked again" measured it on 2026-10-27. A **novice** looks
one decision ahead, production three, an **expert** four with four times
the work. `experiments/skill-fights.mjs`, `modWinPct`, 400 fights each
(about ±2.5 points a row, ±3.5 a span), seeds from 1000: one hero played
by a novice or an expert in its role's seat of a Steppe mirror on both
sides, the rest of both sides by production; and each region's whole
party. Run on `df7d211`; the commits since change only Zahhak, who isn't
in these fights. `experiments/skill-runs.mjs` (`runs.mjs`, 400 runs each,
on `6815c7e`, Zahhak's Regrow built): each region's party through all
three regions, bosses and the sealed road included, played at each depth,
the enemy always production's.

**In a fight** (its side's wins; the span on 2026-10-27 in brackets):

| Hero | Novice | Expert | Span |
|---|---:|---:|---:|
| Elephant Rider (Stomp) | 40% | 53% | **13** (9.2) |
| Magus (Omen) | 39% | 51.8% | **12.8** (15.2) |
| Storm Caller | 44.8% | 55.3% | 10.5 (10.5) |
| Vanguard | 47% | 55% | 8 (7.6) |
| Archer (Longshot) | 48.5% | 55.6% | 7.1 (4.1) |
| Cataphract | 49% | 55.8% | 6.8 |
| Grappler | 42.8% | 49.5% | 6.7 (6.4) |
| Alchemist | 45.5% | 50.3% | 4.8 (9.5) |
| Swordsman | 46.3% | 51% | 4.7 (6.9) |
| Horse Archer | 45.8% | 50% | 4.2 (8.7) |
| Barbarian (Axe Throw) | 47.8% | 51.3% | **3.5** |
| Priest (Blessing) | 49.5% | 50.6% | **1.1** |

| Whole party | Novice | Expert | Span |
|---|---:|---:|---:|
| Persia | 29.3% | 60.7% | **31.4** |
| Steppe | 34% | 58.3% | 24.3 (26.9) |
| China | 35.2% | 54.6% | 19.4 (26.8) |
| Byzantium | 37.9% | 56.8% | 18.9 |

Unfinished fights 0–1.5%, up to 3.3% with the Priest and 6.3% in
Byzantium's novice party.

- **Play is still worth 19–31 points a fight**, Persia's party the most:
  the Elephant Rider's Stomp (13) and the Magus's Omen (12.8) reward play
  most of the twelve, and Longshot stopped by the first unit nearly
  doubled the Archer's span (4.1 to 7.1), as blocking was meant to.
- **The Priest rewards play least, about not at all** (1.1): a novice's
  Blessing does as well as an expert's, healing and Shielding an ally
  within 2 leaving little to choose. The Barbarian's Axe Throw (3.5) is
  next.
- **China's party fell about 7 points**, the Alchemist 9.5 to 4.8, the
  Horse Archer 8.7 to 4.2, the Swordsman 6.9 to 4.7. Each is within about
  two spans' noise, but all falling at once looks real; not traced (the
  Steppe's mountains in every fight since, or the AI's changes).

**In whole runs** (% of runs reaching each point, novice / production /
expert; in brackets, the experts' wins over Zahhak of those reaching him):

| Party | The Cyclops | China | The Bull Demon King | Persia | Zahhak (won) | Runs won |
|---|---|---|---|---|---|---|
| Steppe | 24 / 41 / 53 | 4 / 21 / 36 | 0 / 1 / 1 | 0 / 1 / 1 | 0 / 0.3 / 0.3 (1 of 1) | 0 / 0 / 0.3 |
| China | 26 / 46 / 59 | 11 / 33 / 46 | 0.3 / 2 / 2 | 0 / 2 / 2 | 0 / 0.5 / 1 (0 of 4) | 0 / 0 / 0 |
| Persia | 30 / 66 / 78 | 9 / 40 / 62 | 1 / 5 / 16 | 0 / 3 / 13 | 0 / 0.5 / 3.5 (9 of 14) | 0 / 0.3 / 2.3 |
| Byzantium | 40 / 53 / 62 | 29 / 32 / 45 | 7 / 9 / 16 | 5 / 8 / 13 | 2.5 / 3 / 8 (4 of 32) | 0 / 0 / 1 |

- **In a run, play shows in how far it gets, still not in runs won**: an
  expert reaches China 1.5–7 times as often as a novice, but no party at
  any depth wins more than 2.3% of runs (the experts 0.9% on average).
- **China's regular stages end nearly every run**: of the 32–62% reaching
  China, 1–16% reach the Bull Demon King, at every depth.
- **Zahhak with Regrow can be beaten**: Persia's experts win 9 of 14
  (64%), Byzantium's 4 of 32; before Regrow (a first run of this file on
  `df7d211`, the same runs up to him), one win in his 78 fights over every
  party and depth.
- **Many losses to the Cyclops are unfinished**: 20–34 runs at production
  and expert depth for Persia's and Byzantium's parties (14 for their
  novices), 0–13 for the Steppe's and China's.

Not changed: the numbers are the owner's. What would most help skill
decide runs, measured above: something to choose in Blessing (and Axe
Throw), China's stages 5 to 7, and the Cyclops's stalls.

### Durations by power and defence, step 1: the Elixir (2026-10-29)

`experiments/durations-elixir.mjs`, on the rules of `c524b53`: the
Elixir's Empower and Weaken lasting a turn of the target's slots, plus
`power` slots a point of the Alchemist's power, a Weaken `defence` fewer
a point of the target's defence, at least 1 (`FightRules.ticks`, the
test stage's `"rules"`; no run has it). `t0`: slots with neither; `k1`,
1 and 1; `k2`, 2 and 2. China's mirror (the modified side's wins) and
China against each region, 400 fights each, the same seeds. Not built.

| | By turns | t0 | k1 | k2 |
|---|---:|---:|---:|---:|
| The Alchemist's power +1 | 73.8% | 74.8% | 70.5% | 71.3% |
| its speed +1 | 57.3% | 61.5% | 62.5% | **64.3%** |
| its defence +1 | 57.3% | 51.5% | 55.8% | 55.3% |
| The Vanguard's defence +1 | 54% | 56.3% | 56.5% | 56.5% |
| The Duelist's defence +1 | 60.3% | 58.3% | 56.3% | 56.5% |
| A side without the Elixir | 9.5% | 8.8% | 10.3% | 11% |
| China against the Steppe | 49.8% | 51.8% | 49.8% | 49% |
| against Persia | 47.5% | 45.5% | 47% | 44.5% |
| against Byzantium | 36.3% | 37.3% | 38.5% | 36.3% |

- **Power and defence don't move**: the Alchemist's power point is worth
  no more with k1 or k2 (70.5%, 71.3%, against 73.8% by turns), and a
  point of defence on the units it Weakens no more than with `t0`. An
  Empower or Weaken counts once for each of the unit's turns it lasts to,
  and a turn is 8 to 10 slots: 1 or 2 slots more or fewer seldom changes
  how many turns that is.
- **The Alchemist's speed point is worth more with slots** (57.3% to
  61.5–64.3%), as in "Track time" (61–62%) and "Track time with an AI
  that counts windows" (59.5–62.8%): about 4–7 points, every run. Not
  traced.
- Party against party, and the Elixir's worth, as by turns.

Power and defence would show on an effect that every slot of counts, a
Delay or hail standing, rather than one used once a turn; or with
several slots a point (3 or 4, a third of a turn).

### Durations in a fixed number of slots (2026-10-29)

`experiments/durations-slots.mjs`, on the rules of `2d394de`: every
effect that lasted until a unit's next turn lasting a fixed number of
slots from when it is given, hail its own, a Stun for a turn a Delay
(the fight's `slots`, the test stage's `"rules"`; no run has it): `s10`,
10, 18 and 6 (the test stage's); `s8`, 8, 16 and 6. 400 fights each, the
same seeds. In these parties only the Elixir's Empower and Weaken and
hail change. Not built.

| | By turns | s10 | s8 |
|---|---:|---:|---:|
| Speed +1, mean of the six Steppe and China heroes | 60.7% | 62.1% | **61.2%** |
| the Alchemist | 57.3% | 60.5% | **56.3%** |
| the Duelist | 76% | 78.3% | 77.5% |
| the Storm Caller | 60.3% | 61% | 60.8% |
| A side without the Elixir (China) | 9.5% | 5% | 6.8% |
| without hail (Steppe) | 15.5% | 15% | 14.8% |
| China against the Steppe | 49.8% | 52.5% | 51.5% |
| against Persia, Byzantium | 47.5%, 36.3% | 44.3%, 38.8% | 45%, 37.3% |
| The Steppe against Persia, Byzantium | 33.1%, 48.6% | 33.5%, 47.1% | 32.5%, 47.3% |

- **8 slots is the closer to turns**: speed worth half a point more
  (1.4 at 10), the Alchemist's speed point no more than by turns (3.2
  more at 10), the Elixir a little more (a side without it 6.8%, 5% at
  10). 8 is the fastest hero's turn, so an Empower rarely lasts two of its
  turns.
- Hail at 16 or 18 slots as by turns (its two turns of the Storm
  Caller's 9). Party against party within the noise either way.

### Grapple off the track (2026-10-29)

`experiments/grapple-off-track.mjs`, on the rules of `2631e44`: a
grappled unit's card off the track while the grapple holds, back on the
free slot just before the Grappler's next card once it ends (the fight's
`grapple: 'offTrack'`, the test stage's `"rules"`; no run has it), alone
(`off`) and with durations in slots 8/16/6 (`s8-off`, the test stage's).
400 fights each, the same seeds. Not built.

| | Stunned by turns | off | s8-off |
|---|---:|---:|---:|
| The Steppe without Grapple | 18.5% | 17.5% | 17% |
| The Grappler's speed +1 | 56.5% | 55.5% | 54.3% |
| its power +1 | 51.5% | 53.8% | 53.8% |
| The Steppe against China | 50.3% | 46.8% | 46.5% |
| against Persia | 33.1% | 31.6% | 31.5% |
| against Byzantium | 48.6% | 47.6% | 46.1% |
| The Grappler in China's tank seat | 57.4% | 56.3% | 60.9% |
| in Persia's | 42.9% | 43.2% | 43.2% |
| in Byzantium's | 51.5% | 54.9% | 54.9% |

- **Grapple is worth as much**: a side without it wins 17–17.5% (18.5%
  by turns), and is used as often (28% of the Grappler's turns). The
  freed unit acting first costs it little: a grapple mostly ends with the
  Grappler hit, by the held unit's allies, whose cards come before its
  next turn either way.
- The Steppe 1–3.5 points lower against each region, the Grappler's
  speed point 1–2 points less, its power point 2 more; all within the
  noise. Stalls as by turns.

### A provision against a passive or an upgrade (2026-10-29)

Asked for: how strong a provision is against a passive or a generic
ability upgrade. `experiments/provision-vs-card.mjs`, `modWinPct`, 400
fights each (about ±2.5 points a row), seeds from 1000: in each region's
mirror, one hero of the modified side takes +1 speed, defence or power
(a provision) or one of the caravanserai's 40 cards (`mod.passives`),
every hero and every card, 516 rows. Run on `5423ac3`; the last 24
Byzantium rows on `ffbd809` (the commits between change only the test
stage's `"rules"`, and Axe Throw's crash below). One fight, not a run:
how often each comes up, and that a run's provisions add up, aren't
measured.

**Each card and stat over the twelve heroes**, best first, with the
rarity it has (19.3b):

| | Mean | Best hero | Next | Heroes at 55%+ | Rarity |
|---|---:|---|---|---:|---|
| Concussive | 68.1% | Cataphract 89.7% | Duelist 85.8% | 9 | Legendary |
| Glass Cannon | 60.0% | Alchemist 72% | Ranger 71.7% | 8 | Epic |
| **Power +1 (provision)** | 59.6% | Alchemist 73.8% | Ranger 72.2% | 9 |  |
| **Speed +1 (provision)** | 57.9% | Duelist 76% | Juggernaut 62.5% | 9 |  |
| Hamstring | 56.8% | Barbarian 69.4% | Alchemist 63.3% | 6 | Epic |
| Staggering | 55.6% | Duelist 68% | Cataphract 61.8% | 8 | Rare |
| Forked | 55.1% | Alchemist 83% | Magus 68.1% | 3 | Legendary |
| **Defence +1 (provision)** | 54.6% | Duelist 60.3% | Juggernaut 58.6% | 4 |  |
| Lone Wolf | 54.4% | Duelist 61% | Cataphract 60.1% | 4 | Rare |
| Opportunist | 53.4% | Cataphract 62.1% | Duelist 60.8% | 3 | Epic |
| Last Stand | 52.5% | Juggernaut 59.9% | Magus 53.9% | 1 | Epic |
| Crippling | 52.1% | Storm Caller 55.5% | Cataphract 54.9% | 1 | Epic |
| Hardened | 52.0% | Grappler 55.8% | Alchemist 55.5% | 2 | Rare |
| Vengeance | 51.6% | Outrider 54% | Ranger 52.8% | 0 | Rare |
| Rally | 51.5% | Duelist 55.3% | Alchemist 53.3% | 1 | Epic |
| Steady Gait | 51.0% | Barbarian 61.4% | Vanguard 56.5% | 2 | Uncommon |
| Second Wind | 51.0% | Juggernaut 52.8% | Alchemist 52.5% | 0 | Rare |
| Lethargy | 50.9% | Alchemist 60.5% | Cataphract 50% | 1 | Common |
| Lockdown | 50.8% | Storm Caller 59.8% | Cataphract 50% | 1 | Rare |
| Sundering | 50.8% | Cataphract 55.1% | Barbarian 54.5% | 1 | Uncommon |
| Rooted | 50.8% | Barbarian 59.6% | Cataphract 51.2% | 1 | Uncommon |
| Iron Will | 50.7% | Grappler 53.8% | Outrider 53.8% | 0 | Epic |
| Mending Strike | 50.6% | Duelist 54.3% | Juggernaut 54.2% | 0 | Epic |
| Ward | 50.5% | Alchemist 54.3% | Priest 52.2% | 0 | Rare |
| Inspire | 50.5% | Alchemist 56.3% | Cataphract 50% | 1 | Uncommon |
| Quickening | 50.5% | Alchemist 57% | Cataphract 50% | 1 | Rare |
| Defy Fate | 50.4% | Ranger 53.2% | Juggernaut 51.8% | 0 | Common |
| Fortify | 50.4% | Alchemist 55.3% | Cataphract 50% | 1 | Epic |
| Flanker | 50.4% | Cataphract 52.6% | Juggernaut 51.3% | 0 | Rare |
| Invigorate | 50.4% | Priest 54.8% | Cataphract 50% | 0 | Epic |
| Immovable Object | 50.4% | Juggernaut 52.5% | Ranger 51.9% | 0 | Common |
| Wearying | 50.3% | Vanguard 53.5% | Cataphract 50% | 0 | Uncommon |
| Mending Shot | 50.3% | Ranger 54.7% | Barbarian 52.3% | 0 | Legendary |
| Light Step | 50.0% | Duelist 55.5% | Vanguard 52% | 1 | Uncommon |
| Fervour | 50.0% | Cataphract 50% | Priest 50% | 0 | Common |
| Piercing Eye | 50.0% | Cataphract 50% | Priest 50% | 0 | Common |
| Momentum | 50.0% | Alchemist 50.8% | Storm Caller 50.5% | 0 | Common |
| Bulwark | 49.8% | Vanguard 52.3% | Barbarian 51.4% | 0 | Common |
| Shake Loose | 49.8% | Cataphract 50% | Priest 50% | 0 | Uncommon |
| Rebound | 49.7% | Outrider 50.8% | Barbarian 50.5% | 0 | Uncommon |
| Patient | 49.4% | Vanguard 50.5% | Juggernaut 50.3% | 0 | Common |
| Forceful | 49.3% | Outrider 57% | Ranger 55.2% | 2 | Rare |
| Reel In | 49.3% | Vanguard 51.5% | Alchemist 50.6% | 0 | Uncommon |

**Each hero's best provision against its best card** (bold: its best
provision):

| Hero | Speed | Defence | Power | Best card | Next | Cards above its best provision |
|---|---:|---:|---:|---|---|---:|
| Cataphract (Byzantium) | 53.8% | 53.7% | **67.6%** | Concussive 89.7% | Glass Cannon 68% | 2 |
| Priest (Byzantium) | 50.4% | **50.8%** | **50.8%** | Invigorate 54.8% | Steady Gait 54.2% | 4 |
| Barbarian (Byzantium) | **61.2%** | 53% | 55.1% | Concussive 78% | Hamstring 69.4% | 3 |
| Alchemist (China) | 57.3% | 57.3% | **73.8%** | Forked 83% | Concussive 79.8% | 2 |
| Vanguard (China) | **57.8%** | 54% | 55.5% | Concussive 67.8% | Steady Gait 56.5% | 1 |
| Duelist (China) | **76%** | 60.3% | 63.8% | Concussive 85.8% | Staggering 68% | 1 |
| Ranger (Persia) | 59.5% | 52.9% | **72.2%** | Glass Cannon 71.7% | Concussive 67.7% | 0 |
| Magus (Persia) | 43.2% | **54.6%** | 50% | Forked 68.1% | Last Stand 53.9% | 1 |
| Juggernaut (Persia) | **62.5%** | 58.6% | 57.4% | Last Stand 59.9% | Concussive 58.1% | 0 |
| Grappler (Steppe) | **56.5%** | 56.3% | 51.5% | Hardened 55.8% | Iron Will 53.8% | 0 |
| Outrider (Steppe) | 56% | 50.5% | **59.6%** | Concussive 74.7% | Hamstring 61.8% | 3 |
| Storm Caller (Steppe) | **60.3%** | 53.8% | 58.1% | Concussive 62.8% | Lockdown 59.8% | 1 |

- **A provision is worth about as much as the best cards.** Over the
  twelve heroes, power +1 (59.6%) and speed +1 (57.9%) rank third and
  fourth of 43, behind only Concussive (68.1%) and Glass Cannon (60%).
  Defence +1 (54.6%) is eighth. On each hero's best stat, a provision
  wins 62.7% on average. That hero's best card wins 71%, or 64.7% without
  Concussive. Only 18 of 480 hero-and-card pairs beat that hero's best
  provision, 7 of them Concussive.
- **Most cards are worth nothing on most heroes**: 33 of the 40 average
  49.3–52.5%, and many are exactly 50% on most heroes (Fervour and
  Piercing Eye on all twelve): the card's condition never happens (a
  heal on a hero that can't heal, Pierce with no Armour on the board,
  Defy Fate with no Inevitable enemy). As the
  draft gives them, to a hero the player picks, they are worth what they
  are on the right hero, which the "Best hero" column shows: the healing
  upgrades on the Alchemist or the Priest are still only 54–57%.
- **Concussive is too strong**: 89.7% on the Cataphract, 85.8% on the
  Duelist, 9 heroes at 55% or more, the fights with it up to 10.3%
  unfinished. **Forked** on the Alchemist (83%) and the Magus (68.1%), and
  **Glass Cannon** (Epic, the best passive), are next.
- **The rarity tiers are partly wrong**: Mending Shot (Legendary) is
  worth nothing (50.3%, at most 54.7%); Staggering (Rare) is the fourth
  best card; Rally, Iron Will, Crippling, Mending Strike, Fortify and
  Invigorate (Epic) average 50.4–52.1%; Hamstring and Glass Cannon hold
  their Epic. The rarity column is the one they had then; they were retiered
  from their best hero's figure the same day (owner; progression.md,
  19.3b).
- **A provision helps the support heroes least**: the Priest's best is
  50.8%, the Magus's 54.6%, and the Magus's speed +1 loses (43.2%). Not
  traced.
- **Steady Gait, Forceful and Reel In** are below 50% on some heroes;
  Steady Gait helps the Barbarian (61.4%) and the Vanguard (56.5%).
- **The run found a crash**, fixed in `ffbd809`: a Barbarian with
  Bulwark throwing its axe at an ally next to it took 1 of the hit, could
  die of it, and the throw then pushed from its empty space.

Not changed: the numbers and rarities are the owner's.

### Every duration in slots and Grapple off the track, built (2026-10-29)

`experiments/slots-check.mjs` and `slots-check-runs.mjs`: the rules of
`e21e411` (every duration in slots, 8/16/6, a Stun for a turn a Delay
of 6, Grapple off the track, the squeeze, Bulwark and Opportunist in
slots) against those just before (`20cdc90`), the same seeds. The
regions' parties against each other, 400 fights each:

| | Before | After |
|---|---:|---:|
| China against the Steppe | 49.8% | 52.3% |
| Persia against the Steppe | 66.9% | 68.8% |
| Byzantium against the Steppe | 51.4% | 53.4% |
| Persia against China | 52.5% | 55% |
| Byzantium against China | 63.8% | 62.8% |
| Byzantium against Persia | 54.8% | 54.8% |

Whole runs, 100 each party: none won either way (as before); Persia and
Byzantium reach the Cyclops in 62% and 41% of runs (63%, 41% before) and
China in 32% and 24% (33%, 22%). The Steppe's and China's runs also ended
where they did, but their win at the Cyclops moved more on few runs (the
Steppe's 44.8% to 25.9% of about 27): within the noise, to watch.

- **Balance as it was**: every matchup within 2.5 points, about the
  noise. The Steppe 2 points lower against each region, as with Grapple
  off the track alone ("Grapple off the track").
- The whole runs found a crash, there before these rules: a Cyclops with
  a drafted Bulwark, hitting its own wolf with Boulder, fell to the 1 it
  took for it, and Boulder then read its space. Fixed: it pushes from
  where it threw.

### Each hero in its role, every duration in slots (2026-10-29)

Asked for: balance again on the current rules (every duration in slots,
Grapple off the track, the Cataphract Armoured with the slam's Delay 6),
judged by how each hero does in its role, not region against region.
`experiments/roles-twelve.mjs`: each hero in its role's seat of the three
other regions' mirrors (the role seats of `roster-twelve.mjs`, no party
against party), `modWinPct`, 400 fights each (about ±2.5 points a cell),
seeds from 1000, production AI, on `88df092`. In brackets, "All twelve
heroes, after the owner's changes" (2026-10-28) for all but the
Cataphract's rows and seat, which are from "The slam's Delay 6 with
Armoured back" (its seat's three rows only as a range there, 43–52%,
so left out). Unfinished fights 0–3.8%, 5.8% with the Ranger in
Byzantium's party.

| Tank seat of | Steppe | China | Persia | Byzantium |
|---|---:|---:|---:|---:|
| Grappler | | 60.9% (57.4%) | 43.8% (42.9%) | 56.4% |
| Vanguard | 48.5% (49%) | | 53% (53%) | 43.3% |
| Juggernaut | **66.5%** (62.8%) | 47.8% (51.8%) | | 47.3% |
| Cataphract | 56.8% (57%) | **64.3%** (71.8%) | **60%** (60%) | |

| Damage seat of | Steppe | China | Persia | Byzantium |
|---|---:|---:|---:|---:|
| Outrider | | 54% (49.8%) | 45.2% (45.2%) | 44.4% (41.8%) |
| Duelist | 52.5% (53%) | | 41.6% (41.6%) | 52% (40.8%) |
| Ranger | 53.6% (50.5%) | 45.3% (44.3%) | | 53.8% (36.3%) |
| Barbarian | 50.8% (50%) | 50.5% (49.1%) | **35.9%** (35.9%) | |

| Support seat of | Steppe | China | Persia | Byzantium |
|---|---:|---:|---:|---:|
| Storm Caller | | 44.3% (42.5%) | 42.3% (43.2%) | 50.1% (46.3%) |
| Alchemist | 53.8% (60%) | | 48.7% (52.4%) | 46% (46.6%) |
| Magus | 50.3% (50.8%) | **37.3%** (40.5%) | | 52.6% (49.5%) |
| Priest | 42.7% (50.3%) | 40.3% (42.3%) | 50.9% (50.9%) | |

Each hero's mean in the three other seats of its role, and its side's
wins when each of the three others of its role takes its seat (100% less
their mean); the two together as one score:

| | In others' seats | Kept in its own | Score |
|---|---:|---:|---:|
| Grappler | 53.7% | 42.7% | 48.2% |
| Vanguard | 48.3% | 42.3% | **45.3%** |
| Juggernaut | 53.9% | 47.7% | 50.8% |
| Cataphract | 60.4% | 51% | **55.7%** |
| Outrider | 47.9% | 47.7% | 47.8% |
| Duelist | 48.7% | 50.1% | 49.4% |
| Ranger | 50.9% | 59.1% | **55%** |
| Barbarian | 45.7% | 49.9% | 47.8% |
| Storm Caller | 45.6% | 51.1% | 48.3% |
| Alchemist | 49.5% | 59.4% | **54.5%** |
| Magus | 46.7% | 52.7% | 49.7% |
| Priest | 44.6% | 50.4% | **47.5%** |

- **Damage is the most even role** (scores 47.8–55%): the Duelist and the
  Barbarian even, the Outrider a little under. The Ranger is strong only
  at home: any other damage hero in Persia's seat wins 36–45%, the
  Barbarian least (35.9%, outranged), while the Ranger elsewhere is 45–54%.
  The Byzantine seat's 36–42% of 2026-10-28 is gone (44–54%): that was the
  Cataphract's weakness, not the Barbarian's strength.
- **Tanks spread widest** (45.3–55.7%). **The Cataphract is the strongest
  tank**, 57–64% in every other tank seat; China's seat came down from
  71.8% to 64.3% with the slot rules but is still its best. **The Vanguard
  is the weakest**, 43–53% elsewhere, and its own seat in China is lost to
  the Grappler (60.9%) and the Cataphract (64.3%). The Juggernaut beats
  the Grappler in the Steppe's seat (66.5%), the largest single gap: the
  Grappler is a weak tank at home (42.7%) but fine abroad (53.7%).
- **Support: the Alchemist strong at home, the Priest and the Storm
  Caller a little weak abroad.** Any other support in China's seat wins
  37–44%, the Magus least (37.3%); elsewhere the Alchemist is even.
  The Priest fell 8 points in the Steppe's seat (50.3% to 42.7%) and the
  Alchemist 6 there, the Storm Caller now harder to replace (its own seat
  46% to 51%; a guess, hail lasting 16 slots, not traced); the Priest is 40–51%.
- **What moved since 2026-10-28** is the Steppe's and Byzantium's seats;
  every Persia-seat row came out exactly as before (the slot rules don't
  touch its kits).

Within each role every hero is within about 5 points of 50% but the
Cataphract (+5.7), the Ranger (+5), the Alchemist (+4.5) and the
Vanguard (−4.7); the Ranger's and the Alchemist's surplus is in their own
party only. Not changed: the numbers are the owner's. Likeliest to help,
in order: the Cataphract's China surplus (Armoured only against hits from
in front, or the slam's Delay 4); the Vanguard (a point of power, or
Cleave's Delay 8 back); what the Alchemist's Elixir gives China's
Vanguard and Duelist that no other support does.

### Wait: a turn that does nothing comes back sooner (2026-10-30)

Asked for: whether a cheaper Hold adds depth to the track without
costing readability. Built as `RULES.waitShare` (timeline.md, 3.2,
proposed), **off** (1): a Hold without a walk, or a turn skipped with
only Hold to choose, sends the card that share of its action cost on,
rounded, at least 1 (not a Stunned skip, nor Temee's); at 2/3, 5, 6 and
7 slots for speeds 3, 2 and 1 in place of 8, 9 and 10. The preview aims
a Hold at its Wait, so Skip turn reads +6 beside an ability's +9. A walk
stays full price: cheap walks were what made the old per-action costs
fiddly (25 Horse Archer turns a fight, "Tactical options and strategy").
`experiments/wait.mjs` and `wait-china.mjs`, 800 fights a row (about
±1.8 points), seeds from 1000, production AI, on `04c459d`.

**One side with Wait, the other without.** Given as Patient
(`RULES.patientSlots`) on every unit of one side with Wait off: at 2/3
Wait saves exactly 3 slots at speeds 1 to 3, so Patient 3 is Wait for
that side; Patient 4 is about 1/2. `modWinPct` in each region's mirror;
the deep rows give the side with Wait a horizon of 4 and 4× the work,
against the same search without Wait.

| Mirror | Wait 2/3 | Wait ~1/2 | Deep, with Wait | Deep, without | Wait's worth, deep |
|---|---:|---:|---:|---:|---:|
| Steppe | 50.6% | 49.8% | 60.8% | 60.6% | +0.2 |
| China | **43.9%** | **37.5%** | 52.1% | 57.4% | **−5.3** |
| Persia | 50.6% | 51.5% | 57.6% | 58.8% | −1.2 |
| Byzantium | 50.9% | 49% | 53.6% | 57.2% | −3.6 |

Worth nothing in three regions and a loss in China, and a deeper search
finds no more in it. In China it is the Alchemist's alone: Wait on her
only, 43.1%; on the Duelist 46.3%; on the Vanguard 50.9%; Patient saving
0 slots on her, the control, 50.0%. She Holds 2.7% of her turns with it,
0.1% without, and those few Holds cost her side 7 points. The search
doesn't price what a Wait gives up: its leaf (`evaluatePosition`) has no
term for how soon a card comes back, so a Hold and then the Elixir, both
inside the horizon, scores like the Elixir now, the third of a turn lost
unseen. Patient (2 slots) measured worthless the same way (49.4%,
"A provision against a passive or an upgrade").

**Both sides with Wait** (`built` against `wait`), the player side's
win rate in the mirrors (the side bias: tie order, the board) and
`modWinPct` party against party:

| | Built | Wait 2/3 | Median actions | Share of turns held |
|---|---:|---:|---:|---:|
| Steppe mirror | 64.8% | 64.9% | 50 → 51 | 12.9% → 17.0% |
| China mirror | 43.8% | **59.0%** | 71 → 76 | 11.2% → 14.3% |
| Persia mirror | 78.2% | 77.8% | 50 → 51 | 10.7% → 11.6% |
| Byzantium mirror | 73.1% | 76.7% | 94 → 96 | 7.7% → 9.3% |
| China v Steppe | 50.4% | 46.4% | 57 → 59 | 7.8% → 11.9% |
| Persia v Steppe | 70% | 66.5% | 50 → 53 | 12.3% → 16.6% |
| Byzantium v Steppe | 53.2% | 53.1% | 77 → 79 | 8.5% → 11.6% |
| Persia v China | 54.1% | 58.8% | 50 → 51 | 4.8% → 7.4% |
| Byzantium v China | 61.9% | 64.3% | 80 → 82 | 4.0% → 6.5% |
| Byzantium v Persia | 54.5% | 49.9% | 75 → 76 | 8.2% → 9.9% |

Fights barely longer (1 to 5 actions), Holds up 1 to 4 points of turns,
no more unfinished fights (0–2.4%); parties move 2–5 points, China's
mirror 15 on the side that acts first at ties.

**Not switched on.** As the AI plays it, Wait adds nothing, and in China
it adds AI mistakes. That says as much about the AI as the rule: Wait's
value is timing (stepping out of a 16-slot hail, acting just before an
enemy card, letting an 8-slot Weaken lapse), which the leaf can't see.
Before judging it again, give `evaluatePosition` the track: each card's
slots to its next turn, priced as a share of a turn
(`turnValue`, as `AI.trackWorth` prices the cards a turn moves), then
re-run `wait.mjs`; Patient, Haste and Delay would be measured truer too.
Or play it from the test stage, with `waitShare` 2/3.

### The leaf counting the track, and Wait again (2026-10-30)

Built as `AI.leafTrack`, **off** (0): the search's leaf
(`evaluatePosition`) counts each living card's slots to its next turn
as a share of its action cost × its turn's worth (`turnValue`, its
power; Temee's `perCamelHex`), less for its side the later it is, a
charging card left to `chargeCost`; and screening (`scoreOutcome`)
counts the actor's own card against its action cost. So a Wait's 3
slots are worth a third of the unit's turn, w × power ÷ 3.
`experiments/wait-leaf.mjs`, 800 fights a row, on `02da6ee`.

| Mirror | AI with the leaf, one side: w 0.5 | w 1 | Wait, both AIs with the leaf: w 0.5 | w 1 |
|---|---:|---:|---:|---:|
| Steppe | 49.6% | 47.6% | **40.6%** | **34.1%** |
| China | 51.3% | 54.3% | **42.1%** | **37.8%** |
| Persia | 51.2% | 50.3% | **39.6%** | **34.6%** |
| Byzantium | 51.5% | 46.9% | 45.2% | **44.1%** |

The leaf makes the AI no better (47–54%), and with it Wait goes from
worth nothing to a heavy loss, the more the heavier the leaf. The AI now
Waits where it should walk: in the Steppe's mirror at w 1 the Horse
Archer Holds 40% of its turns (21% with Wait and no leaf) and walks 27%
(40%), the Grappler Holds 16% (6%), the Vanguard in China's 40% (9%),
and fights run longer (Steppe 51 → 55 actions, China 74 → 86). A walk
is priced only by `AI.perHexFromEnemy`, 0.2 a space, a tiebreaker "small
next to any hit": 0.4 for a walk of 2 against a Wait's 1 for a power-3
hero at w 1, so with no hit in reach the Wait wins. What a walk sets up
(the hits a turn later) is worth far more than that, and the search
doesn't see it within its three decisions.

**So Wait can't be judged by this AI.** Without the track in its leaf it
can't see what a Wait gives up; with it, it can't see what a walk
gains, and Waits instead. Pricing both needs a position term worth what
a walk sets up (the damage the unit could reach a turn later, as
`threatsTo` reckons it the other way), a larger change to the AI than
the rule it would measure. Both switches stay off; the cheaper judge is
play: Wait on the test stage (`waitShare` 2/3), the owner's call.

### Blessing by the track (2026-10-30)

Asked for (the owner): Blessing healing or hitting by how far the unit's
card lies on the track, with no Shield and a range of 3, power counting
one of two ways. `ABILITY.blessing.mode` `track` (off): an ally whose card
is under `split` (5) slots on is healed, an enemy's over 5 hit, the Priest
himself (acting now) healed; `scale` `bands` gives his power at 2 or more
slots from 5 and half of it (1) at 1, `cap` 1 a slot from 5, at most his
power (Empower, Weaken and passives counted either way).
`experiments/priest-track.mjs`, on `04c459d`: the Priest in the support
seat of the three other regions' mirrors, each of their supports in his
seat of Byzantium's (as "Each hero in its role"), and a novice and an
expert Priest in a Steppe mirror (as "Skill on all twelve heroes"), 400
fights each (about ±2.5 points a cell, ±3.5 a span). Unfinished fights
0–1.5% by the track, 0–3.5% as built.

| Priest | Steppe | China | Persia | Kept in its own | Score | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| As built | 42.7% | 40.3% | 50.9% | 50.4% | 47.5% | 47.9% | 51.3% | 3.4 |
| Track, `bands` | **31%** | **20%** | 45.1% | 49.2% | **40.6%** | 49% | 51.3% | 2.3 |
| Track, `cap` | **27%** | **19.5%** | 42.1% | 43.8% | **36.7%** | 48% | 54.8% | 6.8 |
| Control: heals only (`bands`, `split` 14) | 30.1% | 22% | | | | | | |

- **Much weaker in both scales**: 6–21 points down in others' seats,
  China's the worst (about 20%). Kept in Byzantium's party he holds up
  with `bands` (49.2%), not with `cap` (43.8%).
- **The Shield's loss is the whole of it, the smite worth about
  nothing**: with `split` past the track's end (every unit in the heal
  band, no enemy hit) he wins 30.1% and 22%, the same as with the smite.
  He smites 1.3–1.9 times a fight for 3–5 damage in all, and takes
  Blessing on 51–63% of his turns, walking on the rest (81–85% Blessing as
  built, since an ally always has a Shield to gain). He lives through 20–50%
  of fights, 44–83% as built: the lasting Shield he gave himself and his
  front line was what kept him standing.
- **Skill**: `cap` 6.8 points, `bands` 2.3, as built 3.4 (1.1 on
  2026-10-29, so the spans are within noise of each other; `cap`'s may be
  real). Fights are shorter (median 105–122 slots, 128–137 as built).
- Untried: the track with the overheal kept as a lasting Shield on the
  heal side; the split moved (more of the track healing); more power or
  defence for him.

### Spearhead: allies next to the Vanguard Hastened when it's hit (2026-10-30)

Asked for: a passive for the Vanguard that Hastens adjacent allies when it
takes damage. Built as `spearhead` (`SPEARHEAD.haste`, 3, Devoted's),
**off**: no hero starts with it and the caravanserai doesn't offer it.
Any damage coming at it, a Shield's or not, Hastens each ally next to it
3, Humphrey too, the hit that fells it as well (Devoted's reading).
`experiments/spearhead.mjs`: one side's Vanguard with it in China's
mirror, then the Vanguard's six rows of "Each hero in its role" with
every Vanguard carrying it, beside the same rows without it on today's
code (the Barbarian's Leap is newer than that table). 400 fights a row
(about ±2.5 points), seeds from 1000, production AI, on `8894940`.

One side's Vanguard with it, China's mirror: **53.3%**.

| Row | Without | With Spearhead |
|---|---:|---:|
| Vanguard in the Steppe's tank seat | 48.5% | 50.3% |
| Vanguard in Persia's | 53% | 52.2% |
| Vanguard in Byzantium's | 45.5% | 47.4% |
| Grappler in China's (the Vanguard's) | 60.9% | 57.5% |
| Juggernaut in China's | 47.8% | 43.3% |
| Cataphract in China's | 64.3% | 66% |
| In others' seats (mean) | 49% | 50% |
| Kept in its own (100% less the mean) | 42.3% | 44.4% |
| **Score** | **45.7%** | **47.2%** |

- **A small gain, at the edge of noise**: 3.3 points in the mirror, 1.5 on
  the Vanguard's score, every row within about 2 points but the
  Juggernaut's and the Grappler's in China's seat (3–4.5). It doesn't
  bring the Vanguard to even; the Cataphract still takes its seat at 66%.
- Without it, the rows match 2026-10-29's to the point but Byzantium's
  (43.3% to 45.5%, the Leap or noise).
- Why little, a guess not traced: the Vanguard is slow and takes few hits
  before its allies act, Cleave's Delay is already its tempo, and the AI
  doesn't seek to stand next to it (no term for it), so the Haste lands
  where the fight puts allies.
- Untried then: Haste 5 or 6; the AI keeping allies next to it (both
  measured below); Spearhead with a point of power, or with Cleave's
  Delay 8 back.

**A bigger Haste, and allies seeking it (2026-10-30).** Asked for: both.
Haste 5 and 6 (`SPEARHEAD.haste`), and the AI's allies valuing a space
next to a Spearhead ally (`AI.spearheadShare`, built, 0 as built): that
share × the Haste one hit on it gives them, as a share of their turn ×
their turn's worth, in its screening (`scoreOutcome`) and the search's
walk price (`actionCost`), both sides' AIs. The same rows, on `b9c78fc`'s
rules (the Duelist's switches since are off).

| Row | Without | Haste 3 | 5 | 6 | 3, AI 1 | 3, AI 2 | 6, AI 1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| With it, China's mirror | | 53.3% | 53.5% | 54% | **44.8%** | **36.8%** | **41%** |
| Vanguard in the Steppe's seat | 48.5% | 50.3% | 50% | 50.5% | 51% | 50.8% | 51.5% |
| Vanguard in Persia's | 53% | 52.2% | 51.6% | 52.1% | 52.7% | 48.6% | 47.8% |
| Vanguard in Byzantium's | 45.5% | 47.4% | 47.4% | 46.5% | 43.2% | 44.1% | 41.6% |
| Grappler in China's | 60.9% | 57.5% | 58.4% | 59.1% | 59.5% | 56% | 56.5% |
| Juggernaut in China's | 47.8% | 43.3% | 43% | 42.8% | 48.8% | 55.5% | 53.5% |
| Cataphract in China's | 64.3% | 66% | 65% | 63.5% | 70.5% | 71.3% | 70% |
| **Score** | **45.7%** | **47.2%** | **47.1%** | **47.3%** | **44.7%** | **43.5%** | **43.5%** |

- **A bigger Haste adds nothing**: 5 and 6 score as 3 does (47.1–47.3%),
  the mirror 53.5–54%. What the passive gives is capped by how often an
  ally happens to stand next to the Vanguard when it's hit, not by the
  Haste's size.
- **Allies seeking it lose**, the more they seek it: the side with it in
  China's mirror wins 44.8% at share 1 and 36.8% at 2, under the 50% of
  no passive at all, and the Vanguard's score falls under its baseline
  (43.5–44.7%). Gathering round the tank costs the damage and support
  more than the Haste gives back. Why, a guess not traced: Cleave's line
  catches allies too, and a support next to the tank is in the enemy's
  reach (the threat term prices it, but against a fixed bonus).
- **So Spearhead is worth about 1.5 points to the Vanguard at any
  Haste**, too little to bring it even. Left off, `AI.spearheadShare` at 0.
  The Vanguard's likelier fixes are still a point of power or Cleave's
  Delay 8, unmeasured on today's rules.

**Spearhead at range 2 (2026-10-30).** Asked for: whether it's too strong
with every ally within 2 Hastened (`SPEARHEAD.range`, 1 as built), Haste
3, the AI's share 0. The same rows, the baseline run again on `9c410a6`
(the switches since are off; Byzantium's row 45.5% to 44.8%).

| Row | Without | Range 1 | Range 2 |
|---|---:|---:|---:|
| With it, China's mirror | | 53.3% | **59.3%** |
| Vanguard in the Steppe's seat | 48.5% | 50.3% | 54% |
| Vanguard in Persia's | 53% | 52.2% | 55.1% |
| Vanguard in Byzantium's | 44.8% | 47.4% | 50.5% |
| Grappler in China's | 60.9% | 57.5% | 54% |
| Juggernaut in China's | 47.8% | 43.3% | **36.8%** |
| Cataphract in China's | 64.3% | 66% | 62.8% |
| In others' seats (mean) | 48.8% | 50% | 53.2% |
| Kept in its own | 42.3% | 44.4% | 48.8% |
| **Score** | **45.6%** | **47.2%** | **51%** |

- **Not too strong for the Vanguard: it brings it to even.** 51% is
  inside the tanks' spread (45.3–55.7% on 2026-10-29), under the
  Cataphract's 55.7%; every row of it elsewhere is 50.5–55.1%, none over
  the band. It is the first change measured that evens the Vanguard.
- **Strong as a passive**: 59.3% for the side whose Vanguard has it, 9
  points, more than a hero's other passives were worth one at a time
  (Steady Gait 51%, the strongest offered ones 57% and Concussive's
  67.8%, "A provision against a passive or an upgrade"). As the
  Vanguard's own it's fine; it shouldn't be offered at the caravanserai at
  range 2 without measuring it on other heroes.
- **Still lost in its own seat** to the Cataphract (62.8%) and less to the
  Grappler (54%); the Juggernaut there falls to 36.8%.
- Range 2 triples the spaces that count (18 for 6), so allies get the
  Haste without gathering round the tank, which was what lost at range 1
  with the AI's share (above). Not tried: range 2 at Haste 2.
- **Built (owner, 2026-10-30):** the Vanguard starts with Spearhead at
  range 2, Haste 3, the AI's share 0; not offered at the caravanserai.

### The Duelist's lunge and streak (2026-10-30)

Asked for (owner): Swift Strike with a lunge, a walk of up to 2 spaces
straight at the first unit in line, stopped by units and yurts, ending
next to it, the Duelist's own walk cut; and its Haste starting smaller
and growing on turns striking running. Built as two switches, **off**
(`ABILITY.swiftStrike.lunge`, `.streak`; a turn without a strike, a walk
or a Hold included, starts the streak again). `experiments/duelist-lunge.mjs`,
`modWinPct`, 400 fights a row (about ±2.5 points), seeds from 1000,
production AI: the Duelist in the damage seat of the Steppe's and
Persia's mirrors, and their damage heroes in his seat of China's (as
roles-twelve.mjs); his speed +1 in China's mirror; a novice and an expert
playing him in a Steppe mirror (as skill-fights.mjs). Run on `dea19f5`'s
rules, the first six rows before the Barbarian's Leap (`8894940`).

| Swift Strike | In others' seats | Kept in its own | Score | Speed +1 | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|
| As built (Haste 3, walk 3) | 47.1% | 50.4% | 48.7% | 77.5% | 48.5% | 51.6% | 3.1 |
| Streak 1, 2, 3 | 44% | 42.1% | 43.1% | 72.5% | 50.5% | 51.5% | 1 |
| Lunge 2, walk 2 | 56.1% | 56.6% | **56.4%** | 78.5% | 38.8% | 53.5% | **14.7** |
| **Lunge 2, walk 1** | 45.9% | 48.5% | **47.2%** | **70.5%** | 42.8% | 54% | **11.2** |
| Lunge 2, walk 2, streak 1, 2, 3 | 48.5% | 48.5% | 48.5% | 74.8% | 43.3% | 51.5% | 8.2 |
| Lunge 2, walk 1, streak 1, 2, 3 | 37.4% | 40.1% | 38.7% | 68.3% | 45.8% | 52.5% | 6.7 |
| Lunge 2, walk 1, streak 2, 3 | 40.9% | 42.9% | 41.9% | 66.3% | 44.3% | 54.3% | 10 |
| Lunge 2, walk 1, streak 2, 3, 4 | 41.9% | 45.1% | 43.5% | 68.8% | 43.3% | 56% | 12.7 |

Byzantium's seat, measured too, is left out of the scores: with the
Barbarian's Leap the Duelist in his seat wins 69.6% as built and any
Duelist 67–73%, the Barbarian in China's 23–31%, which measures the
Barbarian (before the Leap, 52% and 50.5%). On the Leap, Lunge 2 with
walk 1 against as built there: 67.3% against 69.6%, 28.3% against 23.3%.

- **The lunge gives the Duelist something to play**: the span between a
  novice and an expert grows from 3.1 to 11–15, among the widest measured
  (the Juggernaut's 13, the Magus's 12.8). A turn is a walk or an ability,
  so a lunge closes and strikes in one turn, and lines and blockers decide
  which units are in reach.
- **With a walk of 2 it is too strong** (56.4%); **with a walk of 1 it is
  even** (47.2%, as built 48.7%), and his speed +1 falls from 77.5% to
  70.5%, the closest the speed point has come to the other heroes' (62.5%
  the next best).
- **Every streak is a loss**, even 2, 3, 4 (43.5% against a flat 3's
  47.2%): he walks about half his turns, and a walk ends the streak, so he
  seldom reaches its top. It does take speed's snowball down (66–69%).
  The AI's leaf doesn't count how soon a card comes back (Wait, above),
  so it plays for no streak; with people it may be worth more.

Not changed: the numbers are the owner's. Likeliest to suit: Lunge 2 and
a walk of 1, Haste 3 flat. If the streak is wanted, one a walk doesn't end
(only a Hold, a skip or an ability that isn't Swift Strike) is the variant
to measure next.

### The Barbarian's Leap by its shape (2026-10-30)

Asked for (the owner): Leap, the Barbarian's in place of Axe Throw (over
anything to a free space 2 away off his six lines), hitting the four
spaces next to the landing facing forward, and the front two for his power
with the other four for 1, against Leap as built (the front two).
`ABILITY.leap.shape` `front` (built), `forward`, `splash` (`.splash` 1),
and Axe Throw (`HEROES.varangian.abilities`) for a reference.
`experiments/leap.mjs`, on `cd0f9d1` before its rebase: the Barbarian in
the damage seat of the three other regions' mirrors, and each of their
damage heroes in his seat of Byzantium's (as "Each hero in its role"), 400
fights each (about ±2.5 points a cell). Unfinished fights 0–5.8%.

| Barbarian with | Steppe | China | Persia | Kept in its own (100 − theirs) | Leap's share of his turns | He lives through |
|---|---:|---:|---:|---:|---:|---:|
| Axe Throw | 50.8% | 50.5% | 35.9% | 55.6% / 48% / 46.2% | 26–31% (Axe Throw) | 57–78% |
| Leap, `front` (built) | **32%** | **24.3%** | **24.9%** | 42% / 29.6% / 36% | 9–16% | 42–54% |
| Leap, `forward` | **33.5%** | **25%** | **28.5%** | 43.4% / 33.7% / 34.6% | 14–19% | 37–50% |
| Leap, `splash` | **31.8%** | **20.8%** | **26.1%** | 41.7% / 30.3% / 36% | 20–28% | 35–55% |

- **Every Leap is far weaker than Axe Throw**: 15–26 points down in
  others' seats, and Byzantium's party 7–18 points worse with him in it.
  The shapes are within noise of each other: more spaces raise how often
  he leaps (9–16% of turns to 20–28%), not how often his side wins.
- **He dies more**: he lives through 35–55% of fights, 57–78% with Axe
  Throw. A leap ends next to the enemy with 6 health and speed 1, and
  `splash` puts him in the middle of them.
- **He walks or Holds most turns** (Hold 17–25%), so the AI rarely finds
  a landing worth it; how much of the loss is the AI's play and how much
  the ability's is unmeasured (a novice and an expert, as "Skill on all
  twelve heroes", would say).
- The damage by source wasn't counted: `ablate.ts` learnt the axe's and
  the splash's lines after the run started.

**With a Shield (later 2026-10-30).** Asked for (the owner): a leap that
hits enemies Shields him by the damage they take, until spent, at most 3
(as Blessing's cap); one that hits no unit loses any Shield he has, one
hitting only allies gains none (`ABILITY.leap.shield`, off;
`.shieldCap` 3). `experiments/leap.mjs`'s `frontShield` and
`splashShield`, rerun beside `front` and `splash` (the same numbers as
above, now with the axe's damage counted), on `8de5716` before its rebase.

| Barbarian with | Steppe | China | Persia | Kept in its own | Leap's share of his turns | He lives through | His damage to enemies a fight |
|---|---:|---:|---:|---:|---:|---:|---:|
| Leap, `front` | 32% | 24.3% | 24.9% | 42% / 29.6% / 36% | 9–16% | 42–54% | 2.7–4.2 |
| `front` with Shield | 33.5% | 25% | 29.6% | 45.5% / 29.8% / 36.4% | 11–18% | 43–64% | 3.4–5 |
| Leap, `splash` | 31.8% | 20.8% | 26.1% | 41.7% / 30.3% / 36% | 20–28% | 35–55% | 3.6–4.7 |
| `splash` with Shield | **36.5%** | 25.1% | **34.9%** | 40.7% / 30.7% / 35.1% | 31–40% | 37–56% | 3.9–6.8 |

- **The Shield helps a little, `splash` most** (5–9 points in the Steppe
  and Persia, 4 in China), and he leaps more for it (31–40% of his
  turns); every row is still 14–25 points under Axe Throw, and Byzantium's
  party no better with him.
- **He hardly hits**: 3–7 damage to enemies a fight, one or two leaps
  that land on someone, so the Shield seldom comes; with `front` it lifts
  his survival (to 57–64% in China and Persia) without lifting wins.
- The fault is how seldom a leap reaches anyone, not what it does when it
  does; a Leap whose landing can be next to an enemy, or more health,
  untried.

### Blessing by the track with its excess as Shield (2026-10-30)

Asked for (the owner), after "Blessing by the track": the heal still by
the track, and what it can't restore a Shield again.
`ABILITY.blessing.trackShield` (off): the heal beyond the ally's missing
health becomes a lasting Shield, a unit holding at most `cap` (3) of it,
no Shield on top (`shield`'s 1 not given); the smite as before; range 3.
`experiments/priest-track-shield.mjs`, the seats and fights of "Blessing
by the track", Blessing as built run again alongside (the same to the
point). Unfinished fights 0–1.3%.

| Priest | Steppe | China | Persia | Kept in its own | Score | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| As built | 42.7% | 40.3% | 50.9% | 50.4% | 47.5% | 47.9% | 51.3% | 3.4 |
| Track, `bands`, excess as Shield | 40.5% | 37.8% | **60.1%** | **57%** | **51.6%** | 46.3% | 52% | 5.7 |
| Track, `cap`, excess as Shield | 37% | **31%** | 57.3% | 49.6% | 45.7% | 49.3% | 52.5% | 3.2 |
| *Track, `bands`, no Shield ("Blessing by the track")* | *31%* | *20%* | *45.1%* | *49.2%* | *40.6%* | *49%* | *51.3%* | *2.3* |

- **The Shield gives back 10–18 points** in every seat: `bands` scores
  51.6%, 4 points over Blessing as built, but unevenly: under it in the
  Steppe and China (2–3 points, within noise), 9 over in Persia's seat
  and 7 over in his own party. Too strong beside the Persians, about even
  elsewhere.
- **`bands` beats `cap` again** (by about 6 points): `cap`'s heal of 1 or 2
  near the split is too little for a turn.
- He Blesses on 67–74% of his turns (81–85% as built), smites 1.5–2.3
  times a fight for 3.5–6.5 damage, and lives through 35–70% of fights
  (44–83% as built). Fights stay shorter (114–124 slots, 128–137).
- **Skill**: `bands` 5.7 points, `cap` 3.2, as built 3.4 (±3.5 each).
- Untried: `bands` with the Persian seat's strength trimmed (range 2, or
  the smite at half power), and the Steppe and China seats given more.

### Blessing by the track as a pure support (2026-10-30)

Asked for (the owner): the track Blessing with its excess as Shield, but
no smite, a pure support. `ABILITY.blessing.trackSmite` off (on as
measured before): no enemy taken. `experiments/priest-track-pure.mjs`,
`bands`, `trackShield`, range 3, the seats and fights of "Blessing by the
track", with the smite and as built run again on today's rules (the
Barbarian's Leap since, which moved the rows with the Priest's seat in
Byzantium's party; the others' rows came out the same to the point).
Then the pure support with `split` 7 and 9 (9: every ally acting before
his next turn healed) in the other supports' seats. Unfinished fights
0–3.8%.

| Priest | Steppe | China | Persia | Kept in its own | Score | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| As built | 42.7% | 40.3% | 50.9% | 42.9% | 43.8% | 47.9% | 51.3% | 3.4 |
| Track, with the smite | 40.5% | 37.8% | 60.1% | 50.4% | 48.3% | 46.3% | 52% | 5.7 |
| **Track, pure support** | **28.5%** | **26%** | **32.5%** | **34.1%** | **31.6%** | 48.9% | 52.9% | 4 |
| Pure support, `split` 7 | 31.6% | 30.5% | 47% | | | | | |
| Pure support, `split` 9 | 35.6% | 40.8% | 49% | | | | | |

- **The smite is most of what the Shield left**: without it he loses
  12–28 points in every seat, 16.7 points of score. The two halves only
  work together: the smite alone with no Shield was as weak (40.6%,
  "Blessing by the track").
- **Much of the loss is idle turns**: with no smite an ally acting late has
  nothing from him, so he Holds on 8–20% of his turns (Blesses on 54–66%).
  A later split gives back much of it (`split` 9: Holds 3–13%, Blesses
  69–82%), but still 2–9 points under Blessing as built, which reaches any
  ally within 2 and gives Shield 1 on top.
- **His own party is weaker with any Blessing since the Leap** (as built
  42.9% kept in its own, 50.4% before), the Storm Caller beside the
  Cataphract and the Barbarian 67%. Not traced.

### The Duelist's lunge through units (2026-10-30)

Asked for (owner): the lunge of 2 with a walk of 2 and Haste 3 flat (no
streak), passing through the unit next to him. Built as a switch, **off**
(`ABILITY.swiftStrike.passThrough`): a lunge may cross units, each hit as
it goes by, to land on a free space past them (with a lunge of 2, the one
past the unit next to him), and strikes the unit in front of that too;
one Haste for the turn however many it hits. `experiments/duelist-pass.mjs`,
the rows of "The Duelist's lunge and streak", on `48c8916`'s rules (the
Barbarian's Leap); the score over the Steppe's and Persia's seats only, as
there.

| Swift Strike (walk, Haste 3) | In others' seats | Kept in its own | Score | Speed +1 | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|
| As built (walk 3) | 47.1% | 50.4% | 48.7% | 77.5% | 48.5% | 51.6% | 3.1 |
| Lunge 2, walk 2 | 56.1% | 56.6% | 56.4% | 78.5% | 38.8% | 53.5% | 14.7 |
| **Lunge 2 through units, walk 2** | 62.5% | 62.1% | **62.3%** | 78.5% | 34.5% | 52.5% | **18** |
| Lunge 2 through units, walk 2, **no Haste** (owner) | 46.7% | 45.4% | **46%** | **65.8%** | 40.3% | 54% | 13.7 |

Byzantium's seat (left out): the Duelist in it 70.4%, 74.4%, 78.9% and
58.7%, the Barbarian in China's 24.3%, 15%, 12.3% and 28.3%.

- **Passing through is worth about 6 points more** on top of the lunge's
  8: too strong at a walk of 2 (62.3%). He uses Swift Strike on 43.6% of
  his turns (39% with the lunge that stops, 34.5% as built), and his sword
  deals 8.3 a fight in the Steppe's seat (6.8, 6.4).
- **The span is the widest measured (18)**, but it is a novice doing
  worse (34.5%), not an expert better (52.5%, as with the lunge that
  stops): a lunge into the middle of the enemy, and through it, is easy
  to misplay.
- **His speed +1 is no worse** (78.5%, as with the plain lunge).

- **Without the Haste (owner, the same day) it is about even** (46%, as
  built 48.7%), the speed +1 that was his snowball down to 65.8%, near the
  other heroes' best (62.5%), and the span still 13.7. He acts every 8
  slots, never 5, so his speed point is worth no more than another fast
  hero's. Put on the test stage (`"swiftStrike"`) for play-testing.

Not changed in runs: the numbers are the owner's. Through units with no
Haste is the version to play-test; a walk of 1 (the plain lunge's 47.2%
at walk 1, from 56.4% at walk 2) would even the Haste 3 version instead.

### The Duelist's jumps (2026-10-30)

Asked for (owner): Swift Strike hitting a unit 2 away in line, stepping
one space in, or jumping a unit next to it to the free space past it,
hitting it, and from there jumping another next to it in the same turn,
as a checkers king does. Built as a switch, **off**
(`ABILITY.swiftStrike.jump`, with `lunge` 1): a strike next to it as
before; a jump keeps the turn its own while another is open
(`Unit.chaining`), with only another jump or Skip turn to choose, Skip
ending it as a strike's turn, not a Wait; never the same unit twice in a
turn. `experiments/duelist-jump.mjs`, the rows of "The Duelist's lunge
and streak", on `7f2ae72`'s rules (as built in the Duelist's seat came out
1.5–3.5 points from the runs before, the commits since in other heroes);
the score over the Steppe's and Persia's seats only, as there. In a probe
of 40 Steppe fights at walk 2 and no Haste, the AI jumped 26 times, 9 of
them chained.

| Swift Strike | In others' seats | Kept in its own | Score | Speed +1 | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|
| As built (walk 3, Haste 3) | 47.1% | 47.9% | 47.5% | 75.8% | 48.5% | 51.6% | 3.1 |
| Jumps, walk 2, no Haste | 48.5% | 46.6% | 47.5% | 67.8% | 44.5% | 51.5% | 7 |
| **Jumps, walk 3, no Haste** | 48% | 52% | **50%** | **66.3%** | 39% | 49.5% | **10.5** |
| Jumps, walk 2, Haste 3 | 60.5% | 67.5% | **64%** | 74.8% | 41.5% | 53.8% | 12.3 |

Byzantium's seat (left out): the Duelist in it 70.4%, 56.5%, 61.6% and
78%, the Barbarian in China's 23.8%, 28.8%, 26.3% and 15.3%.

- **Without the Haste the jumps are even**: 47.5% at walk 2, 50% at
  walk 3, his speed +1 down to 66–68% (as the lunge through units without
  it, 65.8%). With Haste 3 they are too strong (64%), as the lunge through
  units was (62.3%).
- **Less to play than the lunge through units** (span 7 at walk 2, 10.5
  at walk 3, against 13.7): a chain needs units packed next to each other
  with free spaces past them, which the board seldom offers.
- **Walk 3 rather than 2**: the jump and the 2-space strike move him at
  most a space or two, and with a walk of 2 he reaches fewer fights.

Not changed: the numbers are the owner's. Jumps at walk 3 with no Haste
is the even one of these; the lunge through units with no Haste
(46%, span 13.7) gives more to play.

### The Duelist's jumps one a turn, the Haste growing (2026-10-30)

Asked for (owner): in place of chaining jumps in one turn, each Swift
Strike hit giving more Haste. The jumps of "The Duelist's jumps" (lunge 1)
one a turn (`ABILITY.swiftStrike.chain` off, a switch, on as built), the
Haste 1, 2, then 3: by `streak`, hits on turns running, a turn without
one starting it again; or built up all fight (`streakResets` off, a
switch, on as built). `experiments/duelist-jump-streak.mjs`, the rows of
"The Duelist's lunge and streak", on `f9c3ecd`'s rules; the score over
the Steppe's and Persia's seats only, as there. In brackets, the chained
jumps at walk 2 with no Haste (`7f2ae72`).

| Jumps, one a turn | In others' seats | Kept in its own | Score | Speed +1 | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|
| Walk 2, no Haste | 46.7% | 43.9% | 45.3% (47.5%) | 68.5% (67.8%) | 46.5% | 51% | 4.5 (7) |
| **Walk 2, streak 1, 2, 3** | 54.3% | 50.8% | **52.5%** | 70.5% | 45.5% | 54% | 8.5 |
| Walk 2, built up 1, 2, 3 | 55.5% | 55.6% | 55.5% | 70.5% | 43.5% | 54% | 10.5 |
| Walk 3, streak 1, 2, 3 | 53.3% | 57% | 55.1% | 72.5% | 36.5% | 57% | **20.5** |

Byzantium's seat (left out): the Duelist in it 59.2%, 72.3%, 73.7% and
75.7%, the Barbarian in China's 34.5%, 26.5%, 18.5% and 21%.

- **The chain is worth about 2 points** (45.3% one a turn, 47.5%
  chained), inside the noise, and 2.5 points of span.
- **Now a streak pays**: 1, 2, 3 at walk 2 is 7 points over no Haste
  (52.5%), where on the plain Swift Strike it lost 6 ("The Duelist's lunge
  and streak", walk 3). The 2-space strike and the jump close in as they
  hit, so he walks less and the streak lasts. Built up all fight it is 3
  points more (55.5%).
- **His speed +1 stays down** (70.5–72.5%, 75.8% as built): the Haste
  starts at 1 and only a streak reaches 3.
- **Walk 3 with the streak spans 20.5**, the widest measured, a novice
  36.5% against an expert 57% (about ±3.5 a span): a novice walks out of
  his streak; but it is 55.1%, a little strong.

Not changed: the numbers are the owner's. One jump a turn with the streak
1, 2, 3 at walk 2 is the nearest to even of these (52.5%); a streak of
0, 1, 2 or 1, 2 would bring it nearer, and walk 3 with one of those is the
one to measure for the span.

### Blessing in a line (2026-10-30)

Asked for (the owner): Blessing fired down a straight line, through
obstacles, at any range, healing every unit on it his power, allies and
enemies. `ABILITY.blessing.shape` `line` (off): one of the six lines out
from the Priest to the map's edge, through yurts and units, every unit on
it blessed as one ally is (Humphrey too), aimed at the line's first
space; nothing is a smite. As built per unit (the heal, its excess and 1
more a lasting Shield, at most 3), or a heal alone (`overheal` off,
`shield` 0). He is on no line of his own, so he can't bless himself;
`lineSelf` (off) blesses him too whenever the line has a unit on it.
`experiments/priest-line.mjs`, the seats and fights of "Blessing by the
track", on today's rules. Unfinished fights 0–3.8%.

| Priest | Steppe | China | Persia | Kept in its own | Score | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| As built | 42.7% | 40.3% | 50.9% | 42.9% | 43.8% | 47.9% | 51.3% | 3.4 |
| Line, Blessing's Shield | 35.4% | 34.3% | 41.7% | 33.8% | 35.5% | 49.7% | 50.4% | 0.7 |
| Line, a heal alone | **22.1%** | **18.3%** | **29.2%** | **28.5%** | **25.8%** | 48.5% | 50.3% | 1.8 |
| **Line, Blessing's Shield, himself too (`lineSelf`)** | **44.6%** | **43.8%** | **56.6%** | 46.7% | **47.5%** | 45% | 49.7% | 4.7 |

- **The line is weaker only because he loses himself**: no line holds
  him, so he lives through 25–44% of fights (44–83% as built). Blessed
  too (`lineSelf`), he survives 55–79% and is **2–6 points over Blessing
  as built in every other seat** and 4 points in his own party, the best
  Priest measured on today's rules.
- **Enemies healed cost little**: the AI aims its lines past them (he
  Blesses on 47–69% of his turns, walks on 24–41% to line up).
- **The Shield is still most of his worth**: a heal alone loses 10–16
  points more.
- **Skill**: the line itself rewards play no more (0.7–1.8 points);
  `lineSelf` 4.7, about as built (all ±3.5).
- **Built** (owner, 2026-10-30): `shape` `line` and `lineSelf` are now
  Blessing's defaults; Blessing as one ally is `shape` `unit`.
- **Then any line, the Priest always blessed** (owner, later 2026-10-30):
  aimed as Snap Shot is, along any of the six lines to the edge, a unit on
  it or not, so he can bless himself down an empty one.
  `experiments/priest-line-any.mjs`, the same seats and fights: **45.2%,
  48.8% and 52.5%** in the other supports' seats (44.6%, 43.8%, 56.6%
  with a unit needed), 43.5% kept in his own (46.7%), a score of **46.2%**
  (47.5%); more even across the seats, about as strong. He Blesses on
  78–84% of his turns (58–69%) and lives through 54–75% of fights.
  Skill span **0.8** (novice 48.2%, expert 49%; 4.7): with a Blessing
  always to hand there is less to choose. Unfinished fights 0–2.8%, 5%
  with the Storm Caller in his seat in Byzantium's party.
- **Without his own blessing** (`lineSelf` off; the owner's question,
  later 2026-10-30; `noSelf-` rows of `priest-line-any.mjs`): **33.9%,
  32.8% and 41.6%** in the other supports' seats, 32.9% kept in his own,
  a score of **34.5%** (46.2% with it), skill span 1.6. As measured with a
  unit needed on the line (35.5%): an empty line does nothing for him, so
  the aiming makes no difference. He lives through 27–43% of fights
  (54–75% with it) and walks on 37–39% of his turns to line up allies:
  healing himself is about 12 points of his worth.

### The Elixir in lines, by turns or as poison (2026-10-31)

Asked for (the owner): two Elixirs, each aimed as Axe Throw is, a unit
within 3 on one of the Alchemist's six lines, over units and yurts
(`ABILITY.elixir.line`, `range` 3; not the Alchemist himself, who is on
no line of his own). **By turns** (`mode` `alternate`): the first cast
heals an ally his power, the next hits an enemy for it, and so on
(`Unit.elixirCasts`; a heal turn can be spent on an unhurt ally to turn
it). **Poison** (`mode` `poison`): any unit healed his power, then losing
1 every 6 slots (`poisonEvery`) until his power + 1 (`poisonExtra`) is
lost (`Unit.poison`, `poisonDue`; damage as hail's, a Shield taking it,
Armour not; a second dose adds to what's left). Neither Empowers or
Weakens. Against the Elixir as built, and the lines alone with its built
effects (`lineOnly`). His power 1 throughout. All switches, off.
`experiments/elixir-turns-poison.mjs`: the Alchemist in the other
supports' seats, and each of them in his (China's), as "Blessing in a
line"; 400 fights each, seeds from 1000, on `4fa1214` with the switches.
Unfinished fights 0–1%.

| Alchemist | Steppe | Persia | Byzantium | Kept in its own | Score | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| As built | 53.8% | 48.7% | 48.1% | 55.1% | 52.7% | 47% | 52.8% | 5.8 |
| Lines, the built effects | 46% | 49.7% | 47.4% | 49.6% | 48.6% | 44% | 54% | 10 |
| **Lines, by turns** | **25%** | **24.3%** | 44.6% | **23.3%** | **27.3%** | 47.5% | 52.3% | 4.8 |
| **Lines, poison** | **31%** | **31.7%** | 45% | **23.8%** | **29.9%** | 46.5% | 51.5% | 5 |

- **Both proposals are far too weak at power 1**, about 25 points under
  the Elixir as built: any other support in China's seat wins 70–82%
  against them (45–61% as built). Byzantium's seat loses least (45%),
  the Priest's party carrying it.
- **Most of the loss is the Empower 2 and Weaken 2**: the lines alone
  cost about 4 points (52.7% to 48.6%), most of it in the Steppe's seat
  (53.8% to 46%), where he can no longer give himself an Elixir (he lives
  through 57.5% of fights there, 74.5% as built).
- **By turns, the AI uses the Elixir on only 25–44% of his turns**
  (61–75% as built): on a heal turn with no ally hurt, turning it on an
  unhurt one is worth nothing to its guess, so he walks or Holds. A heal
  of 1 or a hit of 1 every other turn is little either way.
- **Poison is mostly a slow hit of 2 on an enemy** (net 1 on one already
  hurt): an ally gains 1 now and loses 2, so the AI gives it to enemies.
  Used on 36–64% of his turns.
- **Skill**: spans 4.8 and 5 (5.8 as built, 10 for the lines alone).

Not built. Both would need much more from each cast to be even, his
power 2 or more (a heal and hit of 2, a poison of 3), or the Empower and
Weaken kept beside them.

**At power 2** (the owner's question, 2026-10-31; `turns2-` and
`poison2-` rows, the same seats and fights): a heal and a hit of 2 by
turns, or a heal of 2 and a poison of 3.

| Alchemist | Steppe | Persia | Byzantium | Kept in its own | Score | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| By turns, power 2 | 37.3% | 36.8% | 45.5% | 31.1% | **35.5%** | 50.3% | 53.5% | 3.2 |
| Poison, power 2 | 30.5% | 33.2% | 47.5% | 25.7% | **31.4%** | 49% | 53.5% | 4.5 |

- **Still far too weak**: by turns 8 points better than at power 1
  (27.3%), poison only 1.5 (29.9%), both 17–21 points under the Elixir
  as built (52.7%). The Elixir as built at power 2 was 73.8% in China's
  mirror ("Durations by power and defence, step 1"): the point is worth
  much less here.
- **By turns, still cast on only 23–42% of his turns** (27–42% at power
  1): the heal turn with no one hurt still stalls him, so half his
  Elixirs never come. Kept in his own party 31.1% (Persia's Magus in his
  seat 58.8%, the Priest 76%).
- **Poison gains least**: 3 over 18 slots, after healing an enemy 2
  first when it's hurt, is slow and often undone; he lives through
  39–71% of fights (45.5–78.5% at power 1), a little more exposed.
- Unfinished fights at most 1%.

### The Duelist walking straight, and a dash (2026-10-31)

Asked for (owner): the Duelist's walk only straight, up to 3 spaces along
one of the six directions (`HeroDef.movesStraight` with his `moveCap`, a
switch: the Outrider's has no cap), with the jumps one a turn and the
streak 1, 2, 3 of "The Duelist's jumps one a turn, the Haste growing";
then Swift Strike only a dash (`ABILITY.swiftStrike.dash`, a switch, 0 as
built): exactly 3 spaces straight, through the units on the first two,
each hit, to the free third, or with yurts or the map's edge on the third,
2 through a unit next to him; no strike in place, a unit on the landing
space blocking it, nothing at all when Immobilized; with the straight walk
of 3, Haste 3 flat or the streak 1, 2, 3. `experiments/duelist-straight.mjs`
and `duelist-dash.mjs`, the rows of "The Duelist's lunge and streak", on
`65edad7`'s and `bc86882`'s rules (the free-walk rows came out exactly as
before); the score over the Steppe's and Persia's seats only, as there.

| Duelist | In others' seats | Kept in its own | Score | Speed +1 | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|
| Jumps, streak, walk 3 free (the test stage's) | 53.3% | 57% | 55.1% | 72.5% | 36.5% | 57% | **20.5** |
| Jumps, streak, **walk 3 straight** | 48.6% | 45.9% | **47.2%** | 66.5% | 41.5% | 52% | 10.5 |
| Jumps, streak, walk 2 free | 54.3% | 50.8% | 52.5% | 70.5% | 45.5% | 54% | 8.5 |
| Jumps, streak, walk 2 straight | 46.9% | 46% | 46.4% | 69.8% | 42.3% | 52.8% | 10.5 |
| **Dash 3**, walk 3 straight, Haste 3 | 40.5% | 40.5% | **40.5%** | 67% | 42.5% | 55.3% | 12.8 |
| Dash 3, walk 3 straight, streak | 38.4% | 35.1% | **36.7%** | 65.3% | 45.8% | 51.5% | 5.7 |
| **Dash 2 or 3**, walk 3 straight, Haste 3 (owner, the same day) | 48.3% | 48% | **48.1%** | 72.3% | 40.8% | 57.5% | **16.7** |
| Dash 2 or 3, walk 3 straight, streak | 44.8% | 42.4% | 43.6% | 72.8% | 43.5% | 53.8% | 10.3 |

Byzantium's seat (left out): the Duelist in it 62–65% walking straight or
free, 51% dashing; the Barbarian in China's 21–30%, 31–37% dashing.
Unfinished fights up to 3.5% with the dash and Haste 3, 6.8% with its
streak.

- **The straight walk costs about 6–8 points and half the span at walk
  3** (47.2% from 55.1%, span 10.5 from 20.5); at walk 2 it costs 6 and
  leaves the span as it was (10.5 against 8.5). Lines take away most of
  the places from which a planner sets up his next strike.
- **The dash is weak** (40.5% with Haste 3, 36.7% with the streak): in the
  Steppe's seat he uses it on 23–27% of his turns and Holds 24–25%,
  against 41–44% and 9–13% with the jumps; his sword deals 4.8–5.8 a fight
  (6.5–8.3 with the jumps). It needs a unit on the first two spaces of a
  line and a free space exactly 3 out, which the board seldom gives, and
  it leaves him past the enemy's front. The streak lasts least of all with
  it, so it is the weaker there.

- **A dash of 2 or 3, his choice, is even with Haste 3** (48.1%,
  `ABILITY.swiftStrike.dashMin` 2, a switch, 0 as built: any free space 2
  or 3 out with a unit passed on the way), with a span of 16.7, the
  widest after the free walk's: he uses it on 32% of his turns, his sword
  6.7 a fight. His speed +1 is back up to 72.3%, and unfinished fights up
  to 6.3%, over the 3% a change should ship under (Principles, 12). With
  the streak it is weaker again (43.6%).

**Built (owner, 2026-10-31): the dash of 2 or 3 with Haste 3 and the
straight walk of 3**, in runs and on the test stage (roster.md). The free
walk of 3 with the jumps stays the one with the widest span (20.5, at
55.1%); the dash's unfinished fights (up to 6.3%) are the thing to watch.

### Spearhead off, Cleave's Delay raised in its place (2026-10-31)

Asked for: whether Spearhead could come off the Vanguard if Cleave's
Delay went up instead. `experiments/cleave-for-spearhead.mjs`: the
Vanguard's six rows of "Each hero in its role" (as in `spearhead.mjs`),
every Vanguard with Spearhead at range 2 as built at Delay 6, or without
it at Cleave's Delay 6 to 10 (`ABILITY.cleave.delay`, both sides). 400
fights a row (about ±2.5 points), seeds from 1000, production AI. The
four rows without a Cataphract on `dab3646`, its two rows on `deb3834`
(after `12bd9fc` took its Charge's slam off; the other rows don't use
it). Unfinished fights at most 4%.

| Row | Spearhead, 6 | None, 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|
| Vanguard in the Steppe's seat | 54% | 48.5% | 52.3% | 54% | 55.5% | 62% |
| Vanguard in Persia's | 55.1% | 53% | 57.7% | 57.2% | 58.2% | 58.8% |
| Vanguard in Byzantium's | 51.9% | 53.6% | 56.8% | 58.9% | 62.4% | 68% |
| Grappler in China's | 54% | 60.9% | 55.8% | 51.3% | 41.5% | 35.3% |
| Juggernaut in China's | 36.8% | 47.8% | 41.3% | 37.8% | 32.8% | 26.8% |
| Cataphract in China's | 41% | 44% | 38.8% | 36.1% | 27.5% | 23.5% |
| In others' seats (mean) | 53.7% | 51.7% | 55.6% | 56.7% | 58.7% | 62.9% |
| Kept in its own | 56.1% | 49.1% | 54.7% | 58.3% | 66.1% | 71.5% |
| **Score** | **54.9%** | **50.4%** | **55.2%** | **57.5%** | **62.4%** | **67.2%** |

- **Delay 7 replaces Spearhead**: 55.2% against 54.9%, the rows within
  about 5 points of each other (Byzantium's seat and the Juggernaut in
  China's the furthest apart, 4.5–4.9 points); Spearhead does a little better in its own seat
  against the Juggernaut, Delay 7 a little better elsewhere.
- **With the Cataphract's slam gone the Vanguard is even with neither**:
  50.4% at Delay 6 and no Spearhead (45.6% on 2026-10-30, 46.5% on
  `dab3646`'s Cataphract). The Cataphract in China's seat fell from
  62–64% to 41–44%, so Spearhead (and Delay 7) now put the Vanguard
  at 55%, at the top of the tanks' spread (45.3–55.7% on 2026-10-29).
- **8 and up too strong** (57.5–67.2%): every other tank loses China's
  seat, the Juggernaut and the Cataphract to 24–38%.
- Each point of Delay is worth about 3–5 points of the Vanguard's score.
  Not changed then: the numbers are the owner's.

**Beside the other tanks (2026-10-31).** Asked for: how these compare
with the Juggernaut and the Grappler. Each tank's score from the same
rows, the six tank rows without a Vanguard (`roles-twelve.mjs`, the same
for every option) run on `e243cc1`, 400 fights each; the Cataphract too.

| Vanguard as | Vanguard | Grappler | Juggernaut | Cataphract |
|---|---:|---:|---:|---:|
| Spearhead, Delay 6 (built) | **54.9%** | 46.3% | 51.6% | 47.2% |
| No Spearhead, 6 | **50.4%** | 48.4% | **53.8%** | 47.5% |
| No Spearhead, 7 | **55.2%** | 46.9% | 51.9% | 46.1% |
| No Spearhead, 8 | **57.5%** | 45.8% | 51.4% | 45.3% |

- **As built the Vanguard is now the strongest tank**, 3.3 points over
  the Juggernaut and 8.6 over the Grappler; Delay 7 the same.
- **Without Spearhead at Delay 6 the tanks are closest** (47.5–53.8%,
  6.3 points against 8.6 as built): the Vanguard between the Grappler
  and the Juggernaut, the Juggernaut then the strongest.
- The Grappler (42.7–44.5% kept in its own seat) and the Cataphract
  (43.6–45.9%) are weakest at home in every option: the Juggernaut wins
  66.5% in the Steppe's seat. The Cataphract's 55.7% of 2026-10-29 is
  gone with its slam.

**Skill (2026-10-31).** Asked for: the skill gap of each option.
`experiments/vanguard-skill.mjs`, as `skill-fights.mjs`: the tank played
by a novice (depth 1) or an expert (depth 4, 4× the work) in the tank
seat of a Steppe mirror, 400 fights a row (about ±3.5 a span), seeds from
1000, on `a2d0304`. Unfinished fights 0%.

| Tank | Novice | Expert | Span (2026-10-29) |
|---|---:|---:|---:|
| Vanguard, Spearhead, Delay 6 (built) | 45.8% | 52.8% | 7 |
| Vanguard, no Spearhead, 6 | 46.8% | 54% | 7.2 (8) |
| Vanguard, no Spearhead, 7 | 44.5% | 54.8% | **10.3** |
| Grappler | 44.5% | 49.8% | 5.3 (6.7) |
| Juggernaut | 40.8% | 53.5% | **12.7** (13) |
| Cataphract | 44.8% | 58.5% | **13.7** (6.8) |

- **Spearhead adds no skill** (7 against 7.2): it fires on being hit,
  not on a choice. **Delay 7 adds about 3 points of span** (10.3), at the
  edge of noise: a bigger Delay makes choosing whom to Cleave matter more.
- The Cataphract's span doubled with its slam gone (6.8 to 13.7), the
  first measure of it since; the Grappler stays the least skilful tank.
- **Built (owner, 2026-10-31):** the Vanguard without Spearhead, Cleave's
  Delay 6; Spearhead kept in the code, no hero's and not offered.

### The Elixir as an overdose (2026-10-31)

Asked for (the owner): the Elixir's shape kept (one unit within 2, the
Alchemist too), on any unit, ally or enemy, an Empower big enough to fell
most heroes in one hit for a turn's slots (8), and the unit hit for the
Alchemist's power. `ABILITY.elixir.overdose` (0, off): above 0, the unit
is Empowered until its hits deal that much (its power + Empower, at least
1), and takes the Alchemist's power as hail's damage (a Shield takes it,
Armour not; it can fell the unit); no heal, hit or Weaken besides. 6
fells every hero of defence 1 or 2 (8 of the 12, the wolves and foxes),
4 those of defence 1. The AI weighs it on either side, the Empower's
guess less the damage. `experiments/elixir-overdose.mjs`, the seats and
fights of "The Elixir in lines, by turns or as poison", on `09a8f46`.
Score the mean of the six seats; the as-built row rerun on today's rules
(kept 55.8%, score 53% since Cleave's Delay 6). Unfinished fights at
most 0.3%.

| Alchemist | Steppe | Persia | Byzantium | Kept in its own | Score | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| As built | 53.8% | 48.7% | 48.1% | 55.8% | 53% | 47% | 52.8% | 5.8 |
| **Overdose to 6** | 37.8% | 31.3% | 50.3% | 31.6% | **35.7%** | 45.5% | 59.3% | **13.8** |
| Overdose to 4 | 31.8% | 28.3% | 45.8% | 25.9% | **30.6%** | 43.8% | 52.8% | 9 |
| Overdose to 6, power 2 | 43% | 37% | 49.1% | 42.9% | **43%** | 43.5% | 53% | 9.5 |

- **Too weak as the AI plays it**, 17 points under the Elixir as built
  at 6 and power 1: China with any other support in his seat wins 64–73%.
  Only Byzantium's seat holds (50.3%), where the Cataphract's Charge and
  the Priest's Blessing make the hit back affordable.
- **Cast on 31–46% of his turns** (61–75% as built): with no heal, an
  ally pays 1 for an Empower it can only use if it has a hit this turn,
  and on an enemy it is a hit of 1 that may hand it a kill, so most turns
  he walks instead. He lives through 35–74% of fights (52–88% as built),
  standing closer with nothing to heal him.
- **The biggest skill span measured on him, 13.8** (5.8 as built): the
  expert AI, looking 4 deep, wins 59.3%, above the Elixir as built; the
  production AI can't line up the Elixir with the hit that spends it.
  A player who can should find it strong, so play-testing is the truer
  test than these seats.
- **4 is worse than 6** (30.6%): the one-hit threshold is the point.
  **Power 2** (a hit of 2) gains 7 points (43%), the hit on an enemy
  worth more, the cost on an ally more too.

Not built. To be even for the AI it would need more on each cast (its
power 2 and the old heal on an ally, or the hit on an enemy only), or the
AI planning the hit that follows it.

Put on the test stage for play-testing (owner, 2026-10-31; `"elixir":
{"overdose": 6}`, `Unit.elixirOverdose`), its shape as built.

**By its shape** (the owner's question, 2026-10-31; `odLine`, `odRange3`,
`odBurst`, `odAura` rows, the same seats and fights, on `029c9e3`), the
overdose to 6 at power 1: in lines to 3 as Axe Throw (the test stage's
shape before), one unit within 3, a burst of radius 1 on a space within
2 (every unit around it, the Alchemist too), and every unit next to him
and himself.

| Overdose to 6 | Steppe | Persia | Byzantium | Kept in its own | Score | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| One unit within 2 (as built's) | 37.8% | 31.3% | 50.3% | 31.6% | 35.7% | 45.5% | 59.3% | 13.8 |
| Lines to 3 | 32.3% | 33.4% | 52.9% | 30.3% | 34.9% | 42.8% | 56.3% | 13.5 |
| **One unit within 3** | 43.3% | 35.8% | 55.6% | 44.2% | **44.5%** | 35.8% | 57.5% | **21.7** |
| **Burst within 2** | 42% | 34.5% | 61.3% | 42.5% | **44.2%** | 40% | 53.1% | 13.1 |
| Every unit next to him | 21.3% | 22% | 45.9% | 22.2% | **26%** | 42.5% | 53.5% | 11 |

- **The shape matters, by its reach**: one unit within 3 or a burst
  within 2 gain about 9 points (44.5%, 44.2%), still about 9 under the
  Elixir as built (53%); lines to 3 are the unit within 2's equal
  (34.9%), the lines' extra reach given back in the spaces off them.
  The aura is the worst (26%): it catches the enemy beside him as often
  as the ally, and he casts it on only 9–16% of his turns.
- **Reach lets him pick the unit about to hit**: cast on 44–56% of his
  turns within 3 or as a burst (31–46% within 2). The burst does best in
  Byzantium's seat (61.3%), Empowering the Cataphract and the Barbarian
  together.
- **Within 3, the widest skill span measured on him, 21.7** (novice
  35.8%, expert 57.5%): the further the Empowered unit can be, the more
  it pays to plan its hit.
- Unfinished fights at most 0.5%.

**Built (owner, 2026-10-31): the overdose to 6 on one unit within 3**
(`overdose` 6, `range` 3), in runs and on the test stage, at 44.5% as
measured above, with the widest skill span of any hero.

### The overdose with a Sedative beside it (2026-10-31)

Asked for (the owner): whether the Alchemist keeps his balance and skill
span with a second option, a heal of his power that Weakens the unit to
nothing. `ABILITY.sedative` (in no kit as built): a unit within 3, the
Alchemist too, ally or enemy, no line of fire, healed his power and
Weakened by all its hits deal (its power, Empower and passives' Empower)
for 8 slots. Measured with his kit the overdose, Sedative and Hold, both
sides' Alchemists. `experiments/elixir-sedative.mjs`, the seats and
fights of "The Elixir as an overdose", on `b24c536` (the as-built row
reproducing its 44.5% exactly). Unfinished fights at most 0.5%.

| Alchemist | Steppe | Persia | Byzantium | Kept in its own | Score | Novice | Expert | Span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| The overdose (as built) | 43.3% | 35.8% | 55.6% | 44.2% | 44.5% | 35.8% | 57.5% | 21.7 |
| **With Sedative** | 46.5% | 40.1% | 55.8% | 47.4% | **47.4%** | 38.4% | 58.6% | **20.2** |

- **Both kept, a little better**: 3 points up (each seat 0–5 points,
  each row about ±2.5, so the score's gain is about two standard errors),
  still 5–6 under the Elixir before the overdose (53%); the skill span
  about the same (20.2 from 21.7), still the widest of any hero.
- **He uses both about evenly**: the overdose on 34–45% of his turns
  (44–56% alone), Sedative on 32–38%, and walks much less (21–33% from
  37–52%): the Sedative gives him something to do on the turns the
  overdose had no hit to set up. He lives about as often (42–86%).

**Built (owner, 2026-10-31): Sedative the Alchemist's second ability**,
in runs and on the test stage, at 47.4% as measured.

### The Barbarian and the Cataphract swapped (2026-10-31)

Asked for (the owner): Byzantium's tank and damage hero swapped, as the
test stage now has them (test-stage.md, `"heroes"` and `"leap"`): the
**Barbarian a tank**, speed 1, defence 3 (health 8), power 2, the AI's
tank caution (0); Leap as before, its axe on the **four spaces in front**
of the landing (`ABILITY.leap.shape` `forward`), every unit there for his
power, and **Shield 1 for each enemy hit, for 8 slots**
(`ABILITY.leap.perHit`). The **Cataphract the damage hero**, speed 2,
defence 2 (health 6), power 2, caution 1, **without Armoured**, Charge as
built. `experiments/byzantium-swap.mjs` (a `patch`, both sides), on
`ad9353d`'s rules: every row of `roles-twelve.mjs`, Byzantium's party
ordered tank, damage, support, as built and swapped on the same seeds;
400 fights a row (about ±2.5 points), seeds from 1000, production AI.
Unfinished fights at most 7.3%. *Others'*: the hero in its role's seat of
the other three regions' mirrors (Steppe / China / Persia, or with
Byzantium in place of its own); *kept*: 100 − the other regions' heroes
in its seat of its own; the score their mean.

| Hero (role) | Built: others' | kept | **score** | Swapped: others' | kept | **score** |
|---|---:|---:|---:|---:|---:|---:|
| Grappler (tank) | 51.2 | 44.5 | 47.8 | 58.9 | 49.8 | 54.4 |
| Vanguard (tank) | 51.7 | 50.1 | 50.9 | 54.3 | 56.0 | 55.1 |
| Juggernaut (tank) | 55.8 | 50.0 | 52.9 | 56.3 | 55.7 | 56.0 |
| Cataphract (tank, built) | 51.4 | 45.3 | 48.4 | | | |
| **Barbarian (tank, swapped)** | | | | **34.5** (35.5 / 31.8 / 36.1) | **34.5** | **34.5** |
| Outrider (damage) | 51.2 | 55.0 | 53.1 | 49.9 | 53.3 | 51.6 |
| Duelist (damage) | 51.8 | 58.4 | 55.1 | 49.6 | 50.2 | 49.9 |
| Ranger (damage) | 51.8 | 60.9 | 56.3 | 50.7 | 52.8 | 51.8 |
| Barbarian (damage, built) | **25.8** (32 / 20.5 / 24.9) | 45.1 | **35.4** | | | |
| **Cataphract (damage, swapped)** | | | | 43.8 (37.3 / 45 / 49) | 49.6 | **46.7** |
| Storm Caller | 49.4 | 50.2 | 49.8 | 50.7 | 50.2 | 50.5 |
| Alchemist | 50.2 | 55.8 | 53.0 | 47.5 | 55.8 | 51.6 |
| Magus | 48.4 | 52.2 | 50.3 | 47.7 | 52.2 | 49.9 |
| Priest | 47.3 | 46.5 | 46.9 | 47.3 | 48.6 | 48.0 |

How the two play (production AI, their own role seats):

| Row | Wins | Leap or Charge, share of his turns | His turns a fight | Lives through | Axe damage to enemies a fight (hits) |
|---|---:|---:|---:|---:|---:|
| Barbarian as damage (built) | 20.5–32% | Leap 10–16% | 3.6–4.7 | 42–57% | 3–4.2 (0.9–1.4) |
| Barbarian as tank (swapped) | 31.8–36.1% | Leap 19–25% | 3.0–4.0 | 31–45% | 2.4–4.2 (1.2–2.1) |
| Cataphract as tank (built) | 49.5–53.2% | Charge 92–96% | 3.7–4.3 | 49–59% | |
| Cataphract as damage (swapped) | 37.3–49% | Charge 83–91% | 2.3–4.3 | 21–54% | |

- **The Cataphract makes a damage hero**: 46.7%, 3–5 points under the
  other three (49.9–51.8%), and Byzantium's damage seat is no longer a
  free win: the other damage heroes kept 62.7–79.5% of fights in it as
  built (the Barbarian's), 51–55% swapped. Weakest in the Steppe's seat
  (37.3%; he lives through 21% of those fights, 2.3 turns a fight): the
  Outrider and the Storm Caller shoot a 6-health rider down before it
  reaches them.
- **The Barbarian as a tank is as weak as he was as damage**: 34.5%
  against 35.4%, about 20 points under every other tank (54.4–56.0%), the
  same in every seat (32–36%). The other tanks rise 3–7 points only
  because they beat him in Byzantium's seat (60–75%).
- **Health didn't keep him up**: with 8 health he lives through fewer
  fights than with 6 (31–45% against 42–57%), since a tank's caution
  walks him into reach, and speed 1 gives him 3–4 turns a fight. He leaps
  on a fifth of his turns, catches 1.2–2.1 enemies a fight for 2.4–4.2
  damage, so the Shield comes about once a fight, 1–2 of it. The fault
  measured on 2026-10-30 is unchanged: a leap seldom reaches anyone, and
  four spaces in place of two didn't change that (as `forward` didn't
  then).

**Skill.** As `skill-fights.mjs`: the hero played by a novice (depth 1)
or an expert (depth 4, 4× the work) in its role's seat of a Steppe
mirror, against the same hero at production's search; and Byzantium's
whole party in a mirror. 400 fights a row (about ±3.5 a span). Unfinished
0% but the party's (2.8–7.8%).

| Row | Novice | Expert | Span |
|---|---:|---:|---:|
| Barbarian as tank (swapped) | 45.5% | 54.5% | **9.0** |
| Barbarian as damage (built) | 49.8% | 52% | 2.2 |
| Cataphract as damage (swapped) | 40% | 50.8% | **10.8** |
| Cataphract as tank (built) | 44.8% | 58.5% | 13.7 |
| Outrider (damage) | 45.5% | 49.3% | 3.8 |
| Duelist (damage) | 40.8% | 57.5% | 16.7 |
| Ranger (damage) | 52.3% | 53.9% | 1.6 |
| Byzantium's party, swapped | 50.1% | 48.3% | −1.8 |
| Byzantium's party, built | 50.4% | 52% | 1.6 |

- **Both have a healthy skill gap in their new roles**: the Barbarian's
  span 9.0 against 2.2 as damage, within the tanks' 5.3–12.7 (the
  Vanguard 7.2, Grappler 5.3, Juggernaut 12.7, 2026-10-31); the Cataphract
  10.8, second of the damage heroes after the Duelist (16.7), the Outrider
  and the Ranger 1.6–3.8. Choosing where to leap matters to a tank who
  must be where the enemy is; little did to a damage hero who rarely
  reached anyone.
- Byzantium's party shows no span either way (−1.8 and 1.6, within
  noise): its two weak heroes' search carries little, and the Priest's
  span was 1.1 (2026-10-29).
- **Not changed in runs**: the swap is the test stage's. The Cataphract's
  half is close to even; the Barbarian's needs his reach first (a landing
  next to an enemy, a longer leap, or more speed), untried.

### The swap with Hew, and the Cataphract with Armoured (later 2026-10-31)

Asked for (the owner), after "The Barbarian and the Cataphract swapped":
the Barbarian's Leap taken off for **Hew** (`ABILITY.hew`): a funnel, the
two spaces next to him either side of one way and the space past them
touching both, every unit there hit for his power, allies too, and he is
**Empowered 1 for each enemy hit, for 10 slots** (his turn's at speed 1:
the usual 8 would end before his next turn). And whether **Armoured**
(Armour 1) would let the Cataphract hold out in melee after a charge.
`experiments/byzantium-hew.mjs`: the rows of `roles-twelve.mjs` with
Byzantium in them, the rest from `byzantium-swap.mjs`'s `swap-` rows (the
same seeds; both on the Elixir before the overdose, `83f760a`); `hew` the
Cataphract as there, `hewArmoured` with Armoured back. 400 fights a row,
production AI. Unfinished fights at most 0.8%.

| Hero (role) | Swapped, Leap | Hew | Hew, Cataphract Armoured |
|---|---:|---:|---:|
| Grappler / Vanguard / Juggernaut (tanks) | 54.4 / 55.1 / 56.0 | 52.4 / 53.6 / 55.5 | 50.4 / 53.4 / 54.6 |
| **Barbarian (tank)** | 34.5 | **38.5** | 41.6 |
| Outrider / Duelist / Ranger (damage) | 51.6 / 49.9 / 51.8 | 51.5 / 50.8 / 51.9 | 47.9 / 47.0 / 50.0 |
| **Cataphract (damage)** | 46.7 | 45.8 | **55.2** |
| Priest | 48.0 | 47.0 | 47.0 |

| Row (his own role seats) | Wins | Hew or Charge, share of turns | Turns a fight | Lives through | Axe damage to enemies a fight |
|---|---:|---:|---:|---:|---:|
| Barbarian, Leap | 31.8–36.1% | 19–25% | 3.0–4.0 | 31–45% | 2.4–4.2 |
| Barbarian, Hew | 38.3–42% | 27–37% | 2.8–3.0 | **24–25%** | 3.6–5.1 |
| Cataphract, no Armoured | 37.3–49% | 83–91% | 2.3–4.3 | 21–53.5% | |
| Cataphract, Armoured | 54.8–63.8% | 88–95.5% | 3.2–5.0 | **55–68.5%** | |

- **Armoured does what it was asked to and more**: the Cataphract lives
  through 55–68.5% of fights in the damage seats (21–53.5% without),
  through 55% in the Steppe's (21%), and scores 55.2%, 3–8 points over
  the other damage heroes (47–50% beside him), who lose 2–4 points to
  him. About 9 points for Armour 1: a defence 2 rider that takes 1 less
  from every hit is a tank's worth of armour on a damage hero. Something
  between none and always, untried: Armour only for a while after a
  charge (8 slots), or Armour 1 against melee alone.
- **Hew is better than Leap, not enough**: 38.5% against 34.5%, still
  14–17 points under the tanks. He uses it a third of his turns and deals
  3.6–5.1 a fight (2.4–4.2 with Leap), but lives through only a quarter
  of fights (31–45% with Leap): reaching 1–2 spaces with no leap in, at
  speed 1, he stands in the enemy's reach for 3 turns a fight and goes
  down. The AI doesn't count the Empower it gives him when it chooses.
- **Skill** (as `skill-fights.mjs`, the Steppe mirror's seat, ±3.5): the
  Barbarian with Hew 47.3% to 54.5%, **span 7.2** (9.0 with Leap); the
  Cataphract with Armoured 46.9% to 52.5%, **span 5.6** (10.8 without):
  Armour forgives where he ends a charge.
- **Not changed in runs**; the test stage has Hew, and the Cataphract
  without Armoured.

### The Cataphract braced after a charge, and Hew's Shield (later 2026-10-31)

Asked for (the owner), after "The swap with Hew": the Cataphract without
Armoured but with **Armour 1 for 8 slots after each charge**
(`ABILITY.charge.armour`, the test stage's `"charge"`), and Hew's Empower
replaced by **Shield 1 for each enemy hit**, added to any he has, for 10
slots (`ABILITY.hew.shieldPerHit`). `experiments/byzantium-brace.mjs`: all
36 rows of `roles-twelve.mjs` (today's Elixir, the overdose, in runs since
`83f760a`, so China's rows differ from the sections before), Byzantium's
party tank, damage, support; 400 fights a row (about ±2.5), production AI.
Unfinished fights at most 6.5%.

| Hero (role) | Others' seats | Kept in its own | **Score** | Before (Hew's Empower; Armoured or not) |
|---|---:|---:|---:|---|
| Grappler (tank) | 55.2 | 45.3 | 50.3 | 52.4 / 50.4 |
| Vanguard (tank) | 53.0 | 53.1 | 53.0 | 53.6 / 53.4 |
| Juggernaut (tank) | 58.2 | 53.7 | 56.0 | 55.5 / 54.6 |
| **Barbarian (tank)** | 43.8 (49 / 40.5 / 42) | 37.6 | **40.7** | 38.5 / 41.6 |
| Outrider (damage) | 47.9 | 51.1 | 49.5 | 51.5 / 47.9 |
| Duelist (damage) | 50.9 | 51.4 | 51.1 | 50.8 / 47.0 |
| Ranger (damage) | 50.0 | 50.2 | 50.1 | 51.9 / 50.0 |
| **Cataphract (damage)** | 50.2 (43.8 / 50 / 56.8) | 48.2 | **49.2** | 45.8 none / 55.2 Armoured |
| Storm Caller | 53.3 | 52.7 | 53.0 | |
| Alchemist | 48.1 | 47.4 | 47.8 | |
| Magus | 52.3 | 55.0 | 53.7 | |
| Priest | 47.7 | 43.5 | 45.6 | |

| Row (his own role seats) | Wins | Hew or Charge, share of turns | Turns a fight | Lives through | Axe damage to enemies a fight |
|---|---:|---:|---:|---:|---:|
| Barbarian, Hew's Shield | 40.5–49% | 31–37% | 3.0–3.4 | 33–36% (24–25% with its Empower) | 4–5.5 |
| Cataphract, braced | 43.8–56.8% | 91.5–95% | 2.6–4.0 | 27–60.5% (21–53.5% without, 55–68.5% Armoured) | |

- **The brace evens the Cataphract**: 49.2%, within 2 points of the
  other damage heroes (49.5–51.1%), between none (45.8%) and Armoured
  always (55.2%). Still weakest in the Steppe's seat (43.8%, living
  through 27% of fights): the Outrider and the Storm Caller hit him on
  the way in, before a charge braces him.
- **Hew's Shield is a little better than its Empower** (40.7% against
  38.5%, at the edge of noise), and keeps him up a little longer (33–36%
  of fights against 24–25%); still 10–15 points under the other tanks.
  Even with the Steppe (49% in its tank seat), 40.5–42% in China's and
  Persia's.
- **Skill** (as `skill-fights.mjs`, ±3.5): the Cataphract braced 44% to
  54.5%, **span 10.5** (10.8 with no Armour, 5.6 Armoured: the brace,
  earned by charging, keeps where he charges mattering); the Barbarian
  with Hew's Shield 48% to 52.8%, **span 4.8** (7.2 with its Empower),
  as low as the Grappler (5.3).
- **Not changed in runs**; the test stage has both.

### Walks priced by the hit they set up (2026-10-31)

Asked for: item 1 of what Wait needs from the AI, a walk priced by what
it sets up. Built as `AI.reachShare`, **off** (0): the search's leaf
counts each unit's best hit from where it stands (`threatsTo`'s map of
what it reaches, turned round: no more than the target's health, a hit
on Temee at `camelHealthWeight`), its side's for it and the other's
against, × the share; screening counts the acting unit's own. So a walk
into reach is worth about the hit it sets up, and standing in an
enemy's reach costs what it could take. `experiments/reach.mjs`, 800
fights a row, production search for both sides. The first rows ran on
`02da6ee`'s kits, the confirming ones on `740494a`'s (the Duelist's
dash, the Overdose, Invocation, landed meanwhile); the Steppe's and
Persia's rows came out the same on both.

**Is the AI better for it?** One side's AI with it, `modWinPct` in each
region's mirror:

| Mirror | 0.25 | 0.5 | 1 | 0.25 on `740494a` |
|---|---:|---:|---:|---:|
| Steppe | 51.5% | 54.3% | 53.1% | 51.5% |
| China | 61.6% | 61% | 52.6% | 52.9% |
| Persia | 60.7% | 57.9% | 50.7% | 60.7% |
| Byzantium | 55.2% | 54.6% | 51.6% | **61.3%** |

Yes, at 0.25 or 0.5: 51.5–61.3%, the most anything has added to the AI
since the search widths; heavier, it gives it back (a hit set up is
worth less than a hit made, the target being free to step away first).
No more unfinished fights (0–2%, Byzantium 4.5% → 0% on `740494a`), and
fights a little shorter (Steppe 52 → 47 actions). It costs time: about
a third more a decision (200 Steppe mirror fights 17s → 21s), which the
fixed work cap measured here doesn't feel but the browser's clock
(`AI.browser`, 400 ms) would, as depth.

**Wait with it.** Both AIs with reach, one side with Wait at 2/3 (Patient
3), `modWinPct`; the track in the leaf (`AI.leafTrack`) at 1 as before,
then at the same weight as reach, so a third of a turn saved and a hit
set up are priced alike:

| Mirror | No reach, track 1 | Reach 0.25, track 1 | Reach and track 0.25 | Reach and track 0.5 |
|---|---:|---:|---:|---:|
| Steppe | 34.1% | 44% | 49.4% | 47.3% |
| China | 37.8% | 51% | 45.8% | 49.1% |
| Persia | 34.6% | 42.5% | 48.2% | 46.6% |
| Byzantium | 44.1% | 49% | 50.8% | 52.8% |

With the two priced alike the AI no longer Waits in place of walking:
the Horse Archer Holds 14% of its turns and walks 42% (40% and 27% with
the track alone; 14% and 43% with reach alone). But Wait is still worth
nothing to it, 46–53%. What it doesn't yet see is the timing a Wait
buys: its search runs three decisions, not a stretch of the track, so
a line that Waits sees fewer enemy turns than one that acts (item 2),
and a Hold seldom survives screening to be searched where timing pays
(item 4). Both switches stay off; switching reach on is the owner's
call (the AI would get stronger, so every measurement here would move).

## Alignment in place of Omen (2026-10-31; named Syzygy at first)

Asked for (owner): the Magus's Omen replaced on the test stage by
**Alignment**: one of his six lines, any distance, through anything, and the
cards of every unit on it, of either side, rearranged on the track, each on
any blank card or swapped among themselves (`ABILITY.alignment`, `"heroes":
{"magus": {"abilities": ["alignment"]}}` on the test stage). Then role
balance and skill measured. The deck it places on runs from the slot after
his turn to 12 slots on, or the furthest card if further (the track as
drawn). The AI tries three arrangements a line (its allies' cards on the
earliest open slots, its enemies' on the latest, or both, each side in its
order) and weighs each card's move as the share of a turn gained or lost,
as Omen's; a player may make any.

`experiments/alignment.mjs`, 400 fights a row, Alignment a `patch` on both
sides, beside Omen as built. **Roles**, as `roles-twelve.mjs`: the Magus
in the support seat of the three other regions' mirrors (his side's wins),
and each other support in his seat of Persia's (shown as the Magus's side,
100 less the other's):

| Seat | Omen | Alignment | Change |
|---|---:|---:|---:|
| For the Storm Caller (Steppe) | 50.3% | 48.5% | −1.8 |
| For the Alchemist (China) | 60% | 68.3% | +8.3 |
| For the Priest (Byzantium) | 50.6% | 55.6% | +5.0 |
| Against the Storm Caller in Persia's | 57.7% | 62.3% | +4.6 |
| Against the Alchemist in Persia's | 59.9% | 64.2% | +4.3 |
| Against the Priest in Persia's | 66.7% | 73.4% | +6.7 |
| **Mean** | **57.5%** | **62.1%** | **+4.6** |

**Skill**, as `skill-fights.mjs`: the Magus played by a novice (depth 1)
or an expert (depth 4, 4× the work) in the support seat of a Steppe mirror,
against the same Magus at production's search:

| Played by | Omen | Alignment |
|---|---:|---:|
| Novice | 40.3% | 45.3% |
| Expert | 57% | 56.5% |
| Span | **16.7** | **11.2** |

Unfinished fights: 0–1.5% in the seats (Omen 0–2%), but 6.3–6.8% with a
Magus on each side (Omen 1.3–1.8%), over principle 12's 3%. Alignment is
69–79% of his turns (Omen 64–74%). Measured on main as of 30d7cd8 (the
Priest with Invocation, the Alchemist with Sedative); a first run on
a754068 (Blessing, no Sedative) gave the same picture, 61.6% against
55.0%.

- **Alignment is stronger than Omen by about 5 points**, 62.1% as a score
  against 57.5%: even in the Steppe's seat, 5–8 points over in China's
  and Byzantium's, and 4–7 over in Persia's own party. Omen, at 57.5% on
  today's rules, is itself over even here.
- **It rewards play less than Omen but still well**: a span of 11.2
  against 16.7, the novice much stronger with it (45.3% against 40.3%)
  since the AI's arrangements are already near the best (allies to the
  front, enemies to the back), so a shallow search loses little. A player
  arranging by hand has more to choose from than the AI tries.
- **Stalls**: an infinite line that can send Humphrey's card to the back of
  the deck each turn, from both sides, is the likely cause of the
  unfinished fights with two Magi (a mirror; in the seats, with one, they
  stay under 2%); untried, a cap on how far back a card
  may go (`ABILITY.alignment.deck`, 12 now) or leaving Humphrey out.
- **Not changed in runs**: Alignment is the test stage's, for play-testing.
  Untried tunings if it is to replace Omen: a shorter deck (as far back as
  his own next turn, Omen's reach), allies only forward and enemies only
  back, or a line of limited length.

### The Priest's Invocation (2026-10-31)

Built (the owner) in place of Blessing: the Priest **speed 1, defence 2
(health 6), power 3**, with **Invocation** (`ABILITY.invocation`): a space
within 3, no line of fire, and the spaces next to it. Charged: nothing
happens as he casts it, his card going a Hold's cost on (10 slots at
speed 1, his whole turn while Wait is off); when it comes back every enemy
in the area then takes his power and every ally there, himself and
Humphrey too, heals his power (an Empower he cast it with adding to
both), and his card goes a full turn on. `experiments/priest-invocation.mjs`
on `30d7cd8`'s rules, on the same seeds: Invocation as built
(`invocation-`); the Priest as he was, speed 2, defence 1, Blessing in a
line (`blessing-`); and Invocation with Wait at 2/3 on both sides, as the
test stage plays it (`wait-`). 400 fights a row (about ±2.5 points),
seeds from 1000, production AI. Unfinished fights 0–0.5% with Invocation,
up to 4.5% with Blessing (7.8% in its party's skill rows). *Others'*: the
Priest in the support seat of the Steppe's, China's and Persia's mirrors;
*kept*: 100 − each of their supports in his seat of Byzantium's; the score
their mean.

| Variant | Steppe | China | Persia | others' | Storm C. in his | Alchemist in his | Magus in his | kept | **score** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Invocation (built) | 30.8 | 24.0 | 33.3 | 29.4 | 68.5 | 69.8 | 50.6 | 37.0 | **33.2** |
| Blessing (before) | 45.2 | 45.5 | 52.5 | 47.7 | 63.9 | 55.8 | 48.6 | 43.9 | **45.8** |
| Invocation, Wait 2/3 | 43.3 | 38.3 | 48.0 | 43.2 | 62.3 | 58.0 | 46.9 | 44.3 | **43.7** |

How he plays (his turns a fight, the share of them casting, Holding, and
lives through, in the others' seats; Invocation's hits, damage, heals and
kills a fight, from `ablate.ts`'s `invocation` source and
`invocationHealPerFight`):

| Variant | His turns | Casting | Hold | Lives through | Enemies hit | Damage | Healed | Kills |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Invocation (built) | 2.7–3.1 | 22–40% | 13–16% | 29–41% | 0.36–0.78 | 1.1–2.3 | 2.5–5.2 | 0.07–0.27 |
| Blessing (before) | 5.2–7.2 | 76–84% | 0% | 57–75% | | | | |
| Invocation, Wait 2/3 | 2.7–3.0 | 39–57% | 6–10% | 32–48% | 0.94–1.7 | 2.8–5.1 | 3.9–7.2 | 0.24–0.57 |

- **Invocation as built is far too weak**: a score of 33.2% against
  Blessing's 45.8% on the same seeds, 12–21 points under in every
  others' seat (weakest in China's, 24%), and Byzantium wins 31–49% with
  him against the other supports.
- **Time is most of it.** Speed 1 and a charge of a whole turn give him
  2.7–3.1 turns a fight against 5.2–7.2, and a cast lands at most once
  every two of his action costs (20 slots). He casts on only a fifth to
  two fifths of his turns, walks on half and Holds on 13–16%: with the
  area to aim within 4 of him, the AI often finds no cast worth its charge.
- **What lands is small**: under one enemy a fight hit (1.1–2.3 damage) and
  2.5–5.2 health healed, against Blessing's heal and lasting Shield on
  every unit in its line almost every turn. Enemies acting before it lands
  walk out (the AI prices that at `AI.dodgeShare`), and the AI's own allies
  don't wait in it.
- **Defence 2 didn't keep him up**: he lives through 29–41% of fights
  against 57–75% with Blessing at defence 1, since Blessing kept him
  Shielded and healed every turn, and he must stand within 4 of the fight.
- **Wait at 2/3 recovers most of the gap**: 43.7%, 2 points under
  Blessing; his charge falls to 7 slots, he casts more (39–57% of his turns),
  hits 0.94–1.7 enemies a fight and heals 3.9–7.2. Even across the
  others' seats (38–48%), so on the test stage he is close to even.

**Skill.** As `skill-fights.mjs`: the Priest played by a novice (depth 1)
or an expert (depth 4, 4× the work) in the Steppe's support seat, and
Byzantium's party in a mirror, against production's search. Unfinished
0–0.3% but Blessing's party (5.3–7.8%).

| Row | Novice | Expert | Span |
|---|---:|---:|---:|
| Priest, Invocation | 47.5% | 50.8% | **3.3** |
| Priest, Blessing | 48.2% | 49% | 0.8 |
| Priest, Invocation, Wait 2/3 | 47% | 52% | **5.0** |
| Byzantium's party, Invocation | 40.9% | 50.6% | **9.7** |
| Byzantium's party, Blessing | 50.4% | 52% | 1.6 |
| Byzantium's party, Invocation, Wait 2/3 | 43.3% | 55.8% | **12.5** |

- **Invocation rewards play more than Blessing did**: his own span 3.3
  (5.0 with Wait) against 0.8, still low beside the damage heroes'
  1.6–16.7 and the tanks' 5.3–13.7, within noise (±3.5) on its own; his
  party's 9.7 (12.5) against 1.6, clearly above noise, since where to put
  the area, and whether allies stand in it and enemies stay, ties his
  turn to everyone else's. Blessing, aimed along a line that reaches
  everyone, left nothing to choose.
- **Untried**: a shorter charge in runs (Wait at 2/3 is close to it, and
  near even), speed 2, a radius of 2, or the heal or damage raised. The
  AI's allies not stepping into his area (nor its enemies being herded
  into it) is likely some of his loss in the AI's hands and less in a
  player's.

### Hew as a line, with Fury (later 2026-10-31)

Asked for (the owner): Hew's Shield taken off, and its funnel for a
**line**: the first unit up to 2 away along one of his six lines, ally or
enemy, struck for his power, the Barbarian **stepping in next to it
first** when it is 2 away (`ABILITY.hew.shape` `line`, `.reach` 2); and
**Fury**, a passive, his card **Hastened 3 whenever he is hit** (`FURY`).
`experiments/byzantium-fury.mjs`: every row of `roles-twelve.mjs` with
Fury (`fury`), and the rows with Byzantium in them without it (`line`),
the Cataphract braced as before; 400 fights a row (about ±2.5),
production AI, on `e41168a`. Unfinished fights at most 2.5%. **On the
Priest's Invocation** (speed 1, defence 2; in runs since `81e3d7c`'s
day), so not beside the sections before: the Priest wins 24–33% in the
other regions' support seats (45–52% as he was), and Byzantium's party is
weak whoever stands in it, the other tanks winning 77.5–92.3% in its tank
seat. So *kept* is the Priest's as much as each hero's; *others'* (each
hero in the other regions' mirrors, no Priest in them) is the fair read.

| Hero (role) | Others' seats, Fury | kept | score | Others' seats, no Fury | score |
|---|---:|---:|---:|---:|---:|
| Grappler / Vanguard / Juggernaut (tanks) | 61.9 / 59.7 / 58.1 | 47.3 / 50.0 / 51.6 | 54.6 / 54.8 / 54.8 | 62.5 / 59.8 / 58.1 | 55.0 / 56.1 / 55.3 |
| **Barbarian (tank)** | **47.1** (43 / 49.8 / 48.5) | 24.4 | 35.8 | 43.7 (42.5 / 42.5 / 46.1) | 33.7 |
| Outrider / Duelist / Ranger (damage) | 42.8 / 45.8 / 44.0 | 51.1 / 51.4 / 50.2 | 47.0 / 48.6 / 47.1 | | |
| **Cataphract (damage)** | **50.2** (43.8 / 50 / 56.8) | 64.5 | 57.3 | 50.2 | 56.9 |
| Priest (support) | 29.4 | 24.9 | 27.1 | | 28.3 |

| Barbarian (his tank seats) | Wins | Lives through | Turns a fight | Axe damage to enemies a fight |
|---|---:|---:|---:|---:|
| Funnel, Shield (before, the old Priest) | 40.5–49% | 33–36% | 3.0–3.4 | 4–5.5 |
| Line, no Fury | 42.5–46.1% | 24–34% | 2.9–3.0 | 3.9–5.1 |
| **Line, Fury** | **43–49.8%** | **30–42%** | 3.2–3.3 | 4.3–6.6 |

- **Line Hew with Fury is the Barbarian's best yet** in the other
  regions' seats: 47.1%, within about 3 of even (the funnel's 43.8%, on
  the old Priest). Fury is worth 3.4 points there (43.7% without), 2–7 a
  seat, and 6–9 points of his survival: Hastened when hit, he gets about
  a third of a turn more a fight and hits back sooner.
- His score (35.8%) and the other tanks' (54.6–54.8%) are bent by
  Byzantium's party: the Grappler wins 90.5% in its tank seat.
- **The Cataphract is even in others' seats** (50.2%, the same as on the
  old Priest); his 64.5% *kept* is the other damage heroes doing worse in
  a weak Byzantine party, not his own strength.
- **Skill** (as `skill-fights.mjs`, the Steppe mirror's tank seat, no
  Priest in it; ±3.5): line Hew with Fury 47.3% to 53%, **span 5.7**;
  without Fury 45.5% to 55.3%, **span 9.8**. Fury fires on being hit,
  not on a choice, so it lifts a novice as much as an expert (as
  Spearhead added no skill to the Vanguard); the choosing is the line
  Hew's.
- **Not changed in runs**; the test stage has the line Hew and Fury.
  Byzantium's numbers want measuring again once the Priest is settled.

**Fury's Haste 5 (later 2026-10-31).** Asked for (the owner): Fury
Hastening him 5 for each hit in place of 3 (`FURY.haste`).
`byzantium-fury.mjs`'s `fury5`: its 18 rows with Byzantium in them (the
rest as `fury`'s; the commits between change no fight, their switches off)
and its skill. Unfinished fights at most 2.3%.

| Barbarian (tank) | Steppe | China | Persia | **Others' seats** | Kept | Lives through | Turns a fight | Axe damage a fight | Skill: novice → expert, span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Fury, Haste 3 | 43% | 49.8% | 48.5% | 47.1% | 24.4% | 30–42% | 3.2–3.3 | 4.3–6.6 | 47.3% → 53%, 5.7 |
| Fury, Haste 5 | 43.8% | **58.8%** | 47.8% | **50.1%** | 26.0% | 29–46% | 3.3–3.5 | 4.3–8.9 | 48% → 53.8%, 5.8 |

- **Haste 5 puts him even in the other regions' seats** (50.1%), but all
  of it in China's (58.8% against 49.8%; he lives through 46% of fights
  there, 40% with Haste 3, and deals 8.9 a fight, 6.6 at 3); the Steppe's
  and Persia's are within noise of Haste 3. China's Duelist and Vanguard
  hit him often in melee, so the Haste comes often; the Outrider and the
  Storm Caller hit him less, and from where Hew can't answer.
- **No skill from it** (span 5.8 against 5.7): it fires on being hit.
- Byzantium's own seats as before, bent by the Priest's Invocation.
- **Built (owner, 2026-10-31)**, in runs: the Barbarian Byzantium's tank
  with Lunge (Hew renamed) and Fury at Haste 5; the Cataphract its
  damage hero, braced after each charge (roster.md).

### Alignment before his next turn (later 2026-10-31)

Asked for (owner): **no card Alignment moves may land after the Magus's
next turn** (`ABILITY.alignment.beforeNext`, on), so he can't stun-lock an
enemy by sending it back every turn; and the ability renamed Alignment
(Syzygy before). Its deck now runs from the slot after his turn to the
slot before his next (his action cost on, 9 at speed 2); a card already
past it may still be brought in. The AI's enemies go to the latest slots
before his next turn; enemies already past it stay. Same rows as above
(`experiments/alignment.mjs`, 400 fights, on main as of the change):

| Seat | Omen | Alignment, before his next turn |
|---|---:|---:|
| For the Storm Caller (Steppe) | 50.3% | 26% |
| For the Alchemist (China) | 60% | 33% |
| For the Priest (Byzantium) | 50.6% | 45.7% |
| Against the Storm Caller in Persia's | 57.7% | 32.4% |
| Against the Alchemist in Persia's | 59.9% | 33.2% |
| Against the Priest in Persia's | 66.7% | 44.5% |
| **Mean** | **57.5%** | **35.8%** |

| Played by | Omen | Alignment, before his next turn |
|---|---:|---:|
| Novice | 40.3% | 45.9% |
| Expert | 57% | 51% |
| Span | 16.7 | 5.1 |

- **Much too weak**: 35.8% as a score, 22 points under Omen and 26 under
  Alignment as first built (62.1%). Its use fell from 69–79% of his turns
  to 37–52%, the Magus walking more to find a line worth it.
- **Why**: Omen sends an enemy to just *after* his next turn; this rule
  stops every card *before* it, and the enemies in reach mostly act before
  then already, so there is little delay left to give. The track's worth
  of an enemy's turn is in making it wait past someone's turn; past his own
  is what is now ruled out.
- **The stun-lock is gone**: unfinished fights 0–0.5% (6.3–6.8% with a
  Magus on each side as first built), and skill matters less (span 5.1).
- **Untried, to keep the lock out without the loss**: Omen's reach (to just
  after his next turn) with a guard (a card he has sent past his next turn
  can't be again until it has acted, Omen's `once`); or the deck as first
  built with that guard.

### Invocation's charge (2026-10-31)

Asked for (the owner), after "The Priest's Invocation": would a shorter
charge help, and what does it do to skill? `ABILITY.invocation.charge`
(a switch, off: null is a Hold's cost) sets the charge as a share of his
action cost; `experiments/invocation-charge.mjs` on `9b525aa`'s rules,
Wait off, the rows of `priest-invocation.mjs` at charges of **10 slots**
(built, his whole turn at speed 1), **7, 5, 3 and 1**, on the same seeds.
400 fights a row (about ±2.5 points; a span about ±3.5), seeds from 1000,
production AI; unfinished fights at most 1%. The 10-slot rows reproduce
"The Priest's Invocation" exactly.

| Charge | Steppe | China | Persia | others' | Storm C. in his | Alchemist in his | Magus in his | kept | **score** |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 (built) | 30.8 | 24.0 | 33.3 | 29.4 | 68.5 | 69.8 | 50.6 | 37.0 | **33.2** |
| 7 | 41.8 | 36.3 | 49.2 | 42.4 | 56.0 | 61.3 | 44.8 | 46.0 | **44.2** |
| 5 | 55.8 | 49.8 | 62.2 | 55.9 | 35.5 | 57.0 | 35.0 | 57.5 | **56.7** |
| 3 | 70.2 | 71.8 | 70.5 | 70.8 | 22.1 | 42.5 | 20.3 | 71.7 | **71.3** |
| 1 | 85.0 | 88.8 | 78.8 | 84.2 | 9.3 | 29.8 | 8.0 | 84.3 | **84.2** |

How he plays in the others' seats (as before; hits, damage and heals a
fight are Invocation's):

| Charge | His turns | Casting | Hold | Lives through | Enemies hit | Damage | Healed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 2.7–3.1 | 22–40% | 13–16% | 29–41% | 0.36–0.78 | 1.1–2.3 | 2.5–5.2 |
| 7 | 2.6–2.9 | 41–58% | 5–8% | 34–46% | 1.0–1.8 | 3.1–5.3 | 4.2–7.3 |
| 5 | 2.6–3.0 | 52–71% | 2–5% | 43–53% | 2.0–2.9 | 5.9–8.6 | 4.6–8.5 |
| 3 | 2.8–3.2 | 67–76% | 1–3% | 61–62% | 2.9–4.1 | 8.8–12.3 | 4.8–8.5 |
| 1 | 3.1–3.5 | 74–79% | 0–2% | 67–84% | 3.7–4.9 | 11–14.8 | 5.3–8.6 |

**Skill**, as before (the Priest in the Steppe's support seat, and
Byzantium's party, by a novice and an expert):

| Charge | Priest novice | expert | **span** | Party novice | expert | **span** |
|---:|---:|---:|---:|---:|---:|---:|
| 10 (built) | 47.5% | 50.8% | 3.3 | 40.9% | 50.6% | 9.7 |
| 7 | 44.8% | 49.8% | 5.0 | 46% | 53.3% | 7.3 |
| 5 | 43.8% | 50.8% | 7.0 | 37.6% | 54.8% | **17.2** |
| 3 | 45.3% | 51.8% | 6.5 | 37.5% | 56.9% | **19.4** |
| 1 | 46.5% | 54.3% | 7.8 | 35.2% | 54.1% | **18.9** |

- **The charge is the whole balance of Invocation**: each slot taken off
  is worth about 6 points, from 33.2% at 10 to 84.2% at 1, evenly in
  every seat. **Even lies at about 6 slots** (44.2% at 7, 56.7% at 5;
  6 untried), 3/5 of his turn; the test stage's Wait (7 slots) measured
  43.7%, as 7 here.
- **What it buys is landing before the enemy moves**, not more turns: his
  turns a fight barely change (2.6–3.5, the fights shorter as he wins
  more), but the AI casts on more of them (22–40% to 74–79%), Holds less,
  and each cast catches more (0.4–0.8 enemies a fight hit at 10, 3.7–4.9 at
  1) since fewer enemies act between the cast and the landing to walk out.
  The heal grows less (2.5–5.2 to 5.3–8.6): allies are seldom where it
  lands. He lives longer for the damage he deals (29–41% to 67–84%).
- **A shorter charge raises the skill gap, for him and his party.** His
  own span grows from 3.3 to 5–7.8 (each within noise of the next, but
  every short charge above the built one), now beside the tanks'
  5.3–13.7. His party's jumps at 5 slots and under: 17.2–19.4 against
  7.3–9.7, the novice party losing most (37.6% at 5 against 46% at 7),
  as more of the fight turns on where the area goes and who is in it
  when it lands; above the Duelist's 16.7, the largest measured.
- **Not changed in runs**: a charge of about 6 slots (0.6) would bring him
  to even with a span of about 6 and his party's 7–17, though 6 itself
  is unmeasured. Above 7 he is weak whatever the skill; at 5 and under
  too strong, and a novice's party suffers for it.

### Invocation at 6 slots, as built (2026-10-31)

Built (the owner) after "Invocation's charge": the charge **0.6 of his
action cost, 6 slots at speed 1** (`ABILITY.invocation.charge` 0.6), Wait
on or off. `experiments/invocation-charge.mjs`'s `c6-` rows on `fb093cd`'s
rules, the same seeds and rows; unfinished fights at most 0.3%.

| Charge | Steppe | China | Persia | others' | Storm C. in his | Alchemist in his | Magus in his | kept | **score** |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 7 | 41.8 | 36.3 | 49.2 | 42.4 | 56.0 | 61.3 | 44.8 | 46.0 | 44.2 |
| **6 (built)** | 51.0 | 43.5 | 53.1 | 49.2 | 47.3 | 63.5 | 44.8 | 48.1 | **48.7** |
| 5 | 55.8 | 49.8 | 62.2 | 55.9 | 35.5 | 57.0 | 35.0 | 57.5 | 56.7 |

| Charge | His turns | Casting | Hold | Lives through | Enemies hit | Damage | Healed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| **6** | 2.7–3.0 | 45–63% | 3–8% | 38–50% | 1.5–2.4 | 4.3–7.2 | 4.3–8.0 |

| Charge | Priest novice | expert | **span** | Party novice | expert | **span** |
|---:|---:|---:|---:|---:|---:|---:|
| 7 | 44.8% | 49.8% | 5.0 | 46% | 53.3% | 7.3 |
| **6** | 41.5% | 50.5% | **9.0** | 35.1% | 57.4% | **22.3** |
| 5 | 43.8% | 50.8% | 7.0 | 37.6% | 54.8% | 17.2 |

- **Even as a score**: 48.7%, inside the band, between 7's 44.2% and 5's
  56.7% as estimated. Even in the Steppe's and Persia's seats (51.0%,
  53.1%) and against the Storm Caller and the Magus in his own; under in
  China's (43.5%) and against the Alchemist in his (36.5% kept), the
  Alchemist's Overdose being strong in Byzantium's party.
- **The skill gap is large**: the Priest's own span 9.0 (3.3 at 10, 0.8
  with Blessing), in the tanks' 5.3–13.7; Byzantium's party 22.3, the
  largest measured (the Duelist's 16.7 the most for one hero), the novice
  party losing most (35.1%). At ±3.5 a span, 6's and 5's party spans
  (17.2) agree; what is clear is a jump from 7–10's 7.3–9.7 to 17–22 at 6
  and under. A player who places the area and keeps allies in it gains a
  lot; one who doesn't, or the shallow AI, loses a lot.
- **Open**: whether a party span of about 20 is wanted (a hard support to
  play well, and an enemy Priest much weaker in a novice AI's hands than an
  expert's); and China's seat and the Alchemist's under even.

### A horizon of slots (2026-10-31)

Item 2 of what Wait needs from the AI: a line of the search ending at a
stretch of track, not a count of decisions, so a line that Waits sees as
many enemy turns as one that acts. Built as `AI.horizonSlots`, **off**
(0). `experiments/horizon.mjs`, 800 fights a row, on `565d922`: both
sides searching up to 6 decisions (narrowing 4, 3, 2, four times the
work) with reach and the track at 0.25, one side with Wait (Patient 3),
the search cut by decisions only (`d6`) or at 6 or 9 slots too; and one
side's AI with the horizon against the same deep search without it,
no Wait (`ai-h6`). Stopped once the shipping measurements were in, so
some rows are missing.

| Mirror | Wait, decisions only | Wait, horizon 6 | Wait, horizon 9 | The horizon's AI |
|---|---:|---:|---:|---:|
| Steppe | 49.3% | 49.9% | 47.4% | **23.4%** |
| China | **58.8%** | 56.6% | | |
| Persia | 42.8% | 47.5% | 40.8% | 50.4% |
| Byzantium | 51.4% | 53% | | |

The horizon changes little for Wait (+0.6 to +4.7 at 6 slots, worse at
9) and can cripple the AI: on the Steppe the side cutting its lines at 6
slots wins 23.4% against the same search without, its lines ending
before the hits they set up land. **Left off.** The deeper search alone
is what found Wait's first clear worth, China's 58.8%: the browser's AI,
some 11 decisions deep, is the one that plays it in runs.

### A Wait always searched (2026-10-31)

Item 4: a Hold in place that brings the card back sooner joins the
options a decision searches on, tried if it wasn't (`AI.keepWait`, the
root's at 1, every decision's at 2), **off** (0).
`experiments/keep-wait.mjs`, 800 fights a row, on `dbd9bbb`, with reach
and the track at 0.25 (the same as reach.mjs's `waitm0.25-` rows
without it), production's search, one side with Wait:

| Mirror | Without (waitm0.25) | Root | Every decision |
|---|---:|---:|---:|
| Steppe | 49.4% | 51% | 49.5% |
| China | 45.8% | 47.4% | 46.3% |
| Persia | 48.2% | 46.8% | 47.3% |
| Byzantium | 50.8% | 51.5% | 50.3% |

Nothing: the search already tries a Wait often enough, and doesn't find
it better when it does. Left off at first; **on at the root since later
2026-10-31** (`keepWait` 1, the owner's call with Wait in runs: no gain
or loss measured, the root's the cheaper of the two).

### Wait in runs (2026-10-31)

The owner's call, after the four AI items: **Wait is in runs**
(`RULES.waitShare` 2/3), and with it the AI that plays it: reach and
the track in the leaf at 0.25 (`AI.reachShare`, `AI.leafTrack`), and
near-ties at the root settled by what each option does at once
(`AI.tieMargin` 0.05: with reach counted, stepping in to hit next turn
scored a hair over hitting now, the Barbarian walking past a free Axe
Throw). The horizon stays off; the kept Wait was turned on at the root
later that day (`keepWait` 1, "A Wait always searched"), after these
rows. The browser's AI
searches about 6% shallower with the leaf's terms (11.9 → 11.2 decisions
on average over 48 decisions, `AI.browser`'s 400 ms).
`experiments/wait-ship.mjs`, 800 fights a row, on `8fe8c1d`: today's
game (`built`) against the game before (`before`: all four off).

| | Before | Wait in runs |
|---|---:|---:|
| Steppe mirror (player side) | 64.6% | 64.9% |
| China mirror | 41% | 52% |
| Persia mirror | 77.6% | 67.8% |
| Byzantium mirror | 90.6% | 86.4% |
| China v Steppe | 45.6% | **30.6%** |
| Persia v Steppe | 70.1% | 64.5% |
| Byzantium v Steppe | 11.4% | 22.9% |
| Persia v China | 59.8% | 62.9% |
| Byzantium v China | 7.6% | 16.4% |
| Byzantium v Persia | 19.1% | 33.4% |

The AI as built against the AI before, on today's rules, one side each:
Steppe 52.4%, China 55.5%, Persia 60.7%, Byzantium 56.6%. The mirrors'
side bias shrinks (Persia's 77.6% → 67.8%, China's 41% → 52%); China
loses ground (15 points against the Steppe), Byzantium, weak since its
rework of the day, gains 9–14. Which of Wait and the AI moves China is
not separated: the first row to run if China needs tuning.

### Alignment as swaps only, with his own card and Humphrey's (later 2026-10-31)

Asked for (owner): Alignment as **swaps only** (`ABILITY.alignment.swaps`,
on; no blank cards, and so no limit of its own): the cards of the line's
units, **his own next turn's** (where his card would land after this turn)
and **Humphrey's**, on the line or not, permuted among themselves; every
card sent back brings another forward. His own card takes its swapped slot
as his turn ends (`Unit.cardDue`). The AI tries its side's cards (his own
among them) on the pool's earliest slots and the other side's on its
latest, and each single swap of an enemy's card before one of its own.
Same rows (`experiments/alignment.mjs`, 400 fights, main as of the change;
Byzantium's tank and damage hero swapped in runs since the rows above, so
Omen's Byzantine rows moved; before Wait came into runs, ab7c0e7):

| Seat | Omen | Alignment, swaps |
|---|---:|---:|
| For the Storm Caller (Steppe) | 50.3% | 86.9% |
| For the Alchemist (China) | 60% | 93.2% |
| For the Priest (Byzantium) | 69% | 98.4% |
| Against the Storm Caller in Persia's | 57.7% | 82.9% |
| Against the Alchemist in Persia's | 59.9% | 88.1% |
| Against the Priest in Persia's | 66.7% | 97.4% |
| **Mean** | **60.6%** | **91.2%** |

| Played by | Omen | Alignment, swaps |
|---|---:|---:|
| Novice | 40.3% | 38.9% |
| Expert | 57% | 56.8% |
| Span | 16.7 | 17.9 |

Unfinished: 3.3–6.8% in the seats, **45%** with a Magus on each side.
His turns a fight: 15–21 (Omen 5–6), 95 with a Magus on each side;
Alignment on 88–96% of them.

- **Broken, by his own card**: each turn he swaps his next turn's card with
  the earliest card on the pool, an enemy's, and acts again at once while it
  waits where his next turn was. Next turn the same, so he takes turn after
  turn and the enemy he picks is held back each time: the stun-lock back,
  and with extra turns. Two Magi do it to each other until the turn cap.
- **Humphrey is not the trouble**: his card only trades with another.
- **Untried, to keep his own card in**: his card may only go later (a swap
  with him brings a card forward, never sends one back); or a swap with his
  own card ends with his card at least his action cost on; or his own card
  out, Humphrey's in, swaps only.

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
