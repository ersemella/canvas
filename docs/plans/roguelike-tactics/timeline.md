# Roguelike tactics: turn order, speed and action economy

The track (turn order), speed, and what a unit may do on its turn.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 3. Turn Order: the Track

### 3.1 Summary (Decided)
Combat runs on a **track** of numbered **slots**. Every unit, and every track entity (3.7), has a card in one slot. The track advances slot by slot; when it reaches a card, that unit or entity takes its turn. After acting, a unit's card is placed further along the track by an amount set by what it did and its speed. Cheaper actions and higher speed bring it back sooner.

This model is in the same family as the turn systems of Final Fantasy X (placement from action and speed), Final Fantasy Tactics (charge time) and Mana Khemia (a visible card track), which are the main references.

### 3.2 Placement (Decided)
After a unit's turn, its card moves forward by:
```
slotsForward = roundDown((actionCost + hexesMoved × moveCostPerHex) / (speed + C))
```
- **Costs are fine-grained, the track is coarse.** Every action has a fixed, public action cost (for example a basic attack costs 100). Dividing by `speed + C` turns it into a whole number of slots.
- **Speed divides both the action and the movement cost.**
- `C` is a global constant. It sets how much speed matters: a larger `C` flattens speed's effect. Because speed is in the divisor, each extra point of speed is worth slightly less than the last (diminishing returns). Value TBD; aim for a typical turn landing roughly 8 to 12 slots ahead, so speed changes placement in small steps and a window of about 30 slots shows about three turns.
- A card always moves at least 1 slot. Costs and `C` are tuned so ordinary turns never come close to that floor.
- Rounding discards the remainder.

### 3.3 Collisions (Decided)
**Two cards never share a slot.** A card placed on an occupied slot **yields**: it moves to the next free slot, and further if that one is taken (a cascade). Cards already on the track never move because of another card's placement.

Cards placed at the same moment (combat start, or one effect moving several cards) are placed in a fixed order: higher speed first, then alternating sides starting with the player's side, then party slot order. Exact fixed order TBD.

### 3.4 Starting Positions (Decided)
Each card's first slot uses the same formula as placement (3.2), with a standard starting cost:
```
startSlot = roundDown(startCost / (speed + C))
```
Higher speed starts earlier. Collisions resolve as in 3.3.

### 3.5 Push, Pull and Track Manipulation (Decided)
Terminology: **Push** moves a card later on the track and **Pull** earlier; **Displace** physically moves a unit across hexes (keywords in [keywords.md](keywords.md)). Push and Pull never mean the board.
- Abilities may **push** a card later by a stated number of slots: an enemy's, an ally's, or a track entity's (3.7).
- Abilities may **pull** a card earlier, but never earlier than the next slot, within a pull limit ([keywords.md](keywords.md), 17.3).
- A pushed or pulled card that lands on an occupied slot yields (3.3).

### 3.6 Push Limit (Decided, value TBD)
Repeated pushes could keep a unit from ever acting. Mana Khemia was criticized for exactly this, and in PvP it becomes a lockout loop. A card can be moved later by at most a set number of slots in total between two of its own turns, counting Push and any yielding that follows it. Further pushes are reduced to fit, and the preview shows the reduced amount. Value TBD.

### 3.7 Charged Abilities and Track Entities (Decided)
**Charged abilities.** Some abilities have a **charge cost** and a **recovery cost**.
1. Using one places the character's card forward by the charge cost (3.2), typically small.
2. When that card's turn comes, the ability **triggers immediately**: the character takes no other action and no movement that turn.
3. The card is then placed forward by the recovery cost, typically a standard action cost.

The character's own card is the pending effect, so it is visible and answerable: pushing the character's card delays the effect, and defeating the character prevents it. What the ability targets (a fixed hex or area, or a unit it follows) is defined per ability.

**Track entities.** Some abilities place a separate card on the track that acts independently of the character, for example a summoned zombie. The character pays an action cost to activate it, as for any action. The entity then takes its own turns from its own card, with its own placement rules defined by the ability. Track entities occupy slots and follow the collision (3.3) and push and pull (3.5) rules like any card.

**Ultimates** are each hero's most powerful ability, usable **once per combat**, and only after the hero has completed a set number of turns in the fight, shown publicly (10.10). An ultimate may be an ordinary action, a charged ability or a track entity; that is defined per ultimate. Not every ultimate goes on the track, and not every track entity is an ultimate.

### 3.8 New Units (Proposed)
Units that enter mid-combat (summons, reinforcements) are placed with the starting formula (3.4) counted from the current slot, and yield like any card (3.3). TBD.

Reinforcements (Decided): their arrival is shown on the track in advance, with a known arrival slot and spawn location (section 7.4).

### 3.9 Durations and Effects Over Time (Decided)
- Durations (buffs, debuffs, damage over time) are measured in slots. They **do not occupy slots** and are not cards.
- An effect **takes effect at the beginning of a slot**, before any card on that slot acts. Each effect defines which slots it acts on: every slot of its duration, or every N slots (for example a burn that hits every 3 slots for 12).
- A duration that ends on the slot of the affected unit's turn **expires after that unit acts**, so it still covers that turn.

## 4. Speed

Speed sets how far a unit's card moves after each turn (3.2) and its starting slot (3.4), and decides the order of cards placed at the same moment (3.3).

### 4.1 Granularity (Decided)
Speed divides fine-grained costs, so small changes in speed change placement in small steps, and gear can raise or lower speed by single points with a visible effect. Diminishing returns are built in.

