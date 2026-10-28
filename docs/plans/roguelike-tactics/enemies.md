# Roguelike tactics: enemies and difficulty

Regular enemies, bosses and distinct mechanics, and difficulty scaling. Rival caravans (other players' parties) are in [ghosts.md](ghosts.md).

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 11. Enemies

### 11.1 Hybrid Enemy Design (Decided)
- **Regular enemies** are built from the same gear, abilities and character options available to players. They follow the same rules, costs and design language.
- **Bosses and a smaller set of distinct monsters** use the same base systems but each add one distinct mechanic of their own.
- A distinct mechanic should **bend one existing rule** (the track, the map, or the build system) rather than introduce a new system. Players already understand the rule, so the twist stays readable through the track, the map, previews and the shared design language.

### 11.2 Rationale
- Regular enemies teach players what gear and abilities exist, and reinforce the design language: the same visual cues mean the same thing on both sides.
- Distinct mechanics on bosses create memorable threats that force builds to adapt, without making encounters unreadable.
- Enemies built from player options also give a natural path to asynchronous multiplayer using saved player builds, as in Backpack Battles and Super Auto Pets: **rival caravans**, copies of other players' parties met as a fight and played by the enemy AI ([ghosts.md](ghosts.md), D8, D9).

### 11.3 Example Distinct Mechanics (Illustrative, not decided)

| Rule bent | Example | What it tests |
|---|---|---|
| Track | **Two heads, two turns:** a boss with two separate track entries, each with its own action set. Pushing one head delays only that head. | Track control and target priority |
| Track | **Scheduled cataclysm:** recurring environmental events placed on the track as track entities (a collapsing ceiling, a flood). | Racing the clock; positioning before known events |
| Track | **Tempo tax:** an aura that increases action or movement cost for units near the boss. | Speed versus defence tradeoff; ranged versus melee |
| Space | **Multi-hex body:** a large boss occupying several hexes, with parts (arms, a shield) that can be targeted and destroyed separately. | Positioning; flanking over a larger footprint |
| Space | **Terrain shaper:** converts tiles into hazards or conceal over time. | Adapting to a changing map |
| Space | **Vulnerable only when flanked:** takes reduced damage unless flanked. | Positional play and movement cost decisions |
| Build | **Mimic:** copies the last ability used against it. | Build variety; punishes one-dimensional builds |
| Build | **Summoner:** schedules reinforcements on the track. | Burst builds (kill before arrival) versus sustain builds (outlast) |

### 11.3a The One-Eyed Giant, the Steppe's boss (Built 2026-10-28; the Steppe's stage 4 since later that day)
Tepegöz of the *Book of Dede Korkut* (setting.md, 15.6a), the one-eyed
giant whose hide turned Basat's arrows until Basat struck the eye. In the
game's text, the One-Eyed Giant (no real names, roster.md). Its bent rule
is **vulnerable only from the front** (11.3's "vulnerable only when
flanked", turned around), and its kit is the Steppe's own: a hit like the
wolves', and Snap Shot's lanes.

- **Stats (the builder's first numbers, untested):** speed 1, defence 5
  (health 12), power 3. `giant` in config.ts; not in the ROSTER, so the
  start menu doesn't offer it. The Steppe's fourth stage brings it with
  two wolves (`REGIONS.steppe.boss`; progression.md, 19.1), and so does
  the test stage (test-stage.json, as committed). Its sprite and portrait
  are the owner's AI-assisted art (2026-10-28; art-direction.md), its
  facing still drawn as an eye on its hex's edge.
- **One Eye** (a passive, `oneEye`, not offered at the caravanserai):
  Armour 3 (`ONE_EYE.armour`) against a hit, or a grapple's squeeze, from
  a unit not standing in its front lane, the line straight out the way it
  faces at any distance, whatever stands between. A Piercing hit
  (Longshot) ignores it, as it does any Armour (17.6). It starts the fight
  facing across the board, toward the party; it turns the way it last
  stepped on a walk, or toward what it aims at if that is in a straight
  line; a Push or Pull doesn't turn it (`Unit.facing`).
- **Smash:** melee, its power.
- **Boulder:** down any of Snap Shot's six lanes, the first unit in it hit
  for its power; then every other unit next to where it lands, ally or
  enemy, the giant aside, is Pushed 1 away from it, unhurt
  (`ABILITY.boulder.push`).
- **Seize, first proposed** (a grapple Stunning and squeezing for 3, as the
  Grappler's), was dropped before it was built (owner, 2026-10-28): the
  giant faced the unit it held, so the held unit stood in the only lane
  where the giant could be hurt, and nothing could break the hold. Smash
  and Boulder's Push took its place.
- **First measured (2026-10-28, 30 AI fights a line-up, the production
  AI on both sides, Humphrey in play):** the Steppe party beat the giant
  alone 30 of 30, with one wolf 30 of 30, with two wolves 29 of 30; about
  half of those wins were Humphrey reaching the road out. Health 20 and
  speed 2 changed little (29 to 30 of 30, more of them by Humphrey): the
  giant doesn't stop the camel. The AI found the front lane easily (about
  150 to 200 hits by the eye against 250 to 330 taken off by its hide).
  To tune before it enters a run.

---

### 11.4 Difficulty Scaling (Decided)
Difficulty rises over a run mainly by making enemies better built, not by inflating their stats. Enemies scale the same way players do, so difficulty stays readable through the design language and existing systems.

**Primary curve: enemy builds**
- **Gear rarity:** later enemies carry higher-rarity gear, following the same rarity rules as player gear (section 9).
- **Composition synergy:** early enemy groups have little synergy; later groups combine keywords deliberately (for example, one enemy displaces and another punishes displaced targets).
- **Unit count:** larger enemy groups later in the run, within a cap that keeps turns fast. Cap TBD.

**Layered on top**
- **Encounter pressure:**
  - Harder deployment layouts (split, surrounded, far from cover).
  - Harsher maps: more hazards, less conceal, sight lines that favor enemy ranged units.
  - Track pressure: reinforcements arriving sooner, scheduled cataclysms, more enemy push abilities.
  - Objectives beyond defeating all enemies: survive a number of slots, protect a unit, defeat a target before reinforcements arrive. Every fight already has one: the enemy is trying to kill the caravan's camel, and the camel reaching the exit wins ([camel.md](camel.md), decided 2026-10-21).
- **Elite affixes:** later regular enemies may carry one rule-bending trait drawn from the boss toolkit (section 11.3), such as a tempo-tax aura or being vulnerable only when flanked. This scales complexity rather than numbers.
- **Optional risk:** players can choose harder fights for better rewards (similar to Monster Train's Trials), letting strong builds push themselves and weaker builds play safe.

**Raw stats**
- Stat growth beyond what gear provides is kept small, if used at all.

**The run's enemy line-up (Decided, owner 2026-10-24)** is in [progression.md](progression.md) (19.5, 19.6): per region, 2 wolves and a hero, then a wolf and 2 heroes, then 3 heroes; wolves gain a little in stats each region; enemy heroes carry random upgrades and stat points, up to 10 points and 4 upgrades; the run ends on a boss that counters the player's build.

### 11.5 Open Questions on Difficulty
- Enemy unit cap per encounter.
- List of elite affixes and when they begin appearing.
- Objective types and how often they appear.
- Structure of optional risk choices (which fights, what reward).
- Whether enemy AI behavior improves over the run (focus fire, flanking, track manipulation).
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
