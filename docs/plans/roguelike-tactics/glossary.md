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
| **Build** | A player's choices outside of combat: which characters are in the party (composition) and which gear each character has equipped. |
| **Composition** | The specific set of characters in the party. |
| **Party** | The group of characters a player controls in combat. Maximum of 4. |
| **Unit** | Any combatant on the map, whether player-controlled or enemy. |
| **Turn** | A single unit's opportunity to act. Turns are individual, not per side. |
| **Track** | The row of numbered slots that sets turn order. Every unit and track entity has a card in one slot; the track advances slot by slot and each card acts when reached (3.1). Drawn as a scrollable window of roughly the next 30 slots; tapping a card previews it (7.1). |
| **Slot** | One position on the track. Durations are measured in slots. Two cards never share a slot. |
| **Card** | A unit's or track entity's marker on the track. |
| **Placement** | How far a card moves after a turn: (action cost + movement cost) ÷ (speed + C), rounded down, at least 1 slot (3.2). |
| **C** | A global constant added to speed in the placement formula; a larger C flattens speed's effect. |
| **Action cost** | The fixed cost of the action used on a turn, on a fine-grained scale (a basic attack is about 100). Every ability defines its own. |
| **Movement cost** | The cost added by moving: a fixed amount per hex moved, divided by speed like the action cost. |
| **Standard turn** | A reference turn with a typical action and typical movement. Used to anchor tuning; not a separate rule. |
| **Quick / slow action** | An action whose cost is lower / higher than a typical action. |
| **Speed** | A unit stat that divides action and movement cost (placement), sets the starting slot, and orders cards placed at the same moment. See section 4. |
| **Collision** | A card placed on an occupied slot. The arriving card yields to the next free slot (3.3). |
| **Push** | Physically moves a unit away from the attacker by a number of hexes ([phase-1-brief.md](phase-1-brief.md), section 3). Not a track effect; see Delay. |
| **Delay** | An effect that moves a card later on the track (3.5), within the delay limit (3.6). |
| **Charged ability** | An ability with a charge cost and a recovery cost: the character's card first moves by the charge cost; when reached, the ability triggers and the card moves by the recovery cost (3.7). |
| **Track entity** | A card that acts independently of the character who created it, for example a summoned zombie (3.7). |
| **Action** | The single ability or attack a unit uses on its turn. Required: an action ends the turn (5.1). |
| **Move** | Relocating a unit across hexes on its turn. Optional. |
| **Ability** | Any action a unit can perform, including basic attacks. Abilities are granted by characters and gear. |
| **Hex / hex grid** | The map is divided into hexagonal tiles ("hexes"). Each hex has 6 neighbors. |
| **Adjacent** | Two hexes that share an edge. |
| **Flanking** | A positional bonus gained by surrounding an enemy. Defined in section 6.3. |
| **Line of fire** | The straight path between a direct ranged attacker and its target. Must be clear of units for the attack to reach the target. Defined in section 6.7. |
| **Area ability** | An ability that affects every unit in a set of hexes rather than a single target. |
| **Arcing attack** | A ranged attack that travels over units and ignores line of fire, at a higher cost. |
| **Friendly fire** | Damage or effects applied to a unit's own allies. |
| **Map modifier** | Any feature of the map beyond plain, walkable hexes, such as obstacles or hazards. |
| **Diegetic** | Information communicated through the game world itself (character appearance, gear visuals, animations) rather than through menus or text overlays. |
| **Design language** | A consistent set of visual conventions (shapes, colors, silhouettes, effects) that let players recognize what something does without reading a description. |
| **Stats** | Numerical attributes of a unit or item: health, speed, defence, power and influence. See section 9.1. |
| **Health** | A hero's hit points. Set per hero and mostly fixed for the run. |
| **Defence** | A stat that reduces incoming damage by a percentage with diminishing returns (section 9.1). |
| **Power** | A stat that scales direct damage. |
| **Influence** | A stat that scales effect strength: status effects, push distance, healing and shields. Working name (section 9.2). |
| **Gear slot** | One of four equipment positions on a hero: boots, gloves, armour, helmet. |
| **Signature weapon** | A hero's unique weapon. Part of the hero's identity and abilities; not a gear slot and not swappable. |
| **Consumable** | A single-use item held in the party's shared inventory, used only between fights: a stat buff or status for the next combat, or health recovery (9.6). |
| **Milestone upgrade** | A choice of ability upgrade offered to a hero at set points in a run. |
| **Ultimate** | A hero's most powerful ability, usable once per combat. It may be an action, a charged ability or a track entity (3.7). |
| **Keyword** | A named, shared condition or effect (for example burn, push, on-flank, on-kill) that abilities, gear and upgrades all reference. The keyword vocabulary is the main source of synergy (10.8). |
| **Recruitment offer** | A small, random set of heroes offered between fights, from which the player may recruit (10.6). |
| **Ghost team / ghost build** | A saved party build from another player, used as an opponent. **Decided 2026-10-15:** ghosts are **rival caravans**, met as a fight; see [ghosts.md](ghosts.md) (D8). |
| **Deployment zone** | The set of hexes where a side places its units before a fight (6.6). |
| **Elite affix** | A single rule-bending trait, drawn from the boss toolkit, carried by a stronger regular enemy (11.4). |
| **Tank / Damage / Support** | The three mechanical roles of heroes: protecting allies, dealing damage, and healing, buffing or controlling (15.8). |
| **Caravanserai** | A roadside inn on the Silk Road; in the setting, a rest point between fights (15.3). |
| **Preview** | A display of an action's exact outcome, shown before the player commits to it. |
| **Variance** | A range of possible values for a result, such as damage of 5 to 6 instead of exactly 5. |
| **Deterministic** | Producing the same result every time given the same inputs. No chance-based outcomes. |
| **Rarity** | A tier assigned to gear indicating its relative power. |
| **PvP (Player versus Player)** | Matches where two human players control opposing parties. |
| **PvE (Player versus Environment)** | Matches against computer-controlled enemies. |
| **TBD** | To be determined. A value or rule not yet decided. |
| **Rival caravan** | An AI-controlled copy of another player's party, met as a fight on its own map; the game's ghosts. See [ghosts.md](ghosts.md). |
| **Route map** | The run's map of the road, with route choices between nodes (fights, rests, bazaars, recruitment), as in Slay the Spire. |
| **Stage** | A run's **position along the road** on the route map (its row or step); rival caravans are matched by it, and difficulty scales with it. |
| **Party wipe** | Every hero in the party dead; the run ends. A rival caravan that wipes a party counts a kill (D9). |
