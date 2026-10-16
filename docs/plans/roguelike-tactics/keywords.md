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
Displace, Push, Burn, Guard and On-flank
([phase-1-brief.md](phase-1-brief.md), section 3); everything else here is
for later phases.

## 17. Keywords and Effects

### 17.1 The list (Decided 2026-10-16)

| Group | Effects |
|---|---|
| Track | Push, Pull, Swap, Inevitable |
| Board | Displace, Unstoppable |
| Control | Frozen, Dazed, Slowed, Taunt, Stealth |
| Damage | Burn, Pierce, Lifesteal, Vulnerable, Guard, Barrier, Immortal |
| Health | Heal, Overhealth, Antiheal, Cursed |
| Removal | Cleanse |
| Stats | Speed, power, influence and defence up or down |

**Terms (Decided):** **Push** and **Pull** always mean the **track**
(moving a card later or earlier); **Displace** always means the **board**
(moving a unit to another hex). Guard and On-flank (Phase 1) stay in the
vocabulary.

### 17.2 Shared rules (Decided)
- **Durations are in slots** (3.9), not turns: "for N ticks" in an effect's
  description means N slots. A duration that ends on the affected unit's
  turn expires after it acts (3.9).
- **A status doesn't stack with itself:** applying it again replaces the
  old one if the new one is stronger, or refreshes its duration if equal
  (as Guard). Different statuses always combine. **Exception: Burn
  stacks** (17.6).
- **Complete information** (D11): every status, its strength and its
  remaining slots is public, shown as a marker on the card with exact
  slots in the tap preview (7.1). Previews include every effect.
- **Influence scales magnitude** for values on the ×10 scale (burn, heal,
  barrier, overhealth, cursed) and for Push and Pull slots:
  `effect = roundDown(base × (1 + influence / 50))`. **Small or percentage
  values** (stat changes, Vulnerable, Guard, Slowed) are fixed per
  ability, so rounding doesn't erase them (history: single-digit health);
  influence scales their **duration** instead. Displace distances are
  fixed (Phase 1 rule).
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
| **Inevitable** | The card can't be moved by Push, Pull or Swap, from either side. It still yields when placed after its own turn (3.3). A status with a duration, or a passive on bosses and elites (11.3). |

**Why a pull limit:** without one, pulling an ally right after its turn
gives it an extra turn, and a Strategos-style support could chain extra
turns for one damage dealer. A limit mirrors the push limit and is just
as previewable.

### 17.4 Board effects (Decided)

