# Roguelike tactics: information and randomness

What players can see, previews, complete information, and randomness.

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision.

From the combat design document (draft v1.7, owner, 2026-10-15). Rules
are marked **Decided** or **Proposed**; numbers marked TBD are tuning.
Section numbers are the original document's.

## 7. Information and Visibility

### 7.1 What Players Can See (Decided)

| Information | Visible? | How |
|---|---|---|
| Map layout and all special tiles | Yes | Fully visible from the start of the fight. |
| All enemy units and their positions | Yes | Fully visible from the start of the fight (subject to the open question on conceal tiles, section 6.4). |
| Reinforcements | Yes | Shown on the timeline as scheduled entries with a known arrival tick and spawn location. |
| Abilities of all units (allies and enemies) | Yes | Diegetic design language: visual cues on characters and gear indicate their abilities. Must be consistent across the whole game. |
| Action costs | Yes | Fixed and public for every ability. |
| Turn order | Yes | The timeline, including the resolved order of ties and any scheduled delayed actions. *(Revised 2026-10-15, owner:)* drawn as discrete pips or segments, one per tick, over a window of roughly the next 30 ticks; unit portraits, delayed actions and reinforcements sit on their pips, so players can count costs directly (3.3). Window size open (open question 1). |
| Stats (health, speed, defence, power, influence) | Not directly | No stat sheet. Rarity acts as a rough indicator of strength (section 9). Exact values become discoverable through previews and the timeline. **Revised 2026-10-15 (owner, D11):** this now applies to **enemy** units only; your own units' stats are fully viewable. |
| Action outcomes | Yes, before committing | Previews show full numbers (section 7.2). |
| Gear and recruits you're offered *(added (owner, 2026-10-15))* | Yes | Exact stats shown before you choose. **In general players have full information except for enemies' stats** (D11). |
| Enemy intent (what an enemy plans to do next) | No | Not shown, except delayed actions already declared on the timeline. |

### 7.2 Previews (Decided)
Before committing, the player sees:
- Damage dealt (or damage range, if variance applies) and the target's resulting health, with full numbers.
- The acting unit's resulting position on the timeline (the pip it lands on).
- Any change to other units' positions (pushes, pulls).
- Whether line of fire to a target is clear, and which unit blocks it if not.
- For area abilities, every affected unit and the damage or effect each receives, allies included.
- While choosing a destination hex, the movement cost and resulting timeline position for that destination.

Previews intentionally make stats discoverable. Attentive players can deduce health, defence, power and speed from previews and timeline behavior. Knowledge is earned through play rather than given in menus.

### 7.3 Rationale
- Enemy intent is not shown because the system may support PvP, where revealing a human opponent's plan is not possible.
- There is no fog of war (see 7.4).

### 7.4 Complete Information at Fight Start (Decided)
- Every fight starts with complete information: the full map, all special tiles, all enemy units, their positions and their abilities.
- There is no fog of war.
- Uncertainty comes from hidden stats (discoverable through play), narrow damage variance, and opponents' decisions, not from unseen units. (Since D11, 2026-10-15: enemies' hidden stats; your own are shown.)
- Reinforcements are never a surprise: they appear on the timeline before they arrive (section 3.8).
- Information before the fight is a run-level concern: the run map may show partial information about upcoming encounters (for example, enemy types but not exact composition), so uncertainty affects build decisions rather than in-combat play. Run structure is out of scope for this document.
- Rationale: losses caused by unseen threats cannot be attributed to build or play. On compact maps, fog of war adds rules (vision ranges, line of sight) with little payoff. Previews and the timeline both assume all units are visible.
- Visible abilities, costs and timeline give both sides equal information.
- Full-number previews keep losses attributable: players always know what an action will do before taking it.

## 8. Randomness

### 8.1 Rules (Decided)
- **No chance to miss.** Every attack and ability that targets a valid unit hits.
- **Damage is fixed by default.**
- **Gear introduces variance.** Gear can widen damage into a narrow range (for example, 5 to 6 instead of 5), and has a strong influence on whether and how much variance a character has.
- **Variance is always previewed** as a minimum and maximum.
- **Variance is capped.** A global maximum spread applies regardless of gear. Cap value TBD.

### 8.2 Rationale
- Roguelikes already generate variety at the run level (map layouts, rewards, enemy encounters). Keeping combat nearly deterministic preserves attribution.
- Narrow variance prevents combat from becoming precise, repetitive arithmetic.
- Tying variance to gear makes it partly a build decision.
- The cap protects PvP integrity.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Fog of war | None; complete information at fight start | Full fog of war, line-of-sight vision | Preserves attribution; fog adds little on compact maps; previews and timeline assume full visibility |
| Reinforcements | Telegraphed on the timeline | Surprise arrivals | Pressure without unfair surprise |
| Enemy intent | Not shown | Telegraphed intent | Supports possible PvP |
| Stats | Hidden, discoverable via previews | Fully shown | Avoids solved feeling; rewards learning |
| Previews | Full numbers | Output only, health bars without numbers | Clear attribution of outcomes |
| Hit chance | None (always hit) | Percentage hit chance | Avoids frustrating misses and preserves attribution |
| Damage | Fixed by default, narrow capped variance via gear | Fully fixed, wide variance | Avoids solved feeling while staying predictable |

## Open questions (from section 14, original numbers)

13. Global variance cap value.
15. Design language specification: how abilities, rarity and action costs are communicated visually.
