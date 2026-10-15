# Roguelike tactics: map and movement

Hex grid, movement, flanking, map tiles, deployment, line of fire and friendly fire.

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision.

From the combat design document (draft v1.7, owner, 2026-10-15). Rules
are marked **Decided** or **Proposed**; numbers marked TBD are tuning.
Section numbers are the original document's.

## 6. Map and Movement

### 6.1 Grid (Decided)
- The map is a **compact hex grid.** Exact size TBD; small enough to keep encounters short, since a roguelike has many fights per run.
- A single map shape should be chosen and used consistently (options: large hexagon, offset rectangle). Shape TBD.

### 6.2 Movement (Decided)
- Movement is measured **per hex.** Each hex moved adds `moveCostPerHex` ticks to turn cost.
- Units cannot move through hexes occupied by enemies or blocking obstacles. Whether allies can be passed through is TBD.

### 6.3 Flanking (Decided)
- A target is **flanked** when two units hostile to it occupy hexes directly opposite each other across the target (for example, the hexes to its north-east and south-west).
- Flanked targets suffer a penalty or grant attackers a bonus. Specific effect TBD.
- Each hex has exactly 3 pairs of opposite neighbors, so "opposite" is unambiguous.

### 6.4 Map Modifiers (Decided)
Maps can contain three types of special tile:

| Tile | Effect |
|---|---|
| **Obstacle** | Cannot be moved through or occupied. |
| **Hazard** | Deals damage and/or applies status effects to a unit that enters or occupies it. Exact trigger (on entry, at turn start, or both) TBD. |
| **Conceal** | Fog or smoke that obscures the unit occupying it and defends it from ranged attacks. Whether this is full immunity or a reduction is TBD. |

- No other modifier types for now, to keep the board readable.
- **Not included:** elevation (height differences affecting combat), facing (the direction a unit points affecting combat).
- Whether obstacles and conceal tiles block line of fire is TBD (section 6.7).
- Conceal "obscures" its occupant. Whether that only means visual cover and ranged protection, or also hides the occupant's identity, is TBD. Hiding identity would be the one exception to complete information (section 7.4).

### 6.5 Rationale
- Hexes give uniform distances in all directions and clean flanking rules.
- Known tradeoffs: straight-line and cone-shaped area effects only align cleanly in 6 directions and need careful design; room-like layouts look less natural than on square grids.
- Per-hex movement cost interacts with pushes: a pushed unit loses both tempo and repositioning opportunities. Tune these together.

### 6.6 Deployment (Decided)
- Each side has a **deployment zone**: a set of starting hexes. Before the fight, players place their units anywhere within their zone, with full visibility of the map and enemy positions. Placement is the first decision of the fight.
- **PvP:** zones are on opposite ends of the map, on symmetric or mirrored maps.
- **PvE:** zones are commonly on opposite ends, but vary by map. Examples: split starts, being surrounded, defending a central point, or starting already engaged. Enemy positions are set by the map.
- **Engagement distance:** the gap between zones should allow contact within about 1 to 2 turns of typical movement. The approach should be a meaningful timeline decision (rushing in costs ticks), not dead time.
- Watch: heavily armoured units arrive later because of the speed versus defence tradeoff (section 4.5), and ranged units may get free hits during the approach. Short gaps and obstacles that block early sight lines mitigate both.

### 6.7 Line of Fire and Friendly Fire (Decided)
Friendly fire is used as a positioning cost that limits ranged characters, not as a random punishment. Because combat is deterministic and previewed, it is never accidental.

**Direct ranged attacks**
- A direct ranged attack needs a **clear line of fire**: the straight line from the centre of the attacker's hex to the centre of the target's hex must not pass through a hex occupied by another unit.
- **Any unit blocks**, ally or enemy. A blocked attack cannot be made against that target. No one is damaged.
- If the first unit along the line is an enemy, the attacker may target that enemy instead.
- This applies symmetrically: enemy front-liners shield their own back line in the same way.
- Melee attacks against adjacent hexes are unaffected.

**Area abilities**
- Area abilities affect **every unit in the area, allies included**.
- The preview shows all affected units and the damage or effect each receives, allies included, before the player commits (section 7.2).

**Arcing attacks**
- Some ranged attacks arc over units and **ignore line of fire**.
- They pay for this with a higher action cost, delayed resolution (3.7), or both. Exact pricing per ability TBD.

**Exempting allies**
- Gear and milestone upgrades can make an area ability **exclude allies**. This is a build lever, and is expected to be defined as a keyword in the keyword vocabulary.

**Rationale**
- Once melee heroes engage, they tend to block their own ranged allies' lines, so ranged heroes must spend ticks repositioning to a clear angle. This limits ranged power through positioning rather than stat penalties.
- Area friendly fire makes formation a real decision without adding randomness.
- Rejected alternative: stray shots that hit units along the path on a miss (as in Battle Brothers or Jagged Alliance). This depends on hit chance, which this design does not use (section 8).
- Rejected alternative: no friendly fire at all (as in Fire Emblem). Positioning around allies would not matter, and ranged characters would face no natural limit.

**Risks**
- **Clutter:** with up to 8 or more units on a compact map, lines may be blocked so often that ranged heroes feel stuck. Map size, obstacle layout and engagement distance (6.6) must be tuned with this in mind.
- **Permanent death:** area damage to allies is costly when heroes are lost for the run. Expect players to avoid friendly-fire abilities unless allies can be exempted; tune availability of exemption accordingly.
- **AI:** enemy AI must respect line of fire and avoid friendly fire, or deliberately accept it where that is the stronger play.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Grid | Compact hex grid | No grid, rows, square grid, gridless | Uniform distances, clean flanking |
| Map modifiers | Three tile types: obstacle, hazard, conceal; no elevation or facing | Full terrain systems | Readability, with enough variety for positional decisions |
| Friendly fire | Direct ranged attacks need a clear line of fire (any unit blocks); area abilities hit allies; arcing attacks ignore line of fire at a higher cost; gear and upgrades can exempt allies | No friendly fire; stray shots hitting units in the path | Limits ranged power through positioning; deterministic and previewed, so never accidental |
| Deployment | Player placement within deployment zones; opposite and mirrored in PvP, varied in PvE | Fixed spawn positions | Placement is a meaningful first decision; variety keeps PvE openings fresh |

## Open questions (from section 14, original numbers)

9. Map size and shape.
10. Whether units can pass through allied units.
11. Specific flanking effect.
12. Map modifier details: hazard trigger timing and effects; whether conceal grants full ranged immunity or a reduction; whether conceal hides the occupant's identity; which tiles block line of fire (section 6.7).
   - Deployment zone sizes, engagement distance, and the set of PvE deployment layouts.
29. Hex line-of-fire edge case: when the line runs exactly along the border between two hexes, whether it is blocked if either hex is occupied or only if both are (section 6.7).
30. Pricing of arcing attacks: higher action cost, delayed resolution, or both.
31. Name and availability of the ally-exemption keyword for area abilities.
