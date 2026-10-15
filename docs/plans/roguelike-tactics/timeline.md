# Roguelike tactics: turn order, speed and action economy

The shared clock (turn order), speed, and what a unit may do on its turn.

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision.

From the combat design document (draft v1.7, owner, 2026-10-15). Rules
are marked **Decided** or **Proposed**; numbers marked TBD are tuning.
Section numbers are the original document's.

## 3. Turn Order: Shared Clock

### 3.1 Summary (Decided)
All units share one clock. Each unit has a next turn tick. The unit with the lowest next turn tick acts next. When it finishes, its next turn tick is set to the current tick plus the cost of what it did. Cheaper turns come back sooner; expensive turns come back later.

This model is in the same family as the turn systems of Mana Khemia, Final Fantasy X and Final Fantasy Tactics, which are the main references.

### 3.2 Core Rules (Decided)
1. Each unit has a `nextTurnTick`.
2. The clock advances to the lowest `nextTurnTick` among all living units, and that unit takes its turn. If several units share that tick, the tie-break rules in section 3.4 decide the order.
3. When the turn ends:
   ```
   nextTurnTick = currentTick + turnCost
   turnCost     = max(minimumTurnCost, movementCost + modifiedActionCost)
   movementCost = hexesMoved × moveCostPerHex
   modifiedActionCost = roundDown(actionCost × (1 − speedModifier))
   ```
   - `actionCost` is 0 if the unit used no action.
   - Speed affects action cost only, not movement cost (section 4).
4. No other unit's `nextTurnTick` changes as a result of a unit's own turn cost. A quick turn simply lands earlier on the clock; it does not displace anyone.
5. Deaths remove the unit from the clock. No other unit is affected.

### 3.3 Costs (Decided, values TBD)
*(Revised 2026-10-15, owner: the scale is **10** for a typical action — quick 6, slow 15, 1 per hex — not the 100-based example below; see [phase-1-brief.md](phase-1-brief.md), section 2, including what it means for speed in 4.3.)*

- Every action has a **fixed, public action cost**. The same ability always costs the same ticks in every combat, before the speed modifier.
- Costs should use a fine-grained scale so ties are rare. Example scale (illustrative): typical action = 100, quick action = 60, slow action = 150, movement = 7 per hex.
- `minimumTurnCost` ensures a turn where the unit does nothing still costs time, and prevents near-free turns from chaining. Value TBD.
- `moveCostPerHex` may be modified by unit or gear. TBD.

### 3.4 Ties (Decided)
When two or more units have the same `nextTurnTick`, resolve in this order:
1. **Higher speed acts first.** Speed here means the unit's final speed stat after gear.
2. **If speed is equal, first scheduled acts first.** The unit whose `nextTurnTick` was set to that value earlier keeps its place.
3. **If still tied** (units scheduled at the same moment, such as at combat start or by a single effect pushing several units), use a fixed order: alternate between sides, then party slot order. Exact fixed order TBD.

Note: because speed is checked first, a faster unit landing on a slower unit's tick acts before it. This is an intended build reward. The timeline preview must always show the resolved order.

### 3.5 Pushes and Timeline Manipulation (Decided)
*(Revised 2026-10-15, owner: the timeline effect below is now called **Delay**; **Push** now means physically displacing a unit — see [phase-1-brief.md](phase-1-brief.md), section 3.)*

- Abilities may push another unit's `nextTurnTick` later by a stated number of ticks. Abilities may also pull an ally's turn earlier. Specific abilities TBD.
- A pushed unit that lands on an occupied tick is resolved by the tie rules (section 3.4).

### 3.6 Knockback Lock Limit (Proposed)
*(Since 2026-10-15 this limits **Delay**, the renamed timeline push.)*

Repeated pushes can keep an enemy from ever acting. Mana Khemia was criticized for exactly this, and in PvP it becomes a lockout loop. Proposed limit, one of:
- Diminishing returns on repeated pushes against the same unit.
- A cap on total push a unit can receive before its next turn.
- A guaranteed turn after a unit has been pushed a set amount.

Choice TBD.

### 3.7 Delayed Actions (Proposed)
- Some slow or powerful actions resolve later rather than immediately. When declared, the action is placed on the timeline as its own entry at a scheduled tick and takes effect when the clock reaches it.
- At the same tick, **delayed actions resolve before units act.**
- Purpose: if a powerful action resolved immediately and its cost were paid afterward, the cost would be meaningless whenever the action ends the fight. Delayed resolution makes big actions visible and answerable.
- Which actions are delayed is defined per ability. Whether a delayed action can be interrupted (for example by moving out of its target area, or by defeating the caster) is TBD.

### 3.8 New Units (Proposed)
Units that enter mid-combat (summons, reinforcements) are scheduled at `currentTick + startingOffset`, using the same starting offset formula as combat start (section 4.1). TBD.

Reinforcements (Decided): their arrival is shown on the timeline in advance as a scheduled entry, with a known arrival tick and spawn location (section 7.4).

### 3.9 Durations (Decided)
All durations (buffs, debuffs, damage over time) are measured in ticks on the shared clock. A duration of 200 ticks expires 200 ticks after it was applied, regardless of how many turns occur in between.

## 4. Speed

### 4.1 Starting Order (Decided)
Each unit's first `nextTurnTick` is derived from speed, so speed determines initial order and spaces units out at the start, avoiding a block of ties at tick 0.
```
startingOffset = roundDown(standardTurnCost × (1 − speedModifier))
```
Exact formula TBD; the requirement is that higher speed gives an earlier first turn.

### 4.2 Tie-breaking (Decided)
See section 3.4. Speed is the first tie-breaker.

