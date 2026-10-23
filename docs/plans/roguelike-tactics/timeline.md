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
Combat runs on a **track** of numbered **slots**. Every unit, and every track entity (3.7), has a card in one slot. The track advances slot by slot; when it reaches a card, that unit or entity takes its turn. After acting, a unit's card is placed further along the track.

**Every action costs `12 − 2 × speed` slots (owner, 2026-10-23, the second rework of the day).** After any turn a unit's card goes that many slots on, Temee's included: speed 3 costs 6, speed 2 costs 8, speed 1 costs 10, and Temee, speed 0, always 12. What a unit does on its turn (an ability, a move, a Hold) doesn't change the cost, so a faster unit simply acts more often. Temee's card is placed like any other; its walk toward the exit is still the fight's clock ([camel.md](camel.md)).

This model keeps the visible card track of Mana Khemia and Final Fantasy X. Earlier on 2026-10-23 the track was paced by Temee, with every unit acting once in each of its rounds; before that, every action had its own cost ([history.md](history.md)).

### 3.2 Placement (Decided 2026-10-23)
After a unit's turn, its card goes to:
```
slot = current slot + actionBase − speedSlots × speed      (actionBase = 12, speedSlots = 2)
```
- The same for every turn: an ability, a move, a Hold, or a skipped turn (Stunned, or nothing to do but Hold).
- **Temee's card** follows the same rule, whether it stepped or waited: speed 0 (owner, 2026-10-23), so always 12 slots.
- Speed runs 1 to 3 for the heroes (9.1), so costs run 6 to 10; a cost is never less than 1 slot. Cards that land on a taken slot yield (3.3).

### 3.3 Collisions (Decided)
**Two cards never share a slot.** A card placed on an occupied slot **yields**: it moves to the next free slot, and further if that one is taken (a cascade). Cards already on the track never move because of another card's placement.

