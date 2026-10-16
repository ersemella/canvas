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
| Control | Frozen, Dazed, Slowed, Taunt, Stealth |
| Damage | Burn, Pierce, Lifesteal, Vulnerable, Barrier, Immortal |
| Health | Heal, Overhealth, Antiheal, Cursed |
| Removal | Cleanse, Dispel |
| Stats | Speed, power, influence and defence up or down |

**Terms (Decided):** **Push** and **Pull** always mean the **track**
(moving a card later or earlier); **Displace** always means the **board**
(moving a unit to another hex). On-flank (Phase 1) stays in the
vocabulary. Guard (Phase 1 draft) is removed; Barrier replaces it.

### 17.2 Shared rules (Decided)
- **Durations are in slots** (3.9), not turns: "for N ticks" in an effect's
  description means N slots. A duration that ends on the affected unit's
  turn expires after it acts (3.9).
- **A status doesn't stack with itself, but every application runs its
  own duration.** While several applications of the same status are
  active, only the **strongest** applies; when it expires, the next
  strongest still running takes over. Example: Vulnerable 30% for 5
  slots and Vulnerable 15% for 20 slots, applied together, give 30% for
  5 slots, then 15% for the remaining 15. Statuses with no strength
  (Frozen, Taunt, Stealth and others) simply last until the latest
  application ends. Different statuses always combine. **Exception: Burn
  stacks** (17.6): every Burn deals its damage.
- **Complete information** (D11): every status, its strength and its
  remaining slots is public, shown as a marker on the card with exact
  slots in the tap preview (7.1). Previews include every effect.
- **Influence scales magnitude** for values on the ×10 scale (burn, heal,
  barrier, overhealth, cursed) and for Push and Pull slots:
  `effect = roundDown(base × (1 + influence / 50))`. **Small or percentage
  values** (stat changes, Vulnerable, Slowed) are fixed per
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
| **Inevitable** | The card can't be moved by Push, Pull or Swap, **from allies and enemies alike**. It still yields when placed after its own turn (3.3). A status with a duration, or a passive on bosses and elites (11.3). |

**Why a pull limit:** without one, pulling an ally right after its turn
gives it an extra turn, and a Strategos-style support could chain extra
turns for one damage dealer. A limit mirrors the push limit and is just
as previewable.

### 17.4 Board effects (Decided)

| Keyword | Rule |
|---|---|
| **Displace N away** | Moves the target N hexes directly away from the attacker (along the hex direction from attacker to target; for an area centred on a hex, away from that centre). Stopping early at an obstacle, another unit or the map edge deals **20 collision damage** to the displaced unit, and 20 to a unit it hits, ignoring defence. Entering a hazard triggers it. Doesn't move the card. |
| **Displace N toward** | The same, toward the attacker (or the area's centre). Ending adjacent to the attacker is not a collision. |
| **Unstoppable** | Immune to Frozen and Displace, **from allies and enemies alike**. Doesn't block track effects (Push, Pull, Swap) or Dazed and Slowed. The Elephant Rider's passive (it resists Displace but not Push, 15.8) is permanent Unstoppable. |

"Displace N" with no direction means away. Other directions (sideways, to
a chosen hex) can be defined per ability.

- **Displacement is instant:** it resolves completely when the ability
  resolves, so nothing (a freeze, a turn) happens part-way through it.
- **A Frozen unit can't be displaced** (17.5).
- **Several units displaced at once** (an area ability) move one at a
  time: for Displace away, the unit farthest from the centre first; for
  Displace toward, the nearest first. Ties follow the fixed order for
  cards placed at the same moment (3.3). Each unit's collisions resolve
  before the next one moves.

### 17.5 Control effects (Decided)
Every turn must use an action (5.1). Losing a turn is modelled as a
**forced Hold**: the unit's card is reached, it takes no action, and its
card moves forward by Hold's cost (60) like any turn (3.2). The track
keeps moving, so control costs the target a turn, not the fight.

| Keyword | Rule |
|---|---|
| **Frozen** | On its turn, the unit neither moves nor acts: a forced Hold. It also can't be displaced while Frozen. |
| **Dazed** | On its turn, the unit may move but can't act: a forced Hold, plus any movement cost. |
| **Slowed N** | The unit's movement cap (one global value, 4 in Phase 1) is reduced by N, to at least 1 hex. |
| **Taunt** | While taunted, if the unit can attack the taunter from any hex it can reach this turn, it **must**: its action is an ability that targets the taunter or includes it in its area. Hold, other abilities and moving out of reach are not allowed. Only when no reachable hex and no ability can hit the taunter is the unit free. A **charging** unit's ability is redirected to the taunter instead (below). Ends early if the taunter dies. |
| **Stealth** | The unit can't be **targeted** by **hostile** direct or arcing ranged abilities (allies' ranged heals and buffs still reach it). Area abilities centred elsewhere still hit it, melee still targets it, and it still blocks line of fire. Ends when the unit uses a damaging ability. Its identity and position stay visible (D11). Distinct from the conceal tile, which only halves ranged damage. |

**Lockout guard:** Frozen and Dazed can make a unit lose at most **one
turn in a row**. After a lost turn, the unit can't lose its next turn to
either (the preview shows the immunity). Without this, chained freezes,
like chained pushes (3.6), would be a lockout loop in PvP.

