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
> The Bökh Champion's Pin was renamed Grapple (owner, 2026-10-22); the
> measurements below keep the name they were taken under.

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
- **The Mangudai Outrider takes 2–3 times as many turns as anyone else**,
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
| Mangudai Outrider | 25 | move 63%, Dash 18%, **Bow 13.5%**, Volley 3.8%, Hold 1.4% |
| Bökh Champion | 7.7 | move 42%, **Throw 30%**, Pin 16%, Rampage 6.5%, Hold 5.4% |
| Yadachy Storm Caller | 8.3 | **Fog 39%**, Hail 20.5%, move 18.6%, Sunlight 11.7%, Freeze 10.5% |

Median 53 chosen actions and 84 slots per fight; 6.8% unfinished.
Ultimates unlock around slot 32 to 39 and are used around 38 to 50. The
Champion uses Rampage in only half of fights, because it often dies
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
| Throw | 30.6% | 35.1% | | Core; the Champion's only real damage |
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

- **Decisions per turn are few and the same each fight.** The Outrider
  steps into a lane and shoots. The Storm Caller places hail on whoever
  is in reach. The Champion walks in and throws. Fog and Pin are chosen
  often but change nothing. A "turtle" plan (fog, heal, pin) loses to a
  damage race.
- **The six-lane bow, with no range limit, sets the positioning game.**
  Lining up an arrow costs 2–3 cheap moves per shot. That makes the
  Outrider tedious to play: 25 turns a fight against the others' 8. A
  higher move cost doesn't help: at base 30 or 40 the Outrider switches
  to Dash (65–69% of its turns) and takes as many turns.
- **The tank doesn't tank.** The Champion has the lowest survival (27% vs
  41–43%) and a third of the Outrider's damage per slot (raw 9.6 vs 30.9).
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
Vulnerable; the Outrider and Storm Caller at 300 and 420 health since
2026-10-21, 360 before, when Throw took 5 and 6, Hail 6 and 8, and
Volley 2 on the Outrider):

| Attack (raw after power) | vs Champion (540, def 25) | vs Outrider (300, def 10) | vs Storm Caller (420, def 25) |
|---|---:|---:|---:|
| Bow (216) | 4 (144 each) | 2 (180) | 3 (144) |
| Throw (96) | 9 (64) | 4 (80) | 7 (64) |
| Hail hit (75) | 11 (50) | 5 (62) | 9 (50) |
| Volley (360) | 3 (240) | **1 (300)** | 2 (240) |

Damage per slot of a typical action: Outrider 216 / 7 slots = 30.9;
Champion 96 / 10 = 9.6; Storm Caller 75 / 10 = 7.5 plus the lingering
hex.

Stat exchange rates (win rate for +10 on one hero of one side; +60
health for reference):

| Hero | +10 speed | +10 power | +10 defence | +60 health |
|---|---:|---:|---:|---:|
| Bökh Champion | 60.5% | 59.1% | 53.7% | 58.4% |
| Mangudai Outrider | 64.6% | 54.7% | 57.9% | 58.2% |
| Yadachy Storm Caller | 65.4% | 53.9% (61.3% with heal 50) | 55.6% | 55.7% |

- **Speed is the strongest stat for every hero.** Power's worth depends on
  the kit: +10 hardly moves the Outrider (no hits-to-kill threshold
  crossed), but matters for the Storm Caller once Sunlight's heal is
  worth having.
- **Speed's value comes in steps.** For a Medium (25) hero, +10 speed
  turns a typical action from 10 slots into 8 after rounding down.
  Rescaling the formula so the three stats share one constant (`C` 50,
  `speedScale` 7.5, giving typical turns of 8, 10 and 12 slots) measured
  the same: +10 speed on the Storm Caller and the Outrider gave 65.3% and
  63.4%, against 63.0% and 61.0% under the same tuning with today's `C`.
  The slot a turn lands on is what counts, not the formula, so `C` can
  stay.
- **Typical turns fall outside the 8 to 12 slot aim** at the ends (High
  7, Low 14; [timeline.md](timeline.md), 3.2). Harmless with three
  heroes; it starts to matter when Low heroes (Varangian Guard, Modao
  Vanguard) and Very low heroes (Mahout Bulwark) arrive.