### 4.3 Action Cost Reduction (Decided)
- Speed reduces **action cost only**, by a percentage: `actionCost × (1 − speedModifier)`.
- Speed does **not** reduce movement cost. Movement remains a separate lever, controlled through per-hex cost.
- Percentage (not flat) reduction keeps the ratio between quick and slow actions stable. A flat reduction would make quick actions disproportionately efficient.

### 4.4 Guardrails (Decided, values TBD)
- **Cap:** `speedModifier` is capped and deliberately kept small. Exact cap TBD, at or below the earlier 10% to 15% target. Speed affects starting order, ties and cost at once, so without a tight cap it would dominate builds (see 4.6).
- **Rounding:** all speed-modified values round down. The same rule is used everywhere.
- **Minimum turn cost** (section 3.3) applies after the speed modifier.
- The mapping from speed stat to `speedModifier` (linear, stepped, or with diminishing returns) is TBD.

### 4.5 Speed Versus Defence (Decided in principle, details TBD)
- Speed is weighed against defence: gear that provides more defence reduces speed, or speed and defence compete for the same gear budget. Taking speed means giving up protection, and the reverse.
- Mechanism TBD. Options include gear weight (mainly from the armour slot) that lowers speed, similar to Tactics Ogre where equipment weight increases recovery time, or speed and defence as competing stats on the same gear.

### 4.6 Rationale: Speed as a Universal Stat
- Ticks are a single currency. Movement and actions are both paid in ticks, so a tick saved on action cost can be spent on movement. Any action cost reduction therefore benefits every build, which pushes speed toward being universally desirable.
- Mitigations: the cost reduction is kept minimal (4.4), and speed carries an opportunity cost against defence (4.5).
- Known secondary amplifier: durations measured in ticks (3.9) cover more of a fast unit's turns, so buffs are slightly more valuable on fast units. Accepted for now; revisit if speed proves too strong.

## 5. Action Economy

### 5.1 Rules (Decided)
On its turn, a unit may:
- **Move** any number of hexes, each adding movement cost (whether there is a hard maximum per turn is TBD), and/or
- **Use one action** (an ability or attack).

Both are **optional.** A unit may move only, act only, do both, or do neither. Every choice changes its turn cost, so doing less brings its next turn sooner (down to the minimum turn cost).

Order within a turn (move before acting, act before moving, or splitting movement around the action) is TBD. Maximum movement per turn is TBD.

### 5.2 No Cooldowns (Decided)
- Abilities have no cooldowns. An ability can be used on any turn.
- Action cost is therefore the main thing that prices an ability's power. Strong abilities must cost more ticks (or be delayed actions). Low-cost abilities must be roughly comparable in power to each other, or the strongest cheap ability will be used every turn.

### 5.3 Rationale
- Fixed costs make every action's timing consequences readable and context-free.
- Including movement in turn cost means moving and acting in the same turn always costs more than doing only one, so fast units do not get free repositioning.
- Optional movement and action make every turn a decision about how much time to spend.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Turn order | Shared clock with fixed action costs | Individual initiative, side-based phases, simultaneous commit, semi-real-time, slot-based timeline (see below) | Absolute, context-free costs; no displacement rules; deaths do not affect others; matches Mana Khemia-style timeline |
| Slot-based timeline | Rejected | Units placed into numbered slots (N + cost, or "skip k available slots") | Required many patch rules (collisions, empty slots, push vs join, dependence on unit count N, slot floors). Slow turns could be pushed back indefinitely. The shared clock achieves the same intent with three rules |
| Turn cost | Movement per hex + action cost, with a minimum | Uniform cost per turn | Moving and acting together always costs more; doing nothing still costs time |
| Cooldowns | None | Cooldowns in turns or ticks | Simplicity; action cost prices power instead |
| Ties | Speed, then first scheduled, then fixed order | First scheduled only | Gives speed a clear build role while staying deterministic |
| Speed effect on cost | Percentage, action cost only, capped, round down | Flat reduction; applying to movement | Keeps quick/slow ratios stable; prevents speed dominance; keeps movement a separate lever |
| Speed strength | Cost reduction kept minimal | Removing cost reduction and moving tempo to gear-specific modifiers; limiting speed to certain action categories | Keeps speed meaningful while limiting the universal-stat risk from ticks being a single currency |
| Speed vs defence | Speed weighed against defence (details TBD) | No tradeoff | Gives speed an opportunity cost so it is a build choice, not a default |
| Starting order | Derived from speed | Fixed or random order | Avoids opening ties; rewards speed builds |
| Durations | Measured in ticks | Measured in turns | Consistent regardless of how many units act |
| Action economy | Optional move plus optional single action | Action point pools, card-based actions | Clear and fast to read; card draws would blur whether a loss came from build, play, or luck |

## Open questions (from section 14, original numbers)

1. Cost scale and values: typical, quick and slow action costs; `moveCostPerHex`; `minimumTurnCost`.
2. Speed stat to `speedModifier` mapping, and the exact cap (kept small, at or below 10% to 15%).
   - Speed versus defence mechanism: gear weight lowering speed, or competing stats on gear (section 4.5).
   - Whether tick-based durations over-reward speed, and if so, whether buffs should be measured in the affected unit's own turns instead (section 4.6).
3. Starting offset formula details.
4. Fixed fallback order for ties.
5. Knockback lock limit: which mechanism (section 3.6).
6. Delayed actions: which abilities are delayed, and whether they can be interrupted (section 3.7).
7. Scheduling of units that enter mid-combat (section 3.8).
8. Order of move and action within a turn, and maximum movement per turn.
28. Whether there is a hard maximum on hexes moved per turn.
