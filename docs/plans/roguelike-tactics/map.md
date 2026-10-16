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
- Movement is measured **per hex.** Each hex moved adds `moveCostPerHex` to the turn's cost, divided by speed like the action cost (3.2). Movement per turn is capped (5.1).
- Units cannot move through hexes occupied by enemies or blocking obstacles. Whether allies can be passed through is TBD.

### 6.3 Flanking (Decided)
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
| **Hazard** | Deals damage and/or applies status effects to a unit that enters or occupies it. Exact trigger (on entry, at turn start, or both) TBD. |
| **Conceal** | Fog or smoke that obscures the unit occupying it and defends it from ranged attacks. Whether this is full immunity or a reduction is TBD. |

- No other modifier types for now, to keep the board readable.
- **Not included:** elevation (height differences affecting combat), facing (the direction a unit points affecting combat).
- Whether obstacles and conceal tiles block line of fire is TBD (section 6.7).
- Conceal "obscures" its occupant. Whether that only means visual cover and ranged protection, or also hides the occupant's identity, is TBD. Hiding identity would be the one exception to complete information (section 7.4).

### 6.5 Rationale
- Hexes give uniform distances in all directions and clean flanking rules.
- Known tradeoffs: straight-line and cone-shaped area effects only align cleanly in 6 directions and need careful design; room-like layouts look less natural than on square grids.
- Per-hex movement cost interacts with displacement: a displaced unit loses both tempo and repositioning opportunities. Tune these together.
- Movement is capped per turn (5.1), and every hex adds to the turn's cost, so moving and acting in one turn always costs more than acting alone.

### 6.6 Deployment (Decided)
- Each side has a **deployment zone**: a set of starting hexes. Before the fight, players place their units anywhere within their zone, with full visibility of the map and enemy positions. Placement is the first decision of the fight.
- **PvP:** zones are on opposite ends of the map, on symmetric or mirrored maps.
- **Rival caravan fights** use the PvP-style maps above (symmetric or mirrored, opposite deployment zones): a fair mirror match against another player's build ([ghosts.md](ghosts.md) D2).
- **PvE:** zones are commonly on opposite ends, but vary by map. Examples: split starts, being surrounded, defending a central point, or starting already engaged. Enemy positions are set by the map.
- **Engagement distance:** the gap between zones should allow contact within about 1 to 2 turns of typical movement. The approach should be a meaningful track decision (rushing in costs time on the track), not dead time.
- Watch: ranged units may get free hits during the approach, and rushing in costs time on the track (6.5). Armour costs speed (4.2), which makes every turn, moving included, place the unit further back. Short gaps and obstacles that block early sight lines mitigate free hits.

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
- They pay for this by being charged abilities (3.7), with a charge and a recovery cost. Exact pricing per ability TBD.

**Exempting allies**
- Gear and milestone upgrades can make an area ability **exclude allies**. This is a build lever, and is expected to be defined as a keyword in the keyword vocabulary.

**Rationale**
- Once melee heroes engage, they tend to block their own ranged allies' lines, so ranged heroes must spend time repositioning to a clear angle. This limits ranged power through positioning rather than stat penalties.
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
| Flanking | The flanked unit is Vulnerable while flanked | A flat damage bonus to attackers; ignoring defence; pinning; pushing the card on each hit | One rule players already know from the keyword list; the board state shows it |
| Grid | Compact hex grid | No grid, rows, square grid, gridless | Uniform distances, clean flanking |
| Map modifiers | Three tile types: obstacle, hazard, conceal; no elevation or facing | Full terrain systems | Readability, with enough variety for positional decisions |
| Friendly fire | Direct ranged attacks need a clear line of fire (any unit blocks); area abilities hit allies; arcing attacks ignore line of fire at a higher cost; gear and upgrades can exempt allies | No friendly fire; stray shots hitting units in the path | Limits ranged power through positioning; deterministic and previewed, so never accidental |
| Deployment | Player placement within deployment zones; opposite and mirrored in PvP, varied in PvE | Fixed spawn positions | Placement is a meaningful first decision; variety keeps PvE openings fresh |

## Open questions (from section 14, original numbers)

9. Map size and shape.
10. Whether units can pass through allied units.
12. Map modifier details: hazard trigger timing and effects; whether conceal grants full ranged immunity or a reduction; whether conceal hides the occupant's identity; which tiles block line of fire (section 6.7).
   - Deployment zone sizes, engagement distance, and the set of PvE deployment layouts.
29. Hex line-of-fire edge case: when the line runs exactly along the border between two hexes, whether it is blocked if either hex is occupied or only if both are (section 6.7).
30. Pricing of arcing attacks: charge and recovery costs per ability.
31. Name and availability of the ally-exemption keyword for area abilities.
