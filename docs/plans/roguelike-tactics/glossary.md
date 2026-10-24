# Roguelike tactics: glossary

Definitions of the combat design's terms. Look terms up here; no need to read it through.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 2. Glossary

| Term | Definition |
|---|---|
| **Roguelike** | A game structured as a series of independent attempts ("runs"). Each run has randomized content, and progress within a run is lost when it ends. |
| **Run** | One full attempt through the game, from start to victory or defeat. |
| **Bridge gear** | Gear that converts or links keywords (for example, Push effects also apply Burn), letting unexpected pairings work (9.7). Proposed. |
| **Build** | A player's choices outside of combat: which characters are in the party (composition) and which gear each character has equipped. |
| **Composition** | The specific set of characters in the party. |
| **Party** | The group of characters a player controls in combat. Maximum of 4 heroes; the camel isn't one of them. |
| **Camel** | The caravan's camel, Temee: a unit that can't attack and walks one space a turn toward the exit (by itself while the game is pared back). It reaching an exit wins the fight; its death is game over; its damage carries over between fights (18). It starts last, at slot 12 (3.4). |
| **Exit hex** | The hex the camel reaching wins the fight: the bottom row's last hex while the game is pared back (18.2). |
| **Unit** | Any combatant on the map, whether player-controlled or enemy. |
| **Turn** | A single unit's opportunity to act. Turns are individual, not per side. |
| **Track** | The row of numbered slots that sets turn order. Every unit and track entity has a card in one slot; the track advances slot by slot and each card acts when reached (3.1). After each turn a card goes its unit's action cost on. Drawn as a window of roughly the next 30 slots; tapping a card previews it (7.1). |
| **Slot** | One position on the track. Durations are measured in slots. Two cards never share a slot. |
| **Card** | A unit's or track entity's marker on the track. |
| **Placement** | Where a card goes after a turn: 60 ÷ (speed + 5) slots on, rounded (the action cost), whatever the turn did (3.2). |
| **Speed** | A unit stat that sets its action cost (60 ÷ (speed + 5) slots), its starting slot, and the order of cards placed at the same moment. See section 4. |
| **Collision** | A card placed on an occupied slot. The faster card keeps the slot and the other moves on to the next; on equal speeds the arriving card yields (3.3). |
| **Push / Pull / Move** | Displacement: putting a unit on a different space, away from the source (Push), toward it (Pull) or to a stated space (Move) (17.4). Always the board; see Delay and Haste for the track. Until 2026-10-23 called Displace. |
| **Delay** | Moves a card later on the track (3.5), within the delay limit (3.6). Never board movement. Until 2026-10-23 called Push. |
| **Haste** | Moves a card earlier on the track, never earlier than the next slot, within the haste limit (3.5, 17.3). Never board movement. Until 2026-10-23 called Pull. |
| **Status** | A keyword effect on a unit for as long as its source states, such as Burn, Immobilized or Stunned; public, shown on its stat sheet and the board (17.2). |
| **Track entity** | A card that acts independently of the character who created it, for example a summoned zombie (3.7). |
| **Action** | The single ability a unit uses on its turn, or a walk instead. Required: an action ends the turn (5.1). |
| **Walk** | A unit moving itself across spaces on its turn, instead of an ability: up to 3 spaces (5.1). |
| **Ability** | Any action a unit can perform, including basic attacks. Abilities are granted by characters and gear. |
| **Hex / hex grid** | The map is divided into hexagonal tiles ("hexes"). Each hex has 6 neighbors. |
| **Adjacent** | Two hexes that share an edge. |
| **Line of fire** | The straight path between a direct ranged attacker and its target. Must be clear of units for the attack to reach the target. Defined in section 6.7. |
| **Area ability** | An ability that affects every unit in a set of hexes rather than a single target. |
| **Arcing attack** | A ranged attack that travels over units and ignores line of fire, at a higher cost. |
| **Friendly fire** | Damage or effects applied to a unit's own allies. |
| **Map modifier** | Any feature of the map beyond plain, walkable hexes, such as obstacles or hazards. |
| **Diegetic** | Information communicated through the game world itself (character appearance, gear visuals, animations) rather than through menus or text overlays. |
| **Design language** | A consistent set of visual conventions (shapes, colors, silhouettes, effects) that let players recognize what something does without reading a description. |
| **Stats** | Numerical attributes of a unit or item: speed, defence and power, small whole numbers, and health from defence. See section 9.1. |
| **Health** | A unit's hit points: (1 + defence) × 2 (9.1). |
| **Defence** | A stat that sets health (9.1). Damage reduction is the Armour keyword (17.6). |
| **Power** | The one offensive stat: exactly the damage each of the unit's abilities deals (9.2). |
| **Gear slot** | One of four equipment positions on a hero: boots, gloves, armour, helmet. |
| **Signature weapon** | A hero's unique weapon. Part of the hero's identity and abilities; not a gear slot and not swappable. |
| **Consumable** | A single-use item held in the party's shared inventory, used only between fights: a stat buff or status for the next combat, or health recovery (9.6). |
| **Milestone upgrade** | Replaced 2026-10-24 by the upgrade offer (19.3). Was: a hero-specific adjustment to one of that hero's abilities, chosen at set points in a run (10.9). |
| **Provisions** | Working name for stat points: 1 at the end of each region's first and second stages, each +1 to one hero's speed, defence or power; the region's own can be reassigned after its third stage's fight, then locked (19.2). |
| **Upgrade offer** | After each region's third stage's fight, 3 upgrades from fixed slots (hero, passive, wildcard), of which the party picks 1 (19.3). |
| **Keyword** | A named, shared condition or effect (for example Burn, Push, Stunned) that abilities, gear and upgrades all reference. The keyword vocabulary is the main source of synergy (10.8); the list is in [keywords.md](keywords.md). |
| **Recruitment offer** | A small, random set of heroes offered between fights, from which the player may recruit (10.6). |
| **Ghost team / ghost build** | A saved party build from another player, used as an opponent. **Decided 2026-10-15:** ghosts are **rival caravans**, met as a fight; see [ghosts.md](ghosts.md) (D8). |
| **Deployment zone** | The set of hexes where a side places its units before a fight (6.6). |
| **Elite affix** | A single rule-bending trait, drawn from the boss toolkit, carried by a stronger regular enemy (11.4). |
| **Tank / Damage / Support** | The three mechanical roles of heroes: protecting allies, dealing damage, and healing, buffing or controlling (15.8). |
| **Caravanserai** | A roadside inn on the Silk Road; in the setting, a rest point between fights (15.3). |
| **Preview** | A display of an action's exact outcome, shown before the player commits to it. |
| **Deterministic** | Producing the same result every time given the same inputs. No chance-based outcomes. |
| **Rarity** | A tier assigned to gear indicating its relative power. |
| **PvP (Player versus Player)** | Matches where two human players control opposing parties. |
| **PvE (Player versus Environment)** | Matches against computer-controlled enemies. |
| **TBD** | To be determined. A value or rule not yet decided. |
| **Rival caravan** | An AI-controlled copy of another player's party, met as a fight on its own map; the game's ghosts. See [ghosts.md](ghosts.md). |
| **Route map** | The run's map of the road, with route choices between nodes (fights, rests, bazaars, recruitment), as in Slay the Spire. |
| **Stage** | A run's **position along the road** on the route map (its row or step); rival caravans are matched by it, and difficulty scales with it. |
| **Region** | One of the six civilizations a run passes through, in order: Steppe (Mongol and Turkic), China, India, Persia, Arabia, Byzantine. Each has 3 stages, the Byzantine 4 (15.3a, 19.1). |
| **Party wipe** | Every hero in the party dead; the run ends. A rival caravan that wipes a party counts a kill (D9). |
