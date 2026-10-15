# Roguelike tactics: enemies and difficulty

Regular enemies, bosses and distinct mechanics, and difficulty scaling. Rival caravans (other players' parties) are in [ghosts.md](ghosts.md).

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision.

From the combat design document (draft v1.7, owner, 2026-10-15). Rules
are marked **Decided** or **Proposed**; numbers marked TBD are tuning.
Section numbers are the original document's.

## 11. Enemies

### 11.1 Hybrid Enemy Design (Decided)
- **Regular enemies** are built from the same gear, abilities and character options available to players. They follow the same rules, costs and design language.
- **Bosses and a smaller set of distinct monsters** use the same base systems but each add one distinct mechanic of their own.
- A distinct mechanic should **bend one existing rule** (the timeline, the map, or the build system) rather than introduce a new system. Players already understand the rule, so the twist stays readable through the timeline, the map, previews and the shared design language.

### 11.2 Rationale
- Regular enemies teach players what gear and abilities exist, and reinforce the design language: the same visual cues mean the same thing on both sides.
- Distinct mechanics on bosses create memorable threats that force builds to adapt, without making encounters unreadable.
- Enemies built from player options also provide a natural path to asynchronous PvP using saved player builds ("ghost" builds), as in Backpack Battles and Super Auto Pets. Not decided; noted as a possibility.
  - **Revised 2026-10-15 (owner):** decided — ghosts are **rival caravans**, copies of other players' parties met as a fight, played by the enemy AI. See [ghosts.md](ghosts.md) (D8, D9).

### 11.3 Example Distinct Mechanics (Illustrative, not decided)

| Rule bent | Example | What it tests |
|---|---|---|
| Timeline | **Two heads, two turns:** a boss with two separate timeline entries, each with its own action set. Pushing one head delays only that head. | Timeline control and target priority |
| Timeline | **Scheduled cataclysm:** recurring environmental events placed on the timeline as delayed actions (a collapsing ceiling, a flood). | Racing the clock; positioning before known events |
| Timeline | **Tempo tax:** an aura that increases action or movement cost for units near the boss. | Speed versus defence tradeoff; ranged versus melee |
| Space | **Multi-hex body:** a large boss occupying several hexes, with parts (arms, a shield) that can be targeted and destroyed separately. | Positioning; flanking over a larger footprint |
| Space | **Terrain shaper:** converts tiles into hazards or conceal over time. | Adapting to a changing map |
| Space | **Vulnerable only when flanked:** takes reduced damage unless flanked. | Positional play and movement cost decisions |
| Build | **Mimic:** copies the last ability used against it. | Build variety; punishes one-dimensional builds |
| Build | **Summoner:** schedules reinforcements on the timeline. | Burst builds (kill before arrival) versus sustain builds (outlast) |

---

### 11.4 Difficulty Scaling (Decided)
Difficulty rises over a run mainly by making enemies better built, not by inflating their stats. Enemies scale the same way players do, so difficulty stays readable through the design language and existing systems.

**Primary curve: enemy builds**
- **Gear rarity:** later enemies carry higher-rarity gear, following the same rarity rules as player gear (section 9).
- **Composition synergy:** early enemy groups have little synergy; later groups combine keywords deliberately (for example, one enemy pushes and another punishes pushed targets).
- **Unit count:** larger enemy groups later in the run, within a cap that keeps turns fast. Cap TBD.

**Layered on top**
- **Encounter pressure:**
  - Harder deployment layouts (split, surrounded, far from cover).
  - Harsher maps: more hazards, less conceal, sight lines that favor enemy ranged units.
  - Timeline pressure: reinforcements arriving sooner, scheduled cataclysms, more enemy push abilities.
  - Objectives beyond defeating all enemies: survive a number of ticks, protect a unit, defeat a target before reinforcements arrive.
- **Elite affixes:** later regular enemies may carry one rule-bending trait drawn from the boss toolkit (section 11.3), such as a tempo-tax aura or being vulnerable only when flanked. This scales complexity rather than numbers.
- **Optional risk:** players can choose harder fights for better rewards (similar to Monster Train's Trials), letting strong builds push themselves and weaker builds play safe.

**Raw stats**
- Stat growth beyond what gear provides is kept small, if used at all.

### 11.5 Open Questions on Difficulty
- Enemy unit cap per encounter.
- List of elite affixes and when they begin appearing.
- Objective types and how often they appear.
- Structure of optional risk choices (which fights, what reward).
- Whether enemy AI behavior improves over the run (focus fire, flanking, timeline manipulation).
- Recovery tuning: amount recovered after each fight and frequency of rest opportunities (section 10.11).
- Overall difficulty curve and tuning targets.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Enemies | Hybrid: regular enemies built from player options; bosses and some monsters add one distinct mechanic that bends an existing rule | All enemies distinct (like Slice & Dice); all enemies built from player options (like Backpack Battles) | Teaches the system and design language while keeping bosses memorable and readable |
| Difficulty scaling | Enemy builds (gear rarity, composition synergy, unit count) as the main curve; encounter pressure, elite affixes and optional risk layered on top; minimal raw stat growth | Raw stat multipliers | Readable, reuses existing systems, and feels like enemies improving rather than numbers inflating |

## Open questions (from section 14, original numbers)

16. Enemy counts in PvE.
18. Ratio of regular enemies to distinct monsters, and which distinct mechanics to build first.
21. Difficulty scaling questions listed in section 11.5.