**A lost turn doesn't count toward an ultimate** (10.10): only turns the
unit actually takes do, so control never brings an enemy's ultimate
closer.

**Charged abilities:** if a charging unit's trigger turn is lost to Frozen
or Dazed, **the charge fizzles**: nothing triggers and the card moves by
the recovery cost. This makes control a fourth answer to a visible charge
(with pushing the charger back, killing it, and stepping out of the area).

**Taunt and charged abilities:** a charged ability's target is fixed when
charging starts (3.7), so Taunt is the one effect that changes it. If the
charging unit is taunted when its card is reached, a damaging charged
ability triggers on the **taunter** instead: a single-target ability
targets it, and an area ability is centred on its hex at that moment, as
long as the taunter is within the ability's range from the charger's hex.
Out of range, the original target stands. The preview shows the
redirected target. A tank can taunt a charging Volley onto itself to
shield its allies.

### 17.6 Damage effects (Decided)

| Keyword | Rule |
|---|---|
| **Burn N** | N damage at the beginning of every 3rd slot for 12 slots, ignoring defence (Phase 1). **Stacks:** each Burn applied runs on its own schedule alongside any others, and the preview lists each one. |
| **Pierce** | The attack's damage skips the defence step. Barrier and Vulnerable still apply. |
| **Lifesteal N%** | The attacker heals N% of the damage it dealt (to health and barrier, after every reduction), rounded down. It is healing: Antiheal blocks it. |
| **Vulnerable N%** | The unit takes N% more damage for a duration. **Being flanked** makes a unit Vulnerable 25% for as long as the flank holds (6.3). |
| **Barrier N** | Absorbs the next N damage the unit would take, after every other reduction, until used up or it expires. Not healing, so Antiheal doesn't block it. |
| **Immortal** | The unit's health can't be reduced: damage to it becomes 0 (no minimum 1), burn included. Displace still moves it; other statuses still apply. Short durations only. |

**Damage order** (extends the Phase 1 order): base × power;
ranged on conceal −50%; **Vulnerable** (including from a flank); defence (skipped by **Pierce**);
minimum 1; **Barrier** absorbs; **Immortal** sets it to 0. Each step
rounds down. Burn, hazard and collision damage skip defence as now, then take
Vulnerable, Barrier and Immortal. This is a stopgap until damage
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
  from the target: Burn (all stacks), Frozen, Dazed, Slowed, Taunt,
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
- Dispel doesn't touch **passives** (the Elephant Rider's Unstoppable, a
  boss's Inevitable) or **ability properties** (an attack that always
  pierces): only statuses with a duration. It doesn't undo what already
  happened: damage a Barrier absorbed stays absorbed, and a Pull already
  applied stays.
- Harmful statuses are untouched, so Dispel on an ally is never useful
  and Cleanse on an enemy never helps it; abilities still define their
  own targets.

### 17.9 Stat changes (Decided)
- **Speed, power, influence and defence** can be raised or lowered by a
  fixed number of points for a duration, shown on the stat sheet.
- Buffs to a stat follow 17.2: each runs its own duration and only the
  strongest applies; the same for debuffs. The strongest buff and the
  strongest debuff on a stat both apply.
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
  against harmful statuses, Dispel against beneficial ones.

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Effect list | The owner's list (17.1), plus Phase 1's On-flank, plus Cleanse and Dispel; Guard removed | | Owner's call, 2026-10-16 |
| Terms | **Push** and **Pull** move cards on the track (later, earlier); **Displace** moves units across hexes | Delay and Push (Phase 1 draft); Delay, Boost, Push and Pull | One consistent pair for the track, one word for the board; owner's call |
| Rules | 17.2 to 17.7 and 17.9 as proposed | | Confirmed by the owner, 2026-10-16 |
| Taunt | Can't be dodged: the unit must attack the taunter if any reachable hex allows it; a charged ability is redirected to the taunter | Dodged by Hold; dodged by Hold or any non-damaging ability | Owner's call: a Hold escape made Taunt the same as Dazed; redirecting a charge gives Taunt a use no other effect has |
| Burn | Stacks | A new Burn replaces a weaker one | Owner's call; rewards repeated burn applications |
| Barrier and overhealth | Both kept | Merged into Barrier | Owner's call; different counters |
| Removal | Cleanse removes harmful statuses; Dispel, a separate effect, removes beneficial ones; neither touches passives | One effect removing both; no removal | Owner's call; each is a clear counter with an obvious target |
| Same status twice | Each application runs its own duration; only the strongest applies at a time | A stronger application replaces a weaker one | Owner's call; nothing applied is wasted, and the result is still one number |
| Lost turns | Don't count toward ultimates; a Frozen unit can't be displaced | Counting every turn | Control shouldn't bring an enemy's ultimate closer; owner's call |
| Guard | Removed; Barrier covers damage protection | Keeping both | Owner's call: outdated |
| Charged abilities | Fizzle on a lost trigger turn | Trigger anyway | Owner's call; control answers a visible charge |

## Open questions (original numbers continue from 39)

41. Pull limit value, and whether pushes and pulls share one budget.
50. Whether a lost turn resets the push and pull limits like any turn (3.6, 17.3).
48. Which effects are statuses (with durations), which ability properties, and which hero passives.
