# Roguelike tactics: turn order, speed and action economy

The shared clock (turn order), speed, and what a unit may do on its turn.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 3. Turn Order: Shared Clock

### 3.1 Summary (Decided)
All units share one clock. Each unit has a next turn tick. The unit with the lowest next turn tick acts next. When it finishes, its next turn tick is set to the current tick plus the cost of what it did. Cheaper turns come back sooner; expensive turns come back later.

This model is in the same family as the turn systems of Mana Khemia, Final Fantasy X and Final Fantasy Tactics, which are the main references.

### 3.2 Core Rules (Decided)
1. Each unit has a `nextTurnTick`.
2. The clock advances to the lowest `nextTurnTick` among all living units, and that unit takes its turn. Two units never share a tick (3.4).
3. When the turn ends:
   ```
   nextTurnTick = currentTick + turnCost
   turnCost     = max(minimumTurnCost, hexesMoved × moveCostPerHex + actionCost)
   ```
   - `actionCost` is 0 if the unit used no action.
   - Speed does not change turn cost (section 4).
4. A unit's own turn cost changes no other unit's `nextTurnTick`. The one exception is a collision (3.4): if the unit lands on an occupied tick, the unit that loses the tie order moves to a later free tick.
5. Deaths remove the unit from the clock. No other unit is affected.

### 3.3 Costs (Decided, values TBD)
- **Ticks are whole numbers.** Every cost, duration and offset is a whole number of ticks.
- Every action has a **fixed, public action cost**. The same ability always costs the same ticks in every combat.
- **Coarse scale, visually representable.** The timeline is drawn as one pip per tick (7.1), so players can count costs directly. Illustrative scale: typical action = 10, quick action = 6, slow action = 15, movement = 1 per hex, minimum turn cost = about 3.
- `minimumTurnCost` ensures a turn where the unit does nothing still costs time, and prevents near-free turns from chaining.
- `moveCostPerHex` may be modified by unit or gear. TBD.
- **Consequences of the coarse scale:**
  - **Collisions are common.** They resolve to separate ticks (3.4), so losing a collision costs at least 1 tick. Accepted because it is deterministic and shown on the timeline.
  - **Movement is relatively expensive:** 4 hexes cost 40% of a typical action. This supports "rushing in costs time" (6.6) but favours short moves on compact maps. A typical action of 12 would soften this (open question 1).

### 3.4 Ties and Collisions (Decided)
**Two units never share a tick.** When two or more units would have the same `nextTurnTick`, this order decides which keeps the tick; each other unit moves to the next free tick after it, in the same order:
1. **Higher speed first.** Speed here means the unit's final speed stat after gear.
2. **If speed is equal, first scheduled first.** The unit whose `nextTurnTick` was set to that value earlier keeps its place.
3. **If still tied** (units scheduled at the same moment, such as at combat start or by one area Delay), use a fixed order: alternate between sides, then party slot order. Exact fixed order TBD.

- A move can cascade (the next tick may also be taken); it always goes to the first free tick.
- Units scheduled at the same moment spread over consecutive free ticks in this order.
- A faster unit landing on a slower unit's tick takes it, and the slower unit moves on. This is an intended build reward.
- A collision move counts towards the Delay limit (3.6), so repeated bumps cannot lock a unit out.
- Moves can affect any unit, including allies of the unit that caused them (for example, a delayed enemy landing on an ally's tick). The preview must show every resulting move before the player commits (7.2).

### 3.5 Delay, Pulls and Timeline Manipulation (Decided)
Terminology: **Delay** is the timeline effect; **Push** means physically moving a unit across hexes (see the keywords in [phase-1-brief.md](phase-1-brief.md), section 3).
- Abilities may **delay** another unit's `nextTurnTick` by a stated number of ticks.
- Abilities may **pull** an ally's turn earlier, but never earlier than the next tick (the ally acts next at the soonest, as Final Fantasy Tactics' Quick does).
- A delayed or pulled unit that lands on an occupied tick is resolved by the collision rule (3.4).

### 3.6 Delay Limit (Decided, value TBD)
Repeated delays can keep an enemy from ever acting. Mana Khemia was criticized for exactly this, and in PvP it becomes a lockout loop. A unit can be moved later by at most a set number of ticks in total between two of its own turns, counting both Delay and collision moves (3.4). Further delays are reduced to fit, and the preview shows the reduced amount. Value TBD (Phase 1: 10 ticks).

