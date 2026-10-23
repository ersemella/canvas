# Roguelike tactics: map and movement

Hex grid, movement, flanking, map tiles, deployment, line of fire and friendly fire.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 6. Map and Movement

### 6.1 Grid (Decided)
- The map is a **compact hex grid.** Exact size TBD; small enough to keep encounters short, since a roguelike has many fights per run.
- A single map shape should be chosen and used consistently (options: large hexagon, offset rectangle). Shape TBD.

### 6.2 Movement (Decided)
- Movement is measured **per hex.** Ordinary walking is a turn's action, up to 3 spaces (5.1); since 2026-10-23 it places the card like any action (3.2).
- Ordinary walking cannot pass allies, enemies or blocking obstacles, and a walk that enters hail ends there (it Immobilizes; [keywords.md](keywords.md), 17.4).

### 6.3 Flanking (out of the game since 2026-10-23)
**Removed with Vulnerable** (owner's keyword rework, 2026-10-23): with hits of 1 or 2, a percentage bonus rounds away. The rule as it stood, for when an On-flank keyword returns:

- A target is **flanked** when two units hostile to it occupy hexes directly opposite each other across the target (for example, the hexes to its north-east and south-west).
- **A flanked unit is Vulnerable** ([keywords.md](keywords.md), 17.6): it takes **25%** more damage (Phase 1 value; tuning) from every source for as long as it stays flanked. The status appears when the flank forms and disappears when it breaks (a flanker moves, is displaced or dies); it has no duration, and Cleanse doesn't remove it.
- Flanking combines as **max** with Vulnerable from other sources ([keywords.md](keywords.md), 17.2): the stronger applies.
- Abilities and gear can add more through **On-flank**.
- Each hex has exactly 3 pairs of opposite neighbors, so "opposite" is unambiguous.

### 6.4 Map Modifiers (Decided)
Maps can contain three types of special tile:

| Tile | Effect |
|---|---|
| **Obstacle** | Cannot be moved through or occupied. |
| **Hazard** | Deals damage and/or applies status effects to a unit that enters or occupies it. Exact trigger (on entry, at turn start, or both) TBD. Phase 1's quicksand was removed on 2026-10-23 (it was out of fights since 2026-10-22). |
| **Conceal** | Smoke or weather that hides or protects its occupant; rule TBD. Phase 1's sandstorm, which made its occupant Obscured, was removed with that keyword on 2026-10-23 ([history.md](history.md)). |

- No other modifier types for now, to keep the board readable.
- **Not included:** elevation (height differences affecting combat), facing (the direction a unit points affecting combat).
- Whether obstacles and conceal tiles block line of fire is TBD (section 6.7).
- Conceal "obscures" its occupant. Whether that only means visual cover and ranged protection, or also hides the occupant's identity, is TBD. Hiding identity would be the one exception to complete information (section 7.4).

### 6.5 Rationale
- Hexes give uniform distances in all directions and clean flanking rules.
- Known tradeoffs: straight-line and cone-shaped area effects only align cleanly in 6 directions and need careful design; room-like layouts look less natural than on square grids.
- Ordinary movement is capped at 3 spaces per action (5.1) and cannot share a turn with an ability.

### 6.6 Deployment (Decided)
- Each side has a **deployment zone**: a set of starting hexes. Before the fight, players place their units anywhere within their zone, with full visibility of the map and enemy positions. Placement is the first decision of the fight.
- **PvP:** zones are on opposite ends of the map, on symmetric or mirrored maps.
- **Rival caravan fights** use the PvP-style maps above (symmetric or mirrored, opposite deployment zones): a fair mirror match against another player's build ([ghosts.md](ghosts.md) D2).
- **PvE:** zones are commonly on opposite ends, but vary by map. Examples: split starts, being surrounded, defending a central point, or starting already engaged. Enemy positions are set by the map.
- **Engagement distance:** the gap between zones should allow contact within about 1 to 2 turns of typical movement. The approach should be a meaningful track decision (rushing in costs time on the track), not dead time.
- **The camel and the exits (Decided 2026-10-21, owner):** the player's camel deploys with the party, and the four hexes sticking out on the enemy's edge are **exit hexes**, which win the fight when the camel reaches one ([camel.md](camel.md), 18.1, 18.2).
- Watch: ranged units may get free hits during the approach, and rushing in costs time on the track (6.5). Armour costs speed (4.2), which makes every turn, moving included, place the unit further back. Short gaps and obstacles that block early sight lines mitigate free hits.

### 6.7 Line of Fire and Friendly Fire (Decided)
Friendly fire is used as a positioning cost that limits ranged characters, not as a random punishment. Because combat is deterministic and previewed, it is never accidental.

**Abilities don't know sides (Decided 2026-10-19, owner's call)**
- Every ability affects **every unit it reaches**, ally or enemy: attacks damage allies, heals and cleanses reach enemies, statuses land on whoever is hit. An ability's text never filters by side.
- This covers areas, lines and paths (a bow's arrow, a charge's path) and single targets: any unit in reach can be targeted.
- The preview shows every unit affected and how (section 7.2), so it is never accidental.
- The only way to leave allies out is the **ally-exemption keyword** from gear and upgrades (below); no ability has it built in.
- Not covered: movement rules (passing through allies, 6.2) and line of fire, which are about the board, not an ability's effect.