### 4.2 Speed Versus Defence (Decided in principle, details TBD)
- Speed is weighed against defence: gear that provides more defence reduces speed, or speed and defence compete for the same gear budget. Taking speed means giving up protection, and the reverse.
- Mechanism TBD. Options include gear weight (mainly from the armour slot) that lowers speed, similar to Tactics Ogre where equipment weight increases recovery time, or speed and defence as competing stats on the same gear.

### 4.3 Rationale
- Speed affects every turn a unit takes, so it is valuable to every build. The divisor's diminishing returns, the constant `C` and the tradeoff with defence (4.2) keep it from dominating.
- Durations in slots favour fast units slightly: a buff covers more of a fast unit's turns. Accepted; revisit if speed proves too strong.

## 5. Action Economy

### 5.1 Rules (Decided)
On its turn, a unit:
- **must use one action** (an ability, an attack, or a basic action), which ends its turn, and
- **may move once,** up to a maximum number of hexes, each hex adding movement cost. The cap is a single global value, the same for every unit (value TBD).

Every hero has **Hold**, a quick action with no effect, so a unit can always end its turn (cost in [phase-1-brief.md](phase-1-brief.md), section 4).

There are no turns without an action, so every turn has a real cost. The exception is a charged ability's trigger turn (3.7), where the ability resolves and the unit does nothing else.

Order within a turn (move before acting, act before moving, or splitting movement around the action) is TBD.

### 5.2 No Cooldowns (Decided)
- Abilities have no cooldowns. An ability can be used on any turn; ultimates once per combat, after their unlock (3.7).
- Action cost is therefore the main thing that prices an ability's power. Strong abilities must cost more (or be charged abilities). Low-cost abilities must be roughly comparable in power to each other, or the strongest cheap ability will be used every turn.
- **Paying after acting.** A cost is paid after the action resolves, so it prices power only when the unit's next turn matters: a killing blow, the last turns of a fight, or a unit about to die pays little real cost. Handled case by case, per ability: where it matters, the ability is charged (paid before it resolves, 3.7) or priced for it.

### 5.3 Rationale
- Fixed costs make every action's timing consequences readable and context-free.
- Including movement in the cost means moving and acting in the same turn always costs more than acting alone.
- Movement is capped because costs are paid after the turn: without a cap, a unit could cross the map and strike before every unit due in between acts.
- Requiring an action removes near-free turns (stepping or waiting repeatedly to act more often than others).

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Turn order | A track of slots; placement = cost ÷ (speed + C), rounded down | Individual initiative, side-based phases, simultaneous commit, semi-real-time; a clock of whole-number ticks with speed only breaking ties | Costs stay fine-grained while the track stays coarse and countable; speed works in small steps with diminishing returns |
| Collisions | The arriving card yields to the next free slot; cascades | Speed-first tie-break bumping the incumbent; units sharing a slot | Cards on the track never move because of another placement, so plans stay stable and bump-locking is impossible |
| Speed | Divides action and movement cost; sets starting slot and simultaneous-placement order | Speed only for order and ties; percentage reduction of action cost | Granular and tunable, with built-in diminishing returns |
| Speed vs defence | Speed weighed against defence (details TBD) | No tradeoff | Gives speed an opportunity cost so it is a build choice, not a default |
| Charged abilities | Charge cost then trigger then recovery cost, on the character's own card | Delayed actions as separate track entries; immediate resolution | The pending effect is visible and answerable without separate entries or interrupt rules |
| Track entities | Some abilities place independent cards (for example summons); activation costs an action | Only units on the track | Summons and similar effects act on their own timeline and can be manipulated like units |
| Ultimates | Unlocked after a set number of the hero's turns, shown publicly; once per combat; may be an action, a charged ability or a track entity | Usable from the start; charge meter filled by keyword actions | Fights build toward ultimates; a visible unlock is a threat the other side can answer, for example by pushing the hero's card |
| Movement | One move per turn, capped by a single global value; cost per hex divided by speed | Unlimited movement with exponential cost per hex; uncapped linear cost; a cap based on speed; a per-hero cap modified by gear | A cap prevents act-now-pay-later strikes across the map; one global value keeps speed from also setting reach, for now |
| Turns | An action is required to end a turn; every hero has Hold, a quick action with no effect | Move-only and wait turns with a minimum cost; each hero's cheapest real ability as the fallback | No near-free turns to chain |
| Push limit | Cap on total push between a card's own turns | Diminishing returns on repeated pushes; a guaranteed turn after a set delay | Simple, previewable, and prevents lockout |
| Pulls | No earlier than the next slot | Moving a card to any earlier slot | Cannot skip the track; as Final Fantasy Tactics' Quick |
| Effects over time | Do not occupy slots; act at the beginning of a slot, on slots each effect defines; expire after the affected unit acts | Effects as track entries; effects on the affected unit's turns only | Keeps the track for cards; each effect stays exact and previewable |
| Cooldowns | None | Cooldowns in turns or slots | Simplicity; action cost prices power instead |

## Open questions (original numbers)

1. Cost values: typical, quick and slow action costs, `moveCostPerHex`, the starting cost, and `C` (aim: a typical turn 8 to 12 slots ahead). Default size of the visible track window (roughly 30 slots).
2. Speed versus defence mechanism: gear weight lowering speed, or competing stats on gear (4.2).
4. Fixed order for cards placed at the same moment (3.3).
5. Push limit value (3.6).
6. Which abilities are charged, their charge and recovery costs, and what each targets (3.7).
7. Scheduling of units and track entities that enter mid-combat (3.8).
8. Order of move and action within a turn.
28. The maximum number of hexes moved per turn.
