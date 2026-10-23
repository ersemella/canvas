# Roguelike tactics: keywords and effects

The keyword vocabulary (10.8): track and board effects, control, and
damage modifiers that abilities, gear and upgrades all reference.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

**Reworked by the owner on 2026-10-23**, with the stats (9.1): the list
below replaces the one of 2026-10-16 (Push and Pull for the track,
Displace for the board, Dazed, Slowed, Taunt, Stealth, Vulnerable,
Barrier, Lifesteal, Obscured, healing effects, Cleanse and Dispel), which
is in [history.md](history.md). Several are renames: track Push is now
**Delay**, track Pull **Haste**, Displace **Push**, **Pull** or **Move**,
and Barrier **Shield**.

**Built (2026-10-23):** Immobilized, Stunned and Move, which the three
prototype heroes' kits use (Hail, Grapple, Throw; [roster.md](roster.md)).
The others are defined here and built when an ability uses them.

## 17. Keywords and Effects

### 17.1 The list (Decided 2026-10-23)

| Group | Keywords |
|---|---|
| Track | Delay, Haste, Inevitable |
| Board | Push, Pull, Move, Immobilized, Unstoppable |
| Control | Stunned |
| Damage | Burn, Shield, Pierce, Enhance, Degrade, Armour, Immortal |

**Terms (Decided):** **Delay** and **Haste** always mean the **track**
(moving a card later or earlier). **Push**, **Pull** and **Move** always
mean the **board** (putting a unit on a different space); together they
are **displacement**. A unit **moves** when it walks by itself on its
turn; it **is Moved** (capitalized, the keyword) when something else
puts it on another space.

### 17.2 Shared rules (Decided)
- **Every effect is public** (D11): every status, what holds it on and its
  strength are shown on the unit's stat sheet and marked on the board.
  Previews include every effect.