- **Movement:** a one-hex move costs 30, about 3 slots, so stepping is
  nearly free. That suits the separate-movement rule, but it's why the
  Outrider shuffles.

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
| Champion + 2 wolves | 99.7% | 0.28 | 0 / 1 | 0.8% |
| Outrider + 2 wolves | 99.7% | 0.34 | 1 / 0 | 0.3% |
| Storm Caller + 2 wolves | 98.3% | 0.47 | 7 / 0 | 0% |
| Champion + Outrider + wolf | 93.8% | 0.78 | 17 / 7 | 2.8% |
| Champion + Storm Caller + wolf | 84.5% | 1.02 | 60 / 2 | 0% |
| Outrider + Storm Caller + wolf | 82.8% | 1.11 | 63 / 4 | 2.8% |
| *Champion ×2 + wolf* | 98.2% | 0.64 | 7 / 0 | 0.8% |
| *Outrider ×2 + wolf* | 96.1% | 0.68 | 12 / 3 | 2.8% |
| *Storm Caller ×2 + wolf* | 73.1% | 1.41 | 106 / 1 | 0.5% |
| All three, no wolves (stage 3) | 62.5% | 1.70 | 128 / 18 | 2.8% |

- **Stage 1 is nearly unlosable** whichever hero comes (98–100%), so win
  rate can't rank the heroes there; attrition can. The Storm Caller costs
  the player most (0.47 heroes, against 0.28 and 0.34), and it is the only
  stage-1 enemy that wins a few fights.
- **The Storm Caller is the strongest enemy hero by a wide margin.** Every
  caravan with it is 10–25 points harder than one without, and two of them
  beat any mixed pair. Hail looks like the cause: the player's Outrider
  (300 health) survives 54–58% of fights against a mixed pair with a Storm
  Caller and 35% against two, against 67–96% in caravans without one.
- **Synergy is small.** Against the average of its two doubles, the
  Champion and Outrider together lose the player 3.4 points more fights
  (6.2% against 2.9%) and 0.12 more heroes: the one pair clearly worth more
  than its parts (perhaps the Champion's body screening the Outrider; not
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
| Champion + 2 wolves | 99.7%, 0.28 | 99.5%, 0.32 | 100%, 0.31 |
| Outrider + 2 wolves | 99.7%, 0.34 | 98.0%, 0.43 | 99.0%, 0.50 |
| Storm Caller + 2 wolves | 98.3%, 0.47 | 98.5%, 0.38 | 99.5%, 0.35 |
| Champion + Outrider + wolf | 93.8%, 0.78 | 93.0%, 0.84 | 92.7%, 0.90 |
| Champion + Storm Caller + wolf | 84.5%, 1.02 | 91.1%, 0.85 | 92.4%, 0.76 |
| Outrider + Storm Caller + wolf | 82.8%, 1.11 | 87.0%, 1.00 | 83.9%, 1.06 |
| *Champion ×2 + wolf* | 98.2%, 0.64 | 97.5%, 0.68 | 97.0%, 0.72 |
| *Outrider ×2 + wolf* | 96.1%, 0.68 | 94.8%, 0.81 | 95.1%, 0.88 |
| *Storm Caller ×2 + wolf* | 73.1%, 1.41 | 83.0%, 1.10 | 91.2%, 0.84 |
| All three (unfinished) | 62.5%, 1.70 (2.8%) | 64.5%, 1.65 (4.3%) | 60.0%, 1.68 (10%) |

At 40 the stage-2 spread narrows from 83–94% to 87–93%, and the Storm
Caller stops being the hardest solo enemy (0.38 heroes lost, between the
Champion's and the Outrider's). Two Storm Callers are still the hardest
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
dropped: the Outrider shuffled out of every fog and sandstorm hex (20.5
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
   Volley's charge is 1 slot at the Outrider's speed, so little can answer
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

| Version | Side without it wins | Share of the Outrider's turns | Slots (Outrider) |
|---|---:|---:|---:|
| Dash (up to 3, cost 40) | 45.1% | 16.5% | 3 |
| **Leap, cost 20** | **40.3%** | 33% | 1 |
| Leap, cost 30 | 48.8% | 24% | 2 |
| Leap, cost 40 | 50.8% | 9% | 3 |
| Leap over up to 2 spaces, cost 40 | 46.3% | 18% | 3 |

A short hop only pays when it's cheap: at the Outrider's speed, 20 and
25 cost 1 slot, 30 costs 2. Its share of turns is above a situational
ability's band; it mostly replaces walking (9.6 turns a fight against
8.9), so watch it rather than tune it now.
As shipped, with Sunlight clearing hail and fog too, a side without Leap
wins 44.8%, and Leap is a third of the Outrider's turns.

**Measured 2026-10-21, not applied: a step before the Bow or Pin.** Each
was added as an extra option beside the ability (step one hex, then
fire, or step next to a unit, then pin it), so a side without the option
shows what the step is worth. 400 fights each:

| Option | Cost | Side without it wins | Note |
|---|---:|---:|---|
| Step, then fire | 100 | **29.0%** | 39% of the Outrider's turns; fights 54 → 44 actions |
| Step, then fire | 120 | 34.8% | |
| Step, then fire | **150 (slow)** | **43.0%** | 20% of its turns; 7.1 Outrider turns a fight (10.0 today) |
| Step, then fire | 180 | 50.0% | |
| Step, then pin | 100 | 47.0% | Champion survival 34.5% → 29.1% |
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
Rampage.** The Bökh Champion's ultimate is now Lunge: a unit within 3,
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
31% of the Champion's turns (Throw 18%, Lunge 8.8%); Lunge is a little
under Rampage, within noise. 3.5% of fights unfinished, 54 actions a
fight; the Champion survives 29% of fights.

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
6. **Outrider click load.** Two candidates, both untested: the bow hits
   any unit in a range (5 or 6) with line of fire, not only six lanes; or
   a move-and-shoot ability (a "Parthian shot", 120 cost) replaces Dash.
   Either gives fewer, more meaningful turns.
7. **The Champion as a tank.** It needs a reason to be hit or to hold
   ground. Tried after tunings 1 to 3: **Pin that doesn't Immobilize the
   Champion itself** (the pin still breaks if the two are parted). A side
   without Pin then wins 44.8% (about 50% before): Pin becomes worth having,
   at no cost in stalls (3.5%). **Applied 2026-10-20:** the Champion
   stays free, and moving away releases the target. A zone of control is
   untested.
8. **Stalls still need a guaranteed end.** Tuning brought them to 2.5%,
   not zero. Decided (owner, 2026-10-21): the caravan's camel, whose walk
   to the exit ends a fight ([camel.md](camel.md)); built 2026-10-21, and
   over 200 AI-vs-AI fights none went unfinished.

## The Modao Vanguard (2026-10-22)

The fourth hero, measured before it joined the roster. Ablation as above
(`scripts/balance/ablate.mjs`), 400 fights an experiment, about ±2.5
points. "Vanguard team": the Vanguard, the Outrider and the Storm Caller,
against the prototype party (the Champion in its place). Experiments:
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
base 60, pinned while adjacent) and Throw (beside the Champion), with
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
Caller casts Hail on 48% of its turns, the Champion grapples on 28% and
throws on 13%. Survival: Storm Caller 47%, Champion 29%, Outrider 20%.

