# Roguelike tactics: keywords and effects

The keyword vocabulary (10.8): statuses, track and board effects, damage
and health modifiers, and stat changes that abilities, gear and upgrades
all reference.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's. Phase 1 uses only Push,
Delay, Burn, Guard and On-flank ([phase-1-brief.md](phase-1-brief.md),
section 3); everything else here is for later phases.

## 17. Keywords and Effects

### 17.1 The list (Decided 2026-10-16: which effects exist)
The owner's list of effects. **Which effects exist is decided; each
effect's exact rule below is Proposed** until confirmed.

| Group | Effects |
|---|---|
| Track | Delay, Boost, Swap, Inevitable |
| Board | Push, Pull, Unstoppable |
| Control | Frozen, Dazed, Slowed, Taunt, Stealth |
| Damage | Burn, Pierce, Lifesteal, Vulnerable, Guard, Barrier, Immortal |
| Health | Heal, Overhealth, Antiheal, Cursed |
| Stats | Speed, power, influence and defence up or down |

Guard and On-flank (Phase 1) stay in the vocabulary.

### 17.2 Shared rules (Proposed)
- **Durations are in slots** (3.9), not turns: "for N ticks" in an effect's
  description means N slots. A duration that ends on the affected unit's
  turn expires after it acts (3.9).
- **A status doesn't stack with itself:** applying it again replaces the
  old one if the new one is stronger, or refreshes its duration if equal
  (as Guard). Different statuses always combine.
- **Complete information** (D11): every status, its strength and its
  remaining slots is public, shown as a marker on the card with exact
  slots in the tap preview (7.1). Previews include every effect.
- **Influence scales magnitude** for values on the ×10 scale (burn, heal,
  barrier, overhealth, cursed) and for delay and boost slots:
  `effect = roundDown(base × (1 + influence / 50))`. **Small or percentage
  values** (stat changes, Vulnerable, Guard, Slowed) are fixed per
  ability, so rounding doesn't erase them (history: single-digit health);
  influence scales their **duration** instead. Push and Pull distances are
  fixed (Phase 1 rule).