- **A status lasts as long as its source says.** It may last a number of
  slots, until something happens (Hail's Immobilized until the hail
  disappears, Grapple's Stunned until the grapple ends), or as a passive,
  always. A duration in slots that ends on the affected unit's turn
  covers that turn (3.9).
- **The same status twice:** the source states how it combines with one
  already on the unit (add, replace, or keep the stronger). Different
  statuses always combine.
- **Effect values are fixed by their source.** No stat scales a keyword:
  Burn, Shield, Delay and Haste slots, displacement distances, Enhance,
  Degrade and Armour keep the value the ability, gear or upgrade states.
  Gear and milestone upgrades change them directly (9.7, 10.9). Power is
  an ability's own damage (9.2), nothing else.
- **A keyword can be an ability property, a status or a passive.** Pierce
  is usually a property of an attack ("this attack Pierces"), but a buff
  can grant it for a time; Inevitable, Unstoppable and Armour can be a
  hero's passive. The keyword means the same in each.

### 17.3 Track effects (Decided)

| Keyword | Rule |
|---|---|
| **Delay N** | Moves the unit's card N slots later on the track. A taken slot makes it yield to the next free one, cascading (3.3). Within the delay limit (3.6). |
| **Haste N** | Moves the unit's card N slots earlier, never earlier than the next slot. A taken slot makes it yield to the next free one after it (3.3). Within a haste limit, like the delay limit (value TBD). |
| **Inevitable** | The unit's card can't be Delayed or Hastened, by allies or enemies. It still yields when placed after its own turn (3.3). |

**Why limits:** without one, repeated Delays could keep a unit from ever
acting (a lockout loop in PvP), and Hastening an ally right after its turn
could give it extra turns. Both limits are previewable budgets per card
between its own turns.

### 17.4 Board effects (Decided)

| Keyword | Rule |
|---|---|
| **Push N** | Displaces the unit N spaces directly away from the source (along the hex direction from the source to the unit; for an area, away from its centre). |
| **Pull N** | Displaces the unit N spaces directly toward the source. Ending next to the source is not a collision. |
| **Move** | Displaces the unit to a space the ability states (Throw: a free space next to the Champion). |
| **Immobilized** | The unit can't move to a different space by itself: no walking on its turn, and no ability that moves it (none does since Grapple became melee, 2026-10-23). It **still acts** with any ability that doesn't move it, and it **can still be Pushed, Pulled or Moved** by others. |
| **Unstoppable** | The unit can't be Pushed, Pulled or Immobilized, by allies or enemies. (Whether it can be Moved is open question 54.) |

- **Displacement is instant:** it resolves completely when the ability
  resolves; nothing happens part-way through it.
- **Entering a space by displacement triggers it** as walking in does
  (hail Immobilizes a unit Moved into it).
- **Stopped early:** a Push or Pull that meets ruins, another unit or the
  map's edge stops there. Whether that deals collision damage is TBD
  (open question 55; collision damage was 20 on the old scale).
- **Several units displaced at once** move one at a time: for Push, the
  unit farthest from the centre first; for Pull, the nearest first. Ties
  follow the fixed order for cards placed at the same moment (3.3).

### 17.5 Control (Decided)

| Keyword | Rule |
|---|---|
| **Stunned** | The unit can't take any action, moving included: its turn comes up and is skipped, its card placed as after any turn (3.2). |

Immobilized (17.4) is the lesser control: the unit still acts.

**A skipped turn is still a turn:** it resets the delay and haste limits,
and the unit's card is placed by the usual rule, so Stunned costs a turn,
not a place on the track. Stunned has **no lockout guard** for now
(owner, 2026-10-23): a Bökh Champion can hold a unit Stunned turn after
turn while its grapple lasts. Its counters are the grapple's own ends:
damaging the Champion, Stunning it, or moving either unit apart. Whether
a guard is needed is open question 56.

### 17.6 Damage effects (Decided)

| Keyword | Rule |
|---|---|
| **Burn N** | The unit takes N damage at the start of each of its turns while it lasts. |
| **Shield N** | A separate pool of N, reduced before health. Damage the Shield can't absorb carries on to health. |
| **Pierce** | The attack's damage ignores Armour. |
| **Enhance N** | The unit's abilities deal N more damage. |
| **Degrade N** | The unit's abilities deal N less damage, to at least 0. |
| **Armour N** | Damage the unit takes is reduced by N, to at least 0. A flat reduction, not a percentage. |
| **Immortal** | The unit's health can't be reduced: damage that reaches health becomes 0. Damage still reduces and breaks its Shield. |

**Damage order (Decided 2026-10-23):**
1. The ability's damage: its user's **power** (9.2), plus Enhance, minus
   Degrade, at least 0.
2. Minus the target's **Armour**, unless the attack **Pierces**; at least 0.
3. The target's **Shield** takes it first; what it can't absorb goes on.
4. **Health** takes the rest, unless the target is **Immortal**.

There is no minimum damage: 0 is 0, and an ability with power 0 (the
Storm Caller's Hail) deals none. Burn enters at step 2 (Armour applies
unless the Burn Pierces; TBD, open question 57).

### 17.7 Rationale
- Each keyword bends one rule (the track, the board, the damage order)
  rather than adding a system, matching the enemy design principle (11.1).
- Each has a counter in the list: Inevitable against Delay and Haste,
  Unstoppable against displacement and Immobilized, Pierce against
  Armour, Degrade against Enhance, damage (to break a grapple) and
  Stunned against Stunned.
- Small whole numbers (9.1) make every effect countable at a glance:
  Armour 1 against a power-2 bow halves it.

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Effect list (2026-10-23) | Delay, Haste, Inevitable, Push, Pull, Move, Immobilized, Unstoppable, Stunned, Burn, Shield, Pierce, Enhance, Degrade, Armour, Immortal | The 2026-10-16 list ([history.md](history.md)) | Owner's call, with the stats' rework: fewer keywords, each a small whole number or a plain rule |
| Terms (2026-10-23) | **Delay** and **Haste** for the track; **Push**, **Pull** and **Move** for the board | Push and Pull for the track, Displace for the board (2026-10-16) | Owner's call: Push and Pull read as the board in plain speech |
| Shield (2026-10-23) | A separate pool before health; what it can't absorb carries on to health | Barrier: the hit that spent it was absorbed whole, its excess lost (2026-10-22) | Owner's call ("reduced before affecting HP") |
| Armour (2026-10-23) | A flat reduction, Pierce ignoring it; defence only sets health | Defence as a percentage reduction (9.1, until 2026-10-23) | Owner's call: with damage of 1 or 2, a percentage rounds away |
| Immobilized (2026-10-19, kept) | The unit can't move by itself but still acts, and can still be displaced | Immobilized preventing displacement too | Owner's call (2026-10-19); Unstoppable is the answer to displacement. The 2026-10-23 wording ("cannot move to a different space") is read the same way; see open question 54 |
| Stunned (2026-10-23) | No action and no move: the turn is skipped | Dazed: no action but movement allowed, with a one-turn lockout guard | Owner's call; Grapple's hold |

## Open questions (original numbers continue from 53)

41. Delay and haste limit values, and whether they share one budget.
54. Whether Unstoppable also resists Move, and whether Immobilized (as
    read here) should also stop others displacing the unit.
55. Collision damage when a Push or Pull is stopped early (none is built:
    no current ability Pushes or Pulls).
56. Whether Stunned needs a lockout guard, as Dazed had.
57. Whether Armour applies to Burn.