### 3.7 Delayed Actions (Proposed)
- Some slow or powerful actions resolve later rather than immediately. When declared, the action is placed on the timeline as its own entry at a scheduled tick and takes effect when the clock reaches it.
- At the same tick, **delayed actions resolve before units act.**
- Purpose: if a powerful action resolved immediately and its cost were paid afterward, the cost would be meaningless whenever the action ends the fight. Delayed resolution makes big actions visible and answerable.
- A delayed action is **cancelled if its caster dies** before it resolves, and units can step out of its target area. Otherwise it cannot be interrupted.
- Which actions are delayed is defined per ability.

### 3.8 New Units (Proposed)
Units that enter mid-combat (summons, reinforcements) are scheduled at `currentTick`, plus a starting offset if per-tier offsets are adopted for combat start (4.1), and resolve collisions like any unit (3.4). TBD.

Reinforcements (Decided): their arrival is shown on the timeline in advance as a scheduled entry, with a known arrival tick and spawn location (section 7.4).

### 3.9 Durations (Decided)
All durations (buffs, debuffs, damage over time) are measured in whole ticks on the shared clock, on the same scale as costs (3.3). A duration of 20 ticks expires 20 ticks after it was applied, regardless of how many turns occur in between. A duration that ends on the tick of the affected unit's turn **expires after that unit acts**, so it still covers that turn.

## 4. Speed

Speed sets starting order and is the first tie-breaker. It does not reduce action or movement cost.

### 4.1 Starting Order (Proposed, not final)
- **Proposed:** all units start at tick 0, and the tie rules (3.4) decide the opening order, so higher speed acts first. Because collisions resolve to separate ticks, the units spread over ticks 0, 1, 2 and so on in that order.
- **Alternative:** a small whole-tick starting offset per speed tier, so faster tiers start earlier.
- Either way, higher speed gives an earlier first turn. Method open (open question 3).

### 4.2 Tie-breaking (Decided)
See section 3.4. Collisions are common at the coarse scale, so this is speed's main effect during a fight: the faster unit keeps a contested tick.

### 4.3 No Cost Reduction (Decided)
Speed does **not** reduce action or movement cost. Turn cost is `max(minimumTurnCost, hexesMoved × moveCostPerHex + actionCost)` (3.2). At the coarse scale a percentage reduction would round to 0 on quick actions.

### 4.4 Speed Versus Defence (Decided in principle, details TBD)
- Speed is weighed against defence: gear that provides more defence reduces speed, or speed and defence compete for the same gear budget. Taking speed means giving up protection, and the reverse. Giving up speed means acting later in ties and at the start, not paying more ticks.
- Mechanism TBD. Options include gear weight (mainly from the armour slot) that lowers speed, similar to Tactics Ogre where equipment weight increases recovery time, or speed and defence as competing stats on the same gear.

### 4.5 Rationale
- Ticks are a single currency, so a cost reduction from speed would benefit every build and push speed toward being universally desirable. Without one, that route to dominance is closed.
- Speed's value comes from **starting order and tie-breaking**. Collisions are common and the loser moves to a later tick, so speed still matters a lot. The speed versus defence tradeoff (4.4) is its opportunity cost.
- Durations in ticks (3.9) do not favour fast units: speed does not change how often a unit acts, only who keeps a contested tick.
- Speed affects only comparisons, so +1 speed either flips a tie against a particular unit or does nothing. Accepted for now; revisit when tuning (open question 2).

## 5. Action Economy

### 5.1 Rules (Decided)
On its turn, a unit may:
- **Move** any number of hexes, each adding movement cost (a hard maximum per turn is open, question 28), and/or
- **Use one action** (an ability or attack).

Both are **optional.** A unit may move only, act only, do both, or do neither. Every choice changes its turn cost, so doing less brings its next turn sooner (down to the minimum turn cost).

Order within a turn (move before acting, act before moving, or splitting movement around the action) is TBD (Phase 1: move then act or act then move, not split).

### 5.2 No Cooldowns (Decided)
- Abilities have no cooldowns. An ability can be used on any turn.
- Action cost is therefore the main thing that prices an ability's power. Strong abilities must cost more ticks (or be delayed actions). Low-cost abilities must be roughly comparable in power to each other, or the strongest cheap ability will be used every turn.