- **An effect can be an ability property or a status.** Pierce and
  Lifesteal are usually properties of an attack ("Pierce: this attack
  ignores defence"), but a buff can grant them for a duration ("your
  attacks pierce for 10 slots"). The keyword means the same in both.

### 17.3 Track effects (Proposed)

| Keyword | Rule |
|---|---|
| **Delay N** | Moves the target's card N slots later; yields if taken; within the delay limit (3.5, 3.6). Unchanged. |
| **Boost N** | Moves the target's card N slots earlier, never earlier than the next slot (3.5). Yields **forward** (later) if that slot is taken. Within a **boost limit**: a card can be moved earlier by at most a set number of slots in total between two of its own turns; further boosts are reduced to fit and the preview shows it. Value TBD (Phase 2 default to match the delay limit: 10). |
| **Swap** | Two cards exchange slots. The card moved later spends the distance from its delay budget, the card moved earlier from its boost budget; if either budget can't cover the whole distance, the swap can't target that pair (a swap can't be reduced to fit). Which two cards (caster and target, or any two in range) is per ability. |
| **Inevitable** | The card can't be moved by Delay, Boost or Swap, from either side. It still yields when placed after its own turn (3.3). A status with a duration, or a passive on bosses and elites (11.3). |

**Why a boost limit:** without one, boosting an ally right after its turn
gives it an extra turn, and a Strategos-style support could chain extra
turns for one damage dealer. A limit mirrors the delay limit and is just
as previewable.

### 17.4 Board effects (Proposed)

| Keyword | Rule |
|---|---|
| **Push N** | Unchanged from Phase 1: N hexes directly away from the attacker; stopping early at an obstacle, unit or map edge deals 20 collision damage to it and to a unit it hits, ignoring defence; hazards trigger. |
| **Pull N** | The mirror of Push: N hexes directly **toward** the attacker (for an area, toward its centre). Ending adjacent to the attacker is not a collision; stopping early at an obstacle or another unit deals the same collision damage as Push; hazards trigger. Doesn't move the card. |
| **Unstoppable** | Immune to Frozen, Push and Pull. Doesn't block track effects (Delay, Boost, Swap) or Dazed and Slowed. The Elephant Rider's passive (it resists Push but not Delay, 15.8) becomes permanent Unstoppable. |

### 17.5 Control effects (Proposed)
Every turn must use an action (5.1). Losing a turn is modelled as a
**forced Hold**: the unit's card is reached, it takes no action, and its
card moves forward by Hold's cost (60) like any turn (3.2). The track
keeps moving, so control costs the target a turn, not the fight.

| Keyword | Rule |
|---|---|
| **Frozen** | On its turn, the unit neither moves nor acts: a forced Hold. |
| **Dazed** | On its turn, the unit may move but can't act: a forced Hold, plus any movement cost. |
| **Slowed N** | The unit's movement cap (one global value, 4 in Phase 1) is reduced by N, to at least 1 hex. |
| **Taunt** | While taunted, any **damaging** ability the unit uses must target, or include in its area, the taunter if the taunter is a legal target from the hex it chose. Otherwise the unit is free. It may still use non-damaging abilities or Hold. Ends early if the taunter dies. |
| **Stealth** | The unit can't be **targeted** by direct or arcing ranged abilities. Area abilities centred elsewhere still hit it, melee still targets it, and it still blocks line of fire. Ends when the unit uses a damaging ability. Its identity and position stay visible (D11). Distinct from the conceal tile, which only halves ranged damage. |

**Lockout guard:** Frozen and Dazed can make a unit lose at most **one
turn in a row**. After a lost turn, the unit can't lose its next turn to
either (the preview shows the immunity). Without this, chained freezes,
like chained delays (3.6), would be a lockout loop in PvP.

**Charged abilities:** if a charging unit's trigger turn is lost to Frozen
or Dazed, **the charge fizzles**: nothing triggers and the card moves by
the recovery cost. This makes control a fourth answer to a visible charge
(with delaying, killing, and stepping out of the area).

### 17.6 Damage effects (Proposed)

| Keyword | Rule |
|---|---|
| **Burn N** | Unchanged from Phase 1: N damage at the beginning of every 3rd slot for 12 slots, ignoring defence. |
| **Pierce** | The attack's damage skips the defence step. Guard, Barrier and Vulnerable still apply. |
| **Lifesteal N%** | The attacker heals N% of the damage it dealt (to health and barrier, after every reduction), rounded down. It is healing: Antiheal blocks it. |
| **Vulnerable N%** | The unit takes N% more damage for a duration. The mirror of Guard. |
| **Guard N%** | Unchanged from Phase 1: N% less damage for 10 slots. |
| **Barrier N** | Absorbs the next N damage the unit would take, after every other reduction, until used up or it expires. Not healing, so Antiheal doesn't block it. |
| **Immortal** | The unit's health can't be reduced: damage to it becomes 0 (no minimum 1), burn included. Push and Pull still move it; other statuses still apply. Short durations only. |

**Damage order** (extends the Phase 1 order): base × power; flank +25%;
ranged on conceal −50%; **Vulnerable**; defence (skipped by **Pierce**);
Guard; minimum 1; **Barrier** absorbs; **Immortal** sets it to 0. Each step
rounds down. Burn and collision damage skip defence as now, then take
Vulnerable, Guard, Barrier and Immortal. This is a stopgap until damage
buckets are settled (open question 37).

### 17.7 Health effects (Proposed)

| Keyword | Rule |
|---|---|
| **Heal N** | Restores N health, up to max health. Blocked by Antiheal. |
| **Overhealth** | A heal marked **overheal** lets health exceed max; the excess is **overhealth**, which lasts a set number of slots and then disappears. Damage removes overhealth first (it is health above max). Blocked by Antiheal like any heal. |
| **Antiheal** | The unit can't be healed for a duration: Heal, Lifesteal and overhealth all fail; Barrier still works. |
| **Cursed N** | Max health is lowered by N for a duration. Current health above the new max is lowered to it; when the curse ends, max returns but lost health doesn't. A curse can't take a unit below 1 health and is blocked by Immortal. |

**Barrier versus overhealth:** both are a buffer above health, so they
differ only in what counters them. Antiheal stops overhealth, not
Barrier; Cursed lowers the max that overhealth sits above. If play-testing
shows they feel the same, merge them into Barrier.

### 17.8 Stat changes (Proposed)
- **Speed, power, influence and defence** can be raised or lowered by a
  fixed number of points for a duration, shown on the stat sheet.
- One buff and one debuff per stat at a time (each replaces a weaker one,
  17.2); a buff and a debuff on the same stat both apply.
- Floors: speed at least 1 (it divides costs, 3.2); the others at least 0.
- Speed changes take effect at the unit's next placement (3.2): a card
  already on the track doesn't move. Slow is a movement-cap effect
  (Slowed); lowering speed is "speed down", to keep the two apart.

### 17.9 Rationale
- Each effect bends an existing rule (track, board, damage formula,
  health) rather than adding a system, matching the enemy design
  principle (11.1).
- Lost turns, boosts and swaps all reuse the delay limit's idea: a capped,
  previewable budget per card between its own turns, so no combination
  locks a unit out or gives one unlimited extra turns. That keeps the
  vocabulary PvP-ready (goal 5).
- Each effect has a counter in the list: Inevitable against track control,
  Unstoppable against displacement and Frozen, Antiheal against healing,
  Pierce against defence, a lost turn against a charged ability.

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Effect list | The owner's list (17.1), plus Phase 1's Guard and On-flank | | Owner's call, 2026-10-16 |
| Naming | **Boost** moves a card earlier on the track; **Pull** moves a unit toward the attacker | Pull for both (track and board) | One word per meaning, matching Push (board) and Delay (track) |

## Open questions (original numbers continue from 39)

40. Confirm each effect's rule in 17.3 to 17.8, which are proposals.
41. Boost limit value, and whether it shares one budget with the delay limit.
42. Taunt: may a taunted unit escape by using non-damaging abilities or Hold?
43. Stealth: does it end on any action, or only on a damaging one?
44. Lifesteal: does damage absorbed by Barrier count?
45. Burn stacking: does a second burn replace the first or run alongside it?
46. Barrier and overhealth: keep both, or merge (17.7)?
47. A cleanse or dispel effect: not on the list, so statuses can't be removed early. Wanted?
48. Which effects are statuses (with durations), which ability properties, and which hero passives.
