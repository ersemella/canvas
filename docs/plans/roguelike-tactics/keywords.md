# Roguelike tactics: keywords and effects

The keyword vocabulary (10.8): statuses, track and board effects, damage
and health modifiers, and stat changes that abilities, gear and upgrades
all reference.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's. Phase 1 uses only
Displace, Push, Burn, Barrier and On-flank
([phase-1-brief.md](phase-1-brief.md), section 3); everything else here is
for later phases.

## 17. Keywords and Effects

### 17.1 The list (Decided 2026-10-16)

| Group | Effects |
|---|---|
| Track | Push, Pull, Swap, Inevitable |
| Board | Displace, Unstoppable |
| Control | Immobilized, Dazed, Slowed, Taunt, Stealth |
| Damage | Burn, Pierce, Lifesteal, Vulnerable, Barrier, Immortal |
| Health | Heal, Overhealth, Antiheal, Cursed |
| Removal | Cleanse, Dispel |
| Stats | Speed, power and defence up or down |

**Terms (Decided):** **Push** and **Pull** always mean the **track**
(moving a card later or earlier); **Displace** always means the **board**
(moving a unit to another hex). On-flank (Phase 1) stays in the
vocabulary. Guard (Phase 1 draft) is removed; Barrier replaces it.

### 17.2 Shared rules (Decided)
- **Durations are in slots** (3.9), not turns: "for N ticks" in an effect's
  description means N slots. A duration that ends on the affected unit's
  turn expires after it acts (3.9).
- **Repeated statuses: the source decides how they combine.** Whatever
  applies a status (an ability, gear, an upgrade, flanking) states how it
  combines with applications of the same status already on the target:
  - **Additive:** the values add while both run (Vulnerable 30% and 15%
    give 45%).
  - **Multiplicative:** the multipliers multiply (Vulnerable 30% and 15%
    give ×1.3 × 1.15, so 49.5%).
  - **Replace:** the new application removes the existing ones.
  - **Max:** only the strongest applies; when it expires, the next
    strongest still running takes over (Vulnerable 30% for 5 slots and
    15% for 20 slots give 30% for 5 slots, then 15% for 15).
  Except under Replace, every application runs its own duration. For a
  status with no strength (Immobilized, Taunt, Stealth and others), the modes
  apply to duration: additive extends it, max keeps the longest.
  Different statuses always combine. The preview shows the combined
  result.
- **Complete information** (D11): every status, its strength and its
  remaining slots is public, shown as a marker on the card with exact
  slots in the tap preview (7.1). Previews include every effect.
- **Effect values are fixed by their source (Decided 2026-10-18).** No
  stat scales a keyword effect: Burn, Barrier, overhealth, Cursed,
  collision damage, Push and Pull slots, Displace distances, stat
  changes, Vulnerable, Slowed and every duration keep the value the
  ability, gear or upgrade states. Gear and milestone upgrades change
  them directly ([heroes-and-gear.md](heroes-and-gear.md), 9.7, 10.9).
  **Power** scales only an ability's own base damage and base healing
  (a Heal the ability itself states), not a Heal added by gear or an
  upgrade (9.2). Influence, which scaled effect values, was folded into
  power ([history.md](history.md)).