**Stage enemies against the full party** (`experiments/caravans.mjs`, 400
fights each; lower is a stronger enemy):

| Enemy | Player wins | Median actions |
|---|---:|---:|
| Champion and two wolves | 100% | 40 |
| Outrider and two wolves | 99.8% | 40 |
| Storm Caller and two wolves | 98.3% | 44 |
| Champion, Outrider, wolf | 97.3% | 44 |
| Outrider, Storm Caller, wolf | 87.3% | 47 |
| Champion, Storm Caller, wolf | 86.5% | 54 |
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
| Bökh Champion | 60.8% | 58.0% | 56.8% | 56.0% |
| Mangudai Outrider | 49.3% | 61.5% | 58.3% | 61.0% |
| Yadachy Storm Caller | 66.3% | 65.5% | 60.0% | 57.0% |

**Mirror matches** (no camel, 500 pairs): player side 50.7% (47.3–54.0),
first mover 51.4%: no side bias. 16.5% unfinished at 400 actions, with
nothing to end a stall.

**Reading.** Hail carries the game: with no damage of their own outside
it, the side losing it almost never wins, and two Storm Callers are the
strongest pair. Throw adds least. The Outrider gains nothing from +10
speed (its track steps don't change at that step) but dies first. Temee
is rarely attacked and rarely decides a fight, so the race to the exit
does little at these lengths.

### Scaling Hail down (2026-10-23)

`experiments/hail-tuning.mjs`, 400 fights each, the full party against
two Storm Callers and a wolf (Hail's best enemy) and against all three
heroes (stage 3). The player's win rate rises as Hail weakens; for
reference, two Outriders and a wolf lose 95.8% of the time, two
Champions and a wolf 100%.

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
   - each **other** ability: 40–48% (it pulls its weight; none is
     mandatory);
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
   61.8%; the Champion 57.4% for speed; the Outrider 62% for speed and
   57.1% for power. Part of speed's value was the old AI turning cheap
   actions into many low-value turns. Speed still matters most for the
   hero whose damage is its job (the Outrider). Price gear speed by the
   slots it saves for that hero's main action, in steps that cross a slot
   breakpoint, and publish slot tables (cost × speed → slots). Neither
   `C` 50 nor carrying the fraction rounding discards to the next turn
   changed speed's measured worth (both tested).
7. **Breakpoints are what matter.** Hits to kill and slots per action are
   the only numbers that change outcomes. Size a gear stat line to move
   one of them (Bow vs Champion from 4 hits to 3 needs 180 a hit), and let
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
