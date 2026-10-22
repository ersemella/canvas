# Roguelike tactics: the caravan's camel

The camel that carries the party's goods: a unit on the board and on the
track that the player moves but that can't attack, the fight's win and
loss conditions, and how it ends stalled fights.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

**Status:** decided (owner, 2026-10-21) as the answer to how a stalled
fight ends ([owner-decisions.md](owner-decisions.md), issue 1); **built in
the fight (2026-10-21)**, with its sprite and portrait. Carrying its health between fights waits for Phase 2's run.

## 18. The Caravan's Camel

### 18.1 The Camel (Decided)
- Every fight has the party's **camel**, carrying the caravan's goods. It
  is a **unit** with its own hex on the board and its own **card on the
  track**, controlled by the player.
- **It can't attack.** On its turn it **moves one hex**, at a **typical
  action cost** (100), so it advances very slowly. *(Proposed:* or it
  Holds, like any unit; walking rules apply as to heroes: it can't pass
  units or obstacles, and hazards it enters trigger, 6.2.)
- **Very high health and High defence** (owner; defence High, 40, since
  2026-10-21, was none). Built with **1,500**
  (placeholder; the Bökh Champion has 540), so the enemy has to commit
  several turns to it, not one burst.
- **It acts first in every fight, despite its speed** (owner, 2026-10-21):
  its card starts at slot 0, ahead of every other card's starting slot
  (3.4). After that its speed places it like any card, so a Hold (30)
  can give it a second turn before the fastest hero's first.
- *(Proposed:* speed **Low (10)**. A move then places its card 100 × 5 ÷
  35 = 14 slots ahead, so crossing the 8-column map takes about 8 moves
  and 115 slots, about 11 turns of a Medium hero; Phase 1 fights last a
  median of about 9 actions per unit.)
- **It isn't a hero:** it doesn't take one of the party's four places
  (10.1), and has no gear, upgrades or ultimate. *(Proposed.)*
- *(Proposed:* it starts in the player's starting column, in the middle
  row; the heroes are scattered along the same column, 6.6.)

### 18.2 Winning and Losing (Decided)
- **The player wins** when the camel reaches an **exit hex**, or when
  every enemy is defeated.
- **Exit hexes:** the **four hexes sticking out on the right edge**, the
  enemy's side (owner): the last hex of each row shoved half a hex right,
  rows 2, 4, 6 and 8 counting from 1 (column 7 of odd rows 1, 3, 5 and 7 in
  `src/rules/map.ts`). The enemy has three units, so it can't stand on all
  of them.
- **The player loses** when the camel dies: it is **game over**, as a party
  wipe is.
- *(Proposed:* if one action both kills the camel and defeats the last
  enemy, or carries the camel onto an exit as it dies, the camel's death
  counts first: a loss.)

### 18.3 Everything Applies to It (Decided)
- The enemy is **trying to kill it.** Every ability reaches it like any
  other unit: damage, statuses, **displacement** and **Immobilized**
  included (owner). Pushing it back or holding it in place is a legitimate
  tactic; no ability lasts forever, and a Bökh Champion grappling it turn
  after turn means the player has to deal with the Champion (owner).
- A Taunted camel can only Hold, since it has no action that targets the
  taunter (17.5).
- **Friendly fire applies** (owner, 6.7): the party's own Bow, Hail,
  Freeze and Lunge can hit it, and Sunlight can heal it. As a unit, it
  blocks lines of fire for both sides, so it can shield an archer, and it
  takes the arrow when it does.
- *(Proposed:* it flanks and can be flanked like any unit (6.3).)

### 18.4 Between Fights (Decided)
- **The camel's damage carries over** from fight to fight (owner): its
  health is the run's life bar, as the power grid is in Into the Breach.
- **Its statuses are cleared** after each fight, and **the heroes start
  each fight at full health** (owner; [heroes-and-gear.md](heroes-and-gear.md),
  10.11).