- **An effect can be an ability property or a status.** Pierce and
  Lifesteal are usually properties of an attack ("Pierce: this attack
  ignores defence"), but a buff can grant them for a duration ("your
  attacks pierce for 10 slots"). The keyword means the same in both.

### 17.3 Track effects (Decided)

| Keyword | Rule |
|---|---|
| **Push N** | Moves the target's card N slots later; yields if that slot is taken; within the push limit (3.5, 3.6). |
| **Pull N** | Moves the target's card N slots earlier, never earlier than the next slot (3.5). Yields **forward** (later) if that slot is taken. Within a **pull limit**: a card can be moved earlier by at most a set number of slots in total between two of its own turns; further pulls are reduced to fit and the preview shows it. Value TBD (default to match the push limit: 10). |
| **Swap** | Two cards exchange slots. The card moved later spends the distance from its push budget, the card moved earlier from its pull budget; if either budget can't cover the whole distance, the swap can't target that pair (a swap can't be reduced to fit). Which two cards (caster and target, or any two in range) is per ability. |
| **Inevitable** | The card can't be moved by Push, Pull or Swap, **from allies and enemies alike**. It still yields when placed after its own turn (3.3). A status with a duration, or a passive on bosses and elites (11.3). |

**Why a pull limit:** without one, pulling an ally right after its turn
gives it an extra turn, and a commander-style support could chain extra
turns for one damage dealer. A limit mirrors the push limit and is just
as previewable.

### 17.4 Board effects (Decided)

| Keyword | Rule |
|---|---|
| **Displace N away** | Moves the target N hexes directly away from the attacker (along the hex direction from attacker to target; for an area centred on a hex, away from that centre). Stopping early at an obstacle, another unit or the map edge deals **20 collision damage** to the displaced unit, and 20 to a unit it hits, ignoring defence. Entering a hazard triggers it. Doesn't move the card. |
| **Displace N toward** | The same, toward the attacker (or the area's centre). Ending adjacent to the attacker is not a collision. |
| **Unstoppable** | Immune to Immobilized and Displace, **from allies and enemies alike**. Doesn't block track effects (Push, Pull, Swap) or Dazed and Slowed. The Mahout Bulwark's passive (it resists Displace but not Push, 15.8) is permanent Unstoppable. |

"Displace N" with no direction means away. Other directions (sideways, to
a chosen hex) can be defined per ability.

- **Displacement is instant:** it resolves completely when the ability
  resolves, so nothing (an Immobilized status, a turn) happens part-way
  through it.
- **An Immobilized unit can still be displaced** (17.5); only
  Unstoppable prevents it.
- **Several units displaced at once** (an area ability) move one at a
  time: for Displace away, the unit farthest from the centre first; for
  Displace toward, the nearest first. Ties follow the fixed order for
  cards placed at the same moment (3.3). Each unit's collisions resolve
  before the next one moves.

### 17.5 Control effects (Decided)
Every turn must use an action (5.1). Losing a turn (Dazed) is modelled
as a **forced Hold**: the unit's card is reached, it takes no action, and
its card moves forward by Hold's cost (60), plus any movement, like any
turn (3.2). The track keeps moving, so control costs the target a turn,
not the fight.

| Keyword | Rule |
|---|---|
| **Immobilized** | The unit can't move: no movement on its turn, and no ability that moves it (a charge, a leap, a dash, swapping hexes) can be used. It **still acts** with any ability that doesn't move it. It **can still be displaced** by allies and enemies, and stays Immobilized where it lands (owner's call, 2026-10-19). Not a lost turn. |
| **Dazed** | On its turn, the unit may move but can't act: a forced Hold, plus any movement cost. |
| **Slowed N** | The unit's movement cap (one global value, 4 in Phase 1) is reduced by N, to at least 1 hex. |
| **Taunt** | While taunted, if the unit can attack the taunter from any hex it can reach this turn, it **must**: its action is an ability that targets the taunter or includes it in its area, or a **Hold** (owner, 2026-10-20): it may wait the taunt out. Other abilities and moving out of reach are not allowed. Only when no reachable hex and no ability can hit the taunter is the unit free. A **charging** unit's ability is redirected to the taunter instead (below). Ends early if the taunter dies. |
| **Stealth** | The unit can't be **targeted** by **hostile** direct or arcing ranged abilities (allies' ranged heals and buffs still reach it). Area abilities centred elsewhere still hit it, melee still targets it, and it still blocks line of fire. Ends when the unit uses a damaging ability. Its identity and position stay visible (D11). Distinct from the conceal tile, which only halves ranged damage. |

**Lockout guard:** Dazed can make a unit lose at most **one turn in a
row**. After a lost turn, the unit can't lose its next turn to Dazed (the
preview shows the immunity). Without this, chained dazes, like chained
pushes (3.6), would be a lockout loop in PvP. Immobilized doesn't need
the guard, since the unit still acts.

**A lost turn resets the push and pull limits** like any turn (3.6,
17.3): a unit can be pushed to the limit, lose a turn, and be pushed to
the limit again, about two turns at most.

**A lost turn doesn't count toward an ultimate** (10.10): only turns the
unit actually takes do, so control never brings an enemy's ultimate
closer.

**Charged abilities:** if a charging unit's trigger turn is lost to
Dazed, **the charge fizzles**: nothing triggers and the card moves by
the recovery cost. This makes Dazed a fourth answer to a visible charge
(with pushing the charger back, killing it, and stepping out of the area).

**Taunt and charged abilities:** a charged ability's target is fixed when
charging starts (3.7), so Taunt is the one effect that changes it. If the
charging unit is taunted when its card is reached, a damaging charged
ability triggers on the **taunter** instead: a single-target ability
targets it, and an area ability is centred on its hex at that moment, as
long as the taunter is within the ability's range from the charger's hex.
Out of range, the original target stands. The preview shows the
redirected target. A tank can taunt a charging area attack onto itself to
shield its allies.

### 17.6 Damage effects (Decided)

| Keyword | Rule |
|---|---|
| **Burn N** | N damage at the beginning of every 3rd slot for 12 slots, ignoring defence (Phase 1). An additive Burn runs on its own schedule alongside any others, each dealing its damage, and the preview lists each one. |
| **Pierce** | The attack's damage skips the defence step. Barrier and Vulnerable still apply. |
| **Lifesteal N%** | The attacker heals N% of the damage it dealt (to health and barrier, after every reduction), rounded down. It is healing: Antiheal blocks it. |
| **Vulnerable N%** | The unit takes N% more damage for a duration. **Being flanked** makes a unit Vulnerable 25% for as long as the flank holds (6.3). |
| **Barrier N** | Absorbs the next N damage the unit would take, after every other reduction, until used up or it expires. Not healing, so Antiheal doesn't block it. |
| **Immortal** | The unit's health can't be reduced: damage to it becomes 0 (no minimum 1), burn included. Displace still moves it; other statuses still apply. Short durations only. |

**Damage order** (extends the Phase 1 order): base × power;
ranged on conceal −50%; **Vulnerable** (including from a flank); defence (skipped by **Pierce**);
minimum 1; **Barrier** absorbs; **Immortal** sets it to 0. Each step
rounds down. Burn and collision damage skip defence as now, then take
Vulnerable, Barrier and Immortal. Hazard (quicksand) damage takes
Vulnerable and defence like a hit (owner, 2026-10-19; it skipped defence
until then); per-slot damage takes Vulnerable slot by slot and defence once
on the total the track passes, so a few points a slot aren't rounded away. This is a stopgap until damage
buckets are settled (open question 37).

### 17.7 Health effects (Decided)

| Keyword | Rule |
|---|---|
| **Heal N** | Restores N health, up to max health. Blocked by Antiheal. |
| **Overhealth** | A heal marked **overheal** lets health exceed max; the excess is **overhealth**, which lasts a set number of slots and then disappears. Damage removes overhealth first (it is health above max). Blocked by Antiheal like any heal. |
| **Antiheal** | The unit can't be healed for a duration: Heal, Lifesteal and overhealth all fail; Barrier still works. |
| **Cursed N** | Max health is lowered by N for a duration. Current health above the new max is lowered to it; when the curse ends, max returns but lost health doesn't. A curse can't take a unit below 1 health. While Immortal, a curse still lowers max health but not current health. Lowering current health to the new max removes any overhealth. |

**Barrier and overhealth are both kept.** Both are a buffer above health;
they differ in what counters them. Antiheal stops overhealth, not
Barrier; Cursed lowers the max that overhealth sits above.

### 17.8 Cleanse and Dispel (Decided 2026-10-16; rules Proposed)
- **Cleanse** removes every **harmful status applied by an ability**
  from the target: Burn (every application), Immobilized, Dazed, Slowed, Taunt,
  Vulnerable, Antiheal, Cursed and stat downs. It doesn't affect
  flanking: Vulnerable from a flank lasts as long as the flank (6.3).
- It doesn't undo what already happened: a Push or Displace already
  applied stays, and health lost to Burn or Cursed isn't restored (Cursed's
  max health returns).
- Cleansing a unit that already lost a turn doesn't reset the lockout
  guard (17.5).
- Beneficial statuses are untouched.
- **Dispel** is the mirror: it removes every **beneficial status** from the
  target: Barrier, overhealth, Immortal, Stealth, stat ups, and
  Unstoppable, Inevitable, Pierce or Lifesteal when granted as a status
  for a duration.
- Dispel doesn't touch **passives** (the Mahout Bulwark's Unstoppable, a
  boss's Inevitable) or **ability properties** (an attack that always
  pierces): only statuses with a duration. It doesn't undo what already
  happened: damage a Barrier absorbed stays absorbed, and a Pull already
  applied stays.