**Direct ranged attacks**
- A direct ranged attack needs a **clear line of fire**: the straight line from the centre of the attacker's hex to the centre of the target's hex must not pass through a hex occupied by another unit.
- **Any unit blocks**, ally or enemy. A blocked attack cannot be made against that target. No one is damaged.
- If the first unit along the line is an enemy, the attacker may target that enemy instead.
- This applies symmetrically: enemy front-liners shield their own back line in the same way.
- Melee attacks against adjacent hexes are unaffected.

**Area abilities**
- Area abilities affect **every unit in the area, allies included**, as every ability does (above).
- The preview shows all affected units and the damage or effect each receives, allies included, before the player commits (section 7.2).

**Arcing attacks**
- Some ranged attacks arc over units and **ignore line of fire**.
- They pay for this by being charged abilities (3.7), with a charge and a recovery cost. Exact pricing per ability TBD.

**Exempting allies**
- Gear and milestone upgrades can make an ability **exclude allies** (an attack) or **exclude enemies** (a heal, a cleanse or a buff). This is a build lever, the only way to filter by side, and is expected to be defined as a keyword in the keyword vocabulary. It arrives with gear in Phase 2.

**Rationale**
- Once melee heroes engage, they tend to block their own ranged allies' lines, so ranged heroes must spend time repositioning to a clear angle. This limits ranged power through positioning rather than stat penalties.
- Area friendly fire makes formation a real decision without adding randomness.
- Extending it to every ability, heals included, gives one rule with no per-ability exceptions, makes supports position as carefully as attackers, and turns ally exemption into a real build choice (goal 1). The *Secret History*'s storm that turns back on its casters fits the setting (15.8).
- Rejected alternative: stray shots that hit units along the path on a miss (as in Battle Brothers or Jagged Alliance). This depends on hit chance, which this design does not use (section 8).
- Rejected alternative: no friendly fire at all (as in Fire Emblem). Positioning around allies would not matter, and ranged characters would face no natural limit.

**Risks**
- **Clutter:** with up to 8 or more units on a compact map, lines may be blocked so often that ranged heroes feel stuck. Map size, obstacle layout and engagement distance (6.6) must be tuned with this in mind.
- **Permanent death:** area damage to allies is costly when heroes are lost for the run. Expect players to avoid friendly-fire abilities unless allies can be exempted; tune availability of exemption accordingly, so it doesn't become a must-pick.
- **Area support:** a heal or buff that reaches enemies is weak in a melee, which pushes support designs toward single targets and small radii; keep the supports distinct.
- **Stalls:** healing that reaches enemies makes fights longer; the caravan's camel, whose walk to the exit ends a fight, is the decided answer ([camel.md](camel.md)).
- **AI:** enemy AI must respect line of fire and avoid friendly fire, or deliberately accept it where that is the stronger play.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Flanking | The flanked unit is Vulnerable while flanked | A flat damage bonus to attackers; ignoring defence; pinning; pushing the card on each hit | One rule players already know from the keyword list; the board state shows it |
| Grid | Compact hex grid | No grid, rows, square grid, gridless | Uniform distances, clean flanking |
| Map modifiers | Three tile types: obstacle, hazard, conceal; no elevation or facing | Full terrain systems | Readability, with enough variety for positional decisions |
| Friendly fire | Every ability affects every unit it reaches, ally or enemy, heals included (2026-10-19); direct ranged attacks need a clear line of fire (any unit blocks); arcing attacks ignore line of fire at a higher cost; gear and upgrades can exempt allies | No friendly fire; stray shots hitting units in the path; friendly fire for areas only, with single-target and path abilities and heals filtered by side (until 2026-10-19) | Limits ranged power through positioning; deterministic and previewed, so never accidental |
| Deployment | Player placement within deployment zones; opposite and mirrored in PvP, varied in PvE | Fixed spawn positions | Placement is a meaningful first decision; variety keeps PvE openings fresh |

## Open questions (from section 14, original numbers)

9. Map size and shape.
10. Whether units can pass through allied units.
12. Map modifier details: hazard trigger timing and effects; whether conceal grants full ranged immunity or a reduction; whether conceal hides the occupant's identity; which tiles block line of fire (section 6.7).
   - Deployment zone sizes, engagement distance, and the set of PvE deployment layouts.
29. Hex line-of-fire edge case: when the line runs exactly along the border between two hexes, whether it is blocked if either hex is occupied or only if both are (section 6.7).
30. Pricing of arcing attacks: charge and recovery costs per ability.
31. Name and availability of the ally-exemption keyword (for attacks; and its mirror, enemy exemption, for heals and buffs).
