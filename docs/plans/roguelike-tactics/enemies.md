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

### 11.3a The Cyclops, the Steppe's boss (Built 2026-10-28; the Steppe's stage 4 since later that day)
Tepegöz of the *Book of Dede Korkut* (setting.md, 15.6a), the one-eyed
giant whose hide turned Basat's arrows until Basat struck the eye. In the
game's text **the Cyclops** (owner, 2026-10-28: the bosses are named
directly; the One-Eyed Giant before, under roster.md's no real names). Its bent rule
is **vulnerable only from the front** (11.3's "vulnerable only when
flanked", turned around), and its kit is the Steppe's own: a hit like the
wolves', and Snap Shot's lanes.

- **Stats (the builder's first numbers, untested):** speed 1, defence 5
  (health 12), power 3. `giant` in config.ts; not in the ROSTER, so the
  start menu doesn't offer it. The Steppe's fourth stage brings it with
  two wolves (`REGIONS.steppe.boss`; progression.md, 19.1). Its sprite and portrait
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
- **Its map, the Cyclops's cave** (`cave`, owner, 2026-10-28: each boss
  fight on a map of its own): the Steppe's board on a cave's stone floor
  with nothing on it, no mountains and no yurts (`CAVE` in map.ts); the
  Steppe's fourth stage is fought there (`STAGES`). The floor is the
  owner's art (AI-assisted, 2026-10-28; art-direction.md, "Prompts for
  the cave floor").

### 11.3b The Bull Demon King and Princess Iron Fan, China's boss (Built 2026-10-28; China's stage 4 since later that day)
The Bull Demon King and Princess Iron Fan of *Journey to the West*,
named so in the game's text too (owner, 2026-10-28; the Ox King and the
Fan Lady before, under roster.md's no real names). Their bent rule
is **two units whose cards are linked** (11.3's "two heads, two turns"),
and they are fought in the Flaming Mountains, from the same novel: the
fire hazard the art doc kept for the region's boss (art-direction.md).

- **Stats (the owner's):** the Ox King speed 1, defence 5 (health 12),
  power 3; the Fan Lady speed 3, defence 2 (health 6), power 1. `oxKing`
  and `fanLady` in config.ts; not in the ROSTER, so the start menu
  doesn't offer them. China's fourth stage brings the two of them, nothing
  else (`REGIONS.china.boss`, owner, 2026-10-28; a region's boss is one
  unit or two), and so does the test stage (test-stage.json,
  as committed: China's three heroes against the two of them on
  `fireMountain`).
  Their sprites and portraits are the owner's AI-assisted art
  (2026-10-28; art-direction.md).
- **Devoted** (a passive, `devoted`, both carry it, not offered at the
  caravanserai): whenever one of them is hit, any damage coming at it
  (a Shield's too, not damage Armour takes off whole), the other's card is
  Hastened 3 (`DEVOTED.haste`, Swift Strike's number). A fire's burn
  counts, so the Fan Lady blowing the Ox King into her own fire Hastens
  her.
- **Gore** (the Ox King's): Trample as first built, still in the code as
  `ABILITY.stomp.mode: 'charge'` and now shared with it (`resolveCharge`
  in abilities.ts): a walk of up to 2 (`ABILITY.gore.steps`) in a line,
  every unit in its way, a whole row together, hit for his power and Pushed
  back ahead of him; a row that can't be Pushed stops him behind it.
  Gore is a charge whatever Stomp's mode.
- **Iron Fan** (the Fan Lady's; the Banana-leaf Fan until 2026-10-28,
  renamed with her fan's redesign): every unit in a line of 3 straight
  out from her (`ABILITY.bananaFan`), ally or enemy, is Pushed 2 along it,
  the farthest first. No damage of its own: the fire does it.
- **Fan the Flames** (the Fan Lady's): aimed at an open space within 3
  (`ABILITY.fanFlames.range`; owner, 2026-10-28, once her map lost its
  ridges), it and the open spaces next to it, up to seven, catch fire
  until her next turn (`FireEffect`, `FightState.fires`), any fire of hers
  before going out. Lighting a space doesn't burn whoever stands there;
  **entering** one deals 1 (`ABILITY.fanFlames.burn`), as the fissures
  tried on 2026-10-26 did, walking or Moved in, a space at a time, credited
  to her. Walks of the same length prefer the one through fewer fires,
  and Humphrey steps round fire where a step as near is.
- **The map, `fireMountain`** (owner, 2026-10-28: each boss fight on a
  map of its own, theirs the Flaming Mountains with no obstacles shown):
  the Flaming Mountains' red earth with nothing on it, no beacon tower,
  scorched ground or mountains (`FIRE_MOUNTAIN` in map.ts), so the only
  fire is hers. Before it, the same day, `ridges`: the red earth and
  beacon tower with two or three burning ridges, single mountain spaces
  within 3 of the centre, Fan the Flames aimed at one of them anywhere on
  the board and its open neighbours alight; a fight saved there still
  loads (`MAPS.ridges`). China's fourth stage is fought here, its first
  three in the Gobi. Three AI-vs-AI fights of that stage (the production
  AI, China's party, 2026-10-28) were all won by the party, in 50 to 66
  turns, the fan dropped in each: untuned, as the Cyclops is.
- **China's tools against them** (as the owner set out; each checked in
  `bosses.test.ts`): the Vanguard's Cleave through both Hastens each by 3
  and then Delays each by 8, a net Delay of 5 on both; the Duelist,
  Empowered 2 by the Alchemist, fells the Fan Lady in two strikes; the
  Alchemist's Weaken 2 on the Ox King cuts Gore to 1.
- **Her fan, redesigned** (owner, 2026-10-28): an **iron folding fan**,
  for Princess Iron Fan, in place of the green banana leaf. The fan she
  drops is drawn in code as one, open, grey iron pleats under a gilt rim
  on dark sticks and a gold rivet (`drawFan` in ground.ts); her sprite
  and portrait still hold the leaf until the owner's art from the prompts
  in art-direction.md ("Prompts for Princess Iron Fan's iron fan").
- **The fan she drops** (the owner's optional extra, built): when the Fan
  Lady falls her fan lies where she fell (`FightState.fan`), and the fires
  she set burn on, as her next turn won't come (the builder's reading). A
  hero entering the space picks it up (`Unit.fan`; not Humphrey, not the
  enemy) and gains a third action, **Borrowed Fan** (`quench`): a turn
  putting out every fire on the board, the fan then spent, as Sun Wukong
  borrows it in the novel.
- **The AI:** the search plays the fire as it plays hail; its first
  guess counts what the Fan's line would be blown into, and a turn's score
  counts each unit next to a fire of the other side as half a burn
  (`AI.fireShare`, a PLACEHOLDER) so lighting fire by enemies is worth
  something before anyone is Pushed in.
- **First measured (2026-10-28, 20 AI fights, the production AI on both
  sides, Humphrey in play, the committed test stage):** China's party won
  20 of 20, 12 by felling both, 8 by Humphrey reaching the road out; 19
  burns from the fire across the 20, 131 Devoted Hastes; the Fan Lady fanned the
  flames 67 times and swept the fan 22, the Ox King gored 41 times. Like
  the giant, too easy as it stands: to tune before it enters a run.
- **Not China's stage 4 yet** (`REGIONS.china.boss` is still null, so
  that stage brings China's three heroes in the Gobi): a region's `boss`
  is one hero and its stage's map the region's, so putting them in takes a
  list of bosses and stage 4 fought on `ridges`.

### 11.3c Zahhak, Persia's boss (Built 2026-10-29; Persia's stage 4)
Zahhak of the *Shahnameh* (setting.md, 15.6a), the tyrant king on whose
shoulders Iblis's kisses grew two serpents, which grew back each time
they were cut off; Fereydun beat him and chained him under Mount Damavand.
The boss setting.md proposed for "two heads, two turns": **each serpent
is its own unit with its own card** (11.3), and the rule bent is
**Immortal** (17.6), held by the serpents, with 11.3's Summoner: a fallen
serpent's return is a card on the track. The answer is to cut both
serpents down, then hit the king before they grow back. Builder's design
and first numbers, untested; the owner's to change.

- **Stats (the builder's first numbers):** Zahhak speed 1, defence 4
  (health 10), power 3; each serpent speed 3, defence 0 (health 2), power
  1. `zahhak` and `serpent` in config.ts, not in the ROSTER. Persia's
  fourth stage brings Zahhak and two serpents, nothing else
  (`REGIONS.persia.boss`), and so does the test stage as committed,
  against Persia's three heroes. Lettered discs (Z, N) until their art,
  from the prompts in art-direction.md ("Prompts for Zahhak and his
  serpents").
- **Serpent King** (Zahhak's passive, `serpentKing`, not offered at the
  caravanserai): while either serpent is on the board, no damage reaches
  his health (`guarded` in resolve.ts), as Immortal: a Shield still takes
  it first. Pierce doesn't get past it.
- **Regrow** (the serpents' passive, `regrow`, not offered): a serpent
  cut down while Zahhak stands grows back `REGROW.slots` (12) slots after
  it fell, about one turn of every unit on the board, its card greyed on
  the track meanwhile (`Unit.regrowAt`). When the card comes up it returns
  at full health, with nothing on it, on the open space next to him
  nearest the party, and takes its turn there (as any card placed on a
  slot, 3.3). With every space next to him taken it waits until after
  the next card. Once Zahhak falls, neither grows back, and the fight is
  won when he and the serpents are all down. The greyed card can't be
  Delayed or Hastened: only a unit on the board can.
- **Feed the Serpents** (Zahhak's, `feed`): melee, his power, and each
  serpent growing back does so `ABILITY.feed.sooner` (3) slots sooner, at
  the soonest the next slot. The *Shahnameh*'s serpents were fed on
  young men's brains; the game says only that he seizes a unit for them.
- **The serpents walk free**, as wolves do, though they grow from his
  shoulders: the builder's simplest reading. A tether (a serpent's walk
  ending within 2 of him) is the owner's to add if they read wrong.
- **Bite** (the serpents', the wolf's): melee, their power.
- **The map, `palace`**: Zahhak's palace, the Steppe's board with
  nothing on it (`PALACE` in map.ts), as the other bosses' maps; drawn
  with the Salt Flats' crust (`LOOKS.palace`) until the owner's floor art
  from the prompt in art-direction.md ("Prompts for Zahhak's palace
  floor"). Mount Damavand, where he is chained, was the other choice; the
  palace, where Fereydun found him, keeps the region's turquoise tile.
- **First measured (2026-10-29, 12 AI fights a line-up, the production
  AI on both sides, Humphrey in play):** much harder than the Cyclops or
  the Bull Demon King, and won by the camel, not by killing him. Persia's
  party (Ranger, Juggernaut, Magus) won 7 of 12, every one by Humphrey
  reaching the road out, and lost 5; China's party won 10 of 12, again
  all by Humphrey. Zahhak fell in none of the 24. With the serpents
  growing back after 20 slots Persia's party won 11 of 12 (all by
  Humphrey), after 30 slots 12 of 12 (one by killing him). The AI hits
  him while he is guarded (about 17 wasted hits a fight in China's
  party): it doesn't yet aim for the serpents first. To tune before the
  run's last stage is fair: Regrow's slots, his health, and the AI's
  score of a hit that a guard turns away.

### 11.3d The road out sealed while a boss stands (Built 2026-10-29)
The owner's call (2026-10-29), for every boss: while one stands, the road
out is **sealed**. Humphrey walks up to the exit and waits beside it, and
reaching it wins nothing, until the last boss falls; then his next step
out wins as before. Moved onto the exit meanwhile, he stands there and wins
as the last boss falls. A boss is a hero with `boss: true` (`HeroStats.boss`
in config.ts): the Cyclops, the Bull Demon King and Princess Iron Fan (both
must fall), and Zahhak, not his serpents, who stop growing back once he
falls. The wolves don't keep it shut. `exitSealed` (board.ts) is the rule;
`stepToExit` and `checkEnd` (resolve.ts) apply it. The board draws a
sealed exit with a solid border and a still cross in place of the
bouncing chevrons, and its card reads "Road out, sealed".

- **Why** (2026-10-28 measurements, `boss-seal.mjs`'s question): in fresh
  fights against every party of three, 60% to 90% of the boss wins ended
  with an enemy still standing, Humphrey walking out; in whole runs the
  boss stages were won about 30 points more often than the stage before
  each (the Cyclops 77.3% against Steppe 3's 48.6%, the Bull Demon King
  and Princess Iron Fan 88.2% against China 3's 52.5%).
- **Measured** (2026-10-29, `scripts/balance/experiments/boss-seal.mjs`:
  every party of three, 30 whole runs each, the production AI on both
  sides, sealed and open on the same seeds; a stalled fight, 400 actions
  without an end, counted lost):

  | Boss stage | Open | Sealed | Stage before it |
  |---|---|---|---|
  | The Cyclops (Steppe 4) | 79.5% | 53.4% (241 stalls) | 55.3% |
  | The Bull Demon King and Princess Iron Fan (China 4) | 90.2% | 75.0% (25 stalls) | 50.4% |
  | Zahhak (Persia 4) | 93.7% | 2.2% (1 of 45; 9 stalls) | 69.2% |

  Runs won fell from 0.89% to 0.01% (1 of 6,600). The Cyclops is now about
  as hard as the stage before it; parties of the Outrider and the Storm
  Caller with no tank won none of their attempts (One Eye's Armour turns
  their hits). China's pair is still the region's easiest stage. Zahhak,
  who fell in none of his first 24 fights, almost never falls: his
  serpents grow back, Humphrey waits at the sealed exit, and the enemy
  wears him down. Merged as it is, to be tuned later (owner, 2026-10-29).

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