- Harmful statuses are untouched, so Dispel on an ally removes only its
  buffs, and Cleanse on an enemy frees it of the party's control. Every
  ability reaches allies and enemies alike ([map.md](map.md), 6.7), so a
  Cleanse or Dispel in an area hits both sides.

### 17.9 Stat changes (Decided)
- **Speed, power and defence** can be raised or lowered by a
  fixed number of points for a duration, shown on the stat sheet.
- Repeated buffs or debuffs to a stat combine as their source states
  (17.2). Buffs and debuffs on the same stat both apply.
- Floors: speed at least 1 (it divides costs, 3.2); the others at least 0.
- Speed changes take effect at the unit's next placement (3.2): a card
  already on the track doesn't move. Slowed is a movement-cap effect;
  lowering speed is "speed down", to keep the two apart.

### 17.10 Rationale
- Each effect bends an existing rule (track, board, damage formula,
  health) rather than adding a system, matching the enemy design
  principle (11.1).
- Lost turns, pulls and swaps all reuse the push limit's idea: a capped,
  previewable budget per card between its own turns, so no combination
  locks a unit out or gives one unlimited extra turns. That keeps the
  vocabulary PvP-ready (goal 5).
- Each effect has a counter in the list: Inevitable against track control,
  Unstoppable against Displace and Immobilized, Antiheal against healing,
  Pierce against defence, a lost turn against a charged ability, Cleanse
  against harmful statuses, Dispel against beneficial ones.

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Effect list | The owner's list (17.1), plus Phase 1's On-flank, plus Cleanse and Dispel; Guard removed | | Owner's call, 2026-10-16 |
| Terms | **Push** and **Pull** move cards on the track (later, earlier); **Displace** moves units across hexes | Delay and Push (Phase 1 draft); Delay, Boost, Push and Pull | One consistent pair for the track, one word for the board; owner's call |
| Rules | 17.2 to 17.7 and 17.9 as proposed | | Confirmed by the owner, 2026-10-16 |
| Taunt | The unit must attack the taunter if any reachable hex allows it, or Hold; a charged ability is redirected to the taunter | Can't be dodged, not even by Hold (until 2026-10-20); dodged by Hold or any non-damaging ability | Owner's call, 2026-10-20: Holding to wait it out tones down the Bökh Champion's Pin, its only source (Pin 56% of the Champion's AI turns → 47%, with Pin's damage lowered); redirecting a charge gives Taunt a use no other effect has |
| Burn | Combines as its source states, like every status; additive Burns each deal their damage | Always stacks; a new Burn replaces a weaker one | Owner's call; follows the source-defined rule |
| Barrier and overhealth | Both kept | Merged into Barrier | Owner's call; different counters |
| Removal | Cleanse removes harmful statuses; Dispel, a separate effect, removes beneficial ones; neither touches passives | One effect removing both; no removal | Owner's call; each is a clear counter with an obvious target |
| Same status twice | The source states how it combines: additive, multiplicative, replace or max; each application runs its own duration except under replace | One global rule (strongest replaces weaker; then strongest applies at a time); Burn as the only stacking status | Owner's call: how an effect combines is part of its design, and a lever for gear and upgrades |
| Lost turns and budgets | A lost turn resets the push and pull limits like any turn | Budgets carry over a lost turn | Owner's call; the longest legal lockout is about two turns |
| Lost turns | Don't count toward ultimates | Counting every turn | Control shouldn't bring an enemy's ultimate closer; owner's call |
| Immobilized | Replaces Frozen: removes movement, including abilities that move the unit; the unit still acts and can still be displaced (2026-10-19) | Frozen: no movement and no action, a lost turn; Immobilized also preventing displacement (until 2026-10-19) | Owner's call; Dazed already covers losing a turn; displacing a held unit gives the Bökh Champion's Pin then Throw its flow, and leaves Unstoppable as the one answer to Displace |
| Guard | Removed; Barrier covers damage protection | Keeping both | Owner's call: outdated |
| Charged abilities | Fizzle on a lost trigger turn | Trigger anyway | Owner's call; control answers a visible charge |

## Open questions (original numbers continue from 39)

41. Pull limit value, and whether pushes and pulls share one budget.
48. Which effects are statuses (with durations), which ability properties, and which hero passives.
