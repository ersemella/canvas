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
the fight (2026-10-21)**, with its sprite and portrait. **Its health carries over** from stage to stage of a run (built 2026-10-27, 18.4).

## 18. The Caravan's Camel

> **Pared back (owner, 2026-10-22):** while the game is balanced, the
> camel isn't player controlled. It starts on the **top row's first hex** and
> walks itself **one space a turn** along a **shortest walk** around the
> ruins to the **only exit, the bottom row's last hex**, going around units
> in its way; it waits only when Immobilized, Stunned or boxed in.
> A short ivory arrow from its hex shows that next step (2026-10-24),
> worked out again as units move, the planned turn's included, so it
> turns when something gets in its way; none while it would wait.
>
> **On the track (owner, 2026-10-23):** it starts **last, at slot 12**,
> and its card goes its action cost on after each of its turns, like any
> unit's: 60 ÷ (speed + 5), and its speed is 0, so always 12, whether it stepped or waited
> ([timeline.md](timeline.md), 3.2 and 3.4).
> Its stats follow the 2026-10-23 scale: defence 9, so health 20
> (placeholder for "very high"; ten bow hits).
>
> The rules below describe the design it returns to.

### 18.1 The Camel (Decided)
- Every fight has the party's **camel**, carrying the caravan's goods. It
  is a **unit** with its own hex on the board and its own **card on the
  track**, controlled by the player.
- **It can't attack.** On its turn it **moves one hex**, at a **typical
  action cost** (100), so it advances very slowly. *(Proposed:* or it
  Holds, like any unit; walking rules apply as to heroes: it can't pass
  units or obstacles, and hazards it enters trigger, 6.2.)
- **Very high health and High defence** (owner; defence High since
  2026-10-21, was none). Built with defence 9, so health 20 since
  2026-10-23 (placeholder; the Grappler has 8; was 1,500 against
  540), so the enemy has to commit several turns to it, not one burst.
- **It acts last in the starting order, despite its speed** (owner,
  2026-10-23; it acted first, at slot 0, from 2026-10-21): its card starts
  at slot 12, after every other card's starting slot (3.4).
- Its card goes 12 slots a turn (speed 0, owner, 2026-10-23: 3.2). Its road
  runs from the top-right or the bottom-right corner, the seed picks which,
  to the exit at the opposite corner, a straight line through the centre, 8
  steps across open ground (owner, 2026-10-28; from the board's top point to
  its bottom point from 2026-10-24, about 12 from the top-left corner of the
  board of rows before). The party starts on the right, facing left, the
  enemy on the left, facing right, and Humphrey faces left with the party
  (owner, 2026-10-28), so a fight
  lasts at most about 150 slots unless the enemy holds it back.
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
  tactic; no ability lasts forever, and a Grappler grappling it turn
  after turn means the player has to deal with the Grappler (owner).
- A Stunned camel (an enemy Grappler's Grapple) or an Immobilized
  one (hail) waits; its card still goes a round on.
- **Friendly fire applies** (owner, 6.7): the party's own Snap Shot and Hail
  can hit it. As a unit, it
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
- **Built (2026-10-27, owner):** on Next stage the camel starts the new
  fight with the health it ended the last with (`stageFight` in
  `src/rules/run.ts`), its statuses cleared. The caravanserai says how
  much it goes on with, and the start menu that its wounds stay with it.
- **Built (2026-10-28, owner):** at a caravanserai that earns a provision
  (after a region's stages 1 and 2), the provision can **heal the camel
  4 in place of a stat** (`RULES.camelHeal`, up to its full health;
  full health at first, 4 since the same day; `next` with `heal`; a tile beside
  the heroes' stats, disabled at full health): one or the other, never
  both. A hurt camel earns the provision even when every hero standing
  has every stat at 10. The caravanserai between regions offers passives
  only, no heal. Not measured: how much this lifts the run's win rate
  (about 1% with carried health, 12.5% without). Not measured:
  the balance runner plays single fights, so how often a run now ends on
  the camel in a later stage is unknown.

### 18.5 Rationale
- **It ends stalled fights.** Before the camel, a fight ended only when
  one side was eliminated, and a heal could undo damage forever. Now the
  player can always end a fight by walking the camel out, and an enemy
  that hangs back loses. The enemy can hold the camel back (displacing,
  Immobilizing or grappling it), but each costs its own turns, and the
  player can answer the unit doing it.
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
  `HEROES`, `src/rules/config.ts`; health 1,500, speed 10, defence 40 and
  a move of 1 hex costing 100 until 2026-10-23; now defence 9, health 20,
  power 0, speed 0, its card going 12 slots a turn (3.2); only Hold among
  abilities). It
  starts at column 0 of row 4 (0-based), the middle of the player's
  column; the heroes are scattered over the rest. The exits are
  `SALT_FLATS.exits`. `checkEnd` (`resolve.ts`) checks, in order: the camel
  dead (a loss), no enemy left (a win), the camel on an exit (a win), no
  hero left (a loss). A fight saved before the camel has none, and plays as
  before.
- **The AI** (`ai.ts`): a finished fight dominates both the shortlist score
  and the search's evaluation; the camel's health counts a point a point
  (`AI.camelHealthWeight`, 1; 2 since 2026-10-23, and the enemy closes in
  on the camel once no hero is in its reach, [ai-search.md](ai-search.md)),
  with no kill value; each hex between the
  camel and its nearest exit is worth `AI.perCamelHex` (60 on the old
  scale, 0.75 since 2026-10-23) to the enemy and against the player. The camel isn't pulled toward the enemy as heroes
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
  sheet gives its rule in place of abilities; the
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
- **Still to do:** the balance runner always takes a stat, never the
  heal (18.4); the balance runner's camel only waits at its start
  unless the AI moves it. Its health carries over since 2026-10-27.

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Ending stalled fights (2026-10-21, owner) | The caravan's camel: a unit that can't attack, moves one hex a turn at typical cost; reaching one of four exit hexes on the enemy's edge wins; its death is game over; every ability reaches it, displacement and Immobilized included; its damage carries over between fights | A fight limit at a set slot; a surrender rule; stronger finishers or weaker heals; a fourth hero; a camel the enemy plunders, with cargo that can't be won back | The player can always end a fight; fits the caravan setting; gives fights an objective; the camel's health becomes the run's attrition |
| The camel's name (2026-10-21, owner) | Humphrey since 2026-10-26 (a pun on its hump), shown wherever the game names the camel ("Humphrey reaches the road out"); Temee before | Temee, the Mongolian for camel, out with real cultures in the game's text (owner, 2026-10-26; roster.md's decision log); "Camel" for a few minutes; Dune, Saffron, Pebble, Bramble; "Caravan Camel" | A name gives the caravan a character to protect |

## Open questions

- The camel's health (defence 9, health 20, a placeholder since 2026-10-23).
- How exits are placed on maps other than Phase 1's.
- How the camel recovers between fights, and how much (18.4).
- Whether a rival caravan brings its own camel, so both sides have one to
  protect and one to kill, and an exit each ([ghosts.md](ghosts.md); it
  keeps both sides on the same rules, goal 5).