| Keyword | Rule |
|---|---|
| **Displace N away** | Moves the target N hexes directly away from the attacker (along the hex direction from attacker to target; for an area centred on a hex, away from that centre). Stopping early at an obstacle, another unit or the map edge deals **20 collision damage** to the displaced unit, and 20 to a unit it hits, ignoring defence. Entering a hazard triggers it. Doesn't move the card. |
| **Displace N toward** | The same, toward the attacker (or the area's centre). Ending adjacent to the attacker is not a collision. |
| **Unstoppable** | Immune to Frozen and Displace. Doesn't block track effects (Push, Pull, Swap) or Dazed and Slowed. The Elephant Rider's passive (it resists Displace but not Push, 15.8) is permanent Unstoppable. |

"Displace N" with no direction means away. Other directions (sideways, to
a chosen hex) can be defined per ability.

### 17.5 Control effects (Decided)
Every turn must use an action (5.1). Losing a turn is modelled as a
**forced Hold**: the unit's card is reached, it takes no action, and its
card moves forward by Hold's cost (60) like any turn (3.2). The track
keeps moving, so control costs the target a turn, not the fight.

| Keyword | Rule |
|---|---|
| **Frozen** | On its turn, the unit neither moves nor acts: a forced Hold. |
| **Dazed** | On its turn, the unit may move but can't act: a forced Hold, plus any movement cost. |
| **Slowed N** | The unit's movement cap (one global value, 4 in Phase 1) is reduced by N, to at least 1 hex. |
| **Taunt** | While taunted, if the taunter is a legal target from the hex the unit chose, the unit must use an ability that targets the taunter (or includes it in its area), **or Hold**. Hold is the only way to dodge a taunt. Otherwise the unit is free. Ends early if the taunter dies. |
| **Stealth** | The unit can't be **targeted** by direct or arcing ranged abilities. Area abilities centred elsewhere still hit it, melee still targets it, and it still blocks line of fire. Ends when the unit uses a damaging ability. Its identity and position stay visible (D11). Distinct from the conceal tile, which only halves ranged damage. |

**Lockout guard:** Frozen and Dazed can make a unit lose at most **one
turn in a row**. After a lost turn, the unit can't lose its next turn to
either (the preview shows the immunity). Without this, chained freezes,
like chained pushes (3.6), would be a lockout loop in PvP.

**Charged abilities:** if a charging unit's trigger turn is lost to Frozen
or Dazed, **the charge fizzles**: nothing triggers and the card moves by
the recovery cost. This makes control a fourth answer to a visible charge
(with pushing the charger back, killing it, and stepping out of the area).

### 17.6 Damage effects (Decided)

| Keyword | Rule |
|---|---|
| **Burn N** | N damage at the beginning of every 3rd slot for 12 slots, ignoring defence (Phase 1). **Stacks:** each Burn applied runs on its own schedule alongside any others, and the preview lists each one. |
| **Pierce** | The attack's damage skips the defence step. Guard, Barrier and Vulnerable still apply. |
| **Lifesteal N%** | The attacker heals N% of the damage it dealt (to health and barrier, after every reduction), rounded down. It is healing: Antiheal blocks it. |
| **Vulnerable N%** | The unit takes N% more damage for a duration. The mirror of Guard. |
| **Guard N%** | N% less damage for 10 slots (Phase 1). |
| **Barrier N** | Absorbs the next N damage the unit would take, after every other reduction, until used up or it expires. Not healing, so Antiheal doesn't block it. |
| **Immortal** | The unit's health can't be reduced: damage to it becomes 0 (no minimum 1), burn included. Displace still moves it; other statuses still apply. Short durations only. |

**Damage order** (extends the Phase 1 order): base × power; flank +25%;
ranged on conceal −50%; **Vulnerable**; defence (skipped by **Pierce**);
Guard; minimum 1; **Barrier** absorbs; **Immortal** sets it to 0. Each step
rounds down. Burn and collision damage skip defence as now, then take
Vulnerable, Guard, Barrier and Immortal. This is a stopgap until damage
buckets are settled (open question 37).

### 17.7 Health effects (Decided)

| Keyword | Rule |
|---|---|
| **Heal N** | Restores N health, up to max health. Blocked by Antiheal. |
| **Overhealth** | A heal marked **overheal** lets health exceed max; the excess is **overhealth**, which lasts a set number of slots and then disappears. Damage removes overhealth first (it is health above max). Blocked by Antiheal like any heal. |
| **Antiheal** | The unit can't be healed for a duration: Heal, Lifesteal and overhealth all fail; Barrier still works. |
| **Cursed N** | Max health is lowered by N for a duration. Current health above the new max is lowered to it; when the curse ends, max returns but lost health doesn't. A curse can't take a unit below 1 health and is blocked by Immortal. |

**Barrier and overhealth are both kept.** Both are a buffer above health;
they differ in what counters them. Antiheal stops overhealth, not
Barrier; Cursed lowers the max that overhealth sits above.

### 17.8 Cleanse (Decided 2026-10-16; rule Proposed)
- **Cleanse** removes every **harmful status** from the target: Burn (all
  stacks), Frozen, Dazed, Slowed, Taunt, Vulnerable, Antiheal, Cursed and
  stat downs.
- It doesn't undo what already happened: a Push or Displace already
  applied stays, and health lost to Burn or Cursed isn't restored (Cursed's
  max health returns).
- Cleansing a unit that already lost a turn doesn't reset the lockout
  guard (17.5).
- Beneficial statuses are untouched. Removing an enemy's buffs (a dispel)
  is a separate question (open question 49).

### 17.9 Stat changes (Decided)
- **Speed, power, influence and defence** can be raised or lowered by a
  fixed number of points for a duration, shown on the stat sheet.
- One buff and one debuff per stat at a time (each replaces a weaker one,
  17.2); a buff and a debuff on the same stat both apply.
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
  Unstoppable against Displace and Frozen, Antiheal against healing,
  Pierce against defence, a lost turn against a charged ability, Cleanse
  against harmful statuses.

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Effect list | The owner's list (17.1), plus Phase 1's Guard and On-flank, plus Cleanse | | Owner's call, 2026-10-16 |
| Terms | **Push** and **Pull** move cards on the track (later, earlier); **Displace** moves units across hexes | Delay and Push (Phase 1 draft); Delay, Boost, Push and Pull | One consistent pair for the track, one word for the board; owner's call |
| Rules | 17.2 to 17.7 and 17.9 as proposed | | Confirmed by the owner, 2026-10-16 |
| Taunt | Dodged only by Hold | Any non-damaging ability also dodges | Owner's call; a taunt costs the target either its attack choice or its turn |
| Burn | Stacks | A new Burn replaces a weaker one | Owner's call; rewards repeated burn applications |
| Barrier and overhealth | Both kept | Merged into Barrier | Owner's call; different counters |
| Charged abilities | Fizzle on a lost trigger turn | Trigger anyway | Owner's call; control answers a visible charge |

## Open questions (original numbers continue from 39)

41. Pull limit value, and whether pushes and pulls share one budget.
48. Which effects are statuses (with durations), which ability properties, and which hero passives.
49. A dispel (removing an enemy's beneficial statuses): wanted, and is it part of Cleanse?