- *(Proposed:* the camel recovers health only at rests (caravanserais) and
  from consumables (9.6), so route choices weigh the camel's health.)

### 18.5 Rationale
- **It ends stalled fights.** Before the camel, a fight ended only when
  one side was eliminated, and a heal could undo damage forever. Now the
  player can always end a fight by walking the camel out, and an enemy
  that hangs back loses. The enemy can delay the camel (displacing,
  immobilizing, taunting it), but each delay costs its own turns and runs
  out, and the player can answer the unit doing it.
- **It fits the setting:** rival caravans racing along the road (15.1),
  and the caravan is now on the map.
- **A second win condition** gives fights a direction, as objectives do in
  League of Legends, Valorant and Overwatch (owner): the enemy has to
  commit, so the AI no longer needs its pull toward the nearest enemy to
  engage, and the player weighs pressing the camel forward against fighting.
- **It adds positioning without new rules:** the camel blocks lines of
  fire and walking, takes friendly fire, and is a target the enemy must
  reach.
- **Escort fatigue** (every fight being "protect the camel") was raised
  and isn't considered a problem (owner): the objective is what each fight
  is about, as in the games above. Other objectives (11.4) can still vary
  fights.

### 18.6 As Built (2026-10-21)
- **Rules:** the camel is a unit of the player's side (`camel` in
  `HEROES`, `src/rules/config.ts`: health 1,500, speed 10, defence 40,
  power 0, only Hold among abilities, a move of 1 hex costing 100). It
  starts at column 0 of row 4 (0-based), the middle of the player's
  column; the heroes are scattered over the rest. The exits are
  `SALT_FLATS.exits`. `checkEnd` (`resolve.ts`) checks, in order: the camel
  dead (a loss), no enemy left (a win), the camel on an exit (a win), no
  hero left (a loss). A fight saved before the camel has none, and plays as
  before.
- **The AI** (`ai.ts`): a finished fight dominates both the shortlist score
  and the search's evaluation; the camel's health counts a point a point
  (`AI.camelHealthWeight`, 1), with no kill value; each hex between the
  camel and its nearest exit is worth `AI.perCamelHex` (60) to the enemy and
  against the player. The camel isn't pulled toward the enemy as heroes
  are.
- **Measured** over 200 AI-vs-AI fights from real starts (the player's side
  also played by the AI): **none unfinished** (3% to 8% before), median 50
  actions; the player's side wiped the enemy in 61%, was wiped in 25%, lost
  its camel in 13% and walked it out in 1%. The player's side now wins
  more often: the enemy spends turns on the camel. A human walking the
  camel on purpose is untested. The AI's CPU per request is unchanged
  within noise (mean 3.2 ms against 3.1 ms locally).
- **The page:** the exits are drawn with a dashed ivory border and two
  chevrons, and hovering or tapping one says what it is; the camel's stat
  sheet gives its rule in place of abilities; Move shows its 14 slots; the
  result says whether the camel took the road out or fell. Once a won
  fight's result shows, the party walks out (owner, 2026-10-21): the camel
  heads for its nearest exit and every living hero for the same one, hex by
  hex (around enemies still standing where it can), then on past the edge,
  fading away. Nearest first, they reach the exit one hex's time apart, so
  none overlap on it. With reduced motion everyone stays put.
- **Art:** a 36×36 sprite with a 2-frame idle (`sprites/camel.png`, split
  at row 24, above the legs) and a 32×32 portrait
  (`sprites/camel-portrait.png`), both from ChatGPT images through
  `scripts/shrink-sprite.py` (the portrait without `--lines`, which muddied
  the face).
- **Still to do:** carrying its health
  between fights (Phase 2); the balance runner's camel only waits at its
  start unless the AI moves it.

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Ending stalled fights (2026-10-21, owner) | The caravan's camel: a unit that can't attack, moves one hex a turn at typical cost; reaching one of four exit hexes on the enemy's edge wins; its death is game over; every ability reaches it, displacement and Immobilized included; its damage carries over between fights | A fight limit at a set slot; a surrender rule; stronger finishers or weaker heals; a fourth hero; a camel the enemy plunders, with cargo that can't be won back | The player can always end a fight; fits the caravan setting; gives fights an objective; the camel's health becomes the run's attrition |
| The camel's name (2026-10-21, owner) | Temee, shown wherever the game names the camel ("Temee reaches the road out") | "Caravan Camel" | A name gives the caravan a character to protect |

## Open questions

- The camel's health, and its speed (Low proposed).
- How exits are placed on maps other than Phase 1's.
- How the camel recovers between fights, and how much (18.4).
- Whether a rival caravan brings its own camel, so both sides have one to
  protect and one to kill, and an exit each ([ghosts.md](ghosts.md); it
  keeps both sides on the same rules, goal 5).