Cards placed at the same moment (combat start, or one effect moving several cards) are placed higher speed first. Cards of equal speed are placed the player's side first, then the enemy's, each in party slot order (owner, 2026-10-23; was a random order drawn from the fight's seed from 2026-10-21, and alternating sides before that).

### 3.4 Starting Positions (Decided 2026-10-23)
Every card but Temee's is placed from **slot 0** in the simultaneous order (3.3): the highest speed first, ties the player's side first. Cards of the same speed sit side by side; **one free slot** separates one speed from the next. **Temee acts last**, at **slot 12**, whatever its speed (owner, 2026-10-23; it started first, at slot 0, from 2026-10-21); should the other cards ever reach slot 12, its card goes just after them.

For example, two Outriders (speed 3) and four speed-2 units start at slots 0 and 1, then 3, 4, 5 and 6, and Temee at 12.

### 3.5 Delay, Haste and Track Manipulation (Decided)
Terminology (owner, 2026-10-23): **Delay** moves a card later on the track and **Haste** earlier; **Push**, **Pull** and **Move** move a unit across the board (keywords in [keywords.md](keywords.md)). Delay and Haste never mean the board.
- Abilities may **Delay** a card by a stated number of slots: an enemy's, an ally's, or a track entity's (3.7).
- Abilities may **Haste** a card, never earlier than the next slot, within a haste limit ([keywords.md](keywords.md), 17.3).
- A Delayed or Hastened card that lands on an occupied slot yields (3.3).
- **Inevitable** cards can't be Delayed or Hastened.
- No current ability Delays or Hastens (2026-10-23); none is built.

### 3.6 Delay Limit (Decided, value TBD)
Repeated Delays could keep a unit from ever acting. Mana Khemia was criticized for exactly this, and in PvP it becomes a lockout loop. A card can be moved later by at most a set number of slots in total between two of its own turns, counting Delay and any yielding that follows it. A skipped turn counts as a turn and resets the limit ([keywords.md](keywords.md), 17.5). Further Delays are reduced to fit, and the preview shows the reduced amount. Value TBD (10 on the old track).

### 3.7 Track Entities (Proposed)
Some abilities may place a separate card on the track that acts independently of the character, for example a summoned zombie. The entity takes its own turns from its own card, placed by its own speed like any unit's (3.2). Track entities occupy slots and follow the collision (3.3) and Delay and Haste (3.5) rules like any card. None is built.

Charged abilities and ultimates were removed on 2026-10-23 with action costs ([history.md](history.md)).

### 3.8 New Units (Proposed)
Units that enter mid-combat (summons, reinforcements) are placed by the placement rule (3.2) from the current slot, and yield like any card (3.3). TBD.

Reinforcements (Decided): their arrival is shown on the track in advance, with a known arrival slot and spawn location (section 7.4).

### 3.9 Durations and Effects Over Time (Decided)
- An effect lasts as its source states: a number of slots, until something happens (hail until its caster's next turn), or always. Effects **do not occupy slots** and are not cards.
- An effect that acts over time acts at a stated moment: Burn at the start of each of the unit's turns ([keywords.md](keywords.md), 17.6).
- A duration in slots that ends on the slot of the affected unit's turn **expires after that unit acts**, so it still covers that turn.

## 4. Speed

Speed sets a unit's action cost (3.2), its starting slot (3.4), and the order of cards placed at the same moment (3.3). A faster unit acts more often: speed 3 acts every 6 slots, speed 2 every 8, speed 1 every 10, Temee (speed 0) every 12.

### 4.1 Granularity (Decided 2026-10-23)
Speed is a small whole number (1 to 3 for the prototype heroes, 9.1); each point takes 2 slots off the action cost. Equal speeds are told apart only by yielding (3.3).

### 4.2 Speed Versus Defence (Decided in principle, details TBD)
- Speed is weighed against defence: gear that provides more defence reduces speed, or speed and defence compete for the same gear budget. Taking speed means giving up protection, and the reverse.
- Mechanism TBD. Options include gear weight (mainly from the armour slot) that lowers speed, or speed and defence as competing stats on the same gear.

### 4.3 Rationale
- One cost per unit makes the track readable at a glance: a unit's next turn is always the same distance away.
- Speed is worth taking: a speed-3 unit gets five turns for every three of a speed-1 unit.

## 5. Action Economy

### 5.1 Rules (Decided)
On its turn, a unit:
- **must use one action** (an ability or Hold), which ends its turn, or
- **may walk instead of using an ability:** up to **3 spaces** (owner, 2026-10-22), with allies and enemies blocking the path, and hail stopping it where it enters.

Every hero has **Hold**, an action with no effect, so a unit can always end its turn. Walking and an ability cannot share a turn (2026-10-20). Whatever the unit does, its card is placed the same way (3.2).

### 5.2 No Cooldowns (Decided)
- Abilities have no cooldowns. An ability can be used on any turn.
- With every turn placed the same since 2026-10-23, nothing prices one ability above another on the track: a strong ability must be balanced by its effect, its reach or what it needs (Throw needs a grapple).

### 5.3 Rationale
- One placement for every action makes every turn's timing obvious: the only timing choice is what to do with the turn, not how much to spend.
- Movement is capped to keep one turn's repositioning bounded.
- Requiring an action keeps one decision per turn.

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Turn order (2026-10-23) | A track of slots; after any turn a card goes 12 − 2 × speed slots on, Temee's included | Temee pacing the track, everyone acting once in each of its rounds (earlier on 2026-10-23); placement = cost ÷ (speed + C) (until 2026-10-23); individual initiative, side-based phases, simultaneous commit, semi-real-time | Owner's call |
| Starting order (2026-10-23) | From slot 0, fastest first, ties the player's first; equal speeds side by side, a free slot between speeds; Temee last, at slot 12 | Temee first at slot 0, the rest 20 − 2 × speed spaced by one slot (earlier on 2026-10-23) | Owner's call |
| Collisions | The arriving card yields to the next free slot; cascades | Speed-first tie-break bumping the incumbent; units sharing a slot | Cards on the track never move because of another placement, so plans stay stable and bump-locking is impossible |
| Speed (2026-10-23) | Sets the action cost (12 − 2 × speed), the starting slot and simultaneous-placement order | A place in each of Temee's rounds (earlier on 2026-10-23); dividing action and movement cost (until 2026-10-23) | Owner's call, with the track |
| Speed vs defence | Speed weighed against defence (details TBD) | No tradeoff | Gives speed an opportunity cost so it is a build choice, not a default |
| Charged abilities (removed 2026-10-23) | None: with no action costs there is no charge or recovery cost | Charge cost then trigger then recovery cost, on the character's own card (until 2026-10-23) | Owner's call: removed with the parked kits |
| Track entities | Some abilities place independent cards (for example summons); activation costs an action | Only units on the track | Summons and similar effects act on their own timeline and can be manipulated like units |
| Ultimates (removed 2026-10-23) | None | Unlocked after action cost spent, once per combat (until 2026-10-23) | Owner's call: removed with action costs and the parked kits |
| Movement | One move per turn, capped by a single global value (3) | Unlimited movement with exponential cost per hex; a cost per hex (until 2026-10-23); a cap based on speed; a per-hero cap modified by gear | A cap prevents strikes across the map; one global value keeps speed from also setting reach, for now |
| Turns | An action is required to end a turn; every hero has Hold, an action with no effect | Move-only and wait turns with a minimum cost; each hero's cheapest real ability as the fallback | One decision per turn |
| Delay limit | Cap on total Delay between a card's own turns (Push limit until 2026-10-23) | Diminishing returns on repeated Delays; a guaranteed turn after a set delay | Simple, previewable, and prevents lockout |
| Haste | No earlier than the next slot (Pull until 2026-10-23) | Moving a card to any earlier slot | Cannot skip the track; as Final Fantasy Tactics' Quick |
| Effects over time | Do not occupy slots; each lasts and acts as its source states (Burn at the start of the unit's turns) | Effects as track entries; acting at the beginning of slots (until 2026-10-23) | Keeps the track for cards; each effect stays exact and previewable |
| Cooldowns | None | Cooldowns in turns or slots | Simplicity |

## Open questions (original numbers)

1. The base action cost (`actionBase`, 12) and slots per point of speed (`speedSlots`, 2) Default size of the visible track window (roughly 30 slots).
2. Speed versus defence mechanism: gear weight lowering speed, or competing stats on gear (4.2).
5. Delay and haste limit values (3.6).
7. Scheduling of units and track entities that enter mid-combat (3.8).
28. The maximum number of spaces moved per turn.
