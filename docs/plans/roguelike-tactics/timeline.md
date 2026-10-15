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
   turnCost     = max(minimumTurnCost, hexesMoved × moveCostPerHex + actionCost)
   ```
   - `actionCost` is 0 if the unit used no action.
   - Speed does not change turn cost (section 4). *(Revised 2026-10-15, owner: coarse whole-number ticks; speed no longer reduces action cost.)*
4. No other unit's `nextTurnTick` changes as a result of a unit's own turn cost. A quick turn simply lands earlier on the clock; it does not displace anyone.
5. Deaths remove the unit from the clock. No other unit is affected.

### 3.3 Costs (Decided, values TBD)
*(Revised 2026-10-15, owner: ticks are coarse and visually representable, replacing the fine-grained scale of draft v1.7.)*

- **Ticks are whole numbers.** Every cost, duration and offset is a whole number of ticks.
- Every action has a **fixed, public action cost**. The same ability always costs the same ticks in every combat.
- **Coarse scale, visually representable.** The timeline is drawn as one pip per tick (7.1), so players can count costs directly. Illustrative scale, for tuning later: typical action = 10, quick action = 6, slow action = 15, movement = 1 per hex, minimum turn cost = about 3.
- `minimumTurnCost` ensures a turn where the unit does nothing still costs time, and prevents near-free turns from chaining. Value TBD (about 3).
- `moveCostPerHex` may be modified by unit or gear. TBD.
- **Consequences of the coarse scale:**
  - **Ties are common rather than rare.** The tie rules (3.4) decide turns often. Accepted because they are deterministic and the timeline shows the resolved order.
  - **Movement is relatively expensive:** 4 hexes cost 40% of a typical action. This supports "rushing in costs time" (6.6) but favours short moves on compact maps. A typical action of 12 would soften this (open question 1).

### 3.4 Ties (Decided)
When two or more units have the same `nextTurnTick`, resolve in this order:
1. **Higher speed acts first.** Speed here means the unit's final speed stat after gear.
2. **If speed is equal, first scheduled acts first.** The unit whose `nextTurnTick` was set to that value earlier keeps its place.
3. **If still tied** (units scheduled at the same moment, such as at combat start or by a single effect pushing several units), use a fixed order: alternate between sides, then party slot order. Exact fixed order TBD.

Note: because speed is checked first, a faster unit landing on a slower unit's tick acts before it. This is an intended build reward. The timeline preview must always show the resolved order.

*(Revised 2026-10-15, owner:)* with coarse ticks (3.3), ties are common, so this order decides turns often and speed, as the first tie-breaker, matters a lot. That is acceptable because the order is deterministic and shown on the timeline.

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
Units that enter mid-combat (summons, reinforcements) are scheduled at `currentTick`, plus a starting offset if per-tier offsets are adopted for combat start (section 4.1). TBD.

Reinforcements (Decided): their arrival is shown on the timeline in advance as a scheduled entry, with a known arrival tick and spawn location (section 7.4).

### 3.9 Durations (Decided)
All durations (buffs, debuffs, damage over time) are measured in whole ticks on the shared clock, on the same scale as costs (3.3). A duration of 20 ticks expires 20 ticks after it was applied, regardless of how many turns occur in between.

## 4. Speed

*(Revised 2026-10-15, owner: speed now only sets starting order and acts as the first tie-breaker. It no longer reduces action cost; the percentage reduction, its cap and its rounding rules (draft v1.7's 4.3 and 4.4) are removed. See the decision log.)*

### 4.1 Starting Order (Proposed, not final)
- **Proposed:** all units start at tick 0, and the tie rules (3.4) decide the opening order, so higher speed acts first.
- **Alternative:** a small whole-tick starting offset per speed tier, so faster tiers start earlier.
- Either way, higher speed gives an earlier first turn. Method open (open question 3).

### 4.2 Tie-breaking (Decided)
See section 3.4. Speed is the first tie-breaker. With coarse ticks, ties are common, so this is now speed's main effect during a fight.

### 4.3 No Action Cost Reduction (Decided)
- Speed does **not** reduce action cost or movement cost. Turn cost is `max(minimumTurnCost, hexesMoved × moveCostPerHex + actionCost)` (3.2).
- A percentage reduction would round to 0 on quick actions at the coarse scale (3.3), and a flat per-tier reduction was considered and not adopted, in favour of simplicity (see the decision log).

### 4.4 Whole Ticks (Decided)
- All tick values are whole numbers (3.3). No speed modifier, cap or rounding rule applies to costs.
- **Minimum turn cost** (section 3.3) applies to the sum of movement and action cost.

### 4.5 Speed Versus Defence (Decided in principle, details TBD)
- Speed is weighed against defence: gear that provides more defence reduces speed, or speed and defence compete for the same gear budget. Taking speed means giving up protection, and the reverse.
- Mechanism TBD. Options include gear weight (mainly from the armour slot) that lowers speed, similar to Tactics Ogre where equipment weight increases recovery time, or speed and defence as competing stats on the same gear.
- *(Revised 2026-10-15, owner:)* the tradeoff still applies. Speed now buys starting order and tie-breaks rather than cheaper actions, so giving up speed for defence means acting later in ties, not paying more ticks.

### 4.6 Rationale: Speed as a Universal Stat
*(Revised 2026-10-15, owner: rewritten for speed without cost reduction.)*
- Draft v1.7's concern: ticks are a single currency, so any action cost reduction from speed benefits every build and pushes speed toward being universally desirable. Speed no longer reduces cost, which removes that route to dominance.
- Speed's value now comes from **starting order and tie-breaking**. Because ties are common at the coarse scale (3.3), speed still matters a lot. The speed versus defence tradeoff (4.5) remains its opportunity cost.
- Durations in ticks (3.9) no longer favour fast units: speed does not change how often a unit acts, only its order within a tick.

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
| Tick scale | Coarse whole-number ticks (typical action about 10); timeline drawn one pip per tick (revised 2026-10-15) | Fine-grained scale with a typical action around 100 (draft v1.7) | The fine scale was rejected because ticks could not be shown visually; coarse ticks let players count costs on the timeline. Ties become common, accepted as deterministic and shown |
| Ties | Speed, then first scheduled, then fixed order | First scheduled only | Gives speed a clear build role while staying deterministic; with coarse ticks, ties are common and this order decides turns often |
| Speed effect on cost | None: speed sets starting order and breaks ties only (revised 2026-10-15) | Percentage reduction of action cost, capped and rounded down (draft v1.7); flat per-tier reduction; applying to movement | The percentage reduction was rejected because at the coarse scale it rounds to 0 on quick actions; a flat per-tier reduction was considered and not adopted, in favour of simplicity |
| Speed strength | Order and ties only (revised 2026-10-15) | Cost reduction kept minimal (draft v1.7); moving tempo to gear-specific modifiers; limiting speed to certain action categories | Removes the universal-stat risk of cost reduction; speed still matters because ties are frequent |
| Speed vs defence | Speed weighed against defence (details TBD) | No tradeoff | Gives speed an opportunity cost so it is a build choice, not a default |
| Starting order | Proposed, not final: all units at tick 0, tie rules decide (revised 2026-10-15) | Small whole-tick offset per speed tier; offset from a percentage speed formula (draft v1.7); fixed or random order | Rewards speed builds through the tie rules without a formula; per-tier offsets remain the alternative |
| Durations | Measured in ticks | Measured in turns | Consistent regardless of how many units act |
| Action economy | Optional move plus optional single action | Action point pools, card-based actions | Clear and fast to read; card draws would blur whether a loss came from build, play, or luck |

## Open questions (from section 14, original numbers)

1. Cost scale and values: typical, quick and slow action costs; `moveCostPerHex`; `minimumTurnCost`.
   - *(Revised 2026-10-15)* Scale now coarse (3.3). Still open: the exact typical action cost, 10 or 12 (12 softens movement cost).
   - *(Added 2026-10-15)* Size of the visible timeline window (roughly the next 30 ticks, 7.1).
2. ~~Speed stat to `speedModifier` mapping, and the exact cap.~~ Removed 2026-10-15: speed no longer reduces cost (4.3).
   - Speed versus defence mechanism: gear weight lowering speed, or competing stats on gear (section 4.5).
   - ~~Whether tick-based durations over-reward speed.~~ Resolved 2026-10-15: speed no longer changes how often a unit acts (4.6).
3. Starting order method: all units at tick 0 with the tie rules deciding, or a small whole-tick offset per speed tier (4.1). *(Revised 2026-10-15; was "starting offset formula details".)*
4. Fixed fallback order for ties.
5. Knockback lock limit: which mechanism (section 3.6).
6. Delayed actions: which abilities are delayed, and whether they can be interrupted (section 3.7).
7. Scheduling of units that enter mid-combat (section 3.8).
8. Order of move and action within a turn, and maximum movement per turn.
28. Whether there is a hard maximum on hexes moved per turn.
