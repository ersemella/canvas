# Roguelike tactics: information and randomness

What players can see, previews, complete information, and randomness.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 7. Information and Visibility

### 7.1 What Players Can See (Decided)

| Information | Visible? | How |
|---|---|---|
| Map layout and all special tiles | Yes | Fully visible from the start of the fight. |
| All enemy units and their positions | Yes | Fully visible from the start of the fight (subject to the open question on conceal tiles, section 6.4). |
| Reinforcements | Yes | Shown on the track in advance, with a known arrival slot and spawn location. |
| Abilities of all units (allies and enemies) | Yes | Diegetic design language: visual cues on characters and gear indicate their abilities. Must be consistent across the whole game. |
| Action costs | Yes | Fixed and public for every ability. |
| Turn order | Yes | The track: a scrollable window of roughly the next 30 slots, with every unit's and track entity's card in its slot (never two in one), so players can count placement directly (3.2, 3.3). A charging card shows what it will trigger. Statuses show as a small marker on a unit's card; their exact slots appear in the tap preview. **Tapping a card previews it**: a unit's turn (who acts and when; with the unit's stats and ability options, enemies included), a charged ability (target and outcome) or a reinforcement (arrival and spawn hex), limited to what the player can know: enemy intent stays hidden. Default window size open (open question 1). |
| Stats (health, speed, defence, power) | Yes, every unit | Every unit has a stat sheet, enemies included (D11). |
| Action outcomes | Yes, before committing | Previews show full numbers (section 7.2). |
| Gear and recruits you're offered | Yes | Exact stats shown before you choose. **Players have full information;** only opponents' intent is hidden (D11). |
| Enemy options | Yes | Each enemy's ability options can be previewed with their effects (7.2). |
| Enemy intent (what an enemy plans to do next) | No | Not shown, except charged abilities already started (their card shows what they will trigger). |

### 7.2 Previews (Decided)
Before committing, the player sees:
- Damage dealt and the target's resulting health, with full numbers.
- The acting unit's resulting slot on the track, after any yielding.
- Any change to other units' positions (displacement).
- Whether line of fire to a target is clear, and which unit blocks it if not.
- For area abilities, every affected unit and the damage or effect each receives, allies included.
- While choosing a destination hex, the movement cost and resulting slot for that destination.

**Enemy options (Decided).** Selecting an enemy previews each ability it could use on its next turn, with the same detail as your own previews: the targets it could reach (after moving, within its movement cap), the damage and effects each would receive, displacement, pushes and pulls, and its resulting slot. The preview shows options, never which one the enemy will choose.

### 7.3 Rationale
- Enemy intent is not shown: this is a strategy game, and reading what an opponent might do, from options that are fully visible, is part of play. It also keeps PvE compatible with PvP, where a human's plan can't be revealed.
- Stats are shown for every unit, enemies included. Hidden enemy stats were revealed by the first full-number preview anyway, so they added a chore rather than uncertainty, and they made it harder to read an enemy's options.
- There is no fog of war (see 7.4).

### 7.4 Complete Information at Fight Start (Decided)
- Every fight starts with complete information: the full map, all special tiles, all enemy units, their positions and their abilities.
- There is no fog of war.
- Uncertainty comes only from opponents' decisions, not from unseen units, hidden stats or chance.
- Reinforcements are never a surprise: they appear on the track before they arrive (section 3.8).
- Information before the fight is a run-level concern: the run map may show partial information about upcoming encounters (for example, enemy types but not exact composition), so uncertainty affects build decisions rather than in-combat play. Run structure is out of scope for this document.
- Rationale: losses caused by unseen threats cannot be attributed to build or play. On compact maps, fog of war adds rules (vision ranges, line of sight) with little payoff. Previews and the track both assume all units are visible.
- Visible abilities, costs and track give both sides equal information.
- Full-number previews keep losses attributable: players always know what an action will do before taking it.

## 8. Randomness

### 8.1 Rules (Decided)
- **No chance to miss.** Every attack and ability that targets a valid unit hits.
- **No damage variance (Decided 2026-10-16).** Every damage, healing and effect value is a set number, computed from the ability, stats, gear and situation. Gear changes those numbers, never widens them into a range.
- **No critical hits, dodge chance, accuracy or evasion** (Decided 2026-10-16), nor deterministic stand-ins for them.

### 8.2 Rationale
- Roguelikes already generate variety at the run level (map layouts, rewards, enemy encounters, recruitment offers). Fully deterministic combat keeps every outcome attributable and every preview exact.
- Combat avoids a solved feeling through opponents' hidden intent and the track (goal 3), not through chance.
- No chance in combat means nothing to cap or argue about in PvP.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Fog of war | None; complete information at fight start | Full fog of war, line-of-sight vision | Preserves attribution; fog adds little on compact maps; previews and track assume full visibility |
| Reinforcements | Telegraphed on the track | Surprise arrivals | Pressure without unfair surprise |
| Enemy intent | Not shown; every enemy option can be previewed | Telegraphed intent | A strategy game: reading an opponent's likely choice from visible options is part of play; also supports possible PvP |
| Stats | Shown for every unit, enemies included (D11) | All stats hidden; enemy stats hidden but discoverable through previews | Hidden stats were revealed by the first preview anyway; complete information keeps outcomes attributable |
| Previews | Full numbers | Output only, health bars without numbers | Clear attribution of outcomes |
| Hit chance | None (always hit) | Percentage hit chance | Avoids frustrating misses and preserves attribution |
| Damage | Set numbers; no variance | Narrow capped variance from gear (until 2026-10-16); wide variance; critical hits | Exact previews and full attribution; hidden intent and the track keep combat from feeling solved |

## Open questions (from section 14, original numbers)

15. Design language specification: how abilities, rarity and action costs are communicated visually.