### 5.3 Rationale
- Fixed costs make every action's timing consequences readable and context-free.
- Including movement in turn cost means moving and acting in the same turn always costs more than doing only one, so fast units do not get free repositioning.
- Optional movement and action make every turn a decision about how much time to spend.
- **Why movement may still need a cap:** costs are paid after the turn. Without a cap, a unit could cross the map and strike before every unit whose turn falls inside that stretch of ticks acts; if the strike ends the fight, the cost hardly matters (the same reasoning as delayed actions, 3.7).

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Turn order | Shared clock with fixed action costs | Individual initiative, side-based phases, simultaneous commit, semi-real-time, slot-based timeline | Absolute, context-free costs; deaths do not affect others; matches Mana Khemia-style timeline |
| Slot-based timeline | Rejected | Units placed into numbered slots (N + cost, or "skip k available slots") | Required many patch rules (collisions, empty slots, push vs join, dependence on unit count N, slot floors). Slow turns could be pushed back indefinitely |
| Turn cost | Movement per hex + action cost, with a minimum | Uniform cost per turn | Moving and acting together always costs more; doing nothing still costs time |
| Cooldowns | None | Cooldowns in turns or ticks | Simplicity; action cost prices power instead |
| Tick scale | Coarse whole-number ticks (typical action about 10), drawn one pip per tick | Fine-grained scale (typical action about 100) | Ticks must be visually representable so players can count costs; common collisions are accepted as deterministic and shown |
| Collisions | Never share a tick: tie order (speed, first scheduled, fixed order) decides who keeps it; others move to the next free tick; moves count towards the Delay limit | Units sharing a tick and acting in tie order; first scheduled only | One unit per tick keeps the timeline readable; gives speed a clear role; counting moves prevents bump-locking |
| Speed | Starting order and tie-breaking only; no cost reduction | Percentage reduction of action cost; flat per-tier reduction; applying to movement | A percentage reduction rounds to 0 on quick actions at the coarse scale; a flat reduction was not adopted, for simplicity |
| Speed vs defence | Speed weighed against defence (details TBD) | No tradeoff | Gives speed an opportunity cost so it is a build choice, not a default |
| Starting order | Proposed: all units at tick 0, tie rules decide | Small whole-tick offset per speed tier; fixed or random order | Rewards speed through the tie rules without a formula |
| Delay limit | Cap on total delay (Delay and collision moves) between a unit's own turns | Diminishing returns on repeated delays; a guaranteed turn after a set delay | Simple, previewable, and prevents lockout |
| Pulls | No earlier than the next tick; collisions as usual | Moving a turn to any earlier tick | Matches Final Fantasy Tactics' Quick; cannot skip the timeline |
| Delayed actions | Cancelled if the caster dies; units can step out of the area | Uninterruptible; interruptible by damage | Keeps big actions answerable without new interrupt rules |
| Durations | Measured in ticks; expire after the affected unit acts on their last tick | Measured in turns; expiring before the unit acts | Consistent regardless of how many units act; a buff covers the turn it lasts until |
| Action economy | Optional move plus optional single action | Action point pools, card-based actions | Clear and fast to read; card draws would blur whether a loss came from build, play, or luck |

## Open questions (original numbers)

1. Cost values: the exact typical action cost (10 or 12; 12 softens movement cost), quick and slow costs, `moveCostPerHex`, and `minimumTurnCost`.
   - The minimum turn cost (about 3) is below the cost of a short move, so moving 1 to 3 hexes costs the same, and chained 3-tick turns (step, wait, step) act about three times per typical action. Consider about 5, or a fixed cost for Wait and move-only turns.
   - Default size of the visible timeline window (roughly the next 30 ticks; the timeline scrolls, 7.1).
2. Speed versus defence mechanism: gear weight lowering speed, or competing stats on gear (4.4). Whether speed should become an explicit small rank, since it only matters in comparisons (4.5).
3. Starting order method: all units at tick 0 with the tie rules deciding, or a small whole-tick offset per speed tier (4.1).
4. Fixed fallback order for ties.
6. Which abilities are delayed actions (3.7), and whether a delayed action takes a tick of its own when it collides with a unit or shares the tick and resolves first.
7. Scheduling of units that enter mid-combat (3.8).
8. Order of move and action within a turn.
28. Whether there is a hard maximum on hexes moved per turn (see 5.3 for why one may be needed), or movement beyond a cap only without an action.
36. Order of events within one tick: proposed expiries, then damage over time, then delayed actions, then the unit's turn; must be shown in previews.
